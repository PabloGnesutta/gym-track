import { randomBytes } from 'node:crypto';
import { hashPassword, verifyPassword } from '../auth/passwordHash.js';
import { isEmailAllowed } from '../db/allowedEmails.js';
import { getAppBaseUrl } from '../lib/appUrl.js';
import { ServiceError } from './ServiceError.js';
import { createEmailService } from './emailService.js';

// A reset link is generous rather than tight - a locked-out real user is a
// worse outcome than a slightly-longer window for a link that only exists
// in their own inbox.
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

// A generous but finite ceiling on a bearer session token's lifetime - a
// personal, allow-listed app doesn't need short-lived sessions, but an
// unbounded one (the previous behavior) turns any leaked token into a
// forever-valid credential. Also expires normally via logout/password-reset
// before this, same as before.
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const MIN_PASSWORD_LENGTH = 8;

/**
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {{sendEmail: (opts: {to: string, subject: string, text: string, appName?: string}) => Promise<boolean>}} [emailService]
 *   Injectable, same create*Service factory shape used elsewhere - production
 *   code gets the real emailService.js, tests can pass a stub with no SMTP
 *   config required. sendEmail() itself never throws (logs and returns false
 *   on missing config/failure), so callers here don't need their own
 *   try/catch around it.
 */
function createAuthService(db, emailService = createEmailService()) {
  /**
   * @param {string} email
   * @param {string} password
   * @param {string} [name]
   */
  function createUser(email, password, name = '') {
    email = String(email || '').trim().toLowerCase();
    if (!email || !password) { throw new ServiceError('Email y contraseña requeridos'); }
    if (String(password).length < MIN_PASSWORD_LENGTH) {
      throw new ServiceError(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`);
    }
    if (!isEmailAllowed(db, email)) { throw new ServiceError('Este email no está autorizado para crear una cuenta'); }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) { throw new ServiceError('Ya existe una cuenta con ese email'); }

    const info = db.prepare(
      'INSERT INTO users (email, password_hash, name, created_at) VALUES (?, ?, ?, ?)'
    ).run(email, hashPassword(password), name, Date.now());

    return { id: Number(info.lastInsertRowid), email, name };
  }

  /**
   * @param {string} email
   * @param {string} password
   * @returns {{id: number, email: string, name: string, password_hash: string}}
   */
  function verifyLogin(email, password) {
    email = String(email || '').trim().toLowerCase();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user || !verifyPassword(password, /** @type {string} */(user.password_hash))) {
      throw new ServiceError('Email o contraseña incorrectos');
    }
    // @ts-ignore - node:sqlite types every column as SQLOutputValue; the
    // schema guarantees these shapes.
    return user;
  }

  /**
   * @param {number} userId
   * @returns {string} the new bearer token
   */
  function createSession(userId) {
    const token = randomBytes(32).toString('hex');
    const now = Date.now();
    db.prepare(
      'INSERT INTO auth_sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)'
    ).run(token, userId, now, now + SESSION_TTL_MS);
    return token;
  }

  /**
   * A NULL `expires_at` means the row predates migration 006 (every session
   * created before this TTL existed) - treated as already-expired rather
   * than grandfathered in as unlimited-lifetime, since an indefinitely-valid
   * token is exactly what this migration exists to close off.
   * @param {string} token
   * @returns {{id: number, email: string, name: string} | null}
   */
  function getUserBySessionToken(token) {
    if (!token) { return null; }
    const row = db.prepare(
      `SELECT users.id, users.email, users.name, auth_sessions.expires_at FROM auth_sessions
       JOIN users ON users.id = auth_sessions.user_id
       WHERE auth_sessions.token = ?`
    ).get(token);
    if (!row) { return null; }

    if (row.expires_at == null || Date.now() > Number(row.expires_at)) {
      deleteSession(token);
      return null;
    }

    // @ts-ignore - node:sqlite types every column as SQLOutputValue; the
    // schema guarantees these shapes.
    return { id: row.id, email: row.email, name: row.name };
  }

  /**
   * @param {string} token
   */
  function deleteSession(token) {
    db.prepare('DELETE FROM auth_sessions WHERE token = ?').run(token);
  }

  /**
   * Always resolves `{ok: true}`, whether or not an account with this email
   * actually exists - a distinct response would let this unauthenticated
   * route be used to enumerate which emails have a GymTrack account.
   * @param {string} email
   */
  async function requestPasswordReset(email) {
    email = String(email || '').trim().toLowerCase();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) { return { ok: true }; }

    const token = randomBytes(32).toString('hex');
    const expiresAt = Date.now() + PASSWORD_RESET_TTL_MS;
    db.prepare(
      'UPDATE users SET password_reset_token = ?, password_reset_expires_at = ? WHERE id = ?'
    ).run(token, expiresAt, user.id);

    const link = `${getAppBaseUrl()}/?resetToken=${encodeURIComponent(token)}`;
    await emailService.sendEmail({
      to: email,
      subject: 'Restablecer contraseña - GymTrack',
      text: `Para elegir una nueva contraseña, entrá a este link:\n${link}\n\n`
        + `Vence en 1 hora. Si no pediste esto, podés ignorar este mensaje.`,
    });

    return { ok: true };
  }

  /**
   * @param {string} token
   * @param {string} newPassword
   */
  function resetPassword(token, newPassword) {
    token = String(token || '').trim();
    if (!token) { throw new ServiceError('Token inválido o vencido'); }
    if (!newPassword) { throw new ServiceError('Ingresá una contraseña nueva'); }
    if (String(newPassword).length < MIN_PASSWORD_LENGTH) {
      throw new ServiceError(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`);
    }

    const user = db.prepare('SELECT * FROM users WHERE password_reset_token = ?').get(token);
    if (!user || !user.password_reset_expires_at || Date.now() > Number(user.password_reset_expires_at)) {
      throw new ServiceError('Token inválido o vencido');
    }

    db.prepare(
      'UPDATE users SET password_hash = ?, password_reset_token = NULL, password_reset_expires_at = NULL WHERE id = ?'
    ).run(hashPassword(newPassword), user.id);
    // A changed password should kick out any other logged-in session/device.
    db.prepare('DELETE FROM auth_sessions WHERE user_id = ?').run(user.id);

    return { ok: true };
  }

  return {
    createUser, verifyLogin, createSession, getUserBySessionToken, deleteSession,
    requestPasswordReset, resetPassword,
  };
}

export { createAuthService };
