import { test } from 'node:test';
import assert from 'node:assert/strict';
import { timeAgo, toYYYYMMDD } from '../js/lib/date.js';


test('toYYYYMMDD pads single-digit month and day', () => {
  assert.equal(toYYYYMMDD(new Date(2026, 0, 5)), '2026-01-05');
});

test('toYYYYMMDD does not pad double-digit month and day', () => {
  assert.equal(toYYYYMMDD(new Date(2026, 10, 23)), '2026-11-23');
});

test('timeAgo returns "hoy" for a timestamp earlier today', () => {
  const now = new Date();
  const earlierToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 1);
  assert.equal(timeAgo(earlierToday), 'hoy');
});

test('timeAgo returns "ayer" for exactly one whole day ago', () => {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  assert.equal(timeAgo(oneDayAgo), 'ayer');
});

test('timeAgo returns weeks for a week-old date', () => {
  const weekAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
  assert.equal(timeAgo(weekAgo), '1 semana+');
});

test('timeAgo returns "¡!" for an invalid date', () => {
  assert.equal(timeAgo('not a date'), '¡!');
});
