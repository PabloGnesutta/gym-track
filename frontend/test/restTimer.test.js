import { test } from 'node:test';
import assert from 'node:assert/strict';
import { remainingSeconds, formatRestTime, clampDuration } from '../js/lib/restTimer.js';


test('remainingSeconds counts up to the end timestamp', () => {
  assert.equal(remainingSeconds(10_000, 5_000), 5);
});

test('remainingSeconds clamps a past-due end timestamp to 0', () => {
  assert.equal(remainingSeconds(1_000, 5_000), 0);
});

test('formatRestTime pads seconds under 10', () => {
  assert.equal(formatRestTime(5), '0:05');
});

test('formatRestTime does not pad minutes', () => {
  assert.equal(formatRestTime(90), '1:30');
});

test('formatRestTime handles exactly zero', () => {
  assert.equal(formatRestTime(0), '0:00');
});

test('formatRestTime clamps negative input to zero', () => {
  assert.equal(formatRestTime(-5), '0:00');
});

test('clampDuration passes through an in-range value', () => {
  assert.equal(clampDuration(90), 90);
});

test('clampDuration clamps below the minimum', () => {
  assert.equal(clampDuration(0), 15);
});

test('clampDuration clamps above the maximum', () => {
  assert.equal(clampDuration(9999), 600);
});
