import { PGlite } from '@electric-sql/pglite';
import { unaccent } from '@electric-sql/pglite/contrib/unaccent';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { readdirSync, readFileSync } from 'node:fs';

// Default: in-memory PostgreSQL. Explicit native mode verifies an owned loopback cluster.
// Auth/storage objects emulate the Supabase platform, not application business rules.
// pg_cron registration is recorded locally; the scheduler itself is not run.
export async function createLocalDatabase({ throughVersion = '99999999999999' } = {}) {
  if (process.env.AGENDE_NATIVE_PG_PORT) {
    const { createNativeTestDatabase } = await import('./native-test-database.mjs');
    return createNativeTestDatabase({ throughVersion });
  }
  const db = new PGlite({ extensions: { unaccent, pgcrypto, btree_gist } });
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  await db.exec(readFileSync('scripts/test-platform.sql', 'utf8'));
  for (const file of readdirSync('supabase/migrations').filter(f => f.endsWith('.sql') && f.slice(0,14) <= throughVersion).sort()) {
    let sql = readFileSync('supabase/migrations/' + file,'utf8');
    sql = sql.replace(/create extension if not exists pg_cron with schema pg_catalog;/i,'-- pg_cron scheduling is represented by local platform fixtures.');
    try { await db.exec(sql); } catch (error) { await db.close(); throw new Error('Migration failed: ' + file + ': ' + error.message, {cause:error}); }
  }
  return db;
}
if (process.argv[1]?.endsWith('local-database.mjs')) {
  const db = await createLocalDatabase();
  console.log('All repository migrations applied to ' + (db.native ? 'owned native PostgreSQL 17.' : 'in-memory PostgreSQL.'));
  await db.close();
}
