import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { runMigrations } from '../src/db/migrate.js';
import { migrations } from '../src/db/migrations/index.js';
import { addAllowedEmail } from '../src/db/allowedEmails.js';
import { createAuthService } from '../src/services/authService.js';
import { createExerciseService } from '../src/services/exerciseService.js';
import { createSessionService } from '../src/services/sessionService.js';
import { createAnalyticsService } from '../src/services/analyticsService.js';


function makeServices() {
  const db = new DatabaseSync(':memory:');
  runMigrations(db, migrations);
  const exerciseService = createExerciseService(db);
  return {
    authService: createAuthService(db),
    exerciseService,
    sessionService: createSessionService(db, exerciseService),
    analyticsService: createAnalyticsService(db, exerciseService),
    db,
  };
}

function makeUser(authService, db, email) {
  addAllowedEmail(db, email);
  return authService.createUser(email, 'password123').id;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

// --- getMuscleBalance ---

test('getMuscleBalance returns an empty array for an account with no sessions', () => {
  const { authService, analyticsService, db } = makeServices();
  const userId = makeUser(authService, db, 'a@test.local');
  assert.deepEqual(analyticsService.getMuscleBalance(userId), []);
});

test('getMuscleBalance counts sets (not weight rows) per muscle, most-worked first', () => {
  const { authService, exerciseService, sessionService, analyticsService, db } = makeServices();
  const userId = makeUser(authService, db, 'a@test.local');
  const squat = exerciseService.createExercise(userId, 'Sentadilla', ['piernas', 'gluteos']);
  const curl = exerciseService.createExercise(userId, 'Curl', ['brazos']);

  // 2 sets (same weight row, two reps entries) + 1 more set at a different weight = 3 sets total.
  sessionService.addSet(userId, squat.id, { weight: 60, reps: 8 });
  sessionService.addSet(userId, squat.id, { weight: 60, reps: 6 });
  sessionService.addSet(userId, squat.id, { weight: 65, reps: 4 });
  sessionService.addSet(userId, curl.id, { weight: 12, reps: 10 });

  const balance = analyticsService.getMuscleBalance(userId);
  assert.deepEqual(balance, [
    { muscle: 'piernas', sets: 3 },
    { muscle: 'gluteos', sets: 3 },
    { muscle: 'brazos', sets: 1 },
  ]);
});

test('getMuscleBalance merges tags that differ only by casing into one entry', () => {
  const { authService, exerciseService, sessionService, analyticsService, db } = makeServices();
  const userId = makeUser(authService, db, 'a@test.local');
  const squat = exerciseService.createExercise(userId, 'Sentadilla', ['Piernas']);
  const lunge = exerciseService.createExercise(userId, 'Zancadas', ['piernas']);

  sessionService.addSet(userId, squat.id, { weight: 60, reps: 8 });
  sessionService.addSet(userId, lunge.id, { weight: 20, reps: 10 });

  assert.deepEqual(analyticsService.getMuscleBalance(userId), [{ muscle: 'piernas', sets: 2 }]);
});

test('getMuscleBalance excludes sessions older than the window', () => {
  const { authService, exerciseService, sessionService, analyticsService, db } = makeServices();
  const userId = makeUser(authService, db, 'a@test.local');
  const exercise = exerciseService.createExercise(userId, 'Sentadilla', ['piernas']);

  sessionService.addSet(userId, exercise.id, { weight: 60, reps: 8 }, Date.now() - 40 * DAY_MS);

  assert.deepEqual(analyticsService.getMuscleBalance(userId, 30), []);
});

test('getMuscleBalance ignores an exercise with no muscle tags', () => {
  const { authService, exerciseService, sessionService, analyticsService, db } = makeServices();
  const userId = makeUser(authService, db, 'a@test.local');
  const exercise = exerciseService.createExercise(userId, 'Ejercicio sin tags');

  sessionService.addSet(userId, exercise.id, { weight: 20, reps: 10 });

  assert.deepEqual(analyticsService.getMuscleBalance(userId), []);
});

// --- getTrainingFrequency ---

test('getTrainingFrequency returns `weeks` buckets, all zero, for an account with no sessions', () => {
  const { authService, analyticsService, db } = makeServices();
  const userId = makeUser(authService, db, 'a@test.local');

  const frequency = analyticsService.getTrainingFrequency(userId, 8);

  assert.equal(frequency.length, 8);
  assert.ok(frequency.every(bucket => bucket.daysTrained === 0));
});

test('getTrainingFrequency counts a session today in the most recent (last) bucket', () => {
  const { authService, exerciseService, sessionService, analyticsService, db } = makeServices();
  const userId = makeUser(authService, db, 'a@test.local');
  const exercise = exerciseService.createExercise(userId, 'Sentadilla');

  sessionService.addSet(userId, exercise.id, { weight: 60, reps: 8 });

  const frequency = analyticsService.getTrainingFrequency(userId, 8);
  assert.equal(frequency[7].daysTrained, 1);
  assert.ok(frequency.slice(0, 7).every(bucket => bucket.daysTrained === 0));
});

test('getTrainingFrequency counts two exercises trained the same day as one day, not two', () => {
  const { authService, exerciseService, sessionService, analyticsService, db } = makeServices();
  const userId = makeUser(authService, db, 'a@test.local');
  const squat = exerciseService.createExercise(userId, 'Sentadilla');
  const curl = exerciseService.createExercise(userId, 'Curl');

  const now = Date.now();
  sessionService.addSet(userId, squat.id, { weight: 60, reps: 8 }, now);
  sessionService.addSet(userId, curl.id, { weight: 12, reps: 10 }, now + 1000);

  const frequency = analyticsService.getTrainingFrequency(userId, 8);
  assert.equal(frequency[7].daysTrained, 1);
});

test('getTrainingFrequency places an older session in its own earlier week bucket', () => {
  const { authService, exerciseService, sessionService, analyticsService, db } = makeServices();
  const userId = makeUser(authService, db, 'a@test.local');
  const exercise = exerciseService.createExercise(userId, 'Sentadilla');

  sessionService.addSet(userId, exercise.id, { weight: 60, reps: 8 }, Date.now() - 3 * WEEK_MS);

  const frequency = analyticsService.getTrainingFrequency(userId, 8);
  assert.equal(frequency[4].daysTrained, 1); // 3 weeks ago -> index (8 - 1 - 3) = 4
  assert.equal(frequency[7].daysTrained, 0);
});

test('getTrainingFrequency excludes a session older than the window', () => {
  const { authService, exerciseService, sessionService, analyticsService, db } = makeServices();
  const userId = makeUser(authService, db, 'a@test.local');
  const exercise = exerciseService.createExercise(userId, 'Sentadilla');

  sessionService.addSet(userId, exercise.id, { weight: 60, reps: 8 }, Date.now() - 20 * WEEK_MS);

  const frequency = analyticsService.getTrainingFrequency(userId, 8);
  assert.ok(frequency.every(bucket => bucket.daysTrained === 0));
});

// --- getVolumeTrend ---

test('getVolumeTrend returns `weeks` buckets, all zero, for an account with no sessions', () => {
  const { authService, analyticsService, db } = makeServices();
  const userId = makeUser(authService, db, 'a@test.local');

  const trend = analyticsService.getVolumeTrend(userId, 8);

  assert.equal(trend.length, 8);
  assert.ok(trend.every(bucket => bucket.volume === 0));
});

test('getVolumeTrend sums weight x reps across every set into the current week\'s bucket', () => {
  const { authService, exerciseService, sessionService, analyticsService, db } = makeServices();
  const userId = makeUser(authService, db, 'a@test.local');
  const exercise = exerciseService.createExercise(userId, 'Sentadilla');

  sessionService.addSet(userId, exercise.id, { weight: 40, reps: 10 }); // 400
  sessionService.addSet(userId, exercise.id, { weight: 40, reps: 8 });  // 320, same session/weight row

  const trend = analyticsService.getVolumeTrend(userId, 8);
  assert.equal(trend[7].volume, 720);
  assert.ok(trend.slice(0, 7).every(bucket => bucket.volume === 0));
});

test('getVolumeTrend counts two exercises trained the same day as separate volume, unlike day-based frequency', () => {
  const { authService, exerciseService, sessionService, analyticsService, db } = makeServices();
  const userId = makeUser(authService, db, 'a@test.local');
  const squat = exerciseService.createExercise(userId, 'Sentadilla');
  const curl = exerciseService.createExercise(userId, 'Curl');
  const now = Date.now();

  sessionService.addSet(userId, squat.id, { weight: 60, reps: 8 }, now); // 480
  sessionService.addSet(userId, curl.id, { weight: 12, reps: 10 }, now + 1000); // 120

  const trend = analyticsService.getVolumeTrend(userId, 8);
  assert.equal(trend[7].volume, 600);
});

test('getVolumeTrend places an older session in its own earlier week bucket', () => {
  const { authService, exerciseService, sessionService, analyticsService, db } = makeServices();
  const userId = makeUser(authService, db, 'a@test.local');
  const exercise = exerciseService.createExercise(userId, 'Sentadilla');

  sessionService.addSet(userId, exercise.id, { weight: 60, reps: 8 }, Date.now() - 3 * WEEK_MS); // 480

  const trend = analyticsService.getVolumeTrend(userId, 8);
  assert.equal(trend[4].volume, 480); // 3 weeks ago -> index (8 - 1 - 3) = 4
  assert.equal(trend[7].volume, 0);
});

test('getVolumeTrend excludes a session older than the window', () => {
  const { authService, exerciseService, sessionService, analyticsService, db } = makeServices();
  const userId = makeUser(authService, db, 'a@test.local');
  const exercise = exerciseService.createExercise(userId, 'Sentadilla');

  sessionService.addSet(userId, exercise.id, { weight: 60, reps: 8 }, Date.now() - 20 * WEEK_MS);

  const trend = analyticsService.getVolumeTrend(userId, 8);
  assert.ok(trend.every(bucket => bucket.volume === 0));
});

// --- getPersonalRecords ---

test('getPersonalRecords returns an empty array for an account with no sessions', () => {
  const { authService, analyticsService, db } = makeServices();
  const userId = makeUser(authService, db, 'a@test.local');
  assert.deepEqual(analyticsService.getPersonalRecords(userId), []);
});

test('getPersonalRecords tracks the heaviest weight and best estimated one-rep max per exercise', () => {
  const { authService, exerciseService, sessionService, analyticsService, db } = makeServices();
  const userId = makeUser(authService, db, 'a@test.local');
  const exercise = exerciseService.createExercise(userId, 'Press banca');

  sessionService.addSet(userId, exercise.id, { weight: 40, reps: 10 }); // 1RM ~ 53.3
  sessionService.addSet(userId, exercise.id, { weight: 45, reps: 3 });  // heavier, 1RM ~ 49.5
  sessionService.addSet(userId, exercise.id, { weight: 42.5, reps: 8 }); // 1RM ~ 53.8, this session's best

  const [pr] = analyticsService.getPersonalRecords(userId);
  assert.equal(pr.name, 'Press banca');
  assert.equal(pr.maxWeight, 45);
  assert.equal(pr.bestOneRepMax, 53.8);
});

test('getPersonalRecords tracks each exercise independently', () => {
  const { authService, exerciseService, sessionService, analyticsService, db } = makeServices();
  const userId = makeUser(authService, db, 'a@test.local');
  const squat = exerciseService.createExercise(userId, 'Sentadilla');
  const curl = exerciseService.createExercise(userId, 'Curl');

  sessionService.addSet(userId, squat.id, { weight: 80, reps: 5 });
  sessionService.addSet(userId, curl.id, { weight: 15, reps: 10 });

  const records = analyticsService.getPersonalRecords(userId);
  assert.equal(records.length, 2);
  assert.ok(records.some(r => r.name === 'Sentadilla' && r.maxWeight === 80));
  assert.ok(records.some(r => r.name === 'Curl' && r.maxWeight === 15));
});

test('getPersonalRecords sorts by whichever PR was set most recently', () => {
  const { authService, exerciseService, sessionService, analyticsService, db } = makeServices();
  const userId = makeUser(authService, db, 'a@test.local');
  const squat = exerciseService.createExercise(userId, 'Sentadilla');
  const curl = exerciseService.createExercise(userId, 'Curl');
  const now = Date.now();

  sessionService.addSet(userId, squat.id, { weight: 80, reps: 5 }, now - 2 * DAY_MS);
  sessionService.addSet(userId, curl.id, { weight: 15, reps: 10 }, now);

  const [first, second] = analyticsService.getPersonalRecords(userId);
  assert.equal(first.name, 'Curl');
  assert.equal(second.name, 'Sentadilla');
});

test('getPersonalRecords only scopes to the calling user\'s own exercises', () => {
  const { authService, exerciseService, sessionService, analyticsService, db } = makeServices();
  const userA = makeUser(authService, db, 'a@test.local');
  const userB = makeUser(authService, db, 'b@test.local');
  const exerciseA = exerciseService.createExercise(userA, 'Sentadilla');
  exerciseService.createExercise(userB, 'Sentadilla');

  sessionService.addSet(userA, exerciseA.id, { weight: 80, reps: 5 });

  assert.equal(analyticsService.getPersonalRecords(userB).length, 0);
});

// --- getExerciseHistory ---

test('getExerciseHistory returns an empty array for an exercise with no sessions', () => {
  const { authService, exerciseService, analyticsService, db } = makeServices();
  const userId = makeUser(authService, db, 'a@test.local');
  const exercise = exerciseService.createExercise(userId, 'Sentadilla');
  assert.deepEqual(analyticsService.getExerciseHistory(userId, exercise.id), []);
});

test('getExerciseHistory returns one point per session, chronological, using the top-set weight', () => {
  const { authService, exerciseService, sessionService, analyticsService, db } = makeServices();
  const userId = makeUser(authService, db, 'a@test.local');
  const exercise = exerciseService.createExercise(userId, 'Sentadilla');
  const now = Date.now();

  sessionService.addSet(userId, exercise.id, { weight: 60, reps: 8 }, now - 2 * DAY_MS);
  sessionService.addSet(userId, exercise.id, { weight: 40, reps: 10 }, now - 2 * DAY_MS); // same session, lower weight - ignored
  sessionService.addSet(userId, exercise.id, { weight: 65, reps: 5 }, now - 1 * DAY_MS);

  const history = analyticsService.getExerciseHistory(userId, exercise.id);
  assert.equal(history.length, 2);
  assert.equal(history[0].weight, 60);
  assert.equal(history[1].weight, 65);
  assert.ok(history[0].date < history[1].date);
});

test('getExerciseHistory only counts sessions for that exercise, not others', () => {
  const { authService, exerciseService, sessionService, analyticsService, db } = makeServices();
  const userId = makeUser(authService, db, 'a@test.local');
  const squat = exerciseService.createExercise(userId, 'Sentadilla');
  const curl = exerciseService.createExercise(userId, 'Curl');

  sessionService.addSet(userId, squat.id, { weight: 60, reps: 8 });
  sessionService.addSet(userId, curl.id, { weight: 12, reps: 10 });

  assert.equal(analyticsService.getExerciseHistory(userId, squat.id).length, 1);
});

test('getExerciseHistory throws for an exercise owned by another account', () => {
  const { authService, exerciseService, analyticsService, db } = makeServices();
  const ownerId = makeUser(authService, db, 'owner@test.local');
  const otherId = makeUser(authService, db, 'other@test.local');
  const exercise = exerciseService.createExercise(ownerId, 'Sentadilla');

  assert.throws(() => analyticsService.getExerciseHistory(otherId, exercise.id));
});

// --- getSummary ---

test('getSummary combines all three into one object', () => {
  const { authService, exerciseService, sessionService, analyticsService, db } = makeServices();
  const userId = makeUser(authService, db, 'a@test.local');
  const exercise = exerciseService.createExercise(userId, 'Sentadilla', ['piernas']);
  sessionService.addSet(userId, exercise.id, { weight: 60, reps: 8 });

  const summary = analyticsService.getSummary(userId);

  assert.deepEqual(summary.muscleBalance, [{ muscle: 'piernas', sets: 1 }]);
  assert.equal(summary.frequency.length, 8);
  assert.equal(summary.volumeTrend.length, 8);
  assert.equal(summary.volumeTrend[7].volume, 480);
  assert.equal(summary.personalRecords.length, 1);
});
