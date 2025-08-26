import { initializeCache } from "./initializeCache.js";
import { _info, _log } from "./lib/logger.js";
import { initializeIndexedDb } from "./lib/indexedDb.js";
import { initUi, openSetCreate } from "./ui/ui.js";
import { dbStore, initAppState } from "./common/state.js";
import { fetchExercises } from "./local-db/exercise.js";
import { seedDb } from "./local-db/seed.js";
import { fetchSets } from "./local-db/set.js";


_info(' (!) App started');

initializeCache();
initializeIndexedDb(); // <--- todo: somehow await for this (event bus)

setTimeout(async () => {
    // await seedDb();
    await fetchExercises();
    // todo: at first load, only fetch the last set for each exercises, 
    // or potentially have it stored in the exercise
    // then, when one exercise is selected, fetch all its sets
    await fetchSets();
}, 100);

initAppState();
initUi();
