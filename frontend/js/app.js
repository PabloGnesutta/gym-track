import { testButton } from "./lib/dom.js";
import { testWhoami, testLogin } from "./api-caller/apiCaller.js";
import { initializeCache } from "./initializeCache.js";
import { _info, closeLogs, openLogs } from "./lib/logger.js";


_info(' (!) App started');

initializeCache();

openLogs();
setTimeout(() => closeLogs(), 1000);

// testButton();
// await testLogin()
// await testWhoami()
