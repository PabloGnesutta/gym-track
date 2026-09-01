/**
 * Adds exercise favoriting/pinning. Nullable-by-default-value column, so
 * (like 004_password_reset) this is a plain ADD COLUMN, no drop/recreate.
 */
const sql = `
ALTER TABLE exercises ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0;
`;

export { sql };
