import { initializeCache } from "./initializeCache.js";
import { _info, _log } from "./lib/logger.js";
import { initializeIndexedDb } from "./lib/indexedDb.js";
import { initUi } from "./ui/ui.js";
import { initAppState } from "./common/state.js";
import { seedDb } from "./local-db/seed.js";
import { eventBus } from "./lib/utils.js";
import { fillExerciseList, openExerciseList } from "./ui/exercise-ui.js";
import { fetchExercises } from "./local-db/exercise-db.js";


_info(' (!) App started');

initializeCache();

initializeIndexedDb();
/** Callback for Indexed DB initialization */
eventBus.on('IndexedDbInited', async () => {
    _info(' (!) DB Callback')
    // await seedDb();
    await fetchExercises();
    fillExerciseList()
    openExerciseList()
})

initAppState();
initUi();
