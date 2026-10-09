import { NextResponse } from "next/server";
import { loadAppSession } from "@/lib/auth/session";
import { canAccessWorkspaceRecord, isWorkspaceId } from "@/lib/workspace/access";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function forbidden() {
  return NextResponse.json({ error: "forbidden" }, { status: 403 });
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!isWorkspaceId(id)) {
    return forbidden();
  }

  const session = await loadAppSession();
  if (!session?.user.emailConfirmed) {
    return NextResponse.json({ error: "forbidden" }, { status: 401 });
  }
  if (!canAccessWorkspaceRecord(session.workspaces, id)) {
    return forbidden();
  }

  const workspace = session.workspaces.find((item) => item.id === id);
  if (!workspace) {
    return forbidden();
  }

  return NextResponse.json({
    workspace: { id: workspace.id, name: workspace.name, slug: workspace.slug },
  });
}
