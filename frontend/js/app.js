import { initializeCache } from "./initializeCache.js";
import { _info, _log } from "./lib/logger.js";
import { initializeIndexedDb } from "./lib/indexedDb.js";
import { dbugBtns, initUi } from "./ui/ui.js";
import { initAppState } from "./common/state.js";
import { eventBus } from "./lib/utils.js";
import { fillExerciseList, openExerciseList } from "./ui/exercise-ui.js";
import { fetchExercises } from "./local-db/exercise-db.js";
import { $ } from "./lib/dom.js";


_info(' (!) App started');

initializeCache();

initializeIndexedDb();
/** Callback for Indexed DB initialization */
eventBus.on('IndexedDbInited', async () => {
    _info(' (!) DB Callback')
    await fetchExercises();
    fillExerciseList()
    openExerciseList()
    $('cacheMajorVersion').innerText = localStorage.getItem('cacheMajorVersion') || ''
})

initAppState();
initUi();
dbugBtns()
