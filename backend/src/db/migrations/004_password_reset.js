/**
 * Adds a forgot-password flow. Both columns are nullable, so - unlike
 * 002_accounts's user_id column - this is a plain ADD COLUMN, no drop/
 * recreate needed.
 */
const sql = `
ALTER TABLE users ADD COLUMN password_reset_token TEXT;
ALTER TABLE users ADD COLUMN password_reset_expires_at INTEGER;
`;

export { sql };
