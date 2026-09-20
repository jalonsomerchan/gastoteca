import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isPositiveAmount, splitValidation } from '../src/domain/validation.js'

test('amount validation rejects nonfinite, negative and oversized amounts', () => {
  for (const amount of [NaN, Infinity, '', 'abc', 0, -1, 100000000]) assert.equal(isPositiveAmount(amount), false)
  assert.equal(isPositiveAmount('0.01'), true)
})

test('share validation works in cents and supports percentages', () => {
  assert.equal(splitValidation([0.1, 0.2], 0.3), '')
  assert.equal(splitValidation([33.33, 33.33, 33.34], 100, true), '')
  assert.match(splitValidation([50, 45], 100, true), /100 %/)
  assert.match(splitValidation([-5, 15], 10), /igual o mayor/)
  assert.match(splitValidation(['invalid'], 10), /número/)
})
