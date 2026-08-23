import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { runMigrations } from '../src/db/migrate.js';
import { migrations } from '../src/db/migrations/index.js';
import { addAllowedEmail } from '../src/db/allowedEmails.js';
import { createAuthService } from '../src/services/authService.js';
import { createExerciseService } from '../src/services/exerciseService.js';
import { createSessionService } from '../src/services/sessionService.js';
import { ServiceError } from '../src/services/ServiceError.js';


function makeServices() {
  const db = new DatabaseSync(':memory:');
  runMigrations(db, migrations);
  return {
    authService: createAuthService(db),
    exerciseService: createExerciseService(db),
    sessionService: createSessionService(db),
    db,
  };
}

function makeUser(authService, db, email) {
  addAllowedEmail(db, email);
  return authService.createUser(email, 'password123').id;
}

const DAY_MS = 24 * 60 * 60 * 1000;

test('addSet rejects a nonexistent exercise', () => {
  const { authService, sessionService, db } = makeServices();
  const userId = makeUser(authService, db, 'a@test.local');
  assert.throws(() => sessionService.addSet(userId, 999, { weight: 40, reps: 10 }), ServiceError);
});

test('addSet rejects an exercise owned by another user', () => {
  const { authService, exerciseService, sessionService, db } = makeServices();
  const userA = makeUser(authService, db, 'a@test.local');
  const userB = makeUser(authService, db, 'b@test.local');
  const exercise = exerciseService.createExercise(userA, 'Press banca');

  assert.throws(() => sessionService.addSet(userB, exercise.id, { weight: 40, reps: 10 }), ServiceError);
});

test('addSet creates a new session with one weight row', () => {
  const { authService, exerciseService, sessionService, db } = makeServices();
  const userId = makeUser(authService, db, 'a@test.local');
  const exercise = exerciseService.createExercise(userId, 'Press banca');

  const session = sessionService.addSet(userId, exercise.id, { weight: 40, reps: 10 });

  assert.equal(session.exerciseId, exercise.id);
  assert.deepEqual(session.sets, [{ w: 40, r: [10] }]);
});

test('addSet with the same weight on the same day appends to that weight row', () => {
  const { authService, exerciseService, sessionService, db } = makeServices();
  const userId = makeUser(authService, db, 'a@test.local');
  const exercise = exerciseService.createExercise(userId, 'Press banca');
  const now = Date.now();

  sessionService.addSet(userId, exercise.id, { weight: 40, reps: 10 }, now);
  const session = sessionService.addSet(userId, exercise.id, { weight: 40, reps: 8 }, now + 1000);

  assert.deepEqual(session.sets, [{ w: 40, r: [10, 8] }]);
});

test('addSet with a different weight on the same day starts a new weight row', () => {
  const { authService, exerciseService, sessionService, db } = makeServices();
  const userId = makeUser(authService, db, 'a@test.local');
  const exercise = exerciseService.createExercise(userId, 'Press banca');
  const now = Date.now();

  sessionService.addSet(userId, exercise.id, { weight: 40, reps: 10 }, now);
  const session = sessionService.addSet(userId, exercise.id, { weight: 45, reps: 6 }, now + 1000);

  assert.deepEqual(session.sets, [{ w: 40, r: [10] }, { w: 45, r: [6] }]);
});

test('addSet on a different day starts a new session', () => {
  const { authService, exerciseService, sessionService, db } = makeServices();
  const userId = makeUser(authService, db, 'a@test.local');
  const exercise = exerciseService.createExercise(userId, 'Press banca');
  const now = Date.now();

  const first = sessionService.addSet(userId, exercise.id, { weight: 40, reps: 10 }, now);
  const second = sessionService.addSet(userId, exercise.id, { weight: 40, reps: 10 }, now + DAY_MS);

  assert.notEqual(first.id, second.id);
  assert.equal(sessionService.listSessionsForExercise(userId, exercise.id).length, 2);
});

test('two users\' sessions for same-named exercises never mix', () => {
  const { authService, exerciseService, sessionService, db } = makeServices();
  const userA = makeUser(authService, db, 'a@test.local');
  const userB = makeUser(authService, db, 'b@test.local');
  const exA = exerciseService.createExercise(userA, 'Press banca');
  const exB = exerciseService.createExercise(userB, 'Press banca');

  sessionService.addSet(userA, exA.id, { weight: 40, reps: 10 });
  sessionService.addSet(userB, exB.id, { weight: 80, reps: 5 });

  assert.deepEqual(sessionService.listSessionsForExercise(userA, exA.id)[0].sets, [{ w: 40, r: [10] }]);
  assert.deepEqual(sessionService.listSessionsForExercise(userB, exB.id)[0].sets, [{ w: 80, r: [5] }]);
});

test('listSessionsForExercise orders most recent first', () => {
  const { authService, exerciseService, sessionService, db } = makeServices();
  const userId = makeUser(authService, db, 'a@test.local');
  const exercise = exerciseService.createExercise(userId, 'Press banca');
  const now = Date.now();

  sessionService.addSet(userId, exercise.id, { weight: 40, reps: 10 }, now);
  sessionService.addSet(userId, exercise.id, { weight: 40, reps: 10 }, now + DAY_MS);

  const sessions = sessionService.listSessionsForExercise(userId, exercise.id);
  assert.equal(sessions.length, 2);
  assert.ok(sessions[0].date > sessions[1].date);
});

test('listSessionsForExercise rejects a nonexistent exercise', () => {
  const { authService, sessionService, db } = makeServices();
  const userId = makeUser(authService, db, 'a@test.local');
  assert.throws(() => sessionService.listSessionsForExercise(userId, 999), ServiceError);
});

test('updateSession replaces sets and notes wholesale', () => {
  const { authService, exerciseService, sessionService, db } = makeServices();
  const userId = makeUser(authService, db, 'a@test.local');
  const exercise = exerciseService.createExercise(userId, 'Press banca');
  const session = sessionService.addSet(userId, exercise.id, { weight: 40, reps: 10 });

  const updated = sessionService.updateSession(userId, session.id, {
    sets: [{ w: 42.5, r: [8, 8] }],
    notes: 'Se sintió pesado',
  });

  assert.deepEqual(updated.sets, [{ w: 42.5, r: [8, 8] }]);
  assert.equal(updated.notes, 'Se sintió pesado');
});

test('updateSession cannot be called by another user', () => {
  const { authService, exerciseService, sessionService, db } = makeServices();
  const userA = makeUser(authService, db, 'a@test.local');
  const userB = makeUser(authService, db, 'b@test.local');
  const exercise = exerciseService.createExercise(userA, 'Press banca');
  const session = sessionService.addSet(userA, exercise.id, { weight: 40, reps: 10 });

  assert.throws(() => sessionService.updateSession(userB, session.id, { notes: 'hack' }), ServiceError);
});

test('deleteSession removes it', () => {
  const { authService, exerciseService, sessionService, db } = makeServices();
  const userId = makeUser(authService, db, 'a@test.local');
  const exercise = exerciseService.createExercise(userId, 'Press banca');
  const session = sessionService.addSet(userId, exercise.id, { weight: 40, reps: 10 });

  sessionService.deleteSession(userId, session.id);

  assert.throws(() => sessionService.getSession(userId, session.id), ServiceError);
});

test('deleteSession throws for a nonexistent id', () => {
  const { authService, sessionService, db } = makeServices();
  const userId = makeUser(authService, db, 'a@test.local');
  assert.throws(() => sessionService.deleteSession(userId, 999), ServiceError);
});
