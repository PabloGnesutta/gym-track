import { initializeCache } from "./initializeCache.js";
import { _info } from "./lib/logger.js";
import { initializeIndexedDb } from "./lib/indexedDb.js";
import { dbugBtns, initUi } from "./ui/ui.js";
import { initAuthUi } from "./ui/auth-ui.js";
import { initAppState } from "./common/state.js";
import { eventBus } from "./lib/utils.js";
import { bootApp } from "./appBoot.js";
import { $ } from "./lib/dom.js";


_info(' (!) App started');

initializeCache();

initializeIndexedDb();

/** Callback for Indexed DB initialization */
eventBus.on('IndexedDbInited', async ({ version }) => {
    _info(' (!) DB Callback');
    $('cacheMajorVersion').innerText = localStorage.getItem('cacheMajorVersion') || '';
    $('indexedDbVersion').innerText = version;

    await bootApp();
});

initAppState();
initUi();
initAuthUi();
dbugBtns();
