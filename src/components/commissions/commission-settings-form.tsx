"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveCommissionPolicyAction, saveCommissionRuleAction } from "@/lib/commissions/actions";
import { formatRate, type CommissionSettings } from "@/lib/commissions/queries";

async function run(action: (formData: FormData) => Promise<{ error?: string; success?: string }>, formData: FormData) {
  const result = await action(formData);
  if (result.error) toast.error(result.error);
  else if (result.success) toast.success(result.success);
}

export function CommissionSettingsForm({
  settings,
  professionals,
  services,
}: {
  settings: CommissionSettings;
  professionals: Array<{ id: string; name: string }>;
  services: Array<{ id: string; name: string }>;
}) {
  const [pending, start] = useTransition();
  return (
    <div className="grid gap-6">
      <form className="agende-panel grid gap-4 rounded-[1.5rem] p-5 ring-1 ring-[#f0e4de]" action={(formData) => start(() => void run(saveCommissionPolicyAction, formData))}>
        <div>
          <h2 className="font-serif text-2xl text-wine-deep">Quando a comissão pode ser paga</h2>
          <p className="mt-2 text-sm text-muted-foreground">A escolha vale só para os próximos atendimentos.</p>
        </div>
        <label className="flex min-h-11 items-start gap-3 text-sm">
          <input type="radio" name="policy" value="on_receipt" defaultChecked={settings.release_policy === "on_receipt"} className="mt-1 size-4" />
          Liberar conforme o dinheiro entra. É o mais seguro.
        </label>
        <label className="flex min-h-11 items-start gap-3 text-sm">
          <input type="radio" name="policy" value="on_completion" defaultChecked={settings.release_policy === "on_completion"} className="mt-1 size-4" />
          Liberar tudo quando o atendimento termina, mesmo antes de receber.
        </label>
        <Button type="submit" className="h-11 w-fit" disabled={pending}>{pending ? "Salvando..." : "Salvar opção"}</Button>
      </form>

      <form className="agende-panel grid gap-4 rounded-[1.5rem] p-5 ring-1 ring-[#f0e4de]" action={(formData) => start(() => void run(saveCommissionRuleAction, formData))}>
        <div>
          <h2 className="font-serif text-2xl text-wine-deep">Percentual</h2>
          <p className="mt-2 text-sm text-muted-foreground">Sem serviço escolhido, este é o percentual padrão da profissional. Se escolher um serviço, ele vale só para esse serviço.</p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="professional">Profissional</Label>
          <select id="professional" name="professionalId" className="h-11 rounded-2xl border bg-background px-3 text-sm" required>
            {professionals.map((professional) => <option key={professional.id} value={professional.id}>{professional.name}</option>)}
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="service">Serviço</Label>
          <select id="service" name="serviceId" className="h-11 rounded-2xl border bg-background px-3 text-sm" defaultValue="">
            <option value="">Padrão da profissional</option>
            {services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="rate">Percentual</Label>
          <Input id="rate" name="rate" inputMode="decimal" placeholder="40" required />
        </div>
        <Button type="submit" className="h-11 w-fit" disabled={pending}>Salvar percentual</Button>
      </form>

      <section className="grid gap-3">
        <h2 className="font-serif text-2xl text-wine-deep">Regras em vigor</h2>
        {settings.rules.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma regra ainda. Sem percentual, a comissão fica zerada.</p> : null}
        <ul className="grid gap-2">
          {settings.rules.map((rule) => (
            <li key={rule.id} className="rounded-2xl bg-secondary/60 px-4 py-3 text-sm">
              {rule.professional_name} · {rule.service_name ?? "Padrão"} · {formatRate(rule.rate_bps)}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
