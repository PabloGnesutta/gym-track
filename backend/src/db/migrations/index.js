import { sql as initialSchema } from './001_initial_schema.js';
import { sql as accounts } from './002_accounts.js';
import { migrate as muscles } from './003_muscles.js';

/**
 * Ordered, explicit registry (no directory-scanning) - add new migrations
 * by creating NNN_description.js (exporting `sql` and/or `migrate`) and
 * appending it here with the next version number. Never edit an
 * already-applied migration's SQL/logic after it's shipped - add a new one
 * instead, the same rule as any other migration tool.
 * @type {{version: number, name: string, sql?: string, migrate?: (db: import('node:sqlite').DatabaseSync) => void, disableForeignKeys?: boolean}[]}
 */
const migrations = [
  { version: 1, name: 'initial_schema', sql: initialSchema },
  { version: 2, name: 'accounts', sql: accounts },
  { version: 3, name: 'muscles', migrate: muscles },
];

export { migrations };
