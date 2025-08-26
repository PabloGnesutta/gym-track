import { createExercise } from "./exercise.js";
import { createSet } from "./set.js";


async function seedDb() {
  await Promise.all([
    createExercise('ex1', ['biceps']),
    createExercise('ex2', ['quads']),
    createExercise('ex3', ['triceps']),
  ]);
  await Promise.all([
    createSet(1, 7, 51),
    createSet(1, 7, 511),
    createSet(1, 7, 5111),
    createSet(2, 7, 52),
    createSet(2, 7, 522),
  ]);
}

export { seedDb };