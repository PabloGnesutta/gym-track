/**
 * Adds an expiry to bearer session tokens. Before this, a token in
 * `auth_sessions` was valid forever until an explicit logout or password
 * reset - fine for a personal app's day-to-day, but it means any token that
 * ever leaked (a compromised device, a logged proxy, ...) stays a valid
 * credential indefinitely. Nullable column, so (like 004/005) this is a
 * plain ADD COLUMN - existing rows backfill to NULL and are treated as
 * already-expired by authService.js's getUserBySessionToken (see its own
 * comment), which is the safe default for sessions created before this
 * migration ran.
 */
const sql = `
ALTER TABLE auth_sessions ADD COLUMN expires_at INTEGER;
`;

export { sql };
