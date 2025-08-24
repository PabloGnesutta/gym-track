import { $, $button, $form, $queryOne, testButton } from "./lib/dom.js";
import { testWhoami, testLogin } from "./api-caller/apiCaller.js";
import { initializeCache } from "./initializeCache.js";
import { _info, _log, closeLogs, openLogs } from "./lib/logger.js";
import { getAll, getOne, initializeIndexedDb, putOne } from "./lib/indexedDb.js";
import { testLocalDbEndpoint } from "./local-db/exercise.js";
import { initUi } from "./ui/ui.js";
import { initAppState } from "./common/common.js";


_info(' (!) App started');

initializeCache();
initializeIndexedDb();

// openLogs();

setTimeout(async () => {
    // closeLogs();
    // testLocalDbEndpoint()
}, 1000);

initAppState()
initUi()
