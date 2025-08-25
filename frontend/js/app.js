import { initializeCache } from "./initializeCache.js";
import { _info, _log } from "./lib/logger.js";
import { initializeIndexedDb } from "./lib/indexedDb.js";
import { initUi, openSetCreate } from "./ui/ui.js";
import { dbStore, initAppState } from "./common/state.js";
import { fetchExercises } from "./local-db/exercise.js";


_info(' (!) App started');

initializeCache();
initializeIndexedDb(); // <--- todo: somehow await for this (event bus)

setTimeout(async () => {
    await fetchExercises()
    openSetCreate()
}, 100);

initAppState()
initUi()
