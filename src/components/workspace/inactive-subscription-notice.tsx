import Link from "next/link";
import { inactiveWorkspaceMessage } from "@/lib/workspace/settings-errors";

export function InactiveSubscriptionNotice() {
  return (
    <div className="rounded-3xl bg-secondary/70 px-4 py-6 text-sm leading-6">
      <p>{inactiveWorkspaceMessage}</p>
      <Link href="/app/configuracoes/assinatura" className="mt-3 inline-flex min-h-11 items-center underline">
        Conferir assinatura
      </Link>
    </div>
  );
}
