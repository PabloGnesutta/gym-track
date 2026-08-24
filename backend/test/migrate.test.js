import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { runMigrations } from '../src/db/migrate.js';
import { migrations } from '../src/db/migrations/index.js';


test('runMigrations creates every table on a fresh database', () => {
  const db = new DatabaseSync(':memory:');
  runMigrations(db, migrations);

  /** @type {{name: string}[]} */ // @ts-ignore
  const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`).all();
  const names = tables.map(t => t.name);
  for (const expected of ['users', 'auth_sessions', 'allowed_emails', 'exercises', 'sessions', 'muscles', 'exercise_muscles']) {
    assert.ok(names.includes(expected), `expected table "${expected}" to exist`);
  }
});

test('runMigrations records every migration as applied', () => {
  const db = new DatabaseSync(':memory:');
  runMigrations(db, migrations);

  /** @type {{version: number}[]} */ // @ts-ignore
  const applied = db.prepare('SELECT version FROM schema_migrations ORDER BY version').all();
  assert.deepEqual(applied.map(r => r.version), migrations.map(m => m.version));
});

test('running twice does not re-apply already-applied migrations', () => {
  const db = new DatabaseSync(':memory:');
  runMigrations(db, migrations);
  assert.doesNotThrow(() => runMigrations(db, migrations));

  /** @type {{count: number}} */ // @ts-ignore
  const { count } = db.prepare('SELECT COUNT(*) as count FROM schema_migrations').get();
  assert.equal(count, migrations.length);
});

test('migration 003 backfills pre-existing exercises.muscles values into the muscles/exercise_muscles tables, normalized and deduplicated', () => {
  const db = new DatabaseSync(':memory:');
  // Apply only what predates the muscles-table migration, then hand-seed
  // data in the exact pre-migration shape (a raw exercises.muscles comma
  // string, no muscles/exercise_muscles tables at all) - reproducing real
  // pre-existing data with mixed casing/spacing/duplicates, the exact
  // condition this migration exists to clean up.
  runMigrations(db, migrations.slice(0, 2));

  db.exec(`
    INSERT INTO users (id, email, password_hash, created_at) VALUES (1, 'a@test.local', 'x', 1000);
    INSERT INTO exercises (id, user_id, name, muscles, created_at, updated_at) VALUES
      (1, 1, 'Sentadilla', 'Piernas, GLUTEOS', 1000, 1000),
      (2, 1, 'Zancadas', 'piernas,piernas', 1000, 1000),
      (3, 1, 'Plancha', '', 1000, 1000);
  `);

  runMigrations(db, migrations);

  /** @type {{name: string}[]} */ // @ts-ignore
  const muscles = db.prepare('SELECT name FROM muscles WHERE user_id = 1 ORDER BY name').all();
  assert.deepEqual(muscles.map(m => m.name), ['gluteos', 'piernas']);

  /** @type {{name: string}[]} */ // @ts-ignore
  const sentadillaMuscles = db.prepare(
    `SELECT m.name FROM exercise_muscles em JOIN muscles m ON m.id = em.muscle_id
     WHERE em.exercise_id = 1 ORDER BY m.name`
  ).all();
  assert.deepEqual(sentadillaMuscles.map(m => m.name), ['gluteos', 'piernas']);

  // 'piernas,piernas' dedupes to a single link, not two.
  /** @type {{count: number}} */ // @ts-ignore
  const { count } = db.prepare('SELECT COUNT(*) as count FROM exercise_muscles WHERE exercise_id = 2').get();
  assert.equal(count, 1);

  // An exercise with no tags at all gets no links, not an error.
  /** @type {{count: number}} */ // @ts-ignore
  const { count: plankCount } = db.prepare('SELECT COUNT(*) as count FROM exercise_muscles WHERE exercise_id = 3').get();
  assert.equal(plankCount, 0);
});

test('migration 003 drops the old exercises.muscles column', () => {
  const db = new DatabaseSync(':memory:');
  runMigrations(db, migrations);

  /** @type {{name: string}[]} */ // @ts-ignore
  const columns = db.prepare('PRAGMA table_info(exercises)').all();
  assert.ok(!columns.some(c => c.name === 'muscles'), 'exercises.muscles should no longer exist');
});
