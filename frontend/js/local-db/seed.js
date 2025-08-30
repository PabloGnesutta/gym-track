import { createExercise } from "./exercise-db.js";
import { createSet } from "./set-db.js";


async function seedDb() {
  const ex = await createExercise('ejercicio 1', ['biceps']);
  if (!ex.data) { return; }
  const date = new Date();

  let w = 8;
  date.setDate(date.getDate() - 8);
  await createSet(ex.data, w, 13, date);
  await createSet(ex.data, w, 14, date);
  await createSet(ex.data, w, 11, date);

  ex.data.lastSession = null
  w = 9;
  date.setDate(date.getDate() + 7);
  await createSet(ex.data, w, 11, date);
  await createSet(ex.data, w, 13, date);
  await createSet(ex.data, w, 12, date);

  ex.data.lastSession = null
  w = 12;
  date.setDate(date.getDate() + 1);
  await createSet(ex.data, w, 8, date);
  await createSet(ex.data, w, 7, date);
  await createSet(ex.data, w, 9, date);
}


export { seedDb };