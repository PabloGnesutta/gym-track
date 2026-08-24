/**
 * Moves exercise muscle tags from a comma-joined string column
 * (`exercises.muscles`) into a real many-to-many relationship: `muscles`
 * (one row per user per canonical muscle name) + `exercise_muscles` (the
 * join table). Fixes the "Piernas" vs "piernas" bug at the root - a muscle
 * is now looked up-or-created by its normalized name, so two spellings of
 * the same tag can no longer end up as two different tags by construction,
 * not just by convention. `muscles.name` *is* the canonical (trimmed,
 * lowercased) form - there's no separate display name, since the UI
 * already applies `text-transform: capitalize` for display
 * (`analytics.css`'s `.muscle-name`) rather than trusting stored casing.
 *
 * Written as a `migrate` function, not a plain `sql` string, specifically
 * because the backfill needs real Spanish-aware lowercasing
 * (`trim().toLocaleLowerCase()`) - SQLite's own `LOWER()` is ASCII-only
 * (confirmed: `LOWER('TRÍCEPS')` -> `'trÍceps'`, the accented `Í` is left
 * untouched), so two different capitalizations of an accented tag would
 * silently normalize to two *different* strings under a pure-SQL backfill,
 * reproducing the exact bug this migration exists to fix.
 *
 * `ALTER TABLE ... DROP COLUMN` (not a rename-aside + recreate) is safe
 * here because this box's SQLite (3.53.3, confirmed) supports it natively
 * since 3.35 - no need for fridge-track's older recreate-table workaround.
 * @param {import('node:sqlite').DatabaseSync} db
 */
function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS muscles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      UNIQUE(user_id, name)
    );

    CREATE TABLE IF NOT EXISTS exercise_muscles (
      exercise_id INTEGER NOT NULL REFERENCES exercises(id),
      muscle_id INTEGER NOT NULL REFERENCES muscles(id),
      PRIMARY KEY (exercise_id, muscle_id)
    );
    CREATE INDEX IF NOT EXISTS idx_exercise_muscles_muscle_id ON exercise_muscles(muscle_id);
  `);

  /** @type {{id: number, user_id: number, muscles: string}[]} */ // @ts-ignore
  const exercises = db.prepare('SELECT id, user_id, muscles FROM exercises').all();

  const insertMuscle = db.prepare(
    'INSERT INTO muscles (user_id, name, created_at) VALUES (?, ?, ?) ON CONFLICT(user_id, name) DO NOTHING'
  );
  const getMuscleId = db.prepare('SELECT id FROM muscles WHERE user_id = ? AND name = ?');
  const linkExerciseMuscle = db.prepare(
    'INSERT OR IGNORE INTO exercise_muscles (exercise_id, muscle_id) VALUES (?, ?)'
  );

  const now = Date.now();
  for (const exercise of exercises) {
    const tags = String(exercise.muscles || '')
      .split(',')
      .map(t => t.trim().toLocaleLowerCase())
      .filter(Boolean);

    for (const tag of new Set(tags)) {
      insertMuscle.run(exercise.user_id, tag, now);
      /** @type {{id: number}} */ // @ts-ignore
      const row = getMuscleId.get(exercise.user_id, tag);
      linkExerciseMuscle.run(exercise.id, row.id);
    }
  }

  db.exec('ALTER TABLE exercises DROP COLUMN muscles;');
}

export { migrate };
