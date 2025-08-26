import { createExercise } from "./exercise-db.js";


async function seedDb() {
  await Promise.all([
    createExercise('ex1', ['biceps']),
    createExercise('ex2', ['quads']),
    createExercise('ex3', ['triceps']),
  ]);
}

export { seedDb };