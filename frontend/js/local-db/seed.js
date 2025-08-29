import { putOne } from "../lib/indexedDb.js";
import { createExercise } from "./exercise-db.js";


async function seedDb() {
  const ex = await createExercise('ejercicio 1', ['biceps'])
  await Promise.all(
    _createSets(ex.data?._key, [
      { weight: 8, reps: 13, days: -8 },
      { weight: 8, reps: 14, days: -8 },
      { weight: 8, reps: 11, days: -8 },
    ])
  )
  await Promise.all(
    _createSets(ex.data?._key, [
      { weight: 9, reps: 11, days: -1 },
      { weight: 9, reps: 13, days: -1 },
      { weight: 9, reps: 12, days: -1 },
    ])
  )
  await Promise.all(
    _createSets(ex.data?._key, [
      { weight: 12, reps: 8, days: 0 },
      { weight: 12, reps: 7, days: 0 },
      { weight: 12, reps: 9, days: 0 },
    ])
  )
}


function _createSets(exerciseKey, args) {
  const promises = []
  args.forEach(({ weight, reps, days }) => {
    const date = new Date()
    date.setDate(date.getDate() + days)
    promises.push(putOne('sets', {
      exerciseKey,
      weight,
      reps,
      volume: 0,
      date
    }))
  })
  return promises
}
export { seedDb };