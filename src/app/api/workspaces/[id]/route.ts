import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email_confirmed_at) {
    return NextResponse.json({ error: "forbidden" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("workspaces")
    .select("id, name, slug")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!data) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  return NextResponse.json({ workspace: data });
}
