import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { runMigrations } from '../src/db/migrate.js';
import { migrations } from '../src/db/migrations/index.js';
import { addAllowedEmail } from '../src/db/allowedEmails.js';
import { createAuthService } from '../src/services/authService.js';
import { ServiceError } from '../src/services/ServiceError.js';


/**
 * Records every call instead of hitting real SMTP - matches emailService.js's
 * real sendEmail() contract (resolves a boolean, never throws).
 */
function makeFakeEmailService() {
  /** @type {{to: string, subject: string, text: string}[]} */
  const sent = [];
  return {
    sent,
    async sendEmail({ to, subject, text }) {
      sent.push({ to, subject, text });
      return true;
    },
  };
}

function makeServices() {
  const db = new DatabaseSync(':memory:');
  runMigrations(db, migrations);
  const emailService = makeFakeEmailService();
  return { authService: createAuthService(db, emailService), db, emailService };
}

test('createUser rejects an email not on the allow-list', () => {
  const { authService } = makeServices();
  assert.throws(() => authService.createUser('nobody@test.local', 'password123'), ServiceError);
});

test('createUser rejects a missing password', () => {
  const { authService, db } = makeServices();
  addAllowedEmail(db, 'a@test.local');
  assert.throws(() => authService.createUser('a@test.local', ''), ServiceError);
});

test('createUser succeeds for an allow-listed email', () => {
  const { authService, db } = makeServices();
  addAllowedEmail(db, 'a@test.local');
  const user = authService.createUser('a@test.local', 'password123', 'Pablo');

  assert.equal(user.email, 'a@test.local');
  assert.equal(user.name, 'Pablo');
  assert.ok(user.id);
});

test('createUser normalizes email casing and rejects a duplicate', () => {
  const { authService, db } = makeServices();
  addAllowedEmail(db, 'a@test.local');
  authService.createUser('A@Test.Local', 'password123');

  assert.throws(() => authService.createUser('a@test.local', 'password456'), ServiceError);
});

test('verifyLogin succeeds with the right password and rejects the wrong one', () => {
  const { authService, db } = makeServices();
  addAllowedEmail(db, 'a@test.local');
  authService.createUser('a@test.local', 'password123');

  const user = authService.verifyLogin('a@test.local', 'password123');
  assert.equal(user.email, 'a@test.local');

  assert.throws(() => authService.verifyLogin('a@test.local', 'wrong'), ServiceError);
});

test('verifyLogin rejects a nonexistent email', () => {
  const { authService } = makeServices();
  assert.throws(() => authService.verifyLogin('nobody@test.local', 'whatever'), ServiceError);
});

test('createSession returns a token that resolves back to the user via getUserBySessionToken', () => {
  const { authService, db } = makeServices();
  addAllowedEmail(db, 'a@test.local');
  const user = authService.createUser('a@test.local', 'password123');

  const token = authService.createSession(user.id);
  const resolved = authService.getUserBySessionToken(token);

  assert.equal(resolved.id, user.id);
  assert.equal(resolved.email, user.email);
});

test('getUserBySessionToken returns null for a bogus or missing token', () => {
  const { authService } = makeServices();
  assert.equal(authService.getUserBySessionToken('bogus'), null);
  assert.equal(authService.getUserBySessionToken(''), null);
});

test('deleteSession invalidates the token', () => {
  const { authService, db } = makeServices();
  addAllowedEmail(db, 'a@test.local');
  const user = authService.createUser('a@test.local', 'password123');
  const token = authService.createSession(user.id);

  authService.deleteSession(token);

  assert.equal(authService.getUserBySessionToken(token), null);
});

// --- requestPasswordReset / resetPassword ---

test('requestPasswordReset sends an email and resolves {ok:true} for an existing account', async () => {
  const { authService, db, emailService } = makeServices();
  addAllowedEmail(db, 'a@test.local');
  authService.createUser('a@test.local', 'password123');

  const result = await authService.requestPasswordReset('A@Test.Local');

  assert.deepEqual(result, { ok: true });
  assert.equal(emailService.sent.length, 1);
  assert.equal(emailService.sent[0].to, 'a@test.local');
});

test('requestPasswordReset resolves {ok:true} without sending an email for a nonexistent account', async () => {
  const { authService, emailService } = makeServices();

  const result = await authService.requestPasswordReset('nobody@test.local');

  assert.deepEqual(result, { ok: true });
  assert.equal(emailService.sent.length, 0);
});

test('resetPassword changes the password and invalidates existing sessions', async () => {
  const { authService, db, emailService } = makeServices();
  addAllowedEmail(db, 'a@test.local');
  authService.createUser('a@test.local', 'password123');
  const oldToken = authService.createSession(
    /** @type {{id: number}} */(db.prepare('SELECT id FROM users WHERE email = ?').get('a@test.local')).id
  );

  await authService.requestPasswordReset('a@test.local');
  const resetLink = emailService.sent[0].text;
  const resetToken = /** @type {RegExpMatchArray} */(resetLink.match(/resetToken=([a-f0-9]+)/))[1];

  const result = authService.resetPassword(resetToken, 'newPassword456');
  assert.deepEqual(result, { ok: true });

  assert.throws(() => authService.verifyLogin('a@test.local', 'password123'));
  assert.equal(authService.verifyLogin('a@test.local', 'newPassword456').email, 'a@test.local');
  assert.equal(authService.getUserBySessionToken(oldToken), null);
});

test('resetPassword rejects a bogus or expired token', () => {
  const { authService, db } = makeServices();
  addAllowedEmail(db, 'a@test.local');
  const user = authService.createUser('a@test.local', 'password123');

  assert.throws(() => authService.resetPassword('bogus-token', 'newPassword456'), ServiceError);

  db.prepare(
    'UPDATE users SET password_reset_token = ?, password_reset_expires_at = ? WHERE id = ?'
  ).run('expired-token', Date.now() - 1000, user.id);
  assert.throws(() => authService.resetPassword('expired-token', 'newPassword456'), ServiceError);
});

test('resetPassword rejects an empty new password', async () => {
  const { authService, db, emailService } = makeServices();
  addAllowedEmail(db, 'a@test.local');
  authService.createUser('a@test.local', 'password123');
  await authService.requestPasswordReset('a@test.local');
  const resetToken = /** @type {RegExpMatchArray} */(emailService.sent[0].text.match(/resetToken=([a-f0-9]+)/))[1];

  assert.throws(() => authService.resetPassword(resetToken, ''), ServiceError);
});
