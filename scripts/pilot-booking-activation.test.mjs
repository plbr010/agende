import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import pg from 'pg';
import { createLocalDatabase } from './local-database.mjs';

const missing = '00000000-0000-4000-8000-000000000000';
const activateSql = readFileSync('docs/production-readiness/pilot-booking-activate.sql', 'utf8');
const deactivateSql = readFileSync('docs/production-readiness/pilot-booking-deactivate.sql', 'utf8');
const stopSql = readFileSync('docs/production-readiness/prelaunch20-stop-bookings.sql', 'utf8');
const resumeSql = readFileSync('docs/production-readiness/prelaunch20-resume-bookings.sql', 'utf8');

async function execSql(db, sql) {
  try {
    return await db.exec(sql);
  } catch (error) {
    await db.exec('rollback').catch(() => {});
    throw error;
  }
}

function as(db, uid, sql, args = [], role = uid ? 'authenticated' : 'anon') {
  return db.transaction(async (tx) => {
    await tx.query(
      "select set_config('request.jwt.claim.sub',$1,true), set_config('request.jwt.claim.role',$2,true)",
      [uid ?? '', role],
    );
    await tx.exec('set local role ' + role);
    return tx.query(sql, args);
  });
}

async function countWhere(db, table, column, id) {
  const row = (await db.query(`select count(*)::int n from ${table} where ${column} = $1`, [id])).rows[0];
  return row.n;
}

test('pilot booking stays closed except for one activated fictional salon', async (t) => {
  const db = await createLocalDatabase();
  t.after(() => db.close());
  await db.exec(readFileSync('supabase/tests/helpers.sql', 'utf8'));
  await db.query('select app.suspend_booking_creation()');

  const user = async (name, intent = 'professional', confirmed = true) =>
    (await db.query('select test_helpers.create_auth_user($1,$2,$3) id', [`${name}@pilot.invalid`, intent, confirmed])).rows[0].id;
  const ownerA = await user('owner-a');
  const ownerB = await user('owner-b');
  const clientA = await user('client-a', 'client');
  const clientB = await user('client-b', 'client');
  const unconfirmed = await user('unconfirmed', 'client', false);
  const wid = async (owner, name) =>
    (await as(db, owner, 'select public.create_workspace($1,null,$2) data', [name, 'equipe'])).rows[0].data.workspace_id;
  const salonA = await wid(ownerA, 'Salao Piloto Ficticio');
  const salonB = await wid(ownerB, 'Salao Bloqueado Ficticio');
  const member = async (workspace, owner) =>
    (await db.query('select id from public.workspace_members where workspace_id=$1 and user_id=$2', [workspace, owner])).rows[0].id;
  const memberA = await member(salonA, ownerA);
  const memberB = await member(salonB, ownerB);
  const slug = async (workspace) => (await db.query('select slug from public.workspaces where id=$1', [workspace])).rows[0].slug;
  const slugA = await slug(salonA);
  const slugB = await slug(salonB);
  const service = async (owner, workspace) =>
    (await as(db, owner, "insert into public.services(workspace_id,name,duration_minutes,price_cents) values($1,'Corte',60,8000) returning id", [workspace])).rows[0].id;
  const serviceA = await service(ownerA, salonA);
  const serviceB = await service(ownerB, salonB);
  for (const [owner, workspace, person, offered] of [
    [ownerA, salonA, memberA, serviceA],
    [ownerB, salonB, memberB, serviceB],
  ]) {
    await as(db, owner, 'insert into public.professional_services(workspace_id,professional_member_id,service_id) values($1,$2,$3)', [workspace, person, offered]);
    await as(db, owner, "insert into public.professional_working_hours(workspace_id,professional_member_id,weekday,start_time,end_time) select $1,$2,n,'08:00','18:00' from generate_series(0,6) n", [workspace, person]);
  }
  const at = async (hour) =>
    (await db.query("select (((clock_timestamp() at time zone 'America/Sao_Paulo')::date + 3) + $1::time) at time zone 'America/Sao_Paulo' s", [hour])).rows[0].s;
  const day = (await db.query("select ((clock_timestamp() at time zone 'America/Sao_Paulo')::date + 3)::text d")).rows[0].d;
  const start = await at('10:00');
  const second = await at('11:00');
  const third = await at('12:00');
  const fourth = await at('13:00');
  const moved = await at('16:00');
  const book = "select public.create_public_appointment($1,$2,$3,$4,'Maria','+5532999991111','spoofed@pilot.invalid') data";
  const internalClient = async (workspace, email) =>
    (await db.query("insert into public.workspace_clients(workspace_id,full_name,email,phone) values($1,'Cliente interno',$2,'+5532988881111') returning id", [workspace, email])).rows[0].id;
  const internalA = await internalClient(salonA, 'interno-a@pilot.invalid');
  const internalB = await internalClient(salonB, 'interno-b@pilot.invalid');
  const subscription = async (workspace) => (await db.query('select * from public.subscriptions where workspace_id=$1', [workspace])).rows[0];
  const claims = async (uid) => (await db.query('select count(*)::int n from public.professional_trial_claims where user_id=$1', [uid])).rows[0].n;

  await t.test('default posture blocks both fictional salons before any exception', async () => {
    assert.equal((await db.query('select globally_paused from app.booking_creation_controls')).rows[0].globally_paused, true);
    assert.equal((await db.query('select count(*)::int n from app.booking_workspace_exceptions')).rows[0].n, 0);
    const privileges = (await db.query(`
      select
        has_function_privilege('authenticated','public.create_public_appointment(text,uuid,uuid,timestamptz,text,text,text,text,text)','EXECUTE') client,
        has_function_privilege('authenticated','public.create_appointment(uuid,uuid,uuid,uuid,timestamptz,text)','EXECUTE') team,
        has_function_privilege('anon','public.create_public_appointment(text,uuid,uuid,timestamptz,text,text,text,text,text)','EXECUTE') anon,
        has_table_privilege('authenticated','public.appointments','INSERT') direct
    `)).rows[0];
    assert.deepEqual(privileges, { client: false, team: false, anon: false, direct: false });
    await assert.rejects(as(db, clientA, book, [slugA, serviceA, memberA, start]), /permission denied/);
    await assert.rejects(as(db, clientB, book, [slugB, serviceB, memberB, start]), /permission denied/);
    await assert.rejects(
      as(db, ownerA, 'select public.create_appointment($1,$2,$3,$4,$5,null)', [salonA, internalA, memberA, serviceA, second]),
      /permission denied/,
    );
    assert.equal(await countWhere(db, 'public.appointments', 'workspace_id', salonA), 0);
    assert.equal(await countWhere(db, 'public.appointments', 'workspace_id', salonB), 0);
  });

  await t.test('direct insert and the entitlement bypass cannot open a paused salon', async () => {
    try {
      await assert.rejects(
        db.transaction(async (tx) => {
          await tx.query("select set_config('app.bypass_entitlement','on',true)");
          return tx.query(
            `insert into public.appointments(workspace_id,client_id,professional_member_id,service_id,starts_at,ends_at,status,price_cents,duration_minutes)
             values($1,$2,$3,$4,$5::timestamptz,$5::timestamptz + interval '1 hour','scheduled',8000,60)`,
            [salonB, internalB, memberB, serviceB, start],
          );
        }),
        /booking_creation_paused/,
      );
    } finally {
      await db.exec('rollback').catch(() => {});
    }
    assert.equal(await countWhere(db, 'public.appointments', 'workspace_id', salonB), 0);
  });

  await t.test('authenticated callers cannot activate themselves, even if execute is granted by mistake', async () => {
    await assert.rejects(
      as(db, ownerA, "select app.activate_workspace_booking($1, now() + interval '7 days', null)", [salonA]),
      /permission denied/,
    );
    await db.query('grant execute on function app.activate_workspace_booking(uuid,timestamptz,text) to authenticated');
    try {
      await assert.rejects(
        as(db, ownerA, "select app.activate_workspace_booking($1, now() + interval '7 days', 'auto')", [salonA]),
        /booking_activation_denied/,
      );
    } finally {
      await db.query('revoke execute on function app.activate_workspace_booking(uuid,timestamptz,text) from authenticated');
    }
    assert.equal((await db.query('select count(*)::int n from app.booking_workspace_exceptions')).rows[0].n, 0);
    await assert.rejects(db.query('select app.activate_workspace_booking($1, now() + interval \'91 days\', null)', [salonA]), /pilot_expiry_too_far/);
    await assert.rejects(db.query('select app.activate_workspace_booking($1, now() - interval \'1 minute\', null)', [salonA]), /pilot_expiry_required/);
    await assert.rejects(db.query('select app.activate_workspace_booking($1, now() + interval \'7 days\', null)', [missing]), /workspace_not_found/);
    await assert.rejects(execSql(db, activateSql), /pilot_activation_not_confirmed/);
  });

  const beforeA = await subscription(salonA);
  const beforeB = await subscription(salonB);
  const claimsBefore = await claims(ownerA);
  await t.test('service role activates only the pilot UUID and does not touch trial or Stripe state', async () => {
    await as(
      db,
      null,
      "select app.activate_workspace_booking($1, now() + interval '30 days', 'piloto ficticio')",
      [salonA],
      'service_role',
    );
    assert.deepEqual(await subscription(salonA), beforeA);
    assert.deepEqual(await subscription(salonB), beforeB);
    assert.equal(await claims(ownerA), claimsBefore);
    const grant = (await db.query('select enabled, revoked_at is null open, expires_at > now() future from app.booking_workspace_exceptions where workspace_id=$1', [salonA])).rows[0];
    assert.deepEqual(grant, { enabled: true, open: true, future: true });
    assert.equal((await db.query('select count(*)::int n from app.booking_workspace_exceptions where workspace_id=$1', [salonB])).rows[0].n, 0);
    const comp = (await db.query('select revoked_at is null open, ends_at > now() future from app.complimentary_entitlements where workspace_id=$1', [salonA])).rows[0];
    assert.deepEqual(comp, { open: true, future: true });
    const privileges = (await db.query(`
      select
        has_function_privilege('authenticated','public.create_public_appointment(text,uuid,uuid,timestamptz,text,text,text,text,text)','EXECUTE') client,
        has_function_privilege('anon','public.create_public_appointment(text,uuid,uuid,timestamptz,text,text,text,text,text)','EXECUTE') anon
    `)).rows[0];
    assert.deepEqual(privileges, { client: true, anon: false });
  });

  let appointment;
  await t.test('public and internal booking succeed only for the activated salon', async () => {
    await assert.rejects(as(db, null, book, [slugA, serviceA, memberA, start]), /permission denied/);
    await assert.rejects(as(db, unconfirmed, book, [slugA, serviceA, memberA, start]), /email_not_confirmed/);
    const clientsBefore = await countWhere(db, 'public.workspace_clients', 'workspace_id', salonB);
    await assert.rejects(as(db, clientB, book, [slugB, serviceB, memberB, start]), /booking_creation_paused/);
    assert.equal(await countWhere(db, 'public.workspace_clients', 'workspace_id', salonB), clientsBefore);
    assert.equal(await countWhere(db, 'public.appointments', 'workspace_id', salonB), 0);
    const receipt = (await as(db, clientA, book, [slugA, serviceA, memberA, start])).rows[0].data;
    appointment = receipt.appointment_id;
    assert.equal(receipt.price_cents, 8000);
    assert.equal((await db.query('select created_by, workspace_id from public.appointments where id=$1', [appointment])).rows[0].workspace_id, salonA);
    const internal = (await as(db, ownerA, 'select public.create_appointment($1,$2,$3,$4,$5,null) id', [salonA, internalA, memberA, serviceA, second])).rows[0].id;
    assert.ok(internal);
    await assert.rejects(
      as(db, ownerB, 'select public.create_appointment($1,$2,$3,$4,$5,null)', [salonB, internalB, memberB, serviceB, second]),
      /booking_creation_paused/,
    );
    await assert.rejects(
      as(db, ownerB, 'select public.create_appointment($1,$2,$3,$4,$5,null)', [salonA, internalA, memberA, serviceA, third]),
      /not_workspace_member|not_authorized|appointment_write_denied/,
    );
    await assert.rejects(as(db, clientA, book, [slugA, serviceA, memberB, third]), /professional|not_found|slot/);
    assert.equal((await as(db, ownerB, 'select count(*)::int n from public.appointments where workspace_id=$1', [salonA])).rows[0].n, 0);
    await assert.rejects(as(db, clientB, 'select public.cancel_my_appointment($1)', [appointment]), /appointment_not_found|not_authorized/);
    assert.ok((await as(db, null, 'select * from public.list_public_available_slots($1,$2,$3,$4)', [slugA, serviceA, memberA, day])).rows.length > 0);
    await assert.rejects(
      as(db, null, 'select * from public.list_public_available_slots($1,$2,$3,$4)', [slugB, serviceB, memberB, day]),
      /booking_creation_paused/,
    );
    await assert.rejects(
      as(db, ownerB, 'select * from public.list_available_slots($1,$2,$3,$4)', [salonB, memberB, serviceB, day]),
      /booking_creation_paused/,
    );
  });

  await t.test('API roles still cannot insert directly; service role is stopped by the trigger when blocked', async () => {
    await db.query('grant insert on public.appointments to authenticated, service_role');
    try {
      await assert.rejects(
        as(
          db,
          ownerA,
          `insert into public.appointments(workspace_id,client_id,professional_member_id,service_id,starts_at,ends_at,status,price_cents,duration_minutes)
           values($1,$2,$3,$4,$5::timestamptz,$5::timestamptz + interval '1 hour','scheduled',8000,60)`,
          [salonA, internalA, memberA, serviceA, third],
        ),
        /row-level security/,
      );
      await assert.rejects(
        as(
          db,
          null,
          `insert into public.appointments(workspace_id,client_id,professional_member_id,service_id,starts_at,ends_at,status,price_cents,duration_minutes)
           values($1,$2,$3,$4,$5::timestamptz,$5::timestamptz + interval '1 hour','scheduled',8000,60)`,
          [salonB, internalB, memberB, serviceB, start],
          'service_role',
        ),
        /booking_creation_paused/,
      );
      const beforeDirect = await countWhere(db, 'public.appointments', 'workspace_id', salonA);
      await as(
        db,
        null,
        `insert into public.appointments(workspace_id,client_id,professional_member_id,service_id,starts_at,ends_at,status,price_cents,duration_minutes)
         values($1,$2,$3,$4,$5::timestamptz,$5::timestamptz + interval '1 hour','scheduled',8000,60)`,
        [salonA, internalA, memberA, serviceA, third],
        'service_role',
      );
      assert.equal(await countWhere(db, 'public.appointments', 'workspace_id', salonA), beforeDirect + 1);
    } finally {
      await db.query('revoke insert on public.appointments from authenticated, service_role');
    }
  });

  await t.test('expiry and deactivation block new bookings and keep the existing row', async () => {
    const kept = (await db.query('select id, status from public.appointments where id=$1', [appointment])).rows[0];
    await db.query("update app.booking_workspace_exceptions set created_at = now() - interval '2 days', expires_at = now() - interval '1 minute', updated_at = now() where workspace_id=$1", [salonA]);
    await assert.rejects(as(db, clientA, book, [slugA, serviceA, memberA, fourth]), /booking_creation_paused/);
    await assert.rejects(as(db, clientA, 'select public.reschedule_my_appointment($1,$2,$3)', [appointment, moved, memberA]), /booking_creation_paused/);
    await as(db, ownerA, "select public.set_appointment_status($1,'cancelled'::public.appointment_status)", [appointment]);
    const afterCancel = (await db.query('select id, status from public.appointments where id=$1', [appointment])).rows[0];
    assert.equal(afterCancel.id, kept.id);
    assert.equal(afterCancel.status, 'cancelled');

    await db.transaction(async (tx) => {
      await tx.query("select set_config('app.bypass_protected_columns','on',true)");
      await tx.query("update public.subscriptions set trial_started_at = now() - interval '2 days', trial_ends_at = now() - interval '1 day' where workspace_id=$1", [salonA]);
    });
    const expiredTrial = await subscription(salonA);
    await db.query("select set_config('agende.confirm_pilot_activation','yes',false)");
    await db.query('select set_config(\'agende.pilot_workspace_id\',$1,false)', [salonA]);
    await db.query("select set_config('agende.pilot_expires_at',(now() + interval '14 days')::text,false)");
    await db.query("select set_config('agende.pilot_note','renovacao ficticia',false)");
    await execSql(db, activateSql);
    assert.equal((await subscription(salonA)).trial_ends_at.getTime?.() ?? new Date((await subscription(salonA)).trial_ends_at).getTime(), new Date(expiredTrial.trial_ends_at).getTime());
    assert.equal((await subscription(salonA)).status, expiredTrial.status);
    assert.equal(await db.query('select app.workspace_has_entitlement($1) ok', [salonA]).then((r) => r.rows[0].ok), true);
    const revived = (await as(db, clientA, "select public.create_public_appointment($1,$2,$3,$4,'Maria','+5532999992222','spoofed@pilot.invalid') data", [slugA, serviceA, memberA, fourth])).rows[0].data.appointment_id;
    await db.query("update app.complimentary_entitlements set starts_at = now() - interval '2 days', ends_at = now() - interval '1 minute', revoked_at = now() where workspace_id=$1", [salonA]);
    await db.query("update app.booking_workspace_exceptions set created_at = now() - interval '2 days', expires_at = now() - interval '1 minute' where workspace_id=$1", [salonA]);
    await assert.rejects(as(db, clientA, book, [slugA, serviceA, memberA, await at('17:00')]), /workspace_unavailable|workspace_subscription_inactive|booking_creation_paused/);
    assert.equal((await db.query('select count(*)::int n from public.appointments where id=$1', [revived])).rows[0].n, 1);
    await assert.rejects(as(db, clientA, 'select public.reschedule_my_appointment($1,$2,$3)', [revived, await at('18:00'), memberA]), /workspace_subscription_inactive|booking_creation_paused|workspace_unavailable/);
    const beforeExpiredCancel = await countWhere(db, 'public.appointments', 'workspace_id', salonA);
    await as(db, ownerA, "select public.set_appointment_status($1,'cancelled'::public.appointment_status)", [revived]);
    assert.equal((await db.query('select status from public.appointments where id=$1', [revived])).rows[0].status, 'cancelled');
    assert.equal(await countWhere(db, 'public.appointments', 'workspace_id', salonA), beforeExpiredCancel);
    await assert.rejects(as(db, clientA, book, [slugA, serviceA, memberA, await at('17:00')]), /workspace_unavailable|workspace_subscription_inactive|booking_creation_paused/);
    await assert.rejects(db.query("update public.appointments set status='scheduled' where id=$1", [revived]), /workspace_subscription_inactive/);

    const beforeDeactivate = await subscription(salonA);
    await assert.rejects(execSql(db, deactivateSql), /pilot_deactivation_not_confirmed/);
    await db.query("select set_config('agende.confirm_pilot_deactivation','yes',false)");
    await db.query('select set_config(\'agende.pilot_workspace_id\',$1,false)', [salonA]);
    await execSql(db, deactivateSql);
    assert.deepEqual(await subscription(salonA), beforeDeactivate);
    assert.equal((await db.query('select enabled, revoked_at is not null closed from app.booking_workspace_exceptions where workspace_id=$1', [salonA])).rows[0].enabled, false);
    assert.equal(await countWhere(db, 'public.appointments', 'id', revived), 1);
    await assert.rejects(as(db, ownerA, 'select public.create_appointment($1,$2,$3,$4,$5,null)', [salonA, internalA, memberA, serviceA, await at('15:00')]), /workspace_subscription_inactive|booking_creation_paused|permission denied/);
  });

  await t.test('the old global resume still does not open the blocked salon', async () => {
    await as(db, null, "select app.activate_workspace_booking($1, now() + interval '10 days', 'retomada restrita')", [salonA], 'service_role');
    await db.transaction(async (tx) => {
      await tx.query("select set_config('app.bypass_protected_columns','on',true)");
      await tx.query('update public.subscriptions set trial_ends_at = now() + interval \'7 days\', status=\'trialing\' where workspace_id=$1', [salonA]);
    });
    await execSql(db, stopSql);
    await assert.rejects(as(db, clientA, book, [slugA, serviceA, memberA, await at('14:00')]), /permission denied/);
    await execSql(db, resumeSql);
    const reopened = (await as(db, clientA, "select public.create_public_appointment($1,$2,$3,$4,'Maria','+5532999993333','spoofed@pilot.invalid') data", [slugA, serviceA, memberA, await at('14:00')])).rows[0].data;
    assert.ok(reopened.appointment_id);
    await assert.rejects(as(db, clientB, book, [slugB, serviceB, memberB, await at('14:00')]), /booking_creation_paused/);
    assert.equal(await countWhere(db, 'public.appointments', 'workspace_id', salonB), 0);
    assert.deepEqual(await subscription(salonB), beforeB);
  });
});

function command(program, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(program, args, { env, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.once('error', reject);
    child.once('exit', (code) => (code === 0 ? resolve(output) : reject(new Error(`${program} failed (${code}): ${output.slice(-2000)}`))));
  });
}

async function freePort() {
  const socket = createServer();
  await new Promise((resolve, reject) => {
    socket.once('error', reject);
    socket.listen(0, '127.0.0.1', resolve);
  });
  const { port } = socket.address();
  await new Promise((resolve) => socket.close(resolve));
  return port;
}

const nativeBin = '/usr/lib/postgresql/16/bin';

test('two native sessions race on the pilot salon and stay isolated from the blocked salon', { skip: existsSync(join(nativeBin, 'pg_ctl')) ? false : 'PostgreSQL 16 is not installed; the private loopback race runs only where those binaries exist.' }, async (t) => {
  const bin = nativeBin;
  const port = await freePort();
  const dir = mkdtempSync(join(tmpdir(), 'agende-pilot-'));
  const data = join(dir, 'data');
  const env = { ...process.env, PGHOST: '127.0.0.1', PGUSER: 'postgres', PGPASSWORD: '', PGSSLMODE: 'disable' };
  let started = false;
  const stop = async () => {
    if (!started) return;
    await command(join(bin, 'pg_ctl'), ['-D', data, '-m', 'fast', '-w', 'stop'], env).catch(() => {});
  };
  t.after(async () => {
    await stop();
    rmSync(dir, { recursive: true, force: true });
  });

  await command(join(bin, 'initdb'), ['-D', data, '-U', 'postgres', '--auth-local=trust', '--auth-host=trust', '--encoding=UTF8', '--locale=C'], env);
  await command(join(bin, 'pg_ctl'), ['-D', data, '-l', join(dir, 'postgres.log'), '-o', `-h 127.0.0.1 -p ${port} -c listen_addresses=127.0.0.1 -c unix_socket_directories=${dir}`, '-w', 'start'], env);
  started = true;
  const admin = new pg.Client({ host: '127.0.0.1', port, user: 'postgres', database: 'postgres' });
  admin.on('error', () => {});
  await admin.connect();
  await admin.query('create role anon; create role authenticated; create role service_role bypassrls');
  await admin.end();
  const db = new pg.Client({ host: '127.0.0.1', port, user: 'postgres', database: 'postgres' });
  db.on('error', () => {});
  await db.connect();
  t.after(async () => {
    await db.end().catch(() => {});
  });
  const exec = async (sql) => db.query(sql);
  await exec(readFileSync('scripts/test-platform.sql', 'utf8'));
  const files = (await import('node:fs')).readdirSync('supabase/migrations').filter((file) => file.endsWith('.sql')).sort();
  for (const file of files) {
    const sql = readFileSync('supabase/migrations/' + file, 'utf8').replace(/create extension if not exists pg_cron with schema pg_catalog;/i, '-- pg_cron omitted in the local cluster');
    try {
      await exec(sql);
    } catch (error) {
      throw new Error(`Native migration failed: ${file}: ${error.message}`, { cause: error });
    }
  }
  const queryable = {
    query: (sql, args) => db.query(sql, args),
    exec,
    transaction: async (fn) => {
      await db.query('begin');
      try {
        const result = await fn({ query: (sql, args) => db.query(sql, args), exec: (sql) => db.query(sql) });
        await db.query('commit');
        return result;
      } catch (error) {
        await db.query('rollback');
        throw error;
      }
    },
  };
  await exec(readFileSync('supabase/tests/helpers.sql', 'utf8'));
  await queryable.query('select app.suspend_booking_creation()');
  const ownerA = (await queryable.query("select test_helpers.create_auth_user('race-owner@pilot.invalid','professional',true) id")).rows[0].id;
  const ownerB = (await queryable.query("select test_helpers.create_auth_user('race-blocked@pilot.invalid','professional',true) id")).rows[0].id;
  const clientA = (await queryable.query("select test_helpers.create_auth_user('race-a@pilot.invalid','client',true) id")).rows[0].id;
  const clientC = (await queryable.query("select test_helpers.create_auth_user('race-c@pilot.invalid','client',true) id")).rows[0].id;
  const clientD = (await queryable.query("select test_helpers.create_auth_user('race-d@pilot.invalid','client',true) id")).rows[0].id;
  const make = async (uid, name) => (await as(queryable, uid, 'select public.create_workspace($1,null,\'equipe\') data', [name])).rows[0].data.workspace_id;
  const salonA = await make(ownerA, 'Corrida Piloto');
  const salonB = await make(ownerB, 'Corrida Bloqueado');
  const meta = async (workspace, uid) => (await queryable.query('select m.id member, w.slug from public.workspace_members m join public.workspaces w on w.id=m.workspace_id where m.workspace_id=$1 and m.user_id=$2', [workspace, uid])).rows[0];
  const a = await meta(salonA, ownerA);
  const b = await meta(salonB, ownerB);
  const addService = async (uid, workspace, person) => {
    const service = (await as(queryable, uid, "insert into public.services(workspace_id,name,duration_minutes,price_cents) values($1,'Corte',60,8000) returning id", [workspace])).rows[0].id;
    await as(queryable, uid, 'insert into public.professional_services(workspace_id,professional_member_id,service_id) values($1,$2,$3)', [workspace, person, service]);
    await as(queryable, uid, "insert into public.professional_working_hours(workspace_id,professional_member_id,weekday,start_time,end_time) select $1,$2,n,'08:00','18:00' from generate_series(0,6) n", [workspace, person]);
    return service;
  };
  const serviceA = await addService(ownerA, salonA, a.member);
  const serviceB = await addService(ownerB, salonB, b.member);
  await queryable.query("select app.activate_workspace_booking($1, now() + interval '20 days', 'corrida')", [salonA]);
  const when = (await queryable.query("select (((clock_timestamp() at time zone 'America/Sao_Paulo')::date + 4) + time '10:00') at time zone 'America/Sao_Paulo' s, ((clock_timestamp() at time zone 'America/Sao_Paulo')::date + 4)::text d")).rows[0];

  const open = async (uid) => {
    const client = new pg.Client({ host: '127.0.0.1', port, user: 'postgres', database: 'postgres' });
    client.on('error', () => {});
    await client.connect();
    await client.query('begin');
    await client.query("select set_config('request.jwt.claim.sub',$1,true), set_config('request.jwt.claim.role','authenticated',true)", [uid]);
    await client.query('set local role authenticated');
    return client;
  };
  const left = await open(clientA);
  const right = await open(clientC);
  await left.query('select pg_advisory_xact_lock(hashtextextended($1,0))', [a.member]);
  const waiting = right.query(
    "select public.create_public_appointment($1,$2,$3,$4,'Cliente C','+5532999994444',$5) data",
    [a.slug, serviceA, a.member, when.s, 'race-c@pilot.invalid'],
  );
  const winner = await left.query(
    "select public.create_public_appointment($1,$2,$3,$4,'Cliente A','+5532999995555',$5) data",
    [a.slug, serviceA, a.member, when.s, 'race-a@pilot.invalid'],
  );
  await left.query('commit');
  await assert.rejects(waiting, /slot_taken|appointments_client_service_start_active_unique|23P01|exclusion/);
  await right.query('rollback');
  await left.end();
  await right.end();
  assert.equal((await queryable.query('select count(*)::int n from public.appointments where workspace_id=$1', [salonA])).rows[0].n, 1);
  assert.equal(winner.rows[0].data.appointment_id !== undefined, true);

  const blocked = await Promise.all([clientD, clientC].map(async (uid, index) => {
    const client = await open(uid);
    try {
      await client.query(
        'select public.create_public_appointment($1,$2,$3,$4,\'Cliente\',$5,$6) data',
        [b.slug, serviceB, b.member, when.s, index === 0 ? '+5532999996661' : '+5532999996662', `blocked-${index}@pilot.invalid`],
      );
      return 'allowed';
    } catch (error) {
      return error.message;
    } finally {
      await client.query('rollback');
      await client.end();
    }
  }));
  assert.ok(blocked.every((message) => /booking_creation_paused/.test(message)));
  assert.equal((await queryable.query('select count(*)::int n from public.appointments where workspace_id=$1', [salonB])).rows[0].n, 0);
  assert.equal((await as(queryable, ownerB, 'select count(*)::int n from public.appointments where workspace_id=$1', [salonA])).rows[0].n, 0);
});
