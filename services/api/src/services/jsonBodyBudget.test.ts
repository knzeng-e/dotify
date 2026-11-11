import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertBoundedJson, JsonBodyBudgetError } from './jsonBodyBudget.js';

test('network JSON budget refuses oversized collections before enumerating their elements', () => {
  const array = new Array(257);
  Object.defineProperty(array, 0, {
    get() {
      throw new Error('Must not visit an oversized collection');
    }
  });
  assert.throws(() => assertBoundedJson(array), JsonBodyBudgetError);
  assert.throws(() => assertBoundedJson(Object.fromEntries(Array.from({ length: 129 }, (_, i) => [String(i), 1]))), JsonBodyBudgetError);
  assert.throws(() => assertBoundedJson({ ['k'.repeat(257)]: 1 }), JsonBodyBudgetError);
  assert.throws(() => assertBoundedJson('a'.repeat(64 * 1024 + 1)), JsonBodyBudgetError);
});

test('network JSON depth and aggregate budgets stay finite while ordinary public forms pass', () => {
  let value: unknown = null;
  for (let i = 0; i < 17; i++) value = [value];
  assert.throws(() => assertBoundedJson(value), JsonBodyBudgetError);
  assert.throws(() => assertBoundedJson(Array.from({ length: 33 }, () => new Array(256).fill(0))), JsonBodyBudgetError);
  assertBoundedJson({ tracks: Array.from({ length: 5 }, () => ({ contentHash: 'hash', releaseId: 'release' })) });
  assertBoundedJson({ runtimes: Array.from({ length: 100 }, () => '0x' + '12'.repeat(20)) });
  assertBoundedJson({ title: 'Track', credits: Array.from({ length: 20 }, () => ({ name: 'Artist', role: 'Voice' })) });
  assertBoundedJson('a'.repeat(64 * 1024));
});
