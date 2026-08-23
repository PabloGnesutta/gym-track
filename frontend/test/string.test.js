import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize, matches } from '../js/lib/string.js';


test('normalize trims and lowercases', () => {
  assert.equal(normalize('  Press Banca  '), 'press banca');
});

test('matches is case-insensitive substring/regex matching', () => {
  assert.ok(matches('Press Banca', 'banca'));
  assert.ok(!matches('Press Banca', 'sentadilla'));
});
