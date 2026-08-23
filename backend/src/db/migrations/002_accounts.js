/**
 * Adds real password-based accounts (matching the sibling car-track/
 * fridge-track backends) and scopes the domain tables by owner.
 *
 * `sessions` already names the workout-session table from migration 001, so
 * the auth-token table here is `auth_sessions` instead of the sibling
 * projects' literal `sessions` - a deliberate rename to dodge that
 * collision, not a different design.
 *
 * `exercises`/`sessions` are recreated (drop + create, not a rename-aside +
 * `INSERT ... SELECT` copy) rather than `ALTER TABLE ADD COLUMN`, because a
 * `user_id` that's `NOT NULL` and part of a composite `UNIQUE` constraint
 * can't be added to an existing table in SQLite. A plain drop is safe
 * specifically here: no route ever existed to write to either table before
 * this migration (they were only ever created, never inserted into, by
 * anything reachable over HTTP), which is verifiable from `apiRouter.js`'s
 * history - there is no pre-existing data to lose. A future recreate-table
 * migration on a table with real rows must copy them across instead (see
 * fridge-track's `008_locations_category_id.js` for that shape).
 *
 * `exercises.name` was globally UNIQUE (migration 001); it's now
 * UNIQUE per (user_id, name) instead, since two different users must each be
 * able to have their own "Sentadilla".
 */
const sql = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS allowed_emails (
  email TEXT PRIMARY KEY,
  added_at INTEGER NOT NULL
);

DROP TABLE IF EXISTS exercises;
CREATE TABLE exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  muscles TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(user_id, name)
);

DROP TABLE IF EXISTS sessions;
CREATE TABLE sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  exercise_id INTEGER NOT NULL REFERENCES exercises(id),
  date INTEGER NOT NULL,
  sets TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_exercise_id ON sessions(exercise_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
`;

export { sql };
