<?php

// php tests/backups-api.test.php /path/to/api/GastotecaBackups.php
// Real backup logic with fake storage and transport: no account data or network.
require $argv[1];

function check($condition, $message) { if (!$condition) throw new RuntimeException($message); }
function nextRun($frequency, $after, $changes = array()) {
    return GastotecaBackup::nextRun(array_merge(array('frequency' => $frequency, 'time' => '09:00', 'weekday' => 1, 'monthday' => 31), $changes), new DateTimeImmutable($after));
}

check(nextRun('disabled', '2026-10-02T08:00:00Z') === null, 'Disabled schedules have no due date');
check(nextRun('daily', '2026-10-02T06:59:00Z') === '2026-10-02 07:00:00', 'Daily first upcoming local time');
check(nextRun('daily', '2026-10-02T07:00:00Z') === '2026-10-03 07:00:00', 'Already sent slots advance');
check(nextRun('weekly', '2026-10-02T08:00:00Z') === '2026-10-05 07:00:00', 'Next Monday');
check(nextRun('weekly', '2026-10-05T07:00:00Z') === '2026-10-12 07:00:00', 'Weekly advance');
check(nextRun('monthly', '2026-01-31T08:00:00Z') === '2026-02-28 08:00:00', 'Day 31 clamps to February');
check(nextRun('monthly', '2026-02-28T08:00:00Z') === '2026-03-31 07:00:00', 'Monthly anchor does not drift after February');
check(nextRun('monthly', '2028-01-31T08:00:00Z') === '2028-02-29 08:00:00', 'Leap year');
check(nextRun('daily', '2026-03-28T08:00:00Z') === '2026-03-29 07:00:00', 'Spring DST keeps Madrid wall time');
check(nextRun('daily', '2026-10-24T07:00:00Z') === '2026-10-25 08:00:00', 'Autumn DST keeps Madrid wall time');
check(nextRun('daily', '2026-03-28T01:30:00Z', array('time' => '02:30')) === '2026-03-29 01:30:00', 'Nonexistent spring time shifts to 03:30');
check(nextRun('daily', '2026-03-29T01:30:00Z', array('time' => '02:30')) === '2026-03-30 00:30:00', 'The following day returns to the configured time');
check(nextRun('monthly', '2026-03-29T01:30:00Z', array('time' => '02:30')) === '2026-03-31 00:30:00', 'Monthly time does not inherit a DST normalization');
check(GastotecaBackup::isoDate('2026-10-02 07:00:00') === '2026-10-02T07:00:00Z', 'Stored UTC dates have an explicit zone');

class MenuDiarioTelegram
{
    public static $enabled = true;
    public static $fail = false;
    public static $deliveries = array();
    public static function configured() { return self::$enabled; }
    public static function cronSecret() { return 'test-secret'; }
    public static function sendDocument($chatId, $path, $filename, $caption) {
        self::$deliveries[] = array('chat_id' => $chatId, 'path' => $path, 'filename' => $filename, 'csv' => file_get_contents($path), 'caption' => $caption);
        return self::$fail ? null : array('message_id' => 1);
    }
}

class BackupStatement { public function close() {} }

class BackupTestApi
{
    use GastotecaBackups;
    private $databaseName = 'test';
    public $identity = array('claims' => array('uid' => 'alice'));
    public $settings = array();
    public $locked = false;
    public $connected = true;
    public $member = true;
    public $includeExpense = true;
    public $expensesReadFor = null;
    private function requireIdentity() { return $this->identity; }
    private function authError() { return $this->failResponse('AUTH_REQUIRED', 'Auth required', 401); }
    private function ensureDefaultGroup($identity) { return array('id' => 1); }
    private function body() { return $_POST; }
    private function okResponse($data) { return array('ok' => true, 'data' => $data); }
    private function failResponse($code, $message, $status) { return array('ok' => false, 'code' => $code, 'message' => $message, 'status' => $status); }
    private function isGroupMember($groupId, $uid) { return $groupId === 1 && $uid === 'alice' && $this->member; }
    private function materializeDueRecurringExpenses($groupId) { check($groupId === 1, 'Materialize only selected group'); }
    private function getGroup($groupId) {
        check($groupId === 1, 'CSV scoped to authenticated group');
        return array('id' => 1, 'name' => 'Grupo de prueba', 'category_labels' => array('food' => 'Alimentación'), 'members' => array(
            array('uid' => 'alice', 'name' => 'Alicia', 'email' => 'alice@example.test'),
            array('uid' => 'bob', 'name' => 'Roberto', 'email' => 'bob@example.test'),
        ));
    }
    private function getExpenses($groupId, $uid) {
        $this->expensesReadFor = array($groupId, $uid);
        check($groupId === 1 && $uid === 'alice', 'Always pass authenticated uid to visibility-filtered expense reader');
        if (!$this->includeExpense) return array();
        return array(array('id' => 2, 'transaction_type' => 'income', 'name' => '=2+3', 'details' => "Detalle; con \"comillas\"\ny dos líneas", 'amount' => 15.50,
            'category' => 'food', 'place' => 'Café', 'city' => 'Madrid', 'occurred_at' => '2026-10-02 10:00:00',
            'share_mode' => 'amount', 'payment_method' => 'transfer', 'paid_by_type' => 'person', 'paid_by_uid' => 'alice', 'applies_to_all' => false,
            'participants' => array(array('uid' => 'alice', 'share_amount' => 10.25), array('uid' => 'bob', 'share_amount' => 5.25)),
            'tags' => array('Viaje; café'), 'created_by' => 'alice', 'updated_at' => '2026-10-02 10:00:00', 'confirmation_pending' => true, 'is_quick' => false));
    }
    private function getSettlements($groupId) {
        check($groupId === 1, 'Settlements scoped to authenticated group');
        return $this->includeExpense ? array(array('id' => 9, 'payer_uid' => 'bob', 'payee_uid' => 'alice', 'amount' => 8.30, 'payment_method' => 'bizum', 'paid_at' => '2026-10-01 12:00:00', 'created_by' => 'bob')) : array();
    }
    private function query($sql, $types = '', $values = array()) {
        if (strpos($sql, 'SELECT GET_LOCK') === 0) {
            if ($this->locked) return array(array('acquired' => 0));
            $this->locked = true;
            return array(array('acquired' => 1));
        }
        if (strpos($sql, 'SELECT RELEASE_LOCK') === 0) { $this->locked = false; return array(); }
        if (strpos($sql, 'SELECT telegram_chat_id') === 0) {
            check($values[0] === 'alice', 'Never send to a caller-supplied recipient');
            return $this->connected ? array(array('telegram_chat_id' => 'alice-chat')) : array();
        }
        if (strpos($sql, 'SELECT frequency,send_time') === 0) return $this->settings ? array($this->settings) : array();
        if (strpos($sql, 'SELECT p.group_id,p.uid') === 0) {
            return $this->member && $this->settings && $this->settings['frequency'] !== 'disabled' && !empty($this->settings['next_run_at']) && $this->settings['next_run_at'] <= gmdate('Y-m-d H:i:s') ? array(array('group_id' => 1, 'uid' => 'alice')) : array();
        }
        throw new RuntimeException('Unexpected query: ' . $sql);
    }
    private function prepare($sql, $types, $values) {
        if (strpos($sql, 'INSERT INTO mg_backup_preferences (group_id,uid,frequency') === 0) {
            $this->settings = array_merge($this->settings, array('frequency' => $values[2], 'send_time' => $values[3], 'weekday' => $values[4], 'monthday' => $values[5], 'next_run_at' => $values[6]));
        } elseif (strpos($sql, 'INSERT INTO mg_backup_preferences (group_id,uid,last_sent_at') === 0) {
            $this->settings['last_sent_at'] = $values[2];
        } elseif (strpos($sql, 'UPDATE mg_backup_preferences SET last_sent_at') === 0) {
            $this->settings['last_sent_at'] = $values[0];
            $this->settings['next_run_at'] = $values[1];
        } else throw new RuntimeException('Unexpected write: ' . $sql);
        return new BackupStatement();
    }
}

$api = new BackupTestApi();
check($api->backup_settings()['data']['frequency'] === 'disabled', 'Schedules start disabled');
foreach (array(array('frequency' => 'yearly'), array('time' => '25:00'), array('weekday' => 8), array('monthday' => 0), array('monthday' => '2.5'), array('frequency' => array())) as $invalid) {
    $_POST = array_merge(array('frequency' => 'daily', 'time' => '09:00', 'weekday' => 1, 'monthday' => 1), $invalid);
    check($api->save_backup_settings()['code'] === 'INVALID_BACKUP_SETTINGS', 'Reject invalid backup schedule');
}
$_POST = array('frequency' => 'monthly', 'time' => '09:00', 'weekday' => 1, 'monthday' => 31, 'uid' => 'bob', 'group_id' => 999);
check($api->save_backup_settings()['ok'], 'Valid schedule saves');
$next = $api->settings['next_run_at'];
check($api->send_backup()['ok'], 'Manual delivery succeeds');
check($api->settings['next_run_at'] === $next, 'Manual delivery preserves schedule');
check(!$api->locked, 'Delivery releases advisory lock');
$delivery = MenuDiarioTelegram::$deliveries[0];
check($delivery['chat_id'] === 'alice-chat', 'Send only to authenticated recipient');
check(!file_exists($delivery['path']), 'Temporary CSV is deleted after delivery');
check(substr($delivery['csv'], 0, 3) === "\xEF\xBB\xBF", 'CSV has UTF-8 BOM');
$stream = fopen('php://temp', 'w+');
fwrite($stream, substr($delivery['csv'], 3)); rewind($stream);
$headers = fgetcsv($stream, 0, ';', '"', '');
$expense = array_combine($headers, fgetcsv($stream, 0, ';', '"', ''));
$settlement = array_combine($headers, fgetcsv($stream, 0, ';', '"', ''));
check(fgetcsv($stream, 0, ';', '"', '') === false, 'Exactly one row per movement and settlement'); fclose($stream);
check($expense['tipo'] === 'income' && $expense['importe'] === '15.50', 'Income and cents preserved');
check($expense['concepto'] === "'=2+3", 'CSV formula text neutralized');
check($expense['detalle'] === "Detalle; con \"comillas\"\ny dos líneas", 'CSV quoting and multiline text round trips');
check($expense['categoria'] === 'Alimentación' && $expense['establecimiento'] === 'Café', 'Accents and catalog labels preserved');
check(json_decode($expense['participantes_json'], true)[1]['importe'] === 5.25, 'Participant distribution preserved');
check(json_decode($expense['etiquetas_json'], true) === array('Viaje; café'), 'Tag separators round trip');
check($expense['pendiente_confirmacion'] === '1', 'Own pending movement included');
check($settlement['destinatario_uid'] === 'alice' && $settlement['importe'] === '8.30', 'Settlement preserves payer, recipient and amount');

$api->settings['next_run_at'] = '2020-01-01 00:00:00';
$result = $api->run_scheduled_backups();
check($result['sent'] === 1 && $api->settings['next_run_at'] > gmdate('Y-m-d H:i:s'), 'Overdue schedule sends one fresh snapshot then advances');
$count = count(MenuDiarioTelegram::$deliveries);
check($api->run_scheduled_backups()['sent'] === 0 && count(MenuDiarioTelegram::$deliveries) === $count, 'Repeated cron does not resend');
$api->settings['next_run_at'] = '2020-01-01 00:00:00';
MenuDiarioTelegram::$fail = true;
$lastSent = $api->settings['last_sent_at'];
check($api->run_scheduled_backups()['failed'] === 1, 'Failed Telegram delivery recorded');
check($api->settings['next_run_at'] === '2020-01-01 00:00:00' && $api->settings['last_sent_at'] === $lastSent, 'Failed delivery can retry and does not mark success');
check(!file_exists(end(MenuDiarioTelegram::$deliveries)['path']) && !$api->locked, 'Failure cleans temporary file and lock');
MenuDiarioTelegram::$fail = false;
check($api->run_scheduled_backups()['sent'] === 1, 'Next run retries failed delivery');
$api->locked = true;
check($api->send_backup()['code'] === 'BACKUP_BUSY', 'Concurrent send prevented');
$api->locked = false;
$api->member = false;
$api->settings['next_run_at'] = '2020-01-01 00:00:00';
check($api->run_scheduled_backups()['checked'] === 0, 'Former group member excluded');
$api->member = true;
$api->connected = false;
check($api->send_backup()['code'] === 'TELEGRAM_NOT_CONNECTED', 'Disconnected manual send rejected');
check($api->save_backup_settings()['code'] === 'TELEGRAM_NOT_CONNECTED', 'Disconnected schedule activation rejected');
$_POST = array('frequency' => 'disabled');
check($api->save_backup_settings()['ok'] && $api->settings['next_run_at'] === null, 'Can disable while disconnected');
$api->identity = null;
check($api->send_backup()['status'] === 401 && $api->backup_settings()['status'] === 401, 'Authentication required');
$api->identity = array('claims' => array('uid' => 'alice'));
$api->connected = true;
$api->includeExpense = false;
check($api->send_backup()['data']['movement_count'] === 0, 'Empty group can produce a header-only backup');

echo "Backup calendar, CSV, scope, delivery, retry and concurrency checks passed.\n";
