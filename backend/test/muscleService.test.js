import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { runMigrations } from '../src/db/migrate.js';
import { migrations } from '../src/db/migrations/index.js';
import { addAllowedEmail } from '../src/db/allowedEmails.js';
import { createAuthService } from '../src/services/authService.js';
import { createExerciseService } from '../src/services/exerciseService.js';
import { createMuscleService } from '../src/services/muscleService.js';
import { ServiceError } from '../src/services/ServiceError.js';


function makeServices() {
  const db = new DatabaseSync(':memory:');
  runMigrations(db, migrations);
  return {
    authService: createAuthService(db),
    exerciseService: createExerciseService(db),
    muscleService: createMuscleService(db),
    db,
  };
}

/** Creates and returns an allow-listed, logged-in user's id. */
function makeUser(authService, db, email) {
  addAllowedEmail(db, email);
  return authService.createUser(email, 'password123').id;
}

test('listMuscles returns each tag with its exercise count', () => {
  const { authService, exerciseService, muscleService, db } = makeServices();
  const userId = makeUser(authService, db, 'a@test.local');
  exerciseService.createExercise(userId, 'Press banca', ['pecho', 'triceps']);
  exerciseService.createExercise(userId, 'Aperturas', ['pecho']);

  const muscles = muscleService.listMuscles(userId);
  assert.deepEqual(muscles.map(m => [m.name, m.exerciseCount]).sort(), [
    ['pecho', 2],
    ['triceps', 1],
  ]);
});

test('listMuscles only returns the calling user\'s muscles', () => {
  const { authService, exerciseService, muscleService, db } = makeServices();
  const userA = makeUser(authService, db, 'a@test.local');
  const userB = makeUser(authService, db, 'b@test.local');
  exerciseService.createExercise(userA, 'Sentadilla', ['piernas']);
  exerciseService.createExercise(userB, 'Curl', ['biceps']);

  const musclesA = muscleService.listMuscles(userA);
  assert.equal(musclesA.length, 1);
  assert.equal(musclesA[0].name, 'piernas');
});

test('renameMuscle (no collision) renames in place, visible through exerciseService - proving it\'s a real reference, not a copy', () => {
  const { authService, exerciseService, muscleService, db } = makeServices();
  const userId = makeUser(authService, db, 'a@test.local');
  const exercise = exerciseService.createExercise(userId, 'Press banca', ['pecho']);
  const [muscle] = muscleService.listMuscles(userId);

  const renamed = muscleService.renameMuscle(userId, muscle.id, 'Torso');
  assert.equal(renamed.name, 'torso');
  assert.equal(renamed.exerciseCount, 1);

  const updatedExercise = exerciseService.getExercise(userId, exercise.id);
  assert.deepEqual(updatedExercise.muscles, ['torso']);
});

test('renameMuscle normalizes the new name (trim + lowercase)', () => {
  const { authService, exerciseService, muscleService, db } = makeServices();
  const userId = makeUser(authService, db, 'a@test.local');
  exerciseService.createExercise(userId, 'Press banca', ['pecho']);
  const [muscle] = muscleService.listMuscles(userId);

  const renamed = muscleService.renameMuscle(userId, muscle.id, '  PECTORALES  ');
  assert.equal(renamed.name, 'pectorales');
});

test('renameMuscle merges into an existing muscle with the same normalized name', () => {
  const { authService, exerciseService, muscleService, db } = makeServices();
  const userId = makeUser(authService, db, 'a@test.local');
  const exerciseA = exerciseService.createExercise(userId, 'Press banca', ['pecho']);
  const exerciseB = exerciseService.createExercise(userId, 'Aperturas', ['torso']);
  const muscles = muscleService.listMuscles(userId);
  const pecho = muscles.find(m => m.name === 'pecho');
  const torso = muscles.find(m => m.name === 'torso');

  const merged = muscleService.renameMuscle(userId, torso.id, 'pecho');

  assert.equal(merged.id, pecho.id);
  assert.equal(merged.exerciseCount, 2);
  assert.deepEqual(muscleService.listMuscles(userId).map(m => m.name), ['pecho']);
  assert.deepEqual(exerciseService.getExercise(userId, exerciseB.id).muscles, ['pecho']);
  assert.deepEqual(exerciseService.getExercise(userId, exerciseA.id).muscles, ['pecho']);
});

test('renameMuscle merge dedupes an exercise that already carries both tags', () => {
  const { authService, exerciseService, muscleService, db } = makeServices();
  const userId = makeUser(authService, db, 'a@test.local');
  const exercise = exerciseService.createExercise(userId, 'Press banca', ['pecho', 'torso']);
  const muscles = muscleService.listMuscles(userId);
  const pecho = muscles.find(m => m.name === 'pecho');
  const torso = muscles.find(m => m.name === 'torso');

  muscleService.renameMuscle(userId, torso.id, 'pecho');

  const updated = exerciseService.getExercise(userId, exercise.id);
  assert.deepEqual(updated.muscles, ['pecho']);
  const survivor = muscleService.listMuscles(userId).find(m => m.name === 'pecho');
  assert.equal(survivor.id, pecho.id);
  assert.equal(survivor.exerciseCount, 1);
});

test('renameMuscle rejects an empty/whitespace new name', () => {
  const { authService, exerciseService, muscleService, db } = makeServices();
  const userId = makeUser(authService, db, 'a@test.local');
  exerciseService.createExercise(userId, 'Press banca', ['pecho']);
  const [muscle] = muscleService.listMuscles(userId);

  assert.throws(() => muscleService.renameMuscle(userId, muscle.id, '   '), ServiceError);
});

test('renameMuscle throws for a muscle id owned by another user, and does not touch it', () => {
  const { authService, exerciseService, muscleService, db } = makeServices();
  const userA = makeUser(authService, db, 'a@test.local');
  const userB = makeUser(authService, db, 'b@test.local');
  exerciseService.createExercise(userA, 'Sentadilla', ['piernas']);
  const [muscleA] = muscleService.listMuscles(userA);

  assert.throws(() => muscleService.renameMuscle(userB, muscleA.id, 'otro'), ServiceError);
  assert.equal(muscleService.listMuscles(userA)[0].name, 'piernas');
});

test('deleteMuscle cascades: removes it from every exercise and from the list', () => {
  const { authService, exerciseService, muscleService, db } = makeServices();
  const userId = makeUser(authService, db, 'a@test.local');
  const exerciseA = exerciseService.createExercise(userId, 'Press banca', ['pecho', 'triceps']);
  const exerciseB = exerciseService.createExercise(userId, 'Aperturas', ['pecho']);
  const [pecho] = muscleService.listMuscles(userId).filter(m => m.name === 'pecho');

  muscleService.deleteMuscle(userId, pecho.id);

  assert.deepEqual(exerciseService.getExercise(userId, exerciseA.id).muscles, ['triceps']);
  assert.deepEqual(exerciseService.getExercise(userId, exerciseB.id).muscles, []);
  assert.ok(!muscleService.listMuscles(userId).some(m => m.name === 'pecho'));
});

test('deleteMuscle on an unused muscle just removes the row', () => {
  const { authService, exerciseService, muscleService, db } = makeServices();
  const userId = makeUser(authService, db, 'a@test.local');
  exerciseService.createExercise(userId, 'Press banca', ['pecho']);
  exerciseService.updateExercise(userId, 1, { muscles: [] }); // orphans 'pecho'
  const [pecho] = muscleService.listMuscles(userId);
  assert.equal(pecho.exerciseCount, 0);

  muscleService.deleteMuscle(userId, pecho.id);

  assert.equal(muscleService.listMuscles(userId).length, 0);
});

test('deleteMuscle cannot delete another user\'s muscle', () => {
  const { authService, exerciseService, muscleService, db } = makeServices();
  const userA = makeUser(authService, db, 'a@test.local');
  const userB = makeUser(authService, db, 'b@test.local');
  exerciseService.createExercise(userA, 'Sentadilla', ['piernas']);
  const [muscleA] = muscleService.listMuscles(userA);

  assert.throws(() => muscleService.deleteMuscle(userB, muscleA.id), ServiceError);
  assert.equal(muscleService.listMuscles(userA).length, 1);
});
