"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/auth/actions";
import { saveProfessionalProfileAction } from "@/lib/catalog/actions";
import type { TeamMember } from "@/lib/catalog/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const initial: ActionState = {};

export function OwnProfessionalProfile({
  member,
  canManage,
}: {
  member: TeamMember;
  canManage: boolean;
}) {
  const [state, action, pending] = useActionState(saveProfessionalProfileAction, initial);

  if (!member.hasProfessionalProfile) {
    return (
      <section className="rounded-[1.8rem] bg-metric-ivory p-6 ring-1 ring-[#f0e4de]">
        <h2 className="font-serif text-2xl text-wine-deep">Seu perfil de atendimento</h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
          Sua função atual não publica um perfil de atendimento. Quem administra o salão libera isso quando você passa a receber horários.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-[1.8rem] bg-white p-6 ring-1 ring-[#f0e4de] sm:p-8">
      <h2 className="font-serif text-2xl text-wine-deep">Seu perfil de atendimento</h2>
      <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
        Nome e frase que as clientes veem na hora de marcar. A confirmação só aparece depois que o salvamento terminar.
      </p>
      <form action={action} className="mt-6 grid max-w-xl gap-4">
        <input type="hidden" name="memberId" value={member.memberId} />
        <div className="grid gap-2">
          <Label htmlFor="own-displayName">Nome que as clientes veem</Label>
          <Input
            id="own-displayName"
            name="displayName"
            defaultValue={member.displayName ?? member.fullName}
            className="h-12"
            required
            aria-invalid={Boolean(state.fieldErrors?.displayName)}
          />
          {state.fieldErrors?.displayName ? <p className="text-sm text-destructive" role="alert">{state.fieldErrors.displayName}</p> : null}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="own-bio">Uma frase sobre o atendimento</Label>
          <Textarea id="own-bio" name="bio" defaultValue={member.bio ?? ""} placeholder="Ex.: Manicure há 10 anos, atendimento com hora marcada." />
          {state.fieldErrors?.bio ? <p className="text-sm text-destructive" role="alert">{state.fieldErrors.bio}</p> : null}
        </div>
        {canManage ? (
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="hidden" name="manageBooking" value="1" />
            <input
              type="checkbox"
              name="bookingEnabled"
              value="true"
              defaultChecked={Boolean(member.bookingEnabled)}
              className="size-5 rounded border-input"
            />
            Recebe reservas online
          </label>
        ) : null}
        {state.error ? (
          <p role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{state.error}</p>
        ) : null}
        {state.success ? (
          <p role="status" className="rounded-full bg-metric-blush px-4 py-2 text-sm text-wine-deep">{state.success}</p>
        ) : null}
        <Button type="submit" size="lg" className="w-fit" disabled={pending} aria-busy={pending}>
          {pending ? "Salvando..." : "Salvar perfil"}
        </Button>
      </form>
    </section>
  );
}
