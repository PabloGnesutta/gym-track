import { createExercise } from "./exercise-db.js";
import { createSet } from "./set-db.js";


async function seedDb() {
  const minus2 = new Date()
  minus2.setDate(minus2.getDate() - 2)

  const minus1 = new Date()
  minus1.setDate(minus1.getDate() - 1)

  let w = 8;

  const ex1 = await createExercise('antier con set ayer', [], minus2);
  const ex2 = await createExercise('antier con set antier', [], minus2);
  const ex3 = await createExercise('antier sin set', [], minus2);
  const ex4 = await createExercise('ayer sin set', [], minus1);
  if (!ex1.data || !ex2.data || !ex3.data || !ex4.data || !ex1.data) { return; }
  
  await createSet(ex1.data, w, 13, minus1);

  await createSet(ex2.data, w, 14, minus2);

}


export { seedDb };