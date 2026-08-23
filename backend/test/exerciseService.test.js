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

/** Creates and returns an allow-listed, logged-in user's id. */
function makeUser(authService, db, email) {
  addAllowedEmail(db, email);
  return authService.createUser(email, 'password123').id;
}

test('createExercise stores name and muscles', () => {
  const { authService, exerciseService, db } = makeServices();
  const userId = makeUser(authService, db, 'a@test.local');

  const exercise = exerciseService.createExercise(userId, 'Press banca', ['pecho', 'triceps']);

  assert.equal(exercise.name, 'Press banca');
  assert.deepEqual(exercise.muscles, ['pecho', 'triceps']);
  assert.ok(exercise.id);
});

test('createExercise rejects an empty name', () => {
  const { authService, exerciseService, db } = makeServices();
  const userId = makeUser(authService, db, 'a@test.local');
  assert.throws(() => exerciseService.createExercise(userId, '   '), ServiceError);
});

test('createExercise rejects a duplicate name for the same user', () => {
  const { authService, exerciseService, db } = makeServices();
  const userId = makeUser(authService, db, 'a@test.local');
  exerciseService.createExercise(userId, 'Sentadilla');
  assert.throws(() => exerciseService.createExercise(userId, 'Sentadilla'), ServiceError);
});

test('two different users can each have an exercise with the same name', () => {
  const { authService, exerciseService, db } = makeServices();
  const userA = makeUser(authService, db, 'a@test.local');
  const userB = makeUser(authService, db, 'b@test.local');

  const exA = exerciseService.createExercise(userA, 'Sentadilla');
  const exB = exerciseService.createExercise(userB, 'Sentadilla');

  assert.notEqual(exA.id, exB.id);
});

test('listExercises only returns the calling user\'s exercises', () => {
  const { authService, exerciseService, db } = makeServices();
  const userA = makeUser(authService, db, 'a@test.local');
  const userB = makeUser(authService, db, 'b@test.local');
  exerciseService.createExercise(userA, 'Sentadilla');
  exerciseService.createExercise(userB, 'Peso muerto');

  const exercisesA = exerciseService.listExercises(userA);
  assert.equal(exercisesA.length, 1);
  assert.equal(exercisesA[0].name, 'Sentadilla');
});

test('getExercise throws for a nonexistent id', () => {
  const { authService, exerciseService, db } = makeServices();
  const userId = makeUser(authService, db, 'a@test.local');
  assert.throws(() => exerciseService.getExercise(userId, 999), ServiceError);
});

test('getExercise throws when the exercise belongs to another user', () => {
  const { authService, exerciseService, db } = makeServices();
  const userA = makeUser(authService, db, 'a@test.local');
  const userB = makeUser(authService, db, 'b@test.local');
  const exercise = exerciseService.createExercise(userA, 'Sentadilla');

  assert.throws(() => exerciseService.getExercise(userB, exercise.id), ServiceError);
});

test('updateExercise renames and rejects a collision with another of the same user\'s exercises', () => {
  const { authService, exerciseService, db } = makeServices();
  const userId = makeUser(authService, db, 'a@test.local');
  const a = exerciseService.createExercise(userId, 'Sentadilla');
  exerciseService.createExercise(userId, 'Peso muerto');

  const updated = exerciseService.updateExercise(userId, a.id, { name: 'Sentadilla libre' });
  assert.equal(updated.name, 'Sentadilla libre');

  assert.throws(() => exerciseService.updateExercise(userId, a.id, { name: 'Peso muerto' }), ServiceError);
});

test('updateExercise cannot rename another user\'s exercise', () => {
  const { authService, exerciseService, db } = makeServices();
  const userA = makeUser(authService, db, 'a@test.local');
  const userB = makeUser(authService, db, 'b@test.local');
  const exercise = exerciseService.createExercise(userA, 'Sentadilla');

  assert.throws(() => exerciseService.updateExercise(userB, exercise.id, { name: 'Robado' }), ServiceError);
});

test('deleteExercise removes the exercise and cascades its sessions', () => {
  const { authService, exerciseService, sessionService, db } = makeServices();
  const userId = makeUser(authService, db, 'a@test.local');
  const exercise = exerciseService.createExercise(userId, 'Sentadilla');
  sessionService.addSet(userId, exercise.id, { weight: 60, reps: 8 });

  exerciseService.deleteExercise(userId, exercise.id);

  assert.throws(() => exerciseService.getExercise(userId, exercise.id), ServiceError);
  assert.throws(() => sessionService.listSessionsForExercise(userId, exercise.id), ServiceError);
});

test('deleteExercise cannot delete another user\'s exercise', () => {
  const { authService, exerciseService, db } = makeServices();
  const userA = makeUser(authService, db, 'a@test.local');
  const userB = makeUser(authService, db, 'b@test.local');
  const exercise = exerciseService.createExercise(userA, 'Sentadilla');

  assert.throws(() => exerciseService.deleteExercise(userB, exercise.id), ServiceError);
  assert.doesNotThrow(() => exerciseService.getExercise(userA, exercise.id));
});
