import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createLocalDatabase } from './local-database.mjs';

function as(db, uid, sql, args = [], role = uid ? 'authenticated' : 'anon') {
  return db.transaction(async (tx) => {
    await tx.query(
      "select set_config('request.jwt.claim.sub',$1,true), set_config('request.jwt.claim.role',$2,true), set_config('request.jwt.claims',$3,true)",
      [uid ?? '', role, JSON.stringify({ sub: uid, role, email_verified: true })],
    );
    await tx.exec('set local role ' + role);
    return tx.query(sql, args);
  });
}

test('expired trial and complimentary still allow cancellation and keep new bookings closed', async (t) => {
  const db = await createLocalDatabase();
  t.after(() => db.close());
  await db.exec("set time zone 'America/Sao_Paulo'");
  await db.exec(readFileSync('supabase/tests/helpers.sql', 'utf8'));
  await db.query('select app.suspend_booking_creation()');

  let sequence = 0;
  const user = async (intent = 'professional') =>
    (await db.query('select test_helpers.create_auth_user($1,$2,true) id', [`person${sequence++}@expired-cancel.invalid`, intent])).rows[0].id;
  const ownerA = await user();
  const adminA = await user();
  const receptionistA = await user();
  const pro1User = await user();
  const pro2User = await user();
  const clientA = await user('client');
  const ownerB = await user();
  const proBUser = await user();
  const clientB = await user('client');

  const workspaceOf = async (uid, name, plan) =>
    (await as(db, uid, 'select public.create_workspace($1,null,$2) data', [name, plan])).rows[0].data.workspace_id;
  const salonA = await workspaceOf(ownerA, 'Salao A Ficticio', 'salao');
  const salonB = await workspaceOf(ownerB, 'Salao B Ficticio', 'equipe');
  const memberId = async (workspace, uid) =>
    (await db.query('select id from public.workspace_members where workspace_id=$1 and user_id=$2', [workspace, uid])).rows[0].id;
  const ownerMemberA = await memberId(salonA, ownerA);

  await db.query(
    `insert into public.workspace_members(workspace_id,user_id,role,status)
     values ($1,$2,'admin','active'),($1,$3,'receptionist','active'),($1,$4,'professional','active'),($1,$5,'professional','active')`,
    [salonA, adminA, receptionistA, pro1User, pro2User],
  );
  await db.query(
    "insert into public.workspace_members(workspace_id,user_id,role,status) values ($1,$2,'professional','active')",
    [salonB, proBUser],
  );
  const adminMember = await memberId(salonA, adminA);
  const receptionistMember = await memberId(salonA, receptionistA);
  const pro1 = await memberId(salonA, pro1User);
  const pro2 = await memberId(salonA, pro2User);
  const ownerMemberB = await memberId(salonB, ownerB);

  const slugA = (await db.query('select slug from public.workspaces where id=$1', [salonA])).rows[0].slug;
  const service = async (uid, workspace, name) =>
    (await as(db, uid, 'insert into public.services(workspace_id,name,duration_minutes,price_cents) values($1,$2,60,8000) returning id', [workspace, name])).rows[0].id;
  const serviceA = await service(ownerA, salonA, 'Corte');
  const serviceB = await service(ownerB, salonB, 'Corte');
  for (const member of [ownerMemberA, adminMember, pro1, pro2]) {
    await as(db, ownerA, 'insert into public.professional_services(workspace_id,professional_member_id,service_id) values($1,$2,$3)', [salonA, member, serviceA]);
    await as(
      db,
      ownerA,
      "insert into public.professional_working_hours(workspace_id,professional_member_id,weekday,start_time,end_time) select $1,$2,n,'08:00','18:00' from generate_series(0,6) n",
      [salonA, member],
    );
  }
  await as(db, ownerB, 'insert into public.professional_services(workspace_id,professional_member_id,service_id) values($1,$2,$3)', [salonB, ownerMemberB, serviceB]);
  await as(
    db,
    ownerB,
    "insert into public.professional_working_hours(workspace_id,professional_member_id,weekday,start_time,end_time) select $1,$2,n,'08:00','18:00' from generate_series(0,6) n",
    [salonB, ownerMemberB],
  );

  const at = async (hour) =>
    (await db.query("select (((clock_timestamp() at time zone 'America/Sao_Paulo')::date + 3) + $1::time) at time zone 'America/Sao_Paulo' s", [hour])).rows[0].s;
  const clientRow = async (workspace, email, phone) =>
    (await db.query(
      'insert into public.workspace_clients(workspace_id,full_name,email,phone) values($1,$2,$3,$4) returning id',
      [workspace, 'Cliente interno', email, phone],
    )).rows[0].id;
  const internalA = await clientRow(salonA, 'interno-a@expired-cancel.invalid', '+5532991110001');
  const internalB = await clientRow(salonB, 'interno-b@expired-cancel.invalid', '+5532991110002');

  await db.query("select app.activate_workspace_booking($1, now() + interval '14 days', 'piloto ficticio')", [salonA]);
  assert.equal((await db.query('select globally_paused from app.booking_creation_controls')).rows[0].globally_paused, true);
  assert.equal(await db.query('select app.workspace_booking_exception_active($1) ok', [salonB]).then((r) => r.rows[0].ok), false);

  const bookInternal = async (owner, workspace, client, member, serviceId, hour) =>
    (await as(db, owner, 'select public.create_appointment($1,$2,$3,$4,$5,null) id', [workspace, client, member, serviceId, await at(hour)])).rows[0].id;
  const receptionistCancelId = await bookInternal(ownerA, salonA, internalA, pro1, serviceA, '10:00');
  const ownerCancelId = await bookInternal(ownerA, salonA, internalA, pro2, serviceA, '10:30');
  const proOwnId = await bookInternal(ownerA, salonA, internalA, pro1, serviceA, '11:00');
  const proOtherId = await bookInternal(ownerA, salonA, internalA, pro2, serviceA, '11:30');
  const completedId = await bookInternal(ownerA, salonA, internalA, pro1, serviceA, '12:00');
  const keptId = await bookInternal(ownerA, salonA, internalA, pro2, serviceA, '13:00');
  await as(db, ownerA, "select public.set_appointment_status($1,'in_progress'::public.appointment_status)", [completedId]);
  await as(db, ownerA, "select public.set_appointment_status($1,'completed'::public.appointment_status)", [completedId]);

  const clientEmail = (await db.query('select email from auth.users where id=$1', [clientA])).rows[0].email;
  const publicId = (await as(
    db,
    clientA,
    "select public.create_public_appointment($1,$2,$3,$4,'Maria','+5532991110003',$5) data",
    [slugA, serviceA, pro1, await at('14:00'), clientEmail],
  )).rows[0].data.appointment_id;
  await assert.rejects(
    as(db, ownerB, 'select public.create_appointment($1,$2,$3,$4,$5,null)', [salonB, internalB, ownerMemberB, serviceB, await at('10:00')]),
    /booking_creation_paused/,
  );

  await db.transaction(async (tx) => {
    await tx.query("select set_config('app.bypass_protected_columns','on',true)");
    await tx.query("update public.subscriptions set trial_started_at = now() - interval '2 days', trial_ends_at = now() - interval '1 day' where workspace_id=$1", [salonA]);
  });
  await db.query(
    "update app.complimentary_entitlements set starts_at = now() - interval '2 days', ends_at = now() - interval '1 minute', revoked_at = now() where workspace_id=$1",
    [salonA],
  );
  await db.query(
    "update app.booking_workspace_exceptions set created_at = now() - interval '2 days', expires_at = now() - interval '1 minute', updated_at = now() where workspace_id=$1",
    [salonA],
  );
  assert.equal(await db.query('select app.workspace_has_entitlement($1) ok', [salonA]).then((r) => r.rows[0].ok), false);
  const subscriptionBefore = await db.query('select status, trial_ends_at, plan from public.subscriptions where workspace_id=$1', [salonA]);
  const appointmentsBefore = await db.query('select count(*)::int n from public.appointments').then((r) => r.rows[0].n);

  await t.test('new bookings, slots, reschedule, completion and no-show stay closed', async () => {
    await assert.rejects(
      as(db, clientA, "select public.create_public_appointment($1,$2,$3,$4,'Maria','+5532991110004',$5)", [slugA, serviceA, pro1, await at('15:00'), clientEmail]),
      /workspace_unavailable|workspace_subscription_inactive|booking_creation_paused/,
    );
    await assert.rejects(
      as(db, ownerA, 'select public.create_appointment($1,$2,$3,$4,$5,null)', [salonA, internalA, pro1, serviceA, await at('15:00')]),
      /workspace_subscription_inactive|booking_creation_paused/,
    );
    await assert.rejects(
      as(db, ownerB, 'select public.create_appointment($1,$2,$3,$4,$5,null)', [salonA, internalA, pro1, serviceA, await at('15:30')]),
      /not_workspace_member/,
    );
    await assert.rejects(
      as(db, ownerB, 'select public.create_appointment($1,$2,$3,$4,$5,null)', [salonB, internalB, ownerMemberB, serviceB, await at('11:00')]),
      /booking_creation_paused|workspace_subscription_inactive/,
    );
    const day = (await db.query("select ((clock_timestamp() at time zone 'America/Sao_Paulo')::date + 3)::text d")).rows[0].d;
    await assert.rejects(
      as(db, null, 'select * from public.list_public_available_slots($1,$2,$3,$4::date)', [slugA, serviceA, pro1, day]),
      /workspace_unavailable|workspace_subscription_inactive|booking_creation_paused/,
    );
    await assert.rejects(
      as(db, clientA, 'select public.reschedule_my_appointment($1,$2,$3)', [publicId, await at('16:00'), pro1]),
      /workspace_subscription_inactive|booking_creation_paused/,
    );
    await assert.rejects(
      as(db, ownerA, 'select public.reschedule_appointment($1,$2,$3,$4,null)', [keptId, pro2, serviceA, await at('16:00')]),
      /workspace_subscription_inactive|booking_creation_paused/,
    );
    await assert.rejects(
      as(db, ownerA, "select public.set_appointment_status($1,'no_show'::public.appointment_status)", [keptId]),
      /workspace_subscription_inactive/,
    );
    await assert.rejects(
      as(db, ownerA, "select public.set_appointment_status($1,'completed'::public.appointment_status)", [keptId]),
      /workspace_subscription_inactive/,
    );
    await assert.rejects(
      as(db, ownerA, "select public.set_appointment_status($1,'cancelled'::public.appointment_status)", [completedId]),
      /appointment_terminal/,
    );
    assert.equal((await db.query('select status from public.appointments where id=$1', [completedId])).rows[0].status, 'completed');
    assert.equal((await db.query('select status from public.appointments where id=$1', [keptId])).rows[0].status, 'scheduled');
  });

  await t.test('staff, the client and a denied permission follow the existing cancel rules', async () => {
    await as(db, receptionistA, "select public.set_appointment_status($1,'cancelled'::public.appointment_status)", [receptionistCancelId]);
    await as(db, ownerA, "select public.set_appointment_status($1,'cancelled'::public.appointment_status)", [ownerCancelId]);
    await as(db, ownerA, "select public.set_appointment_status($1,'cancelled'::public.appointment_status)", [ownerCancelId]);
    await as(db, pro1User, "select public.set_appointment_status($1,'cancelled'::public.appointment_status)", [proOwnId]);
    await assert.rejects(
      as(db, pro1User, "select public.set_appointment_status($1,'cancelled'::public.appointment_status)", [proOtherId]),
      /appointment_write_denied|not_authorized/,
    );
    await as(db, adminA, "select public.set_appointment_status($1,'cancelled'::public.appointment_status)", [proOtherId]);
    await as(db, clientA, 'select public.cancel_my_appointment($1)', [publicId]);
    await assert.rejects(as(db, clientB, 'select public.cancel_my_appointment($1)', [keptId]), /appointment_not_found|not_authorized/);
    await assert.rejects(
      as(db, ownerB, "select public.set_appointment_status($1,'cancelled'::public.appointment_status)", [keptId]),
      /not_authorized|not_workspace_member/,
    );
    await db.query(
      "insert into public.workspace_member_permissions(member_id,workspace_id,permission_key,effect) values ($1,$2,'appointments.cancel','deny')",
      [receptionistMember, salonA],
    );
    await assert.rejects(
      as(db, receptionistA, "select public.set_appointment_status($1,'cancelled'::public.appointment_status)", [keptId]),
      /not_authorized/,
    );
    assert.equal((await db.query('select status from public.appointments where id=$1', [keptId])).rows[0].status, 'scheduled');
    await as(db, ownerA, "select public.set_appointment_status($1,'cancelled'::public.appointment_status)", [keptId]);
  });

  await t.test('direct writes, bypass and reopening the row still fail', async () => {
    const target = ownerCancelId;
    await assert.rejects(
      as(db, ownerA, "update public.appointments set status='cancelled' where id=$1", [target]),
      /permission denied/,
    );
    await assert.rejects(
      db.query("update public.appointments set status='cancelled', starts_at = starts_at + interval '1 hour', ends_at = ends_at + interval '1 hour' where id=$1", [keptId]),
      /workspace_subscription_inactive|booking_creation_paused/,
    );
    await assert.rejects(
      db.query("update public.appointments set status='cancelled', notes='alterado na expiracao' where id=$1", [receptionistCancelId]),
      /workspace_subscription_inactive/,
    );
    const blockedStart = await at('17:00');
    await assert.rejects(
      db.transaction(async (tx) => {
        await tx.query("select set_config('app.bypass_entitlement','on',true)");
        await tx.query(
          `insert into public.appointments(workspace_id,client_id,professional_member_id,service_id,starts_at,ends_at,status,price_cents,duration_minutes)
           values($1,$2,$3,$4,$5::timestamptz,$5::timestamptz + interval '1 hour','scheduled',8000,60)`,
          [salonA, internalA, pro2, serviceA, blockedStart],
        );
      }),
      /workspace_subscription_inactive|booking_creation_paused/,
    );
    await assert.rejects(
      db.query("update public.appointments set status='scheduled' where id=$1", [target]),
      /workspace_subscription_inactive/,
    );
    await assert.rejects(
      as(db, ownerA, "insert into public.services(workspace_id,name,duration_minutes,price_cents) values($1,'Extra',30,1000)", [salonA]),
      /workspace_subscription_inactive/,
    );
  });

  const statuses = await db.query('select id, status from public.appointments where workspace_id=$1 order by starts_at', [salonA]);
  const byId = Object.fromEntries(statuses.rows.map((row) => [row.id, row.status]));
  assert.equal(byId[receptionistCancelId], 'cancelled');
  assert.equal(byId[ownerCancelId], 'cancelled');
  assert.equal(byId[proOwnId], 'cancelled');
  assert.equal(byId[proOtherId], 'cancelled');
  assert.equal(byId[publicId], 'cancelled');
  assert.equal(byId[keptId], 'cancelled');
  assert.equal(byId[completedId], 'completed');
  assert.equal(await db.query('select count(*)::int n from public.appointments').then((r) => r.rows[0].n), appointmentsBefore);
  assert.equal(await db.query('select count(*)::int n from public.appointments where workspace_id=$1', [salonB]).then((r) => r.rows[0].n), 0);
  const subscriptionAfter = await db.query('select status, trial_ends_at, plan from public.subscriptions where workspace_id=$1', [salonA]);
  assert.equal(subscriptionAfter.rows[0].status, subscriptionBefore.rows[0].status);
  assert.equal(new Date(subscriptionAfter.rows[0].trial_ends_at).getTime(), new Date(subscriptionBefore.rows[0].trial_ends_at).getTime());
  assert.equal(subscriptionAfter.rows[0].plan, subscriptionBefore.rows[0].plan);
  assert.equal((await db.query('select globally_paused from app.booking_creation_controls')).rows[0].globally_paused, true);
  assert.equal(await db.query('select app.workspace_booking_exception_active($1) ok', [salonA]).then((r) => r.rows[0].ok), false);
  assert.equal(await db.query('select revoked_at is not null closed from app.complimentary_entitlements where workspace_id=$1', [salonA]).then((r) => r.rows[0].closed), true);
});
