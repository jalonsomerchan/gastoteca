<?php

// Run with: php tests/quick-template-api.test.php /path/to/api/mistergastos.php
// Exercise the real endpoints with an in-memory connector and cached identity.
// No Firebase requests, controller constructors or database connections run.
class BaseControler
{
    public $ConectorBD;
}

if (!defined('MYSQLI_ASSOC')) define('MYSQLI_ASSOC', 1);
require $argv[1];

class TemplateTestResult
{
    private $rows;
    public function __construct($rows) { $this->rows = $rows; }
    public function fetch_all($mode) { return $this->rows; }
}

class TemplateTestStatement
{
    private $connection;
    private $sql;
    private $values = array();
    private $rows = array();
    public function __construct($connection, $sql) { $this->connection = $connection; $this->sql = $sql; }
    public function bind_param($types, &...$values) { $this->values = $values; }
    public function execute() { $this->rows = $this->connection->execute($this->sql, $this->values); return true; }
    public function get_result() { return new TemplateTestResult($this->rows); }
    public function close() {}
}

class TemplateTestConnection
{
    public $templates = array();
    public $members = array(1 => array('alice', 'bob'), 2 => array('other'));
    public function prepare($sql) { return new TemplateTestStatement($this, $sql); }
    public function execute($sql, $values)
    {
        if (strpos($sql, 'SELECT t.uid,t.templates FROM mg_quick_expense_templates') === 0) {
            $rows = array();
            foreach ($this->templates[$values[0]] as $uid => $templates) {
                if (in_array($uid, $this->members[$values[0]], true))
                    $rows[] = array('uid' => $uid, 'templates' => json_encode($templates));
            }
            usort($rows, function ($a, $b) use ($values) {
                return (int) ($b['uid'] === $values[1]) - (int) ($a['uid'] === $values[1]) ?: strcmp($a['uid'], $b['uid']);
            });
            return $rows;
        }
        if (strpos($sql, 'INSERT INTO mg_quick_expense_templates') === 0) {
            $this->templates[$values[0]][$values[1]] = json_decode($values[2], true);
            return array();
        }
        if (strpos($sql, 'SELECT group_id FROM mg_preferences') === 0) return array(array('group_id' => 1));
        if (strpos($sql, 'SELECT uid FROM mg_group_members') === 0)
            return in_array($values[1], $this->members[$values[0]], true) ? array(array('uid' => $values[1])) : array();
        if (strpos($sql, 'SELECT id,name,owner_uid,invite_code') === 0)
            return array(array('id' => 1, 'name' => 'Test', 'owner_uid' => 'alice', 'invite_code' => 'TEST1234', 'default_city' => '', 'default_payment_method' => 'card'));
        if (strpos($sql, 'SELECT uid,email,name FROM mg_group_members') === 0)
            return array_map(function ($uid) { return array('uid' => $uid, 'email' => $uid . '@example.test', 'name' => $uid); }, $this->members[1]);
        foreach (array('SELECT email FROM mg_group_invites', 'SELECT category_key,label,icon', 'SELECT name,icon FROM mg_places', 'SELECT t.id,t.name', 'SELECT c.category_key', 'SELECT id,active,frequency', 'SELECT id,concept,status,source_uid,target_uid,source_name,target_name,amount,created_at') as $prefix) {
            if (strpos($sql, $prefix) === 0) return array();
        }
        foreach (array('INSERT IGNORE INTO mg_preferences', 'UPDATE mg_group_members SET email', 'INSERT INTO mg_categories') as $prefix) {
            if (strpos($sql, $prefix) === 0) return array();
        }
        throw new RuntimeException('Unexpected query: ' . $sql);
    }
}

function check($condition, $message)
{
    if (!$condition) throw new RuntimeException($message);
}

function apiFor($uid, $connection)
{
    $class = new ReflectionClass('mistergastos');
    $api = $class->newInstanceWithoutConstructor();
    $api->ConectorBD = $connection;
    $identity = $class->getProperty('identityCache');
    $identity->setAccessible(true);
    $identity->setValue($api, array('claims' => array('uid' => $uid, 'name' => $uid, 'email' => $uid . '@example.test')));
    return $api;
}

function templateFor($id, $visibility = 'private')
{
    return array('id' => $id, 'title' => $id, 'name' => $id, 'fields' => array('name'), 'visibility' => $visibility);
}

function visibleIds($api)
{
    $response = $api->quick_expense_templates();
    check($response['ok'], 'The read endpoint failed.');
    return array_column($response['data']['templates'], 'id');
}

function saveTemplates($api, $templates)
{
    $_POST = array('templates' => $templates);
    return $api->save_quick_expense_templates();
}

$connection = new TemplateTestConnection();
$legacy = templateFor('legacy');
unset($legacy['visibility']);
$spoofed = templateFor('bob-shared', 'group');
$spoofed['created_by'] = 'alice';
$spoofed['can_edit'] = true;
$connection->templates = array(
    1 => array(
        'alice' => array(templateFor('alice-private'), $legacy, templateFor('alice-shared', 'group')),
        'bob' => array(templateFor('bob-private'), $legacy, $spoofed),
        'departed' => array(templateFor('departed-shared', 'group')),
    ),
    2 => array('other' => array(templateFor('other-group', 'group'))),
);
$aliceApi = apiFor('alice', $connection);
$bobApi = apiFor('bob', $connection);

check(visibleIds($aliceApi) === array('alice-private', 'legacy', 'alice-shared', 'bob-shared'), 'Personal, legacy, departed or other-group templates leaked.');
check(visibleIds($bobApi) === array('bob-private', 'legacy', 'bob-shared', 'alice-shared'), 'Shared templates were not available to another member.');
$read = $aliceApi->quick_expense_templates()['data']['templates'];
check($read[1]['visibility'] === 'private', 'Legacy templates must stay private.');
check($read[3]['created_by'] === 'bob' && $read[3]['can_edit'] === false, 'Stored creator metadata must not override row ownership.');

$before = $connection->templates;
$foreign = templateFor('bob-shared', 'private');
$foreign['created_by'] = 'bob';
check(saveTemplates($aliceApi, array($foreign))['status'] === 403, 'Another creator template was accepted for editing.');
check($connection->templates === $before, 'A forbidden save changed storage.');
check(saveTemplates($aliceApi, array(templateFor('bad', 'everyone')))['status'] === 400, 'An invalid visibility was accepted.');
check(saveTemplates($aliceApi, array_fill(0, 13, templateFor('excess')))['code'] === 'TOO_MANY_QUICK_TEMPLATES', 'The per-creator limit was not enforced.');
check(saveTemplates($aliceApi, array(templateFor('duplicate'), templateFor('duplicate')))['status'] === 400, 'Duplicate template ids were accepted.');
check($connection->templates === $before, 'A rejected save changed storage.');

$saved = saveTemplates($aliceApi, array(templateFor('new-shared', 'group'), templateFor('personal')));
check($saved['ok'], 'Sharing an own template failed.');
check(array_column($saved['data']['templates'], 'id') === array('new-shared', 'personal', 'bob-shared'), 'Saving must return own and shared templates.');
check(in_array('new-shared', visibleIds($bobApi), true), 'The shared template did not appear for another member.');
check(!in_array('personal', visibleIds($bobApi), true), 'The personal template appeared for another member.');
check($connection->templates[1]['bob'] === $before[1]['bob'], 'Saving overwrote another creator templates.');

$saved = saveTemplates($aliceApi, array(templateFor('new-shared', 'private')));
check($saved['ok'] && !in_array('new-shared', visibleIds($bobApi), true), 'Making a template private did not stop sharing it.');
$saved = saveTemplates($aliceApi, array());
check($saved['ok'] && array_column($saved['data']['templates'], 'id') === array('bob-shared'), 'Deleting own templates removed another creator shared template.');
check($connection->templates[1]['bob'] === $before[1]['bob'], 'Deleting overwrote another creator templates.');

echo "Quick template API visibility and ownership checks passed.\n";
