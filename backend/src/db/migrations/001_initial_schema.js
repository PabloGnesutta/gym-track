/**
 * Baseline schema for server-side storage. Mirrors the shape already used
 * client-side in IndexedDB (`frontend/js/local-db/exercise-db.js` and
 * `set-db.js`): an Exercise has a unique name and a denormalized muscles
 * list; a Session belongs to one Exercise for one calendar day and holds
 * multiple weight rows (`{ w: weight, r: reps[] }`), stored here as a JSON
 * string in `sets` rather than a separate table, same tradeoff the client
 * already makes for the same data.
 *
 * No user/account scoping yet - this app currently has no real persisted
 * identity server-side (`login` issues a token for any name as an anonymous
 * "Visitor", see `controllers/auth-controller.js`), so there's nothing
 * meaningful to scope rows by until that changes.
 */
const sql = `
CREATE TABLE IF NOT EXISTS exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  muscles TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exercise_id INTEGER NOT NULL REFERENCES exercises(id),
  date INTEGER NOT NULL,
  sets TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_exercise_id ON sessions(exercise_id);
`;

export { sql };
