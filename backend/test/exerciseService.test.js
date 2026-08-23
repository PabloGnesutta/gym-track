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
    db,
  };
}

test('createExercise stores name and muscles', () => {
  const { exerciseService } = makeServices();
  const exercise = exerciseService.createExercise('Press banca', ['pecho', 'triceps']);

  assert.equal(exercise.name, 'Press banca');
  assert.deepEqual(exercise.muscles, ['pecho', 'triceps']);
  assert.ok(exercise.id);
});

test('createExercise rejects an empty name', () => {
  const { exerciseService } = makeServices();
  assert.throws(() => exerciseService.createExercise('   '), ServiceError);
});

test('createExercise rejects a duplicate name', () => {
  const { exerciseService } = makeServices();
  exerciseService.createExercise('Sentadilla');
  assert.throws(() => exerciseService.createExercise('Sentadilla'), ServiceError);
});

test('listExercises returns every created exercise', () => {
  const { exerciseService } = makeServices();
  exerciseService.createExercise('Sentadilla');
  exerciseService.createExercise('Peso muerto');

  const exercises = exerciseService.listExercises();
  assert.equal(exercises.length, 2);
  assert.deepEqual(exercises.map(e => e.name).sort(), ['Peso muerto', 'Sentadilla']);
});

test('getExercise throws for a nonexistent id', () => {
  const { exerciseService } = makeServices();
  assert.throws(() => exerciseService.getExercise(999), ServiceError);
});

test('updateExercise renames and rejects a collision with another exercise', () => {
  const { exerciseService } = makeServices();
  const a = exerciseService.createExercise('Sentadilla');
  exerciseService.createExercise('Peso muerto');

  const updated = exerciseService.updateExercise(a.id, { name: 'Sentadilla libre' });
  assert.equal(updated.name, 'Sentadilla libre');

  assert.throws(() => exerciseService.updateExercise(a.id, { name: 'Peso muerto' }), ServiceError);
});

test('updateExercise can change muscles without touching name', () => {
  const { exerciseService } = makeServices();
  const exercise = exerciseService.createExercise('Sentadilla', ['piernas']);
  const updated = exerciseService.updateExercise(exercise.id, { muscles: ['piernas', 'gluteos'] });

  assert.equal(updated.name, 'Sentadilla');
  assert.deepEqual(updated.muscles, ['piernas', 'gluteos']);
});

test('deleteExercise removes the exercise and cascades its sessions', () => {
  const { exerciseService, sessionService } = makeServices();
  const exercise = exerciseService.createExercise('Sentadilla');
  sessionService.addSet(exercise.id, { weight: 60, reps: 8 });

  exerciseService.deleteExercise(exercise.id);

  assert.throws(() => exerciseService.getExercise(exercise.id), ServiceError);
  assert.throws(() => sessionService.listSessionsForExercise(exercise.id), ServiceError);
});

test('deleteExercise throws for a nonexistent id', () => {
  const { exerciseService } = makeServices();
  assert.throws(() => exerciseService.deleteExercise(999), ServiceError);
});
