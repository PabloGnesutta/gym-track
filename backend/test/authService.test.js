import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { runMigrations } from '../src/db/migrate.js';
import { migrations } from '../src/db/migrations/index.js';
import { addAllowedEmail } from '../src/db/allowedEmails.js';
import { createAuthService } from '../src/services/authService.js';
import { ServiceError } from '../src/services/ServiceError.js';


function makeServices() {
  const db = new DatabaseSync(':memory:');
  runMigrations(db, migrations);
  return { authService: createAuthService(db), db };
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
