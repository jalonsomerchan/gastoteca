<?php

// Uses the real debt handlers and simulated transactional storage. No user data is touched.
require __DIR__ . '/debts-api.test.php';

class OfflineTestResult extends TemplateTestResult
{
    public function free() {}
}

class OfflineTestConnection extends DebtTestConnection
{
    public $receipts = array();
    public $groupId = 1;
    public $commits = 0;
    public $begins = 0;
    public $failReceipt = false;
    private $snapshot;
    public function query($sql)
    {
        if ($sql === 'SET TRANSACTION ISOLATION LEVEL READ COMMITTED') return true;
        return new OfflineTestResult($this->execute($sql, array()));
    }
    public function begin_transaction()
    {
        $this->begins++;
        $this->snapshot = serialize(array($this->debts, $this->receipts, $this->nextId));
        return true;
    }
    public function commit() { $this->commits++; $this->snapshot = null; return true; }
    public function rollback()
    {
        if ($this->snapshot !== null) list($this->debts, $this->receipts, $this->nextId) = unserialize($this->snapshot);
        $this->snapshot = null;
        return true;
    }
    public function execute($sql, $values)
    {
        if (strpos($sql, 'SELECT GET_LOCK') === 0) return array(array('acquired' => 1));
        if (strpos($sql, 'SELECT RELEASE_LOCK') === 0) return array();
        if (strpos($sql, 'SELECT group_id FROM mg_preferences') === 0) return array(array('group_id' => $this->groupId));
        if (strpos($sql, 'SELECT id FROM mg_groups WHERE id=? FOR UPDATE') === 0) return array(array('id' => $values[0]));
        if (strpos($sql, 'SELECT request_hash,receipt FROM mg_offline_operations') === 0) {
            $key = $values[0] . ':' . $values[1];
            return isset($this->receipts[$key]) ? array($this->receipts[$key]) : array();
        }
        if (strpos($sql, 'INSERT INTO mg_offline_operations') === 0) {
            if ($this->failReceipt) throw new RuntimeException('Simulated receipt failure');
            $this->receipts[$values[0] . ':' . $values[1]] = array('request_hash' => $values[3], 'receipt' => $values[4]);
            return array();
        }
        if (strpos($sql, 'SELECT updated_at FROM mg_expenses') === 0) return array(array('updated_at' => '2026-10-04 13:00:00'));
        return parent::execute($sql, $values);
    }
}

$offlineStorage = new OfflineTestConnection();
$offlineApi = apiFor('alice', $offlineStorage);
$operation = array('operation_id' => '12345678-1234-4234-8234-123456789012', 'group_id' => 1, 'action' => 'save_debt',
    'body' => array('concept' => 'Offline debt', 'amount' => 25, 'status' => 'pending', 'source_uid' => 'alice', 'target_uid' => 'bob'));
$_POST = $operation;
$response = $offlineApi->sync_operation();
check($response['ok'] && $response['data']['entity_id'] === 1, 'New entities must return their server id');
check(count($offlineStorage->debts) === 1 && count($offlineStorage->receipts) === 1, 'Debt and receipt must commit together');
check($offlineStorage->begins === 1 && $offlineStorage->commits === 1, 'One outer transaction must commit the operation');
$_POST = $operation;
$replayed = $offlineApi->sync_operation();
check($replayed['ok'] && $replayed['data']['replayed'] && $replayed['data']['entity_id'] === 1, 'Lost responses must replay the receipt');
check(count($offlineStorage->debts) === 1 && $offlineStorage->commits === 1, 'Replaying an operation must not write again');
check(!isset($replayed['data']['data']['group']), 'Receipts must not retain or disclose group snapshots');

$_POST = $operation;
$_POST['body']['amount'] = 99;
check($offlineApi->sync_operation()['code'] === 'OFFLINE_OPERATION_REUSED', 'An operation id must not accept a different body');

$_POST = $operation;
$_POST['operation_id'] = '22345678-1234-4234-8234-123456789012';
$_POST['body']['target_uid'] = 'other';
check($offlineApi->sync_operation()['status'] === 400, 'Synchronization must keep normal server validation');
check(count($offlineStorage->receipts) === 1 && count($offlineStorage->debts) === 1, 'Rejected operations must roll back');

$_POST = $operation;
$_POST['operation_id'] = '32345678-1234-4234-8234-123456789012';
$offlineStorage->groupId = 2;
check($offlineApi->sync_operation()['code'] === 'OFFLINE_GROUP_CHANGED', 'Queued writes must never move to another group');
$offlineStorage->groupId = 1;

$_POST = $operation;
$_POST['action'] = 'invite_email';
check($offlineApi->sync_operation()['status'] === 400, 'External actions must not enter the offline queue');
$_POST['action'] = 'sync_operation';
check($offlineApi->sync_operation()['status'] === 400, 'Recursive synchronization must be rejected');

$_POST = $operation;
$_POST['operation_id'] = '42345678-1234-4234-8234-123456789012';
$_POST['action'] = 'save_expense';
$_POST['body']['id'] = 42;
$_POST['expected_updated_at'] = '2026-10-04 12:00:00';
check($offlineApi->sync_operation()['code'] === 'OFFLINE_CONFLICT', 'Stale edits must be retained for review');

$_POST = $operation;
$_POST['operation_id'] = '52345678-1234-4234-8234-123456789012';
$offlineStorage->failReceipt = true;
try { $offlineApi->sync_operation(); check(false, 'Expected receipt error'); } catch (RuntimeException $error) {
    check($error->getMessage() === 'Simulated receipt failure', 'Unexpected failure');
}
check(count($offlineStorage->debts) === 1 && count($offlineStorage->receipts) === 1, 'Receipt failure must roll back the business change');
$offlineStorage->failReceipt = false;
check($offlineApi->sync_operation()['ok'], 'A rolled back operation must remain retryable');
check(count($offlineStorage->debts) === 2 && count($offlineStorage->receipts) === 2, 'Retry must create exactly one new debt');

$proxy = new GastotecaOfflineConnection($offlineStorage);
$begins = $offlineStorage->begins;
$commits = $offlineStorage->commits;
$proxy->begin_transaction(); $proxy->commit(); $proxy->rollback();
check($offlineStorage->begins === $begins && $offlineStorage->commits === $commits, 'Nested handlers must not commit the outer transaction');
check($offlineApi->ConectorBD === $offlineStorage, 'The original connection must be restored after every path');
echo "Offline synchronization validation, atomic receipts, replay and isolation checks passed.\n";
