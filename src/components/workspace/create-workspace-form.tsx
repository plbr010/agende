"use client";

import { useActionState } from "react";
import { createWorkspaceAction, type ActionState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: ActionState = {};

export function CreateWorkspaceForm() {
  const [state, action, pending] = useActionState(createWorkspaceAction, initial);

  return (
    <form action={action} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="name">Nome do negócio</Label>
        <Input
          id="name"
          name="name"
          required
          minLength={2}
          maxLength={80}
          className="h-11"
          placeholder="Estúdio Luna, Studio Ana, Barbearia Norte..."
        />
        {state.fieldErrors?.name ? <p className="text-sm text-destructive">{state.fieldErrors.name}</p> : null}
      </div>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <Button type="submit" className="h-12" disabled={pending}>
        {pending ? "Criando..." : "Criar negócio e começar trial"}
      </Button>
    </form>
  );
}
