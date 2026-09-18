import Link from "next/link";
import { notFound } from "next/navigation";
import { requireConfirmedSession } from "@/lib/auth/session";
import { AvailabilityEditor } from "@/components/agenda/availability-editor";
import { loadTeam } from "@/lib/catalog/queries";
import {
  canManageJornada,
  canManageTimeBlocks,
  loadBreaks,
  loadCurrentMemberId,
  loadTimeBlocks,
  loadWorkingHours,
} from "@/lib/agenda/queries";
import { Button } from "@/components/ui/button";

export default async function AvailabilityPage({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  const session = await requireConfirmedSession("/app/equipe");
  const workspace = session.workspaces[0];
  if (!workspace) {
    return null;
  }

  const { memberId } = await params;
  const [team, currentMemberId, hours, breaks, blocks] = await Promise.all([
    loadTeam(workspace.id),
    loadCurrentMemberId(workspace.id, session.user.id),
    loadWorkingHours(workspace.id, memberId),
    loadBreaks(workspace.id, memberId),
    loadTimeBlocks(workspace.id, memberId),
  ]);

  const member = team.find((row) => row.memberId === memberId && row.hasProfessionalProfile);
  if (!member) {
    notFound();
  }

  const isOwn = currentMemberId === member.memberId;

  return (
    <>
      <Button variant="outline" className="h-11 w-fit" render={<Link href="/app/equipe" />}>
        Voltar para a equipe
      </Button>
      <AvailabilityEditor
        memberId={member.memberId}
        memberName={member.displayName ?? member.fullName}
        hours={hours}
        breaks={breaks}
        blocks={blocks}
        canEditJornada={canManageJornada(workspace.role, isOwn)}
        canEditBlocks={canManageTimeBlocks(workspace.role, isOwn)}
      />
    </>
  );
}
