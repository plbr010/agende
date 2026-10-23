"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setMemberPermissionAction } from "@/lib/commissions/actions";
import { permissionLabels, type PermissionEditor as PermissionEditorData } from "@/lib/commissions/queries";

const roleLabel: Record<string, string> = {
  owner: "Proprietária",
  admin: "Administração",
  professional: "Profissional",
  receptionist: "Recepção",
};

export function PermissionEditor({ editor }: { editor: PermissionEditorData }) {
  const [pending, start] = useTransition();
  return (
    <div className="grid gap-6">
      <p className="text-sm text-muted-foreground">A proprietária sempre pode tudo. Para as outras pessoas, você pode liberar, bloquear ou voltar ao padrão do cargo.</p>
      {editor.members.map((member) => (
        <section key={member.member_id} className="agende-panel grid gap-3 rounded-[1.5rem] p-5 ring-1 ring-[#f0e4de]">
          <div>
            <h2 className="font-serif text-2xl text-wine-deep">{member.full_name}</h2>
            <p className="text-sm text-muted-foreground">{roleLabel[member.role] ?? member.role}{member.editable ? "" : " · não pode ser limitada"}</p>
          </div>
          <ul className="grid gap-2">
            {member.permissions.map((permission) => (
              <li key={permission.key} className="flex flex-col gap-2 rounded-2xl bg-secondary/50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium">{permissionLabels[permission.key] ?? permission.key}</p>
                  <p className="text-xs text-muted-foreground">{permission.effective ? "Pode" : "Não pode"} · {permission.source === "default" ? "padrão do cargo" : permission.source === "grant" ? "liberado por você" : permission.source === "deny" ? "bloqueado por você" : "sempre pode"}</p>
                </div>
                {member.editable ? (
                  <div className="flex flex-wrap gap-2">
                    {(["grant", "deny", ""] as const).map((effect) => (
                      <form key={effect || "default"} action={(formData) => {
                        if (effect === "grant" && !window.confirm("Liberar este acesso para esta pessoa?")) return;
                        if (effect === "deny" && !window.confirm("Bloquear este acesso? A pessoa deixa de ver ou fazer esta ação.")) return;
                        start(async () => {
                          const result = await setMemberPermissionAction(formData);
                          if (result.error) toast.error(result.error);
                          else if (result.success) toast.success(result.success);
                        });
                      }}>
                        <input type="hidden" name="memberId" value={member.member_id} />
                        <input type="hidden" name="permissionKey" value={permission.key} />
                        <input type="hidden" name="effect" value={effect} />
                        <Button type="submit" variant="outline" className="h-11" disabled={pending}>
                          {effect === "grant" ? "Permitir" : effect === "deny" ? "Bloquear" : "Padrão"}
                        </Button>
                      </form>
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
