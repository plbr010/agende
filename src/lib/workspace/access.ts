const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isWorkspaceId(value: string): boolean {
  return UUID_RE.test(value);
}

export function canAccessWorkspaceRecord(
  memberships: ReadonlyArray<{ id: string }>,
  workspaceId: string,
): boolean {
  return isWorkspaceId(workspaceId) && memberships.some((item) => item.id === workspaceId);
}
