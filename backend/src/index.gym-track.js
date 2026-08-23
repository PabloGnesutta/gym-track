import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { config as configEnv } from 'dotenv';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
configEnv({ path: join(__dirname, '../', '.env') });
import { handleRequest } from './http/requestHandler.js';
import { log } from './logger/logger.js';
import { db } from './db/db.js';


// Importing db.js runs pending migrations (backend/src/db/migrate.js)
// against backend/data/gymtrack.db, creating it on first run. Not yet used
// by any route - see CLAUDE.md's "Server-side database (scaffolding)".
log(' - Database ready:', db.isOpen);

createServer(
  handleRequest
).listen(
  process.env.PORT,
  async () => {
    log(' - Listening on port', process.env.PORT);
  }
);
