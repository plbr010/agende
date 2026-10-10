import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { createLocalDatabase } from "./local-database.mjs";

// No remote connections: compares the read-only catalog snapshot to in-memory SQL.
const remote = JSON.parse(readFileSync("docs/migrations/remote-final-2026-10-09.json", "utf8"));
const query = "select jsonb_build_object(\n 'checked_at',now(),\n 'tables',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity) order by n.nspname,c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','app') and c.relkind='r'),\n 'policies',(select jsonb_agg(to_jsonb(p) order by schemaname,tablename,policyname) from pg_policies p where schemaname in ('public','app','storage')),\n 'grants',(select jsonb_agg(to_jsonb(g) order by table_schema,table_name,grantee,privilege_type) from information_schema.role_table_grants g where table_schema in ('public','app') and grantee in ('anon','authenticated','service_role','PUBLIC')),\n 'functions',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'name',p.proname,'args',pg_get_function_identity_arguments(p.oid),'security_definer',p.prosecdef,'config',p.proconfig,'body',pg_get_functiondef(p.oid),'anon_execute',has_function_privilege('anon',p.oid,'EXECUTE'),'authenticated_execute',has_function_privilege('authenticated',p.oid,'EXECUTE'),'service_execute',has_function_privilege('service_role',p.oid,'EXECUTE')) order by n.nspname,p.proname,p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('app','public') and p.prokind='f'),\n 'triggers',(select jsonb_agg(jsonb_build_object('table',c.relname,'name',t.tgname,'definition',pg_get_triggerdef(t.oid)) order by c.relname,t.tgname) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where not t.tgisinternal and n.nspname in ('public','app')),\n 'columns',(select jsonb_agg(jsonb_build_object('table',table_name,'name',column_name,'type',udt_name,'nullable',is_nullable,'default',column_default) order by table_name,ordinal_position) from information_schema.columns where table_schema='public')\n,'constraints',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'name',k.conname,'definition',pg_get_constraintdef(k.oid)) order by n.nspname,c.relname,k.conname) from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','app') and k.contype <> 'n'),\n'indexes',(select jsonb_agg(jsonb_build_object('schema',schemaname,'table',tablename,'name',indexname,'definition',indexdef) order by schemaname,tablename,indexname) from pg_indexes where schemaname in ('public','app'))) as audit;";
const canonical = value => Array.isArray(value) ? value.map(canonical)
  : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]))
  : typeof value === "string" ? value.replace(/\r\n/g, "\n") : value;
const normalize = value => JSON.stringify(canonical(value));
function compare(left, right, key) {
  const a = new Map(left.map(item => [key(item), item]));
  const b = new Map(right.map(item => [key(item), item]));
  return {
    remoteOnly: [...a.keys()].filter(k => !b.has(k)),
    localOnly: [...b.keys()].filter(k => !a.has(k)),
    changed: [...a.keys()].filter(k => b.has(k) && normalize(a.get(k)) !== normalize(b.get(k))),
  };
}
const report = { snapshotAt: remote.checked_at, modes: {} };
const migrationFiles = readdirSync("supabase/migrations").filter(file => file.endsWith(".sql"));
report.history = remote.history.map(entry => {
  const file = migrationFiles.find(file => file.startsWith(entry.version + "_"));
  const localMd5 = file ? createHash("md5").update(readFileSync("supabase/migrations/" + file, "utf8").replace(/\r/g, "")).digest("hex") : null;
  const normalizedMd5 = file ? createHash("md5").update(readFileSync("supabase/migrations/" + file, "utf8").replace(/\r/g, "").replace(/^(?:\s*--[^\n]*\n)*\s*/, "").trim()).digest("hex") : null;
  return { version: entry.version, name: entry.name, statementCount: entry.statement_count,
    status: !file ? "remote-only-unrecoverable" : entry.history_placeholder ? "remote-history-placeholder" : entry.md5 === localMd5 ? "match" : entry.normalized_md5 === normalizedMd5 ? "leading-comments-or-line-endings" : "different", remoteMd5: entry.md5, localMd5 };
});
report.pending = migrationFiles.filter(file => !remote.history.some(entry => file.startsWith(entry.version + "_"))).sort();
for (const [mode, throughVersion] of [["baseline", "20260927005815"], ["target", "99999999999999"]]) {
  const db = await createLocalDatabase({ throughVersion });
  try {
    const local = (await db.query(query)).rows[0].audit;
    if (mode === "baseline") writeFileSync(join(tmpdir(), "agende-local-catalog.json"), JSON.stringify(local));
    report.modes[mode] = {
      tables: compare(remote.tables, local.tables, x => x.schema + "." + x.name),
      columns: compare(remote.columns, local.columns, x => x.table + "." + x.name),
      constraints: compare(remote.constraints, local.constraints, x => x.schema + "." + x.table + "." + x.name),
      indexes: compare(remote.indexes, local.indexes, x => x.schema + "." + x.table + "." + x.name),
      policies: compare(remote.policies, local.policies, x => x.schemaname + "." + x.tablename + "." + x.policyname),
      triggers: compare(remote.triggers, local.triggers, x => x.table + "." + x.name),
      functions: compare(remote.functions.map(({service_execute: _service, ...fn}) => { void _service; return fn; }), local.functions.map(({service_execute: _service, ...fn}) => { void _service; return fn; }), x => x.schema + "." + x.name + "(" + x.args + ")"),
      serviceFunctionGrants: compare(remote.functions.map(({schema,name,args,service_execute}) => ({schema,name,args,service_execute})), local.functions.map(({schema,name,args,service_execute}) => ({schema,name,args,service_execute})), x => x.schema + "." + x.name + "(" + x.args + ")"),
      grants: compare(remote.grants.map(({table_schema,table_name,grantee,privilege_type}) => ({table_schema,table_name,grantee,privilege_type})), local.grants.map(({table_schema,table_name,grantee,privilege_type}) => ({table_schema,table_name,grantee,privilege_type})), x => [x.table_schema,x.table_name,x.grantee,x.privilege_type].join(".")),
    };
  } finally { await db.close(); }
}
report.snapshotSha256 = createHash("sha256").update(readFileSync("docs/migrations/remote-final-2026-10-09.json")).digest("hex");
writeFileSync(process.argv[2] ?? "docs/migrations/drift-final-2026-10-10.json", JSON.stringify(report, null, 2) + "\n");
for (const [mode, groups] of Object.entries(report.modes)) {
  console.log(mode, Object.fromEntries(Object.entries(groups).map(([name, diff]) => [name,
    Object.fromEntries(Object.entries(diff).map(([kind, items]) => [kind, items.length > 12 ? { count: items.length, sample: items.slice(0, 3) } : items]))])));
}

