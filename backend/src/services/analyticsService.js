/**
 * @typedef {{ w: number, r: number[] }} WeightRow
 */

/**
 * The epoch-ms start (local midnight) of the calendar day containing `a` -
 * used to dedupe sessions down to distinct trained days. Same local-day
 * semantics as `sessionService.js`'s own `isSameDay`, just expressed as a
 * bucketable timestamp instead of a same/different comparison; duplicated
 * rather than imported to avoid a cross-service dependency neither side
 * otherwise needs.
 * @param {number} a
 */
function dayStart(a) {
  const d = new Date(a);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

/**
 * Total number of sets in a session - each element of a weight row's `r`
 * array is one set at that weight (e.g. `{w: 40, r: [10, 8]}` is two sets:
 * 40kg x10, then 40kg x8), same reading `set-ui.js` already renders
 * ("40kg X 10,8") client-side.
 * @param {WeightRow[]} sets
 */
function countSets(sets) {
  return sets.reduce((sum, row) => sum + row.r.length, 0);
}

/**
 * Estimated one-rep max via the Epley formula - standard, simple, good
 * enough for a rough "is this a PR" comparison (not meant to be exact).
 * @param {number} weight
 * @param {number} reps
 */
function estimatedOneRepMax(weight, reps) {
  return weight * (1 + reps / 30);
}

/**
 * Aggregation queries backing the Analytics page. Deliberately hybrid: SQL
 * does the cheap part (scope to `userId`, join in `muscles`/`name`, and for
 * frequency/PRs a date-range filter), the actual counting/bucketing happens
 * in JS - `muscles` is a comma-joined string and `sets` is a JSON blob on
 * `sessions`, and unpacking both in raw SQL would need json_each() plus a
 * recursive CTE for the comma-split, for no real benefit at this app's data
 * volume (a personal, single-user history - hundreds of sessions at most).
 * @param {import('node:sqlite').DatabaseSync} db
 */
function createAnalyticsService(db) {
  /**
   * Sets logged per muscle tag over the trailing `days` days, most-worked
   * first - a quick "have I been skipping a muscle group" check using the
   * tags already on each exercise, no new data needed.
   * @param {number} userId
   * @param {number} [days]
   */
  function getMuscleBalance(userId, days = 30) {
    const sinceMs = Date.now() - days * DAY_MS;
    const rows = db.prepare(
      `SELECT e.muscles, s.sets FROM sessions s
       JOIN exercises e ON e.id = s.exercise_id
       WHERE s.user_id = ? AND s.date >= ?`
    ).all(userId, sinceMs);

    /** @type {Map<string, number>} */
    const setsByMuscle = new Map();
    for (const row of rows) {
      const muscles = row.muscles ? String(row.muscles).split(',').filter(Boolean) : [];
      if (!muscles.length) { continue; }
      const setCount = countSets(JSON.parse(String(row.sets)));
      for (const muscle of muscles) {
        setsByMuscle.set(muscle, (setsByMuscle.get(muscle) || 0) + setCount);
      }
    }

    return Array.from(setsByMuscle, ([muscle, sets]) => ({ muscle, sets }))
      .sort((a, b) => b.sets - a.sets);
  }

  /**
   * Distinct calendar days trained per week, oldest to newest, over the
   * trailing `weeks` weeks (including the current, possibly-partial week).
   * Counts *days*, not sessions - training two different exercises on the
   * same day is one day of consistency, not two.
   * @param {number} userId
   * @param {number} [weeks]
   */
  function getTrainingFrequency(userId, weeks = 8) {
    const sinceMs = Date.now() - weeks * WEEK_MS;
    const rows = db.prepare('SELECT date FROM sessions WHERE user_id = ? AND date >= ?').all(userId, sinceMs);

    /** @type {Set<number>} */
    const trainedDayStarts = new Set(rows.map(r => dayStart(Number(r.date))));
    const todayStart = dayStart(Date.now());

    const buckets = Array.from({ length: weeks }, (_, i) => ({
      weekStart: todayStart - (weeks - 1 - i) * WEEK_MS,
      daysTrained: 0,
    }));

    for (const trainedDay of trainedDayStarts) {
      const weeksAgo = Math.floor((todayStart - trainedDay) / WEEK_MS);
      if (weeksAgo >= 0 && weeksAgo < weeks) {
        buckets[weeks - 1 - weeksAgo].daysTrained++;
      }
    }

    return buckets;
  }

  /**
   * Per exercise: the heaviest single set ever logged, and the best
   * estimated one-rep max across every individual set. Sorted by whichever
   * PR was set most recently, so it reads like a small "recent
   * achievements" feed rather than an arbitrary leaderboard.
   * @param {number} userId
   */
  function getPersonalRecords(userId) {
    const rows = db.prepare(
      `SELECT e.id as exercise_id, e.name, s.sets, s.date FROM sessions s
       JOIN exercises e ON e.id = s.exercise_id
       WHERE s.user_id = ?`
    ).all(userId);

    /** @type {Map<number, {exerciseId: number, name: string, maxWeight: number, maxWeightDate: number, bestOneRepMax: number, bestOneRepMaxDate: number}>} */
    const prByExercise = new Map();

    for (const row of rows) {
      const exerciseId = Number(row.exercise_id);
      const date = Number(row.date);
      const sets = JSON.parse(String(row.sets));

      for (const weightRow of sets) {
        for (const reps of weightRow.r) {
          const oneRepMax = estimatedOneRepMax(weightRow.w, reps);
          const existing = prByExercise.get(exerciseId);
          if (!existing) {
            prByExercise.set(exerciseId, {
              exerciseId, name: String(row.name),
              maxWeight: weightRow.w, maxWeightDate: date,
              bestOneRepMax: oneRepMax, bestOneRepMaxDate: date,
            });
            continue;
          }
          if (weightRow.w > existing.maxWeight) { existing.maxWeight = weightRow.w; existing.maxWeightDate = date; }
          if (oneRepMax > existing.bestOneRepMax) { existing.bestOneRepMax = oneRepMax; existing.bestOneRepMaxDate = date; }
        }
      }
    }

    return Array.from(prByExercise.values())
      .map(pr => ({ ...pr, bestOneRepMax: Math.round(pr.bestOneRepMax * 10) / 10 }))
      .sort((a, b) => Math.max(b.maxWeightDate, b.bestOneRepMaxDate) - Math.max(a.maxWeightDate, a.bestOneRepMaxDate));
  }

  /**
   * @param {number} userId
   */
  function getSummary(userId) {
    return {
      muscleBalance: getMuscleBalance(userId),
      frequency: getTrainingFrequency(userId),
      personalRecords: getPersonalRecords(userId),
    };
  }

  return { getMuscleBalance, getTrainingFrequency, getPersonalRecords, getSummary };
}

export { createAnalyticsService };
