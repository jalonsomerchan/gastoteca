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
        if (strpos($sql, 'SELECT COALESCE(SUM(CASE WHEN e.transaction_type') === 0) {
            check($types === 'iss' && $values[0] === 1, 'Totals are scoped to group');
            check(strpos($sql, 'e.confirmed_at IS NOT NULL AND e.occurred_at>=? AND e.occurred_at<?') !== false, 'Exclude pending movements and use a half-open period');
            $this->totalsReads[] = $values;
            return count($this->totalsReads) % 2 === 1 ? array(array('expense_total' => '120.00', 'income_total' => '300.00', 'expense_count' => 3)) : array(array('expense_total' => '100.00', 'income_total' => 0, 'expense_count' => 2));
        }
        if (strpos($sql, 'SELECT c.label,SUM(e.amount)') === 0) {
            check($values[0] === 1 && strpos($sql, "e.confirmed_at IS NOT NULL AND e.transaction_type='expense'") !== false, 'Categories only count confirmed expenses in current group');
            return array(array('label' => 'Alimentación', 'total' => '90.00'));
        }
        if (strpos($sql, 'SELECT COALESCE(SUM(p.share_amount)') === 0) {
            check(array_slice($values, 0, 2) === array('alice', 1) && $types === 'siss', 'Personal share uses authenticated uid and group');
            return array(array('total' => '32.50'));
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
check(strpos($message['text'], 'Gastos del grupo: 120,00 € (3 movimientos)') !== false && strpos($message['text'], 'Tu parte del reparto: 32,50 €') !== false && strpos($message['text'], '20,0% más') !== false && strpos($message['text'], '• Resto: 30,00 €') !== false, 'Message totals, shares, comparison and remaining categories');
check(strpos($message['text'], 'Ingresos: 300,00 €') !== false && strpos($message['text'], 'Ingresos − gastos: 180,00 €') !== false, 'Income and net flow do not mix into expenses');
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
$empty = GastotecaSummary::message('monthly', "Prueba\nGrupo", $month, array('expense_total' => 0, 'income_total' => 10, 'own_share' => 0, 'expense_count' => 0, 'previous_total' => 0, 'categories' => array()));
check(strpos($empty, 'No hubo gastos confirmados') !== false && strpos($empty, '%') === false && strpos($empty, 'Prueba Grupo') !== false, 'Empty periods and zero comparison are explicit');

echo "Summary calendar, text, settings, scope, shared cron, retries and transaction checks passed.\n";
