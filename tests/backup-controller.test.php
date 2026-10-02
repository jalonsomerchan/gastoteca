<?php

// php tests/backup-controller.test.php /path/to/api/mistergastos.php
// Reuse the real controller's existing in-memory fixtures (no constructor/DB).
require __DIR__ . '/quick-template-api.test.php';

class BackupControllerResult extends TemplateTestResult { public function free() {} }

class BackupControllerConnection extends TemplateTestConnection
{
    public $version = 10;
    public $schemaWrites = array();
    public function query($sql) {
        if (strpos($sql, 'CREATE TABLE IF NOT EXISTS mg_schema_version') === 0 || strpos($sql, 'CREATE TABLE IF NOT EXISTS mg_backup_preferences') === 0) {
            $this->schemaWrites[] = $sql;
            return true;
        }
        if (strpos($sql, 'SELECT version FROM mg_schema_version') === 0) return new BackupControllerResult(array(array('version' => $this->version)));
        if (strpos($sql, 'SELECT expense_id,uid,share_amount') === 0 || strpos($sql, 'SELECT et.expense_id,t.name') === 0) return new BackupControllerResult(array());
        throw new RuntimeException('Unexpected raw query: ' . $sql);
    }
    public function execute($sql, $values) {
        if (strpos($sql, 'SELECT GET_LOCK') === 0) return array(array('acquired' => 1));
        if (strpos($sql, 'SELECT RELEASE_LOCK') === 0) return array();
        if (strpos($sql, 'INSERT INTO mg_schema_version') === 0) { $this->version = 11; return array(); }
        if (strpos($sql, 'SELECT e.id,e.transaction_type') === 0) {
            check($values === array(1, 'alice'), 'Expense query must use the authenticated group and uid');
            check(strpos($sql, 'WHERE e.group_id=? AND (e.confirmed_at IS NOT NULL OR e.created_by=?)') !== false, 'Backup reader must hide other authors pending movements');
            check(stripos($sql, ' LIMIT ') === false, 'Backup must read all movements without pagination');
            $base = array('transaction_type' => 'expense', 'details' => '', 'is_quick' => 0, 'category' => 'food', 'place' => '', 'city' => 'Madrid', 'occurred_at' => '2026-10-02 12:00:00', 'amount' => '10.00', 'share_mode' => 'equal', 'payment_method' => 'card', 'paid_by_type' => 'person', 'paid_by_uid' => 'alice', 'applies_to_all' => 1, 'updated_at' => '2026-10-02 12:00:00');
            return array(array_merge($base, array('id' => 1, 'name' => 'Compartido', 'created_by' => 'bob', 'confirmed_at' => '2026-10-02 12:00:00')),
                array_merge($base, array('id' => 2, 'name' => 'Pendiente propio', 'created_by' => 'alice', 'confirmed_at' => null)));
        }
        return parent::execute($sql, $values);
    }
}

$storage = new BackupControllerConnection();
$api = apiFor('alice', $storage);
$class = new ReflectionClass('mistergastos');
$database = $class->getProperty('databaseName'); $database->setAccessible(true); $database->setValue($api, 'test');
$migrate = $class->getMethod('ensureTables'); $migrate->setAccessible(true); $migrate->invoke($api);
check($storage->version === 11, 'Schema 10 must migrate to 11');
check(count($storage->schemaWrites) === 2 && strpos($storage->schemaWrites[1], 'mg_backup_preferences') !== false, 'Upgrade must only add backups, without rerunning legacy data migrations');
check(strpos($storage->schemaWrites[1], 'REFERENCES mg_group_members(group_id,uid) ON DELETE CASCADE') !== false, 'Leaving a group must remove its backup schedule');
$storage->schemaWrites = array(); $migrate->invoke($api);
check(count($storage->schemaWrites) === 1, 'Current schema must skip migration');
$reader = $class->getMethod('getExpenses'); $reader->setAccessible(true); $expenses = $reader->invoke($api, 1, 'alice');
check(count($expenses) === 2 && $expenses[1]['confirmation_pending'], 'Real controller returns shared and own pending movements for backup');

echo "Backup controller visibility and schema migration checks passed.\n";
