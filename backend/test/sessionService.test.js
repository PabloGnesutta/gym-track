import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { runMigrations } from '../src/db/migrate.js';
import { migrations } from '../src/db/migrations/index.js';
import { createExerciseService } from '../src/services/exerciseService.js';
import { createSessionService } from '../src/services/sessionService.js';
import { ServiceError } from '../src/services/ServiceError.js';


function makeServices() {
  const db = new DatabaseSync(':memory:');
  runMigrations(db, migrations);
  return {
    exerciseService: createExerciseService(db),
    sessionService: createSessionService(db),
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

test('addSet rejects a nonexistent exercise', () => {
  const { sessionService } = makeServices();
  assert.throws(() => sessionService.addSet(999, { weight: 40, reps: 10 }), ServiceError);
});

test('addSet creates a new session with one weight row', () => {
  const { exerciseService, sessionService } = makeServices();
  const exercise = exerciseService.createExercise('Press banca');

  const session = sessionService.addSet(exercise.id, { weight: 40, reps: 10 });

  assert.equal(session.exerciseId, exercise.id);
  assert.deepEqual(session.sets, [{ w: 40, r: [10] }]);
});

test('addSet with the same weight on the same day appends to that weight row', () => {
  const { exerciseService, sessionService } = makeServices();
  const exercise = exerciseService.createExercise('Press banca');
  const now = Date.now();

  sessionService.addSet(exercise.id, { weight: 40, reps: 10 }, now);
  const session = sessionService.addSet(exercise.id, { weight: 40, reps: 8 }, now + 1000);

  assert.deepEqual(session.sets, [{ w: 40, r: [10, 8] }]);
});

test('addSet with a different weight on the same day starts a new weight row', () => {
  const { exerciseService, sessionService } = makeServices();
  const exercise = exerciseService.createExercise('Press banca');
  const now = Date.now();

  sessionService.addSet(exercise.id, { weight: 40, reps: 10 }, now);
  const session = sessionService.addSet(exercise.id, { weight: 45, reps: 6 }, now + 1000);

  assert.deepEqual(session.sets, [{ w: 40, r: [10] }, { w: 45, r: [6] }]);
});

test('addSet on a different day starts a new session', () => {
  const { exerciseService, sessionService } = makeServices();
  const exercise = exerciseService.createExercise('Press banca');
  const now = Date.now();

  const first = sessionService.addSet(exercise.id, { weight: 40, reps: 10 }, now);
  const second = sessionService.addSet(exercise.id, { weight: 40, reps: 10 }, now + DAY_MS);

  assert.notEqual(first.id, second.id);
  assert.equal(sessionService.listSessionsForExercise(exercise.id).length, 2);
});

test('listSessionsForExercise orders most recent first', () => {
  const { exerciseService, sessionService } = makeServices();
  const exercise = exerciseService.createExercise('Press banca');
  const now = Date.now();

  sessionService.addSet(exercise.id, { weight: 40, reps: 10 }, now);
  sessionService.addSet(exercise.id, { weight: 40, reps: 10 }, now + DAY_MS);

  const sessions = sessionService.listSessionsForExercise(exercise.id);
  assert.equal(sessions.length, 2);
  assert.ok(sessions[0].date > sessions[1].date);
});

test('listSessionsForExercise rejects a nonexistent exercise', () => {
  const { sessionService } = makeServices();
  assert.throws(() => sessionService.listSessionsForExercise(999), ServiceError);
});

test('updateSession replaces sets and notes wholesale', () => {
  const { exerciseService, sessionService } = makeServices();
  const exercise = exerciseService.createExercise('Press banca');
  const session = sessionService.addSet(exercise.id, { weight: 40, reps: 10 });

  const updated = sessionService.updateSession(session.id, {
    sets: [{ w: 42.5, r: [8, 8] }],
    notes: 'Se sintió pesado',
  });

  assert.deepEqual(updated.sets, [{ w: 42.5, r: [8, 8] }]);
  assert.equal(updated.notes, 'Se sintió pesado');
});

test('deleteSession removes it', () => {
  const { exerciseService, sessionService } = makeServices();
  const exercise = exerciseService.createExercise('Press banca');
  const session = sessionService.addSet(exercise.id, { weight: 40, reps: 10 });

  sessionService.deleteSession(session.id);

  assert.throws(() => sessionService.getSession(session.id), ServiceError);
});

test('deleteSession throws for a nonexistent id', () => {
  const { sessionService } = makeServices();
  assert.throws(() => sessionService.deleteSession(999), ServiceError);
});
