<?php

// php tests/summaries-api.test.php /path/to/api/GastotecaBackups.php
// Exercise the real shared cron with fake storage/transport, without sending.
require __DIR__ . '/backups-api.test.php';

$week = GastotecaSummary::period('weekly', new DateTimeImmutable('2026-10-02T08:00:00Z'));
check($week['start'] === '2026-09-21 00:00:00' && $week['end'] === '2026-09-28 00:00:00' && $week['previous_start'] === '2026-09-14 00:00:00' && $week['days'] === 7, 'Week is previous Monday through Sunday');
$month = GastotecaSummary::period('monthly', new DateTimeImmutable('2026-01-01T08:00:00Z'));
check($month['from'] === '2025-12-01' && $month['through'] === '2025-12-31' && $month['previous_start'] === '2025-11-01 00:00:00', 'Month handles year boundary');
check(GastotecaSummary::period('monthly', new DateTimeImmutable('2028-03-05T08:00:00Z'))['days'] === 29, 'Leap February');
$day = GastotecaSummary::period('daily', new DateTimeImmutable('2026-10-01T22:30:00Z'));
check($day['from'] === '2026-10-01' && $day['through'] === '2026-10-01', 'Day boundary uses Madrid rather than UTC');
check(GastotecaSummary::period('daily', new DateTimeImmutable('2026-03-30T08:00:00Z'))['days'] === 1, 'A DST day counts as one calendar day');

class SummaryTransaction
{
    private $api; private $snapshot;
    public $commits = 0; public $rollbacks = 0;
    public function __construct($api) { $this->api = $api; }
    public function begin_transaction() { $this->snapshot = $this->api->schedules; return true; }
    public function commit() { $this->commits++; return true; }
    public function rollback() { $this->rollbacks++; $this->api->schedules = $this->snapshot; return true; }
}

class SummaryTestApi extends BackupTestApi
{
    public $ConectorBD; public $schedules = array(); public $failWrite = false; public $totalsReads = array();
    public function __construct() { $this->ConectorBD = new SummaryTransaction($this); }
    protected function query($sql, $types = '', $values = array()) {
        if (strpos($sql, 'SELECT period,enabled,send_time') === 0) {
            check($values === array(1, 'alice'), 'Settings only for authenticated account and group');
            return array_values($this->schedules);
        }
        if (strpos($sql, 'SELECT p.group_id,p.uid,p.period FROM mg_summary_preferences') === 0) {
            $rows = array();
            foreach ($this->schedules as $row)
                if ($this->member && $row['enabled'] && $row['next_run_at'] && $row['next_run_at'] <= gmdate('Y-m-d H:i:s')) $rows[] = array('group_id' => 1, 'uid' => 'alice', 'period' => $row['period']);
            return $rows;
        }
        if (strpos($sql, 'SELECT name FROM mg_groups') === 0) { check($values === array(1), 'Only current group in message'); return array(array('name' => 'Grupo de prueba')); }
        if (strpos($sql, 'SELECT COALESCE(SUM(p.share_amount)') === 0) {
            check($types === 'siss' && array_slice($values, 0, 2) === array('alice', 1), 'Totals use authenticated participant and group');
            check(strpos($sql, "e.confirmed_at IS NOT NULL AND e.transaction_type='expense' AND e.occurred_at>=? AND e.occurred_at<?") !== false, 'Exclude pending, income and dates outside the half-open period');
            $this->totalsReads[] = $values;
            return count($this->totalsReads) % 2 === 1 ? array(array('expense_total' => '120.00', 'expense_count' => 3)) : array(array('expense_total' => '100.00', 'expense_count' => 2));
        }
        if (strpos($sql, 'SUM(ep.share_amount)') !== false || strpos($sql, 'ep.share_amount AS total') !== false) {
            check($types === 'siss' && $values === $this->totalsReads[count($this->totalsReads) - 2], 'Rankings use the selected period, group and authenticated participant');
            check(strpos($sql, 'ep.uid=?') !== false && strpos($sql, "e.transaction_type='expense'") !== false, 'Rankings only use the personal expense share');
            if (strpos($sql, 'SELECT c.label') === 0) return array(array('label' => 'Alimentación', 'total' => '90.00'));
            return strpos($sql, 'SELECT p.name') === 0 ? array(array('label' => 'Mercadona', 'total' => '90.00'))
                : array(array('label' => 'Compra semanal', 'total' => '60.00', 'place' => 'Mercadona'));
        }
        return parent::query($sql, $types, $values);
    }
    protected function prepare($sql, $types, $values) {
        if (strpos($sql, 'INSERT INTO mg_summary_preferences (group_id,uid,period,enabled') === 0) {
            check($values[0] === 1 && $values[1] === 'alice' && $types === 'issisiis', 'Caller cannot override schedule recipient');
            if ($this->failWrite && $values[2] === 'weekly') throw new RuntimeException('Simulated write failure');
            $this->schedules[$values[2]] = array_merge($this->schedules[$values[2]] ?? array('last_sent_at' => null), array('period' => $values[2], 'enabled' => $values[3], 'send_time' => $values[4], 'weekday' => $values[5], 'monthday' => $values[6], 'next_run_at' => $values[7]));
            return new BackupStatement();
        }
        if (strpos($sql, 'INSERT INTO mg_summary_preferences (group_id,uid,period,last_sent_at') === 0) {
            $this->schedules[$values[2]]['last_sent_at'] = $values[3]; return new BackupStatement();
        }
        if (strpos($sql, 'UPDATE mg_summary_preferences SET last_sent_at') === 0) {
            check($types === 'ssiss' && $values[2] === 1 && $values[3] === 'alice', 'Cron advances only the delivered account/period');
            $this->schedules[$values[4]]['last_sent_at'] = $values[0]; $this->schedules[$values[4]]['next_run_at'] = $values[1]; return new BackupStatement();
        }
        return parent::prepare($sql, $types, $values);
    }
}

$summaryApi = new SummaryTestApi();
$defaults = $summaryApi->summary_settings()['data']['schedules'];
check(count($defaults) === 3 && !$defaults['weekly']['enabled'], 'All summary schedules default disabled');
$_POST = array('schedules' => $defaults, 'uid' => 'bob', 'group_id' => 999);
$_POST['schedules']['weekly']['enabled'] = true; $_POST['schedules']['monthly']['enabled'] = true;
check($summaryApi->save_summary_settings()['ok'], 'Weekly and monthly can run simultaneously');
check($summaryApi->ConectorBD->commits === 1, 'All schedules saved in one transaction');
$saved = $summaryApi->schedules;
$summaryApi->failWrite = true; $_POST['schedules']['daily']['enabled'] = true;
try { $summaryApi->save_summary_settings(); check(false, 'Expected write failure'); } catch (RuntimeException $error) { check($error->getMessage() === 'Simulated write failure', 'Expected transaction failure'); }
check($summaryApi->schedules === $saved && $summaryApi->ConectorBD->rollbacks === 1 && !$summaryApi->locked, 'Failure rolls back all settings and releases lock');
$summaryApi->failWrite = false; $_POST['schedules']['daily']['enabled'] = false; $_POST['schedules']['weekly']['enabled'] = 'false';
check($summaryApi->save_summary_settings()['code'] === 'INVALID_SUMMARY_SETTINGS', 'Reject string booleans');
$_POST['schedules']['weekly']['enabled'] = true; $_POST['schedules']['monthly']['monthday'] = 32;
check($summaryApi->save_summary_settings()['status'] === 400 && $summaryApi->schedules === $saved, 'Validate all settings before any write');
$_POST = array('period' => 'weekly', 'uid' => 'bob', 'group_id' => 999);
$delivery = $summaryApi->send_summary();
check($delivery['ok'] && $delivery['data']['period'] === 'weekly', 'Manual summary sends');
check($summaryApi->schedules['weekly']['next_run_at'] === $saved['weekly']['next_run_at'], 'Manual summary preserves saved schedule');
$message = end(MenuDiarioTelegram::$messages);
check($message['chat_id'] === 'alice-chat', 'Summary only to authenticated personal Telegram');
check(strpos($message['text'], '📊 La Gastoteca · Resumen semanal') === 0, 'Weekly personal summary heading');
check(strpos($message['text'], 'Tu gasto: 120,00 €') !== false && strpos($message['text'], 'Has gastado un 20,0% más que en la semana anterior.') !== false, 'Weekly totals and comparison');
check(strpos($message['text'], "Establecimientos donde más gastaste\n1. Mercadona: 90,00 €") !== false && strpos($message['text'], "Tus principales categorías\n1. Alimentación: 90,00 €") !== false && strpos($message['text'], "Tus mayores gastos\n1. Compra semanal · Mercadona: 60,00 €") !== false, 'All three rankings include labels and amounts');
$summaryApi->schedules['weekly']['next_run_at'] = '2020-01-01 00:00:00'; $summaryApi->schedules['monthly']['next_run_at'] = '2020-01-01 00:00:00';
$_POST = array('schedules' => $summaryApi->summary_settings()['data']['schedules']);
check($summaryApi->save_summary_settings()['ok'] && $summaryApi->schedules['weekly']['next_run_at'] === '2020-01-01 00:00:00', 'Unchanged settings preserve pending deliveries');
$result = $summaryApi->run_scheduled_backups();
check($result['sent'] === 0 && $result['summaries']['sent'] === 2, 'Same cron sends summaries with CSV backups disabled');
$count = count(MenuDiarioTelegram::$messages);
check($summaryApi->run_scheduled_backups()['summaries']['sent'] === 0 && count(MenuDiarioTelegram::$messages) === $count, 'Repeated cron does not resend');
$summaryApi->schedules['weekly']['next_run_at'] = '2020-01-01 00:00:00'; MenuDiarioTelegram::$fail = true; $last = $summaryApi->schedules['weekly']['last_sent_at'];
check($summaryApi->run_scheduled_backups()['summaries']['failed'] === 1 && $summaryApi->schedules['weekly']['next_run_at'] === '2020-01-01 00:00:00' && $summaryApi->schedules['weekly']['last_sent_at'] === $last, 'Telegram failure stays pending without recording success');
MenuDiarioTelegram::$fail = false;
check($summaryApi->run_scheduled_backups()['summaries']['sent'] === 1, 'Next cron retries summary');
$summaryApi->locked = true; $_POST = array('period' => 'weekly');
check($summaryApi->send_summary()['status'] === 409, 'Concurrent manual delivery prevented'); $summaryApi->locked = false;
$summaryApi->member = false; $summaryApi->schedules['weekly']['next_run_at'] = '2020-01-01 00:00:00';
check($summaryApi->run_scheduled_backups()['summaries']['checked'] === 0, 'Former member excluded'); $summaryApi->member = true; $summaryApi->connected = false;
check($summaryApi->send_summary()['code'] === 'TELEGRAM_NOT_CONNECTED', 'Disconnected send rejected');
$_POST = array('schedules' => $defaults);
check($summaryApi->save_summary_settings()['ok'] && $summaryApi->schedules['weekly']['next_run_at'] === null, 'Can disable summaries while disconnected');
$summaryApi->identity = null;
check($summaryApi->send_summary()['status'] === 401 && $summaryApi->summary_settings()['status'] === 401, 'Authentication required');
$emptyData = array('expense_total' => 0, 'income_total' => 10, 'net_balance' => 0, 'expense_count' => 0, 'previous_total' => 0, 'categories' => array(), 'establishments' => array(), 'largest_expenses' => array());
$empty = GastotecaSummary::message('monthly', "Prueba\nGrupo", $month, $emptyData);
check(strpos($empty, 'No tuviste gastos') !== false && strpos($empty, '%') === false && strpos($empty, 'Prueba Grupo') !== false, 'Empty periods and zero comparison are explicit');
check(strpos($empty, 'Resumen mensual') !== false && strpos($empty, 'Tu gasto: 0,00 €') !== false && substr_count($empty, 'Sin gastos en este periodo.') === 3, 'Monthly labels and empty rankings');
$decreased = GastotecaSummary::message('monthly', 'Grupo', $month, array_merge($emptyData, array('expense_total' => 50, 'expense_count' => 1, 'previous_total' => 100, 'net_balance' => -25.50)));
check(strpos($decreased, 'Tu gasto: 50,00 €') !== false && strpos($decreased, 'Has gastado un 50,0% menos que en el mes anterior.') !== false, 'Personal spending and lower monthly comparison');
$unchanged = GastotecaSummary::message('weekly', 'Grupo', $week, array_merge($emptyData, array('expense_total' => 100, 'expense_count' => 1, 'previous_total' => 100)));
check(strpos($unchanged, 'Has gastado lo mismo que en la semana anterior.') !== false && strpos($unchanged, '%') === false, 'Equal spending is explicit');
$firstSpend = GastotecaSummary::message('weekly', 'Grupo', $week, array_merge($emptyData, array('expense_total' => 100, 'expense_count' => 1)));
check(strpos($firstSpend, 'no se puede calcular la variación porcentual') !== false && strpos($firstSpend, '%') === false, 'First spending does not divide by zero');
$noSpend = GastotecaSummary::message('weekly', 'Grupo', $week, array_merge($emptyData, array('previous_total' => 100)));
check(strpos($noSpend, '100,0% menos') !== false && strpos($noSpend, 'No tuviste gastos') !== false, 'Empty current period with previous spending');
$daily = GastotecaSummary::message('daily', 'Grupo', $day, array_merge($emptyData, array('expense_total' => 120, 'expense_count' => 3, 'previous_total' => 100, 'own_share' => 32.50, 'categories' => array(array('label' => 'Alimentación', 'total' => 90)))));
check(strpos($daily, 'Resumen diario') !== false && strpos($daily, 'Tu gasto: 120,00 €') !== false && strpos($daily, 'Media diaria: 120,00 €') !== false && strpos($daily, 'según tu parte del reparto') !== false, 'Daily summary keeps its existing format');

// Execute the real aggregation SQL against isolated fixtures, with no account data.
class SummarySqlTestApi extends SummaryTestApi
{
    public $statistics;
    public function __construct() {
        parent::__construct();
        $this->statistics = new PDO('sqlite::memory:');
        $this->statistics->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $this->statistics->exec('CREATE TABLE mg_expenses (id INTEGER,group_id INTEGER,transaction_type TEXT,name TEXT,amount NUMERIC,category_id INTEGER,place_id INTEGER,occurred_at TEXT,confirmed_at TEXT,paid_by_type TEXT,paid_by_uid TEXT)');
        $this->statistics->exec('CREATE TABLE mg_expense_participants (expense_id INTEGER,uid TEXT,share_amount NUMERIC)');
        $this->statistics->exec('CREATE TABLE mg_categories (id INTEGER,group_id INTEGER,label TEXT)');
        $this->statistics->exec('CREATE TABLE mg_places (id INTEGER,group_id INTEGER,name TEXT)');
        $this->statistics->exec('CREATE TABLE mg_settlements (group_id INTEGER,payer_uid TEXT,payee_uid TEXT,amount NUMERIC)');
    }
    protected function query($sql, $types = '', $values = array()) {
        if (strpos($sql, 'FROM mg_expenses e') !== false || strpos($sql, 'FROM mg_settlements WHERE') !== false) {
            $statement = $this->statistics->prepare($sql);
            $statement->execute($values);
            return $statement->fetchAll(PDO::FETCH_ASSOC);
        }
        return parent::query($sql, $types, $values);
    }
    public function fixture($table, $values) {
        $this->statistics->prepare('INSERT INTO ' . $table . ' VALUES (' . implode(',', array_fill(0, count($values), '?')) . ')')->execute($values);
    }
}

$sqlApi = new SummarySqlTestApi();
$sqlPeriod = GastotecaSummary::period('weekly', new DateTimeImmutable('now', new DateTimeZone('Europe/Madrid')));
$currentDate = $sqlPeriod['from'] . ' 12:00:00';
foreach (array('Alimentación', 'Restaurantes', 'Café', 'Hogar') as $index => $label) $sqlApi->fixture('mg_categories', array($index + 1, 1, $label));
foreach (array('Mercadona', 'Restaurante', 'Panadería', 'Kiosco') as $index => $label) $sqlApi->fixture('mg_places', array($index + 1, 1, $label));
$sqlApi->fixture('mg_categories', array(5, 2, 'Otro grupo'));
$sqlApi->fixture('mg_places', array(5, 2, 'Otro grupo'));
$fixtureExpenses = array(
    array(1, 1, 'expense', "Compra\ngrande", 60, 1, 1, $currentDate, 'confirmed', 'person', 'alice', 'bob', 30),
    array(2, 1, 'expense', 'Cena', 40, 2, 2, $currentDate, 'confirmed', 'person', 'bob', 'alice', 20),
    array(3, 1, 'expense', 'Café', 20, 3, 1, $currentDate, 'confirmed', 'all', null, 'alice', 10),
    array(4, 1, 'expense', 'Menú', 10, 4, null, $currentDate, 'confirmed', 'person', 'charlie', 'alice', 5),
    array(5, 1, 'expense', 'Compra pequeña', 10, 1, 3, $currentDate, 'confirmed', 'person', 'alice', 'bob', 5),
    array(6, 1, 'expense', 'Prensa', 5, 1, 4, $currentDate, 'confirmed', 'person', 'alice', 'bob', 5),
    array(7, 1, 'income', 'Ingreso excluido de rankings y saldo', 300, 1, 1, $currentDate, 'confirmed', 'person', 'alice', 'bob', 150),
    array(8, 1, 'expense', 'Pendiente excluido', 10000, 1, 1, $currentDate, null, 'person', 'alice', 'bob', 5000),
    array(9, 2, 'expense', 'Otro grupo excluido', 20000, 5, 5, $currentDate, 'confirmed', 'person', 'alice', 'bob', 10000),
    array(10, 1, 'expense', 'Periodo previo', 100, 1, 1, $sqlPeriod['previous_start'], 'confirmed', 'person', 'bob', 'alice', 50),
    array(11, 1, 'expense', 'Saldo histórico', 160, 1, 1, (new DateTimeImmutable($sqlPeriod['previous_start']))->modify('-1 day')->format('Y-m-d H:i:s'), 'confirmed', 'person', 'alice', 'bob', 80),
    array(12, 1, 'expense', 'Límite final excluido', 250, 4, null, $sqlPeriod['end'], 'confirmed', 'all', null, 'alice', 0),
);
foreach ($fixtureExpenses as $expense) {
    $sqlApi->fixture('mg_expenses', array_slice($expense, 0, 11));
    $sqlApi->fixture('mg_expense_participants', array($expense[0], $expense[11], $expense[12]));
    if ($expense[10] && $expense[10] !== $expense[11]) $sqlApi->fixture('mg_expense_participants', array($expense[0], $expense[10], $expense[4] - $expense[12]));
}
foreach (array(array(1, 'alice', 'bob', 15), array(1, 'bob', 'alice', 12), array(1, 'bob', 'charlie', 10000), array(2, 'alice', 'bob', 10000), array(1, 'alice', 'alice', 10000)) as $settlement) $sqlApi->fixture('mg_settlements', $settlement);
$_POST = array('period' => 'weekly', 'uid' => 'bob', 'group_id' => 2);
check($sqlApi->send_summary()['ok'], 'Real aggregation queries send the authenticated group summary');
$sqlMessage = end(MenuDiarioTelegram::$messages)['text'];
check(strpos($sqlMessage, 'Tu gasto: 70,00 €') !== false && strpos($sqlMessage, '40,0% más') !== false, 'Totals use personal shares and the current and previous periods, exclude income, pending and other groups');
check(strpos($sqlMessage, "Establecimientos donde más gastaste\n1. Mercadona: 40,00 €\n2. Restaurante: 20,00 €\n3. Panadería: 5,00 €") !== false && strpos($sqlMessage, 'Kiosco') === false, 'Establishment ranking groups personal shares and limits to three');
check(strpos($sqlMessage, "Tus principales categorías\n1. Alimentación: 35,00 €\n2. Restaurantes: 20,00 €\n3. Café: 10,00 €") !== false && strpos($sqlMessage, 'Hogar') === false, 'Category ranking groups personal shares and limits to three');
check(strpos($sqlMessage, "Tus mayores gastos\n1. Compra grande · Mercadona: 30,00 €\n2. Cena · Restaurante: 20,00 €\n3. Café · Mercadona: 10,00 €") !== false && strpos($sqlMessage, 'Menú') === false && strpos($sqlMessage, 'excluido') === false && strpos($sqlMessage, 'Saldo histórico') === false, 'Largest personal expenses stay within the period and sanitize multiline labels');

echo "Summary calendar, personal cents, SQL rankings, settings, scope, cron, retries and transaction checks passed.\n";
