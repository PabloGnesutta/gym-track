/**
 * Small migration runner, same shape as the sibling fridge-track/car-track
 * backends: each migration's SQL runs at most once, tracked in
 * `schema_migrations`, inside its own transaction so a failing migration
 * never leaves the schema half-applied. `CREATE TABLE IF NOT EXISTS` alone
 * isn't enough once a table needs a column added or changed later - it
 * silently no-ops against a table that already exists on disk - so this
 * exists from the start rather than being bolted on after that gap bites.
 *
 * A migration can set `disableForeignKeys: true` when its recreate-table
 * technique rebuilds a table another table holds a foreign key into -
 * `PRAGMA foreign_keys` is a documented no-op mid-transaction, so it has to
 * be toggled off before BEGIN and back on after COMMIT, around that
 * migration only, not the whole runner.
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {{version: number, name: string, sql: string, disableForeignKeys?: boolean}[]} migrations
 */
function runMigrations(db, migrations) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at INTEGER NOT NULL
    );
  `);

  /** @type {Set<number>} */
  const applied = new Set(
    // @ts-ignore
    db.prepare('SELECT version FROM schema_migrations').all().map(row => Number(row.version))
  );

  const pending = migrations
    .filter(m => !applied.has(m.version))
    .sort((a, b) => a.version - b.version);

  for (const migration of pending) {
    if (migration.disableForeignKeys) { db.exec('PRAGMA foreign_keys = OFF;'); }
    db.exec('BEGIN');
    try {
      db.exec(migration.sql);
      if (migration.disableForeignKeys) {
        /** @type {unknown[]} */ // @ts-ignore
        const violations = db.prepare('PRAGMA foreign_key_check').all();
        if (violations.length) {
          throw new Error(
            `Migration ${migration.version} (${migration.name}) left dangling foreign keys: `
            + JSON.stringify(violations)
          );
        }
      }
      db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)')
        .run(migration.version, migration.name, Date.now());
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    } finally {
      if (migration.disableForeignKeys) { db.exec('PRAGMA foreign_keys = ON;'); }
    }
  }
}

export { runMigrations };
