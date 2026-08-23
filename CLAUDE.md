# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Gym Track: a mobile-first PWA for logging gym exercises, sets, and reps. Vanilla JS frontend (no framework, no bundler, no build step) with a Node.js backend that currently serves static files and a scaffolded (but unused) JWT auth API. All exercise/session data lives client-side in IndexedDB; a server-side SQLite schema now exists too (see "Server-side database" below) but nothing reads or writes it from an HTTP route yet.

This repo is one of several sibling "-track" apps (car-track, fridge-track) that share the same structure — fridge-track in particular is more mature (accounts, sync, a real `node:sqlite` API) and is a useful reference for how this project's own backend/tooling might grow. Be careful not to cross-contaminate: this project's frontend content (index.html, app.js, ui.js) should stay gym-specific — do not copy in UI/markup from a sibling project.

**Requires Node ≥24** (`backend/package.json`'s `engines`) — the server-side schema is built on the built-in `node:sqlite` module.

## Commands

The repo has two independent npm projects (`backend/`, `frontend/`); there is no root-level package.json or build step.

**Backend (`backend/`)**:
```
npm run serve       # nodemon on src/index.gym-track.js, reads PORT from backend/.env (copy .env.example first)
npm test             # unit tests: node --test (backend/test/*.test.js)
node --test test/exerciseService.test.js   # run a single test file
npm run typecheck    # tsc --noEmit (backend/tsconfig.json)
```

**Frontend (`frontend/`)** — no bundler/build step; every file is loaded exactly as written by the browser (`<script type="module">`) or served as-is by the backend:
```
npm test                          # unit tests: node --test (frontend/test/*.test.js)
node --test test/date.test.js     # run a single unit test file
npm run typecheck                 # tsc --noEmit (frontend/tsconfig.json)
npm run test:e2e                  # Playwright e2e (frontend/e2e/*.spec.js)
npx playwright test e2e/session.spec.js    # run a single e2e spec
npx playwright test -g "some title"        # run e2e tests matching a title
```
`test:e2e` auto-starts and tears down the backend server itself against port 3033 (see `playwright.config.js`) — don't start it manually first. `npx playwright install chromium` is a one-time setup step if the browser binary isn't already downloaded.

Both `typecheck` scripts run real `tsc --noEmit` against the existing JSDoc annotations (`tsconfig.json` in each project, `checkJs`/`allowJs`/`noEmit`, no `strict`) — unlike the sibling fridge-track/car-track projects, which only have editor-level (`.vscode/settings.json` `checkJs`) type checking with no scriptable CLI command. Keep annotating new code with JSDoc rather than converting files to `.ts`; the two `tsconfig.json`s are intentionally separate (frontend targets `lib: ["DOM"]` for browser globals, backend targets Node's `types: ["node"]`) since the two runtimes don't share globals.

## Architecture

### Frontend (`frontend/js/`)

Vanilla JS with ES modules (`type="module"`), no framework. Structure:
- `local-db/` — data access layer, one file per entity (`exercise-db.js`, `set-db.js`). Functions here read/write IndexedDB directly and also mutate the in-memory `dbStore` cache.
- `ui/` — DOM rendering and event wiring, one file per view/entity (`exercise-ui.js`, `set-ui.js`, `ui.js`). No component framework — elements are built with the `$new`/`$button` helpers in `lib/dom.js` and appended directly to fixed containers already present in `index.html`.
- `common/state.js` — three global, mutated-in-place state objects: `appState` (UI flags like `showExerciseForm`, also mirrored onto `$app.dataset` for CSS state-driven styling), `dataState` (currently-open exercise/session), and `dbStore` (in-memory cache of IndexedDB records — exercises array, sessions keyed by exercise key as strings).
- `lib/indexedDb.js` — thin generic wrapper around the IndexedDB API (`putOne`, `getOne`, `getAll`, `getOneWithIndex`, `getAllWithIndex`, `deleteOne`, `deleteMany`). All local-db modules build on this instead of touching `indexedDB` directly. `whenDbReady()` gates any DB access before initialization completes.
- `lib/utils.js` — includes a tiny pub/sub `eventBus`. The only current event is `IndexedDbInited`, emitted once the DB opens; `app.js` waits on it before fetching/rendering exercises.
- `api-caller/apiCaller.js` — wraps `fetch` to the backend `/api/*` routes with the JWT bearer token from `localStorage`. Currently only exercises test routes (`login`, `whoami`); not used by the real exercise/session flow.

**Data flow for a typical action** (e.g. adding a set): UI event handler in `ui/*.js` → local-db function in `local-db/*.js` (validates, builds the record, calls `indexedDb.js`) → local-db function also updates `dbStore` in place → UI function re-renders the affected DOM node directly (no reactive re-render; each mutation manually patches the relevant element).

**IndexedDB schema** (`frontend/js/lib/indexedDb.js`): database `GymTrack`, bump `dbVersion` and add store creation logic in `onDbUpgradeNeeded` when changing schema. Two stores: `exercises` (autoIncrement key, unique index on `name`) and `sessions` (autoIncrement key, non-unique index on `exerciseKey`). A `Session` belongs to one `Exercise` for one calendar day and holds multiple `WeightRow`s (`{ w: weight, r: reps[] }`); adding another set for the same weight on the same day appends to `r` on the existing row rather than creating a new row/session. Each `Exercise` denormalizes `lastSession` onto its own record for fast list rendering.

Because `dbVersion` bumps trigger `onDbOpenError` with `VersionError` handling that **deletes and recreates the whole database**, never lower `dbVersion` against a codebase with data you want to keep — that path exists specifically to wipe local data during development.

### PWA / caching (`frontend/cacheServiceWorker.js`)

Static-asset caching via a service worker with a versioned cache name (`MAJOR_VERSION`). `INTERCEPT_FETCH_REQUESTS` toggles whether the service worker intercepts fetches at all:
- Set to `false` during local development so hot-reloaded changes are visible immediately (otherwise the cached version is always served).
- Set to `true`, and bump `MAJOR_VERSION`, before shipping a release.

See [frontend/js/README.md](frontend/js/README.md) for the same note in context.

### Backend (`backend/src/`)

Plain Node.js `http` server (no Express/framework), ESM (`"type": "module"`).
- [index.gym-track.js](backend/src/index.gym-track.js) — entry point; loads `.env`, starts `createServer(handleRequest)`.
- [http/requestHandler.js](backend/src/http/requestHandler.js) — top-level router: serves `frontend/` static files by extension/path prefix (`css/`, `js/`, `static/`, `/`→`index.html`), and delegates anything under `/api` to `apiRouter`. Also parses request bodies (JSON or urlencoded only) before handing off to the API router.
- [http/apiRouter.js](backend/src/http/apiRouter.js) — switches on `req.url`. Splits routes into a public list (currently just `/api/login`) and everything else, which goes through `authorize()` (JWT bearer check) first. Add new API routes here.
- [http/middleware.js](backend/src/http/middleware.js) — `authorize(req)`: validates the `Authorization: Bearer <token>` header via `verifyJWT`, attaches `req.user` on success.
- [auth/jwt.js](backend/src/auth/jwt.js) — `generateJWT`/`verifyJWT` using `jsonwebtoken` and `process.env.TOKEN_SECRET`.
- [controllers/auth-controller.js](backend/src/controllers/auth-controller.js) — `login` currently issues a token for *any* name as an anonymous "Visitor" — there's no real user/credential system yet.
- Responses are always `{ data }` or `{ error }` JSON envelopes, built by [http/httpResponses.js](backend/src/http/httpResponses.js) (`jsonResponse`/`errorResponse`).

The backend has no gym-domain HTTP routes yet — `/api/test` and `/api/whoami` are the only authenticated examples. `apiRouter.js`'s router is intentionally still a bare `switch` on `req.url`; a more structured router (path params, method dispatch) closer to fridge-track's/car-track's is planned as a follow-up, not yet built.

### Server-side database (scaffolding, not yet wired to any route)

`backend/src/db/` mirrors fridge-track's own `node:sqlite`-based setup:
- [db/db.js](backend/src/db/db.js) — opens `backend/data/gymtrack.db` (a `node:sqlite` `DatabaseSync`, gitignored, created on first run) and runs pending migrations. Importing this module (done once, from `index.gym-track.js`, so the schema is ready as soon as the server boots) is what actually applies migrations — nothing else touches the file.
- [db/migrate.js](backend/src/db/migrate.js) — generic migration runner: each migration runs at most once, tracked in a `schema_migrations` table, inside its own transaction. `CREATE TABLE IF NOT EXISTS` alone can't handle a column being added to an existing table later, which is why this exists instead of a single hand-maintained schema blob.
- [db/migrations/](backend/src/db/migrations) — `NNN_description.js` files exporting a `sql` string, registered in order in `migrations/index.js` (an explicit array, not directory-scanning). **Never edit an already-shipped migration's `sql`** — add a new migration with the next version number instead. Migration `001` creates `exercises` (unique `name`, comma-joined `muscles`) and `sessions` (`exercise_id` FK, `sets` stored as a JSON string of `WeightRow[]`, `notes`) — the same shape the client already uses in IndexedDB, just relational instead of a key-value store. There's deliberately no user/account scoping yet: `login` (`controllers/auth-controller.js`) issues a token for any name as an anonymous "Visitor" with no persisted identity, so there's nothing real to scope rows by until that changes.
- [services/exerciseService.js](backend/src/services/exerciseService.js) / [services/sessionService.js](backend/src/services/sessionService.js) — `create*Service(db)` factories (same shape as fridge-track's `create*Service`) with the CRUD logic: `exerciseService` mirrors `frontend/js/local-db/exercise-db.js`'s validation (non-empty name, uniqueness) and cascades exercise deletion to its sessions; `sessionService` mirrors `set-db.js`'s `createSet` — `addSet(exerciseId, {weight, reps}, date?)` appends to today's session if one exists (grouping same-weight reps into one row, exactly like the client), otherwise starts a new session. [services/ServiceError.js](backend/src/services/ServiceError.js) is a plain `Error` subclass for user-facing validation messages, ready for a future router to map to a 400.
- [test/](backend/test) covers all of the above against an in-memory (`:memory:`) database, following fridge-track's test pattern exactly.

None of this is called from `apiRouter.js` yet — wiring routes to these services is the "actual router" work mentioned as a follow-up. When that happens, follow the router → controller (or router → service, per fridge-track) pattern rather than introducing a new structure.

## Conventions to preserve

- JSDoc types (`@typedef`, `@param`, `@returns`) are used consistently in place of TypeScript; keep annotating new functions the same way rather than converting the project to `.ts`.
- Store mutation functions (`local-db/*.js`) mutate the passed-in object (e.g. `updateExercise` mutates the `exercise` argument) rather than returning a new one — callers rely on this to update `dbStore` in place without a separate replace step.
- Some UI copy is in Spanish (form labels, confirm dialogs, error messages like `'Ingresar nombre'`); match the existing language per string rather than switching wholesale.
- **Frontend unit tests only cover DOM-free modules.** `js/lib/dom.js` and `js/lib/logger.js` touch `document`/`window` at module top level, so importing anything that transitively pulls them in (most of `ui/*.js`, `local-db/*.js`) crashes under plain `node --test`. `frontend/test/` therefore only targets modules with no such dependency (`lib/date.js`, `lib/string.js` today) — same constraint fridge-track's own frontend test suite documents. UI-level behavior belongs in the Playwright e2e suite instead, where every test gets a fresh browser context (empty IndexedDB) for free.
