import assert from "node:assert/strict";
import test from "node:test";
import { canAccessWorkspaceRecord, isWorkspaceId } from "./access";

const own = "0199a899-771d-7cb3-8d00-0a9d6c6fbf30";
const other = "0199a899-771d-7cb3-8d00-0a9d6c6fbf31";

test("workspace API ids must be canonical UUIDs", () => {
  assert.equal(isWorkspaceId(own), true);
  assert.equal(isWorkspaceId("00000000-0000-4000-8000-000000000000"), true);
  assert.equal(isWorkspaceId("workspace-1"), false);
  assert.equal(isWorkspaceId(`${own}' or 1=1`), false);
});

test("workspace lookup requires an active membership even if RLS is bypassed", () => {
  const memberships = [{ id: own }];
  assert.equal(canAccessWorkspaceRecord(memberships, own), true);
  assert.equal(canAccessWorkspaceRecord(memberships, other), false);
  assert.equal(canAccessWorkspaceRecord([], own), false);
  assert.equal(canAccessWorkspaceRecord(memberships, "not-a-uuid"), false);
});
