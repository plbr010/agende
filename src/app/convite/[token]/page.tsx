import { createClient } from "@/lib/supabase/server";
import { loadAppSession } from "@/lib/auth/session";
import { InviteAcceptance } from "@/components/workspace/invite-acceptance";
import { parseInvitePeek } from "@/lib/workspace/public";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();
  const [{ data }, session] = await Promise.all([
    supabase.rpc("peek_workspace_invite", { p_token: token }),
    loadAppSession(),
  ]);

  return (
    <InviteAcceptance
      token={token}
      peek={parseInvitePeek(data)}
      signedIn={Boolean(session)}
      email={session?.user.email ?? null}
      emailConfirmed={Boolean(session?.context.emailConfirmed)}
    />
  );
}
