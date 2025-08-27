import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { debug, log, warn } from '../logger/logger.js';
import { apiRouter } from './apiRouter.js';
import { jsonResponse, errorResponse } from './httpResponses.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PUBLIC_DIR = join(__dirname, '../', '../', '../', 'frontend');

/**
 * Main handler of the request. 
 * First thing that executes in the request lifecycle.
 * // TODO:? Make it always return ApiResponse
 * @param {import('./types').ApiRequest} req - request object.
 * @param {import('./types').ApiResponse} res - response object.
 * @returns {Promise<import('./types').ApiResponse | null>}
 */
export async function handleRequest(req, res) {
  const _url = req.url || '/'
  try {
    if (_url === '/') {
      return sendAssetFile(res, ['index.html'], 'text/html');
    }

    const urlArray = _url.split('/');
    const pathBase = urlArray[1];
    const fileRoute = urlArray.slice(1, urlArray.length);
    debug('urlArray', urlArray)

    if (pathBase === 'css') return sendAssetFile(res, fileRoute, 'text/css');
    else if (pathBase === 'js') return sendAssetFile(res, fileRoute, 'application/javascript');
    else if (pathBase === 'static') {
      if (fileRoute[1] === 'icons') {
        return sendAssetFile(res, fileRoute, 'image/png');
      }
      else if (fileRoute[1] === 'manifest.json') {
        return sendAssetFile(res, fileRoute, 'application/json');
      }
    }

    else if (pathBase === 'cacheServiceWorker.js') {
      return sendAssetFile(res, ['cacheServiceWorker.js'], 'application/javascript');
    }
    else if (pathBase === 'favicon.ico') {
      return sendAssetFile(res, ['static', pathBase], 'image/x-icon');
    }

    else if (pathBase === 'api') {
      return await handleApiRequest(req, res);
    }


    // 404
    return errorResponse(res, 'Resource not found ' + _url, 404);
  } catch (_err) {
    log('---Error @handleRequest', _err);
    return errorResponse(res, 'Something went wrong', 500);
  }
}

/**
 * If the request was made to the /api route, it should be handled by this.
 * Would be the second step in the chain
 * @param {import('./types').ApiRequest} req - request object.
 * @param {import('./types').ApiResponse} res - response object.
 * @returns {Promise<import('./types').ApiResponse>}
 */
async function handleApiRequest(req, res) {
  const parseResult = await parseRequestData(req);
  if (parseResult) {
    return errorResponse(res, parseResult.errMsg, parseResult.status);
  }

  const apiRequestResult = await apiRouter(req);
  if (apiRequestResult.data) {
    return jsonResponse(res, apiRequestResult.data);
  } else {
    return errorResponse(res, apiRequestResult.error || 'Error__', apiRequestResult.status);
  }
}


/**
 * If everything went ok, it returns null, otherwise 
 * returnw object with http status code and error data
 * @param {import('./types').ApiRequest} req - request object
 * @returns {Promise<null | {
 *   status: number,
 *   errMsg: string,
 *   err?: [Error],
 * }>}
*/
async function parseRequestData(req) {
  // Note: Might need not be a promise, but it's practical
  req.query = new URL(req.url || '', process.env.SERVER_HOST).searchParams;
  const body = [];
  req.on('data', chunk => body.push(chunk));
  return new Promise((resolve, rej) => {
    req.on('end', async () => {
      try {
        // Parse request body
        switch (req.headers['content-type']) {
          case 'application/json':
            req.body = JSON.parse(Buffer.concat(body).toString());
            resolve(null);
            break;
          case 'application/x-www-form-urlencoded':
            req.body = new URLSearchParams(Buffer.concat(body).toString());
            resolve(null);
            break;
          default:
            resolve({ status: 400, errMsg: 'Unsupported content type: ' + req.headers['content-type'] });
            return;
        }
      } catch (e) {
        warn('Error @parseRequestData', e);
        resolve({ status: 500, err: e, errMsg: 'Invalid payload' });
      }
    });
  });
}


/**
 * Uses the response object to stream static files. 
 * Returns null.
 * @param {import('./types').ApiResponse} res - response object
 * @param {string[]} fileRoute
 * @param {string} contentType - Should pobably be an enum
 * @returns {null}
 */
function sendAssetFile(res, fileRoute, contentType) {
  // TODO: Not very fond of this spread
  const filePath = join(PUBLIC_DIR, ...fileRoute);
  fs.stat(filePath, (err, stat) => {
    if (err === null) {
      res.writeHead(200, { 'content-type': contentType });
      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
      return;
    }

    if (err.code === 'ENOENT') {
      log('---File does not exist @sendAssetFile', filePath);
      res.writeHead(404);
      res.end();
    } else {
      log('---Error @sendAssetFile', err);
      res.writeHead(500);
      res.end();
    }
  });
  return null;
}
