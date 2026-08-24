import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRoute } from '../js/common/routeMatch.js';


test('parseRoute: root path maps to the exercise list', () => {
  assert.deepEqual(parseRoute('/'), { view: 'ExerciseList' });
});

test('parseRoute: /exercise/:key maps to the single exercise view', () => {
  assert.deepEqual(parseRoute('/exercise/42'), { view: 'SingleExercise', exerciseKey: '42' });
});

test('parseRoute: trailing slash on /exercise/:key is tolerated', () => {
  assert.deepEqual(parseRoute('/exercise/42/'), { view: 'SingleExercise', exerciseKey: '42' });
});

test('parseRoute: unknown or malformed paths fall back to the exercise list', () => {
  assert.deepEqual(parseRoute('/settings'), { view: 'ExerciseList' });
  assert.deepEqual(parseRoute('/exercise/'), { view: 'ExerciseList' });
});

test('parseRoute: /analytics maps to the Analytics view', () => {
  assert.deepEqual(parseRoute('/analytics'), { view: 'Analytics' });
});

test('parseRoute: trailing slash on /analytics is tolerated', () => {
  assert.deepEqual(parseRoute('/analytics/'), { view: 'Analytics' });
});

test('parseRoute: /muscles maps to the Muscles view', () => {
  assert.deepEqual(parseRoute('/muscles'), { view: 'Muscles' });
});

test('parseRoute: trailing slash on /muscles is tolerated', () => {
  assert.deepEqual(parseRoute('/muscles/'), { view: 'Muscles' });
});
