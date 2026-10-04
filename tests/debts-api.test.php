<?php

// php tests/debts-api.test.php /path/to/api/mistergastos.php
// Reuse cached identities and simulated storage; no real data is modified.
require __DIR__ . '/quick-template-api.test.php';

class DebtTestConnection extends TemplateTestConnection
{
    public $debts = array();
    public $nextId = 1;
    public function execute($sql, $values)
    {
        if (strpos($sql, 'SELECT COUNT(*) AS total FROM mg_expenses') === 0) return array(array('total' => 0));
        if (strpos($sql, 'INSERT INTO mg_debts') === 0) {
            $id = $this->nextId++;
            $row = array_combine(array('group_id', 'concept', 'status', 'source_uid', 'target_uid', 'source_name', 'target_name', 'amount', 'created_by', 'updated_by'), $values);
            $this->debts[$id] = array_merge($row, array('id' => $id, 'created_at' => '2026-10-04 12:00:00', 'updated_at' => '2026-10-04 12:00:00'));
            return array();
        }
        if (strpos($sql, 'UPDATE mg_debts SET') === 0) {
            check($this->debts[$values[8]]['group_id'] === $values[9], 'Updates must be scoped to the current group');
            $keys = array('concept', 'status', 'source_uid', 'target_uid', 'source_name', 'target_name', 'amount', 'updated_by');
            $this->debts[$values[8]] = array_merge($this->debts[$values[8]], array_combine($keys, array_slice($values, 0, 8)));
            return array();
        }
        if (strpos($sql, 'DELETE FROM mg_debts') === 0) {
            check($this->debts[$values[0]]['group_id'] === $values[1], 'Deletes must be scoped to the current group');
            unset($this->debts[$values[0]]);
            return array();
        }
        if (strpos($sql, 'SELECT id,concept,status,source_uid,target_uid,source_name,target_name,amount FROM mg_debts') === 0) {
            return isset($this->debts[$values[0]]) && $this->debts[$values[0]]['group_id'] === $values[1] ? array($this->debts[$values[0]]) : array();
        }
        if (strpos($sql, 'SELECT id,concept,status,source_uid,target_uid,source_name,target_name,amount,created_at') === 0) {
            return array_values(array_filter($this->debts, function ($debt) use ($values) { return $debt['group_id'] === $values[0]; }));
        }
        return parent::execute($sql, $values);
    }
}

$storage = new DebtTestConnection();
$api = apiFor('alice', $storage);
$valid = array('concept' => '  Préstamo para el viaje  ', 'status' => 'pending', 'source_uid' => 'alice', 'target_uid' => 'bob', 'amount' => '75.25');
foreach (array(array('concept' => ' '), array('concept' => array()), array('amount' => 0), array('amount' => 0.001), array('amount' => 'abc'), array('amount' => INF), array('amount' => 100000000), array('status' => 'unknown'), array('source_uid' => 'other'), array('target_uid' => 'alice'), array('id' => -1), array('id' => 'bad')) as $invalid) {
    $_POST = array_merge($valid, $invalid);
    check($api->save_debt()['status'] === 400, 'Invalid debt was accepted: ' . json_encode($invalid));
    check(count($storage->debts) === 0, 'Invalid debt changed storage');
}
$_POST = $valid;
$response = $api->save_debt();
check($response['ok'], 'Creating a debt failed');
$debt = $response['data']['group']['debts'][0];
check($debt['id'] === 1 && $debt['amount'] === 75.25 && $debt['concept'] === 'Préstamo para el viaje', 'Debt fields were not normalized and returned');
check($debt['source_uid'] === 'alice' && $debt['target_uid'] === 'bob', 'Creditor and debtor were reversed');
check($storage->debts[1]['created_by'] === 'alice', 'Creator must use the authenticated identity');

$storage->debts[99] = array_merge($storage->debts[1], array('id' => 99, 'group_id' => 2));
$_POST = array_merge($valid, array('id' => 99));
check($api->save_debt()['status'] === 404, 'Another group debt could be edited');
$_POST = array('id' => 99);
check($api->delete_debt()['status'] === 404 && isset($storage->debts[99]), 'Another group debt could be deleted');
$_POST = array('id' => 0);
check($api->delete_debt()['status'] === 400, 'Invalid delete id was accepted');

$bobApi = apiFor('bob', $storage);
$_POST = array_merge($valid, array('id' => 1, 'status' => 'paid', 'amount' => 80, 'created_by' => 'spoofed'));
$response = $bobApi->save_debt();
check($response['ok'] && $storage->debts[1]['status'] === 'paid', 'A group member could not update debt status');
check($storage->debts[1]['created_by'] === 'alice' && $storage->debts[1]['updated_by'] === 'bob', 'Editing must preserve creator and use the authenticated editor');
check(count($response['data']['group']['debts']) === 1, 'Another group debt appeared in the response');

$storage->members[1] = array('alice');
$canLeave = (new ReflectionClass('mistergastos'))->getMethod('canLeaveGroup');
$canLeave->setAccessible(true);
check(!$canLeave->invoke($api, 1, 'alice'), 'The last member must not delete a group with debts by leaving');
$_POST = array_merge($valid, array('id' => 1, 'status' => 'cancelled'));
check($api->save_debt()['ok'] && $storage->debts[1]['target_name'] === 'bob', 'An existing debt could not preserve a departed member');
$_POST = $valid;
check($api->save_debt()['status'] === 400, 'A new debt accepted a departed member');
$_POST = array('id' => 1);
$response = $api->delete_debt();
check($response['ok'] && !isset($storage->debts[1]) && isset($storage->debts[99]), 'Deleting must remove only the selected group debt');
check(count($response['data']['group']['debts']) === 0, 'Delete response did not update the debt list');
check($canLeave->invoke($api, 1, 'alice'), 'An empty personal group should remain possible to leave');

echo "Debt validation, persistence and group isolation checks passed.\n";
