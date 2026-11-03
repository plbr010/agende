import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createLocalDatabase } from "./local-database.mjs";

test("master admin authorization, reads, holds and audit stay off the public API", async (t) => {
  const db = await createLocalDatabase();
  t.after(() => db.close());
  await db.exec(readFileSync("supabase/tests/helpers.sql", "utf8"));

  let sequence = 0;
  const user = async (intent = "professional", confirmed = true) =>
    (await db.query("select test_helpers.create_auth_user($1,$2,$3) as id", [
      `admin${sequence++}@agende-admin.test`,
      intent,
      confirmed,
    ])).rows[0].id;

  const as = (uid, sql, params = []) =>
    db.transaction(async (tx) => {
      await tx.query(
        "select set_config('request.jwt.claim.sub',$1,true), set_config('request.jwt.claim.role','authenticated',true)",
        [uid],
      );
      await tx.exec("set local role authenticated");
      return tx.query(sql, params);
    });

  const asService = (sql, params = []) =>
    db.transaction(async (tx) => {
      await tx.query("select set_config('request.jwt.claim.role','service_role',true)");
      await tx.exec("set local role service_role");
      return tx.query(sql, params);
    });

  const owner = (
    await db.query("select test_helpers.create_auth_user($1,$2,$3) as id", [
      "plbrpc@gmail.com",
      "professional",
      true,
    ])
  ).rows[0].id;
  const outsider = await user("client");
  const workspace = (
    await as(owner, "select public.create_workspace($1,null,$2) as result", ["Estúdio Master", "equipe"])
  ).rows[0].result;
  const wid = workspace.workspace_id;

  await t.test("anon and regular users cannot read or write admin tables", async () => {
    await assert.rejects(
      db.transaction(async (tx) => {
        await tx.exec("set local role anon");
        await tx.query("select * from app.platform_admins");
      }),
      /permission denied/,
    );
    await assert.rejects(
      as(outsider, "insert into app.platform_admins(user_id) values ($1)", [outsider]),
      /permission denied|not_platform_admin/,
    );
    await assert.rejects(as(outsider, "select public.admin_dashboard_overview()"), /not_platform_admin/);
    await assert.rejects(
      as(owner, "select public.grant_platform_admin($1)", [owner]),
      /permission denied|not_official_platform_admin/,
    );
    await assert.rejects(as(outsider, "select public.claim_official_platform_admin()"), /not_official_platform_admin/);
    assert.equal((await as(outsider, "select public.is_official_platform_owner() as ok")).rows[0].ok, false);
    assert.equal((await as(owner, "select public.is_official_platform_owner() as ok")).rows[0].ok, true);
    assert.equal((await as(outsider, "select public.is_platform_admin() as ok")).rows[0].ok, false);
  });

  await t.test("editing a profile never creates a platform admin", async () => {
    await as(owner, "update public.profiles set full_name = 'Dono Alterado' where user_id = $1", [owner]);
    assert.equal((await as(owner, "select public.is_platform_admin() as ok")).rows[0].ok, false);
    assert.equal(
      (await db.query("select count(*)::int as n from app.platform_admins")).rows[0].n,
      0,
    );
  });

  await t.test("only the official Auth identity can become master and then operate", async () => {
    await assert.rejects(asService("select public.grant_platform_admin($1)", [outsider]), /not_official_platform_admin/);
    await as(owner, "select public.claim_official_platform_admin()");
    assert.equal((await as(owner, "select public.is_platform_admin() as ok")).rows[0].ok, true);
    assert.equal(
      (await db.query("select user_id from app.platform_admins where revoked_at is null")).rows[0].user_id,
      owner,
    );

    const overview = (await as(owner, "select public.admin_dashboard_overview() as data")).rows[0].data;
    assert.equal(overview.metrics.workspaces, 1);
    assert.ok(overview.metrics.professionals >= 1);
    assert.equal(overview.metrics.subscriptions_trialing, 1);
    assert.equal(overview.metrics.mrr_cents, 0);
    assert.equal(Array.isArray(overview.growth), true);
    assert.equal(overview.growth.length, 30);
    assert.deepEqual(
      overview.metrics.plans.map((plan) => plan.code).sort(),
      ["equipe", "salao", "solo"],
    );

    const professionals = (await as(owner, "select public.admin_list_professionals(null,null,null,20,0) as data")).rows[0]
      .data;
    assert.ok(professionals.total >= 1);
    assert.equal(professionals.items.some((row) => row.user_id === owner), true);

    const filtered = (
      await as(owner, "select public.admin_list_professionals($1,'equipe','trialing',20,0) as data", ["estudio"])
    ).rows[0].data;
    assert.equal(filtered.total, 1);

    await assert.rejects(as(outsider, "select public.admin_list_professionals()"), /not_platform_admin/);
  });

  await t.test("spoofed email in the JWT cannot promote another account", async () => {
    const colleague = await user();
    await assert.rejects(
      db.transaction(async (tx) => {
        await tx.query(
          "select set_config('request.jwt.claim.sub',$1,true), set_config('request.jwt.claim.role','authenticated',true), set_config('request.jwt.claim.email','plbrpc@gmail.com',true)",
          [colleague],
        );
        await tx.exec("set local role authenticated");
        return tx.query("select public.claim_official_platform_admin()");
      }),
      /not_official_platform_admin/,
    );
    assert.equal((await as(colleague, "select public.is_platform_admin() as ok")).rows[0].ok, false);
    await assert.rejects(as(owner, "select public.grant_platform_admin($1)", [colleague]), /permission denied|not_official_platform_admin/);
    await assert.rejects(
      db.query("insert into app.platform_admins(user_id) values ($1)", [colleague]),
      /not_official_platform_admin/,
    );
  });

  await t.test("suspend and reactivate write audit and block self-hold", async () => {
    await assert.rejects(
      as(owner, "select public.admin_set_account_hold('user',$1,'bloqueio',true)", [owner]),
      /cannot_hold_self/,
    );

    const target = await user();
    const held = (
      await as(owner, "select public.admin_set_account_hold('user',$1,'Uso indevido da plataforma',true) as data", [
        target,
      ])
    ).rows[0].data;
    assert.equal(held.subject_id, target);
    assert.equal(
      (await as(target, "select (public.my_platform_hold()->>'held')::boolean as held")).rows[0].held,
      true,
    );

    const users = (await as(owner, "select public.admin_list_users(null,null,'held',20,0) as data")).rows[0].data;
    assert.equal(users.items.some((row) => row.user_id === target), true);

    await as(owner, "select public.admin_set_account_hold('user',$1,'liberado',false)", [target]);
    assert.equal(
      (await as(target, "select (public.my_platform_hold()->>'held')::boolean as held")).rows[0].held,
      false,
    );

    const audit = (await as(owner, "select public.admin_list_audit_events(null,20,0) as data")).rows[0].data;
    assert.ok(audit.items.some((row) => row.action === "account.suspend"));
    assert.ok(audit.items.some((row) => row.action === "account.reactivate"));
    assert.ok(audit.items.every((row) => !JSON.stringify(row).includes("encrypted_password")));
  });

  await t.test("workspace hold stops new appointments without deleting rows", async () => {
    const before = (await db.query("select count(*)::int as n from public.appointments where workspace_id=$1", [wid]))
      .rows[0].n;
    await as(owner, "select public.admin_set_account_hold('workspace',$1,'Salão em análise',true)", [wid]);
    await assert.rejects(
      as(owner, "select public.create_appointment($1,null,null,null,now(),null)", [wid]),
      /workspace_suspended|not_authorized|invalid/,
    );
    assert.equal(
      (await db.query("select count(*)::int as n from public.appointments where workspace_id=$1", [wid])).rows[0].n,
      before,
    );
    await as(owner, "select public.admin_set_account_hold('workspace',$1,'ok',false)", [wid]);
  });

  await t.test("dashboard, clients, subscriptions and support read live rows", async () => {
    const client = await user("client");
    const overview = (await as(owner, "select public.admin_dashboard_overview() as data")).rows[0].data;
    assert.ok(overview.metrics.clients >= 1);
    assert.ok(overview.metrics.users >= 3);

    const clients = (await as(owner, "select public.admin_list_clients(null,null,20,0) as data")).rows[0].data;
    assert.equal(clients.items.some((row) => row.user_id === client), true);

    const subs = (await as(owner, "select public.admin_list_subscriptions(null,null,'trialing',20,0) as data")).rows[0]
      .data;
    assert.equal(subs.total, 1);
    assert.equal(subs.items[0].plan, "equipe");

    const support = (await as(owner, "select public.admin_support_overview() as data")).rows[0].data;
    assert.equal(support.application_error_log, false);
    assert.equal(Array.isArray(support.unconfirmed_signups), true);
  });
});
