import assert from "node:assert/strict";
import { test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { loadSessionProfile } from "./session-profile";
import { PGlite } from "@electric-sql/pglite";

function fixture(results: unknown[]) {
  const calls: { fields: string; userId?: string }[] = [];
  const client = { from(table: string) {
    assert.equal(table, "profiles");
    return { select(fields: string) {
      const call: { fields: string; userId?: string } = { fields };
      calls.push(call);
      return { eq(column: string, value: string) {
        assert.equal(column, "user_id"); call.userId = value;
        return { maybeSingle: async () => results.shift() };
      } };
    } };
  } } as unknown as SupabaseClient<Database>;
  return { client, calls };
}

test("current schema preserves optional metadata without retry", async () => {
  const result = { data: { residence_city: "Juiz de Fora", avatar_path: "user/photo" }, error: null };
  const { client, calls } = fixture([result]);
  assert.equal(await loadSessionProfile(client, "verified-user"), result);
  assert.equal(calls.length, 1);
});

for (const column of ["residence_city", "avatar_path"]) {
  test(`legacy schema retries missing ${column} with same authenticated user`, async () => {
    const { client, calls } = fixture([
      { data: null, error: { code: "42703", message: `column profiles.${column} does not exist` } },
      { data: { full_name: "Owner", intended_use: "professional" }, error: null },
    ]);
    const result = await loadSessionProfile(client, "verified-user");
    assert.equal(result.error, null);
    assert.equal(result.data?.intended_use, "professional");
    assert.equal(result.data?.residence_city, null);
    assert.equal(result.data?.avatar_path, null);
    assert.deepEqual(calls.map(c => c.userId), ["verified-user", "verified-user"]);
    assert.equal(calls[1].fields, "full_name, email, phone, intended_use");
  });
}

for (const error of [
  { code: "42501", message: "permission denied" },
  { code: "42703", message: "column profiles.intended_use does not exist" },
  { code: "", message: "Failed to fetch residence_city" },
]) test(`unrelated failure remains visible: ${error.code || "network"}`, async () => {
  const result = { data: null, error };
  const { client, calls } = fixture([result]);
  assert.equal(await loadSessionProfile(client, "verified-user"), result);
  assert.equal(calls.length, 1);
});

test("fallback errors and missing profile are never converted to a profile", async () => {
  for (const fallback of [{ data: null, error: { code: "42501", message: "denied" } }, { data: null, error: null }]) {
    const { client } = fixture([
      { data: null, error: { code: "42703", message: "column profiles.avatar_path does not exist" } }, fallback,
    ]);
    assert.deepEqual(await loadSessionProfile(client, "verified-user"), fallback);
  }
});

test("PostgreSQL legacy schema reproduces 42703 and fallback isolates the requested user", async () => {
  const db = new PGlite();
  try {
    await db.exec("create table profiles(user_id text primary key, full_name text, email text, phone text, intended_use text); insert into profiles values ('owner', 'Owner', 'owner@test.invalid', null, 'professional'), ('other', 'Other', 'other@test.invalid', null, 'client')");
    const errors: string[] = [];
    const client = { from: () => ({ select: (fields: string) => ({ eq: (_: string, id: string) => ({ maybeSingle: async () => {
      try {
        const rows = await db.query(`select ${fields} from profiles where user_id = $1`, [id]);
        return { data: rows.rows[0] ?? null, error: null };
      } catch (error) {
        const sqlError = error as { code: string; message: string };
        errors.push(sqlError.code);
        return { data: null, error: sqlError };
      }
    } }) }) }) } as unknown as SupabaseClient<Database>;
    const result = await loadSessionProfile(client, "owner");
    assert.deepEqual(errors, ["42703"]);
    assert.equal(result.error, null);
    assert.equal(result.data?.full_name, "Owner");
    assert.equal(result.data?.intended_use, "professional");
    assert.equal(result.data?.residence_city, null);
    assert.equal((await loadSessionProfile(client, "absent")).data, null);
  } finally { await db.close(); }
});
