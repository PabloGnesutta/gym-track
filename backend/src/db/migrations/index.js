import { sql as initialSchema } from './001_initial_schema.js';
import { sql as accounts } from './002_accounts.js';

/**
 * Ordered, explicit registry (no directory-scanning) - add new migrations
 * by creating NNN_description.js (exporting `sql`) and appending it here
 * with the next version number. Never edit an already-applied migration's
 * SQL after it's shipped - add a new one instead, the same rule as any
 * other migration tool.
 * @type {{version: number, name: string, sql: string, disableForeignKeys?: boolean}[]}
 */
const migrations = [
  { version: 1, name: 'initial_schema', sql: initialSchema },
  { version: 2, name: 'accounts', sql: accounts },
];

export { migrations };
