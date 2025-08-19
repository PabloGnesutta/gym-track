import { IncomingMessage, ServerResponse } from 'node:http';


/**
 * @typedef {Object} ReqUser
 * @property {String} userId
 * 
 * @typedef {Object} CustomRequestProperties
 * @property {Object} [body]
 * @property {URLSearchParams} [query]
 * @property {ReqUser} [user]
 * @typedef {IncomingMessage & CustomRequestProperties} ApiRequest
 *
 * @typedef {ServerResponse} ApiResponse
 */
