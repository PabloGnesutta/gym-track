import { $, $new, display, undisplay } from "./dom.js";


/** @type {'log'|'warn'|'error'|'info'} */
var logLevel = 'log';

const logger = $('logger');
const logs = $('logs');

$('closeLogsBtn').addEventListener('click', closeLogs);


function openLogs() {
  display(logger);
  logger.scroll({ top: logger.scrollHeight, behavior: 'smooth' });
}

function closeLogs() {
  undisplay(logger);
}

function log() {
  console[logLevel](...arguments);

  [...arguments].forEach(arg => {
    let text = '';
    switch (typeof arg) {
      case 'boolean':
      case 'bigint':
      case 'number':
      case 'symbol':
      case 'function':
        text = String(arg); break;
      case 'object':
        if (arg instanceof Error) {
          _error(arg.message);
          _error(arg.stack);
          return;
        } else {
          text = JSON.stringify(arg, null, 1); break;
        }
      case 'string':
        text = arg; break;
      case "undefined":
        text = "undefined"; break;
      default:
        text = String(arg); break;
    }
    const p = $new({ tag: 'p', class: 'log-entry type-' + logLevel, text });
    logs.append(p);
  });
}


function _log() {
  logLevel = 'log';
  log(...arguments);
}
function _warn() {
  logLevel = 'warn';
  log(...arguments);
}
function _error() {
  logLevel = 'error';
  log(...arguments);
  openLogs();
}
function _info() {
  logLevel = 'info';
  log(...arguments);
}

window.onerror = e => _error('window.onerror:', e);

window.addEventListener('unhandledrejection', e => _error('unhandledrejection:', e.reason));


export { _log, _warn, _error, _info, openLogs, closeLogs };
