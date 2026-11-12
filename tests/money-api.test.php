<?php

// php tests/money-api.test.php /path/to/api/gastoteca/mistergastos.php
// Real calculation and read methods, fake storage; no constructor or account IO.
require __DIR__ . '/quick-template-api.test.php';

foreach (array('0.29' => 29, '1.13' => 113, '99999999.00' => 9999999900, '-0.29' => -29) as $input => $expected)
    check(GastotecaMoney::cents($input) === $expected, 'Decimal cents must parse exactly: ' . $input);
foreach (array(true, array(), null, '', '1e2', INF, NAN, '0.001', '1.005', '1.999') as $input)
    check(GastotecaMoney::cents($input) === null, 'Do not coerce invalid money or silently round a fraction of a cent');
check(GastotecaMoney::amount('1.234,56', true) === 1234.56, 'Spanish thousands and decimal separators');
foreach (array('1.2.3,45', '1,234', '1.2345', 'NaN', '99999999.001') as $input)
    check(GastotecaMoney::amount($input, true) === 0, 'Malformed and fractional-cent amounts rejected');

$api = apiFor('alice', new TemplateTestConnection());
$calculate = new ReflectionMethod('mistergastos', 'calculateParticipantShares'); $calculate->setAccessible(true);
$split = function ($amount, $uids, $mode = 'equal', $input = array()) use ($calculate, $api) { return $calculate->invoke($api, $amount, $uids, $mode, $input); };
check($split('0.02', array('a', 'b', 'c', 'd')) === array('a' => 0, 'b' => 0, 'c' => 0.01, 'd' => 0.01), 'Tiny equal splits cannot go negative');
check($split('0.01', array('a', 'b', 'c'), 'percent', array('a' => 50, 'b' => 50, 'c' => 0)) === array('a' => 0, 'b' => 0.01, 'c' => 0), 'Zero percent receives no rounding residue');
check(isset($split('0.01', array('a', 'b'), 'amount', array('a' => '0.005', 'b' => '0.005'))['error']), 'Amount shares cannot contain fractions of a cent');
check(isset($split('1.00', array('a', 'b'), 'percent', array('a' => '50.001', 'b' => '49.999'))['error']), 'Percentages have at most two decimals');
check(isset($split('1.00', array())['error']), 'Empty participants cannot divide by zero');

// Stop at the first write boundary: exercise the real endpoint validation
// without writing movements or recurring rules to any account.
class IncomeValidationPassed extends RuntimeException {}
class IncomeValidationConnection extends TemplateTestConnection
{
    public $recurringPayload;
    public function begin_transaction() { throw new IncomeValidationPassed(); }
    public function execute($sql, $values) {
        if (strpos($sql, 'INSERT INTO mg_recurring_expenses') === 0) {
            $this->recurringPayload = json_decode($values[2], true);
            throw new IncomeValidationPassed();
        }
        return parent::execute($sql, $values);
    }
}
$incomeStorage = new IncomeValidationConnection();
$incomeApi = apiFor('alice', $incomeStorage);
foreach (array(true, false) as $all) {
    $_POST = array('transaction_type' => 'income', 'name' => 'Ingreso', 'amount' => '10.00', 'paid_by_uid' => 'alice', 'applies_to_all' => $all, 'participant_uids' => array('alice'), 'share_mode' => 'percent', 'participant_shares' => $all ? array('alice' => 50, 'bob' => 50) : array('alice' => 100), 'frequency' => 'monthly', 'next_at' => '2099-11-03T12:00');
    foreach (array('save_expense', 'save_recurring') as $endpoint) {
        try {
            $incomeApi->$endpoint();
            check(false, 'Income endpoint rejected a valid recipient-inclusive split: ' . $endpoint);
        } catch (IncomeValidationPassed $expected) {}
    }
    check($incomeStorage->recurringPayload['participant_uids'] === ($all ? array('alice', 'bob') : array('alice')), 'Recurring income preserves the selected recipient');
}

$preserve = new ReflectionMethod('mistergastos', 'preservedParticipantShares'); $preserve->setAccessible(true);
$original = array('share_mode' => 'percent', 'transaction_type' => 'expense', 'amount' => 999999.99, 'participants' => array(array('uid' => 'alice', 'share_amount' => 333333.33), array('uid' => 'bob', 'share_amount' => 666666.66)));
check($preserve->invoke($api, $original, 999999.99, array('alice', 'bob'), 'percent', 'expense') === array('alice' => 333333.33, 'bob' => 666666.66), 'Nonfinancial edits preserve large original cent allocations');
check($preserve->invoke($api, $original, 1, array('alice', 'bob'), 'percent', 'expense') === null, 'Changed amounts must be recalculated');
check($preserve->invoke($api, $original, 999999.99, array('alice'), 'percent', 'expense') === null, 'Changed participants must be recalculated');
$original['participants'][0]['share_amount'] = -0.01;
check($preserve->invoke($api, $original, 999999.99, array('alice', 'bob'), 'percent', 'expense') === null, 'Never preserve invalid historical shares');

mt_srand(729);
for ($i = 0; $i < 10000; $i++) {
    $total = mt_rand(1, 9999999900);
    $weights = array();
    for ($j = 0; $j < 2 + $i % 12; $j++) $weights[] = mt_rand(1, 9999999900);
    $weights[] = 0;
    $shares = GastotecaMoney::allocate($total, $weights);
    check(array_sum($shares) === $total && min($shares) >= 0 && end($shares) === 0, 'Weighted allocation must conserve every cent and zero weight');
    foreach ($shares as $index => $share) {
        $exact = $total * ($weights[$index] / array_sum($weights));
        check(abs($share - $exact) < 1.00001, 'Every weighted share is within one cent of its exact quota');
    }
}
for ($count = 1; $count <= 60; $count++) {
    foreach (array(1, 2, 3, 10, 29, 100, 1000, 9999999900) as $total) {
        $shares = GastotecaMoney::allocate($total, array_fill(0, $count, 1));
        check(array_sum($shares) === $total && max($shares) - min($shares) <= 1 && min($shares) >= 0, 'Equal allocations must be balanced and exact');
    }
}

// Exercise each monetary write's validation before it reaches any write query.
foreach (array('0.001', '1.005', 'abc', INF, NAN, array(), true) as $invalid) {
    $_POST = array('name' => 'Prueba', 'amount' => $invalid, 'paid_by_uid' => 'alice');
    check($api->save_expense()['code'] === 'INVALID_AMOUNT', 'Movement validation rejected invalid money');
    $_POST['frequency'] = 'monthly'; $_POST['next_at'] = '2026-11-03T12:00';
    check($api->save_recurring()['code'] === 'INVALID_AMOUNT', 'Recurring validation rejected invalid money');
    $_POST['monthly_limit'] = $invalid; $_POST['category'] = 'food';
    check($api->save_budget()['code'] === 'INVALID_BUDGET', 'Budget validation rejected invalid money');
    $_POST['payer_uid'] = 'alice'; $_POST['payee_uid'] = 'bob';
    check($api->save_settlement()['code'] === 'INVALID_SETTLEMENT', 'Settlement validation rejected invalid money');
}

class MoneyTestConnection extends TemplateTestConnection
{
    public $expenses = array(); public $participants = array(); public $settlements = array();
    public $recurringPayload;
    public function query($sql) {
        if (strpos($sql, 'SELECT expense_id,uid,share_amount') === 0) return new TemplateTestResult($this->participants);
        if (strpos($sql, 'SELECT et.expense_id,t.name') === 0) return new TemplateTestResult(array());
        throw new RuntimeException('Unexpected raw query: ' . $sql);
    }
    public function execute($sql, $values) {
        if (strpos($sql, 'INSERT INTO mg_recurring_expenses') === 0) { $this->recurringPayload = json_decode($values[2], true); return array(); }
        if (strpos($sql, 'SELECT e.id,e.transaction_type') === 0) return $this->expenses;
        if (strpos($sql, 'SELECT id,payer_uid,payee_uid') === 0) return $this->settlements;
        return parent::execute($sql, $values);
    }
}
$storage = new MoneyTestConnection();
$api = apiFor('alice', $storage);
$createRule = new ReflectionMethod('mistergastos', 'createRecurringRule'); $createRule->setAccessible(true);
$createRule->invoke($api, 1, 'alice', array('recurrence' => 'monthly', 'name' => 'Compra recurrente', 'amount' => '1.234,56', 'applies_to_all' => true, 'occurred_at' => '2026-11-03T12:00'), array('alice', 'bob'), array('alice' => 617.28, 'bob' => 617.28), array(), 'card');
check($storage->recurringPayload['amount'] === 1234.56, 'A Spanish-formatted API amount must retain all its euros and cents in the recurring rule');
$base = array('name' => 'Prueba', 'details' => '', 'is_quick' => 0, 'category' => 'food', 'place' => '', 'city' => 'Madrid', 'occurred_at' => '2026-11-03 12:00:00', 'share_mode' => 'amount', 'payment_method' => 'card', 'paid_by_type' => 'person', 'applies_to_all' => false, 'created_by' => 'alice', 'updated_at' => '2026-11-03 12:00:00', 'confirmed_at' => 'confirmed');
$storage->expenses = array(
    array_merge($base, array('id' => 1, 'transaction_type' => 'expense', 'amount' => 1, 'paid_by_uid' => 'bob')),
    array_merge($base, array('id' => 2, 'transaction_type' => 'expense', 'amount' => 1, 'paid_by_uid' => 'charlie')),
    array_merge($base, array('id' => 3, 'transaction_type' => 'income', 'amount' => 0.01, 'paid_by_uid' => 'alice')),
    array_merge($base, array('id' => 4, 'transaction_type' => 'expense', 'amount' => 10000, 'paid_by_uid' => 'bob', 'confirmed_at' => null)),
);
$storage->participants = array(array('expense_id' => 1, 'uid' => 'alice', 'share_amount' => 1), array('expense_id' => 2, 'uid' => 'alice', 'share_amount' => 1), array('expense_id' => 3, 'uid' => 'bob', 'share_amount' => 1), array('expense_id' => 3, 'uid' => 'charlie', 'share_amount' => 1), array('expense_id' => 4, 'uid' => 'alice', 'share_amount' => 10000));
$settlement = array('id' => 1, 'payment_method' => 'card', 'paid_at' => '2026-11-03 12:00:00', 'created_by' => 'alice', 'payer_uid' => 'alice', 'payee_uid' => 'bob');
$storage->settlements = array(array_merge($settlement, array('amount' => 0.29)), array_merge($settlement, array('id' => 2, 'amount' => 0.57)));
$pairsMethod = new ReflectionMethod('mistergastos', 'getPairBalances'); $pairsMethod->setAccessible(true);
$pairs = $pairsMethod->invoke($api, 1);
check($pairs[0]['amount'] === 0.14 && $pairs[1]['amount'] === 0.99, 'Balances use exact cents after income scaling and partial settlements');
$storage->settlements[] = array_merge($settlement, array('id' => 3, 'amount' => 0.14));
$storage->settlements[] = array_merge($settlement, array('id' => 4, 'payee_uid' => 'charlie', 'amount' => 0.99));
check($pairsMethod->invoke($api, 1) === array(), 'Paying the final cent leaves no residual balance');
$storage->expenses = array(array_merge($base, array('id' => 3, 'transaction_type' => 'income', 'amount' => 0.29, 'paid_by_uid' => 'alice')));
$storage->participants = array(array('expense_id' => 3, 'uid' => 'bob', 'share_amount' => 0.29));
$storage->settlements = array(array_merge($settlement, array('amount' => 0.01)));
$pairs = $pairsMethod->invoke($api, 1);
check(count($pairs) === 1 && $pairs[0]['debtor_uid'] === 'bob' && $pairs[0]['amount'] === 0.30, 'Income surplus and recorded transfer must both remain after the original expense is removed');
$storage->expenses = array(array_merge($base, array('id' => 1, 'transaction_type' => 'expense', 'amount' => 10, 'paid_by_uid' => 'bob')), array_merge($base, array('id' => 2, 'transaction_type' => 'income', 'amount' => 10, 'paid_by_uid' => 'alice')));
$storage->participants = array(array('expense_id' => 1, 'uid' => 'alice', 'share_amount' => 10), array('expense_id' => 2, 'uid' => 'alice', 'share_amount' => 5), array('expense_id' => 2, 'uid' => 'bob', 'share_amount' => 5));
$storage->settlements = array();
$pairs = $pairsMethod->invoke($api, 1);
check(count($pairs) === 1 && $pairs[0]['amount'] === 5, 'Recipient share must not be reassigned to other participants in income balances');
$storage->expenses = array(array_merge($base, array('id' => 1, 'transaction_type' => 'expense', 'amount' => 296, 'paid_by_uid' => 'bob')), array_merge($base, array('id' => 2, 'transaction_type' => 'expense', 'amount' => 143.83, 'paid_by_uid' => 'alice')), array_merge($base, array('id' => 3, 'transaction_type' => 'income', 'amount' => 600, 'paid_by_uid' => 'alice')));
$storage->participants = array(array('expense_id' => 1, 'uid' => 'alice', 'share_amount' => 296), array('expense_id' => 2, 'uid' => 'bob', 'share_amount' => 143.83), array('expense_id' => 3, 'uid' => 'bob', 'share_amount' => 600));
$pairs = $pairsMethod->invoke($api, 1);
check(count($pairs) === 1 && $pairs[0]['debtor_uid'] === 'bob' && $pairs[0]['amount'] === 447.83, 'Income surplus must carry into the reciprocal balance');
$storage->participants[0]['share_amount'] = 268.43;
$pairs = $pairsMethod->invoke($api, 1);
check(count($pairs) === 1 && $pairs[0]['amount'] === 475.40, 'Removing a confirmed expense share must change the balance by its full amount');

echo "Money parsing, 10,000 allocations, shares, write validation and exact balances passed.\n";
