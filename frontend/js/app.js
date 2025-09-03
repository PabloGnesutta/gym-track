import { initializeCache } from "./initializeCache.js";
import { _info, _log } from "./lib/logger.js";
import { initializeIndexedDb } from "./lib/indexedDb.js";
import { dbugBtns, initUi } from "./ui/ui.js";
import { initAppState } from "./common/state.js";
import { eventBus } from "./lib/utils.js";
import { fillExerciseList, openExerciseList, openSingleExercise } from "./ui/exercise-ui.js";
import { fetchExercises } from "./local-db/exercise-db.js";
import { $ } from "./lib/dom.js";
import { seedDb } from "./local-db/seed.js";
import { openSessionForm } from "./ui/set-ui.js";


_info(' (!) App started');

initializeCache();

initializeIndexedDb();
/** Callback for Indexed DB initialization */
eventBus.on('IndexedDbInited', async ({ version }) => {
    // await seedDb();
    // return;
    _info(' (!) DB Callback');
    $('cacheMajorVersion').innerText = localStorage.getItem('cacheMajorVersion') || '';
    $('indexedDbVersion').innerText = version;
    await fetchExercises();
    fillExerciseList();
    openExerciseList();
    // await openSingleExercise('1');
    // openSessionForm('1')
});

initAppState();
initUi();
dbugBtns();
