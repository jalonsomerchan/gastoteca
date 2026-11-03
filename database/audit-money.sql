-- Read-only reconciliation of stored monetary data. Select the Gastoteca
-- database before running. An empty result in each query means no discrepancy
-- was found by that check. Do not auto-correct historical participant shares:
-- their intended allocation needs to be checked against the original movement.

SELECT e.id, e.group_id, e.amount, COUNT(p.uid) AS participants,
       COALESCE(SUM(p.share_amount), 0) AS allocated_amount,
       e.amount - COALESCE(SUM(p.share_amount), 0) AS difference,
       COALESCE(MIN(p.share_amount), 0) AS smallest_share
FROM mg_expenses e
LEFT JOIN mg_expense_participants p ON p.expense_id = e.id
GROUP BY e.id, e.group_id, e.amount
HAVING e.amount <= 0 OR COUNT(p.uid) = 0
    OR SUM(p.share_amount) <> e.amount OR MIN(p.share_amount) < 0
ORDER BY e.group_id, e.id;

SELECT id, group_id, payer_uid, payee_uid, amount
FROM mg_settlements
WHERE amount <= 0 OR payer_uid = payee_uid
ORDER BY group_id, id;

SELECT id, group_id, category_id, monthly_limit
FROM mg_budgets
WHERE monthly_limit <= 0
ORDER BY group_id, id;

SELECT id, group_id, source_uid, target_uid, amount
FROM mg_debts
WHERE amount <= 0 OR source_uid = target_uid
ORDER BY group_id, id;

SELECT p.expense_id, p.uid, p.share_amount
FROM mg_expense_participants p
LEFT JOIN mg_expenses e ON e.id = p.expense_id
WHERE e.id IS NULL;
