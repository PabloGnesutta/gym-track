# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Gym Track: a mobile-first PWA for logging gym exercises, sets, and reps. Vanilla JS frontend (no framework, no bundler, no build step) with a Node.js backend. The backend now has real password-based accounts and a proper `/api/*` router (`backend/src/http/apiRouter.js`) backed by SQLite, matching the sibling car-track/fridge-track apps — see "Backend" and "Accounts" below. Exercise/session **data** itself still lives entirely in the browser's IndexedDB; accounts currently only gate *access* to the app, they don't yet scope or sync that data (see "What accounts do (and don't) do yet").

This repo is one of several sibling "-track" apps (car-track, fridge-track) that share the same structure — car-track in particular was the direct model for this backend/accounts rewrite (same single-owner-per-row shape, unlike fridge-track's multi-user "Home" sharing model). Be careful not to cross-contaminate: this project's frontend content (index.html, app.js, ui.js) should stay gym-specific — do not copy in UI/markup from a sibling project. Also don't take a sibling's own CLAUDE.md as ground truth without checking the actual code first — car-track's, for one, was found stale (still describing a since-replaced local-only backend) partway through this rewrite.

**Requires Node ≥24** (`backend/package.json`'s `engines`) — the server-side schema is built on the built-in `node:sqlite` module.

**Allow-listed signup**: creating an account requires the email to already be in the `allowed_emails` table (same anti-abuse gate car-track/fridge-track use). Manage it via `node src/db/manageAllowedEmails.js add|remove|list <email>` from `backend/` — there's no UI for this. `pablo.gnesutta@gmail.com` is already allow-listed on the local dev database as of this writing.

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
`test:e2e` auto-starts and tears down the backend server itself, on its own port and its own sqlite file (`3999` / `backend/data/gymtrack.test.db`, set via `playwright.config.js`'s `webServer.env` — see `e2e/testPort.js`) — deliberately isolated from a manually-run `npm run serve` (port from `backend/.env`, `gymtrack.db`) so an e2e run can never collide with or wipe real local dev data. Don't start the backend manually before running e2e. `npx playwright install chromium` is a one-time setup step if the browser binary isn't already downloaded.

Both `typecheck` scripts run real `tsc --noEmit` against the existing JSDoc annotations (`tsconfig.json` in each project, `checkJs`/`allowJs`/`noEmit`, no `strict`) — unlike the sibling fridge-track/car-track projects, which only have editor-level (`.vscode/settings.json` `checkJs`) type checking with no scriptable CLI command. Keep annotating new code with JSDoc rather than converting files to `.ts`; the two `tsconfig.json`s are intentionally separate (frontend targets `lib: ["DOM"]` for browser globals, backend targets Node's `types: ["node"]`) since the two runtimes don't share globals.

## Architecture

### Frontend (`frontend/js/`)

Vanilla JS with ES modules (`type="module"`), no framework. Structure:
- `local-db/` — data access layer, one file per entity (`exercise-db.js`, `set-db.js`). Functions here read/write IndexedDB directly and also mutate the in-memory `dbStore` cache.
- `ui/` — DOM rendering and event wiring, one file per view/entity (`exercise-ui.js`, `set-ui.js`, `ui.js`). No component framework — elements are built with the `$new`/`$button` helpers in `lib/dom.js` and appended directly to fixed containers already present in `index.html`.
- `common/state.js` — three global, mutated-in-place state objects: `appState` (UI flags like `showExerciseForm`, also mirrored onto `$app.dataset` for CSS state-driven styling), `dataState` (currently-open exercise/session), and `dbStore` (in-memory cache of IndexedDB records — exercises array, sessions keyed by exercise key as strings).
- `lib/indexedDb.js` — thin generic wrapper around the IndexedDB API (`putOne`, `getOne`, `getAll`, `getOneWithIndex`, `getAllWithIndex`, `deleteOne`, `deleteMany`). All local-db modules build on this instead of touching `indexedDB` directly. `whenDbReady()` gates any DB access before initialization completes.
- `lib/utils.js` — includes a tiny pub/sub `eventBus`. The only current event is `IndexedDbInited`, emitted once the DB opens; `app.js` waits on it before calling `bootApp()`.
- `api-caller/apiCaller.js` — wraps `fetch` to the backend's `/api/*` routes with the bearer session token from `localStorage`, always POSTs, always resolves `{data}`/`{error}` (never throws). `apiSignup`/`apiLogin`/`apiLogout` are wired into the boot/auth flow (see below); `apiCreateExercise`/`apiFetchExercises`/`apiUpdateExercise`/`apiDeleteExercise`/`apiFetchSessions`/`apiAddSet`/`apiUpdateSession`/`apiDeleteSession` are 1:1 clients for the backend's exercises/sessions routes but **aren't called anywhere yet** — exercise/session data still flows through `local-db/*.js` → IndexedDB only, not through these. Wiring them up (with a one-time import of each device's existing IndexedDB data, the way car-track's `maybeImportLegacyData()` did for its own equivalent migration) is the natural next step, not done here.
- `appBoot.js` — `bootApp()` (called from `app.js`'s `IndexedDbInited` handler): checks `isLoggedIn()` and stops at the login screen (`appState.authStage = 'login'`) if there's no cached session, otherwise calls `afterLogin()`. `afterLogin()` sets `authStage = 'ready'` and runs the *existing* `fetchAndRenderExercises()` + `openExerciseList()` sequence unchanged — see "What accounts do (and don't) do yet" below. `logout()` calls the API to invalidate the session token, then drops back to the login screen.
- `ui/auth-ui.js` — wires the login/signup form (`#authForm`, toggled between modes via `#authModeToggle`) and calls `afterLogin()` on success. The header's logout button itself is wired in `ui.js` (where every other header/view button is, per that file's own centralizing convention), which calls back into `auth-ui.js`'s `resetAuthMode()` so a fresh logout always lands on the login form rather than wherever signup/login mode was left.

**Data flow for a typical action** (e.g. adding a set): UI event handler in `ui/*.js` → local-db function in `local-db/*.js` (validates, builds the record, calls `indexedDb.js`) → local-db function also updates `dbStore` in place → UI function re-renders the affected DOM node directly (no reactive re-render; each mutation manually patches the relevant element).

**Auth gates the DOM the same way view-switching does**: `#app`'s `data-auth-stage` attribute (`'checking'` → `'login'` or `'ready'`, via `setAuthStage()` in `state.js`) drives `css/auth.css`'s `#app:not([data-auth-stage='ready']) #mainHeader, .views { display: none }` / `#app[data-auth-stage='login'] #authView { display: flex }` rules — the same CSS-attribute-selector pattern `currentView`/`showExerciseForm` already use, not a JS show/hide toggle.

**IndexedDB schema** (`frontend/js/lib/indexedDb.js`): database `GymTrack`, bump `dbVersion` and add store creation logic in `onDbUpgradeNeeded` when changing schema. Two stores: `exercises` (autoIncrement key, unique index on `name`) and `sessions` (autoIncrement key, non-unique index on `exerciseKey`). A `Session` belongs to one `Exercise` for one calendar day and holds multiple `WeightRow`s (`{ w: weight, r: reps[] }`); adding another set for the same weight on the same day appends to `r` on the existing row rather than creating a new row/session. Each `Exercise` denormalizes `lastSession` onto its own record for fast list rendering.

Because `dbVersion` bumps trigger `onDbOpenError` with `VersionError` handling that **deletes and recreates the whole database**, never lower `dbVersion` against a codebase with data you want to keep — that path exists specifically to wipe local data during development.

### PWA / caching (`frontend/cacheServiceWorker.js`)

Static-asset caching via a service worker with a versioned cache name (`MAJOR_VERSION`). `INTERCEPT_FETCH_REQUESTS` toggles whether the service worker intercepts fetches at all:
- Set to `false` during local development so hot-reloaded changes are visible immediately (otherwise the cached version is always served).
- Set to `true`, and bump `MAJOR_VERSION`, before shipping a release.

See [frontend/js/README.md](frontend/js/README.md) for the same note in context.

### Backend (`backend/src/`)

Plain Node.js `http` server (no Express/framework), ESM (`"type": "module"`), following the exact structure of car-track's/fridge-track's own backends.
- [index.gym-track.js](backend/src/index.gym-track.js) — entry point; loads `.env`, imports `db.js` (runs pending migrations as a side effect), starts `createServer(handleRequest)`.
- [http/requestHandler.js](backend/src/http/requestHandler.js) — serves `frontend/` static files by path prefix (`css/`, `js/`, `static/`, `/`→`index.html`), merges [http/securityHeaders.js](backend/src/http/securityHeaders.js)'s `SECURITY_HEADERS` (strict CSP — the app has zero inline scripts/styles/third-party resources, so this costs nothing) into every response, and delegates anything under `/api` to `apiRouter.js`'s `handleApiRequest`.
- [http/apiRouter.js](backend/src/http/apiRouter.js) — `handleApiRequest(req, res, segments)`: joins the path segments after `api/` into a route string and dispatches via an `if` chain (not a bare `switch` on `req.url` like before — this is the "actual router" work). All routes are POST-only, matching `apiCaller.js`. `signup`/`login` are public; everything else requires a valid `Authorization: Bearer <token>` resolved via `getBearerUser()`. A `ServiceError` thrown by any service maps to a 400; anything else unexpected is logged and mapped to a 500. Add new routes here, following the existing `if (route === '...') { return successResponse(res, someService.doThing(user.id, ...)); }` shape.
- [http/bodyParser.js](backend/src/http/bodyParser.js) — `readJsonBody(req)`, used directly by `apiRouter.js` (no separate content-type switch in `requestHandler.js` anymore).
- [http/httpResponses.js](backend/src/http/httpResponses.js) — `successResponse(res, data)` / `errorResponse(res, msg, status)`, both merging `SECURITY_HEADERS`.
- [auth/passwordHash.js](backend/src/auth/passwordHash.js) — `hashPassword`/`verifyPassword` via `node:crypto`'s `scryptSync` + `timingSafeEqual`. No JWT anymore (the old `auth/jwt.js`/`controllers/auth-controller.js`/`http/middleware.js` were removed) — sessions are opaque random tokens stored server-side (see below), not self-contained signed tokens, so there's no `TOKEN_SECRET` to protect or leak.

### Accounts (`backend/src/services/authService.js`, `backend/src/db/allowedEmails.js`)

Real password-based accounts, replacing the old anonymous-visitor JWT entirely:
- `createUser(email, password, name?)` requires the email to be in `allowed_emails` first (`isEmailAllowed`) — signup is invite-gated, not open. Manage the list via `node src/db/manageAllowedEmails.js add|remove|list <email>` (no UI).
- `verifyLogin(email, password)` checks the stored `scrypt` hash.
- `createSession(userId)` issues a random 32-byte hex bearer token, stored in the `auth_sessions` table (see schema below); `getUserBySessionToken(token)`/`deleteSession(token)` resolve/revoke it. `apiRouter.js`'s `getBearerUser()` is the only place that reads the `Authorization` header.
- Frontend: `js/api-caller/apiCaller.js`'s `apiSignup`/`apiLogin`/`apiLogout` persist/clear `accessToken`/`userId`/`userEmail`/`userName` in `localStorage`; `isLoggedIn()` is just `!!accessToken`. `js/appBoot.js` + `js/ui/auth-ui.js` wire this into the boot flow and the `#authView` login/signup form — see the Frontend section above.

**What accounts do (and don't) do yet**: logging in gates *access* to the app (`authStage`), but exercise/session data is still 100% IndexedDB, unscoped by account — every logged-in user on a given device currently sees that device's same local data, regardless of which account is active. The backend *has* real per-`user_id` exercises/sessions routes ready (see below) — the frontend just doesn't call them for its actual data flow yet. Don't assume accounts imply data isolation across users on the same device until that migration happens.

### Server-side database (`backend/src/db/`)

`node:sqlite`-based, mirroring car-track's/fridge-track's own setup:
- [db/db.js](backend/src/db/db.js) — opens `backend/data/<DB_NAME>.db` (a `node:sqlite` `DatabaseSync`, gitignored; `DB_NAME` env var defaults to `gymtrack.db`, overridden to `gymtrack.test.db` for e2e — see "Commands" above) and runs pending migrations. WAL journal mode + a 5s busy timeout, so concurrent readers/writers (e.g. e2e test helpers opening their own short-lived connection to the same file) don't collide.
- [db/migrate.js](backend/src/db/migrate.js) — generic migration runner: each migration runs at most once, tracked in a `schema_migrations` table, inside its own transaction.
- [db/migrations/](backend/src/db/migrations) — `NNN_description.js` files exporting a `sql` string, registered in order in `migrations/index.js` (an explicit array, not directory-scanning). **Never edit an already-shipped migration's `sql`** — add a new migration with the next version number instead.
  - `001_initial_schema` — original `exercises`/`sessions` tables (no accounts yet at that point).
  - `002_accounts` — adds `users`, `auth_sessions` (named `auth_sessions`, not `sessions`, specifically to avoid colliding with the pre-existing workout-session table), and `allowed_emails`; **drops and recreates** `exercises`/`sessions` with a `user_id` column (`exercises.name`'s unique constraint also widened from global to per-`(user_id, name)`, so two accounts can each have their own "Sentadilla") — safe as a plain drop specifically because no route ever existed to write to either table before this migration shipped. A future recreate-table migration against a table that *does* have real rows must copy them across instead (rename-aside + `INSERT ... SELECT`, per fridge-track's own `008_locations_category_id.js`).
- [services/exerciseService.js](backend/src/services/exerciseService.js) / [services/sessionService.js](backend/src/services/sessionService.js) — `create*Service(db)` factories, every function scoped by `userId` (mirrors car-track's `vehicleService.js`'s `getOwnedVehicleRow` ownership-check pattern via `getOwnedExerciseRow`). `sessionService` takes an injected `exerciseService` (defaulting to a real one) purely to reuse its ownership check rather than duplicating that query — same cross-service-reuse shape as fridge-track's `syncService` reusing `homeService`'s `assertHomeMembership`. [services/ServiceError.js](backend/src/services/ServiceError.js) is a plain `Error` subclass the router maps to a 400.
- [test/](backend/test) covers all of the above (including `authService.test.js` and multi-user data-isolation cases) against an in-memory (`:memory:`) database.

**Routes** (all POST, bearer-gated except signup/login): `signup`, `login`, `whoami`, `logout`, `exercises/fetch`, `exercises/create`, `exercises/update`, `exercises/delete`, `sessions/fetch`, `sessions/addSet`, `sessions/update`, `sessions/delete`.

## Conventions to preserve

- JSDoc types (`@typedef`, `@param`, `@returns`) are used consistently in place of TypeScript; keep annotating new functions the same way rather than converting the project to `.ts`.
- Store mutation functions (`local-db/*.js`) mutate the passed-in object (e.g. `updateExercise` mutates the `exercise` argument) rather than returning a new one — callers rely on this to update `dbStore` in place without a separate replace step.
- Some UI copy is in Spanish (form labels, confirm dialogs, error messages like `'Ingresar nombre'`); match the existing language per string rather than switching wholesale.
- **Frontend unit tests only cover DOM-free modules.** `js/lib/dom.js` and `js/lib/logger.js` touch `document`/`window` at module top level, so importing anything that transitively pulls them in (most of `ui/*.js`, `local-db/*.js`) crashes under plain `node --test`. `frontend/test/` therefore only targets modules with no such dependency (`lib/date.js`, `lib/string.js` today) — same constraint fridge-track's own frontend test suite documents. UI-level behavior belongs in the Playwright e2e suite instead, where every test gets a fresh browser context (empty IndexedDB) for free.
- **Every e2e test needs a logged-in session first** (the app now gates behind login) — call `ensureAuth(page)` from `e2e/helpers.js` at the top of the test/`beforeEach` (it allow-lists a freshly-generated unique email against the e2e backend's own sqlite file, then signs up). `e2e/auth.spec.js` is the one place that deliberately does its own signup/login by hand instead, since it's testing that flow directly.
