"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import type { ActionState } from "@/lib/auth/actions";
import { saveWorkspaceSettingsAction } from "@/lib/workspace/actions";
import type { WorkspaceSettingsRecord } from "@/lib/workspace/queries";
import { BR_STATES, selectClassName } from "@/lib/workspace/labels";
import { formatPublicProfilePreview, slugifyPreview } from "@/lib/workspace/slug";
import { WORKSPACE_TIMEZONES } from "@/lib/workspace/timezone";
import { publicLogoUrl } from "@/lib/workspace/public";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatPhoneBr } from "@/lib/validation/phone";

function HiddenSettingsFields({
  settings,
  omit,
}: {
  settings: WorkspaceSettingsRecord;
  omit: Array<keyof WorkspaceSettingsRecord>;
}) {
  const hidden: Array<[string, string]> = [];
  const push = (name: string, key: keyof WorkspaceSettingsRecord) => {
    if (omit.includes(key)) return;
    hidden.push([name, String(settings[key] ?? "")]);
  };
  push("name", "name");
  push("slug", "slug");
  push("businessPhone", "businessPhone");
  push("businessEmail", "businessEmail");
  push("description", "description");
  push("address", "address");
  push("city", "city");
  push("state", "state");
  push("postalCode", "postalCode");
  push("instagram", "instagram");
  push("timezone", "timezone");
  return (
    <>
      {hidden.map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
    </>
  );
}

export function GeneralSettingsForm({
  settings,
  canEdit,
}: {
  settings: WorkspaceSettingsRecord;
  canEdit: boolean;
}) {
  const [phone, setPhone] = useState(settings.businessPhone ? formatPhoneBr(settings.businessPhone) : "");
  const [state, action, pending] = useActionState(
    async (prev: ActionState, formData: FormData) => {
      const result = await saveWorkspaceSettingsAction(prev, formData);
      if (result.success) toast.success(result.success);
      else if (result.error && !result.fieldErrors) toast.error(result.error);
      return result;
    },
    {},
  );

  return (
    <Card className="border-none ring-1 ring-border">
      <CardHeader>
        <CardTitle>Endereço e contato do salão</CardTitle>
        <CardDescription>
          Nome, telefone e endereço. O horário padrão é o de Brasília.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid gap-4">
          <HiddenSettingsFields
            settings={settings}
            omit={["name", "businessPhone", "businessEmail", "address", "city", "state", "postalCode", "timezone"]}
          />
          <div className="grid gap-2">
            <Label htmlFor="name">Nome do salão ou estúdio</Label>
            <Input id="name" name="name" required defaultValue={settings.name} className="h-11" disabled={!canEdit} />
            {state.fieldErrors?.name ? <p className="text-sm text-destructive">{state.fieldErrors.name}</p> : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="businessPhone">Telefone comercial</Label>
              <Input
                id="businessPhone"
                name="businessPhone"
                className="h-11"
                placeholder="(32) 99999-9999"
                value={phone}
                onChange={(event) => setPhone(formatPhoneBr(event.target.value))}
                disabled={!canEdit}
              />
              {state.fieldErrors?.businessPhone ? (
                <p className="text-sm text-destructive">{state.fieldErrors.businessPhone}</p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="businessEmail">E-mail comercial</Label>
              <Input
                id="businessEmail"
                name="businessEmail"
                type="email"
                defaultValue={settings.businessEmail ?? ""}
                className="h-11"
                disabled={!canEdit}
              />
              {state.fieldErrors?.businessEmail ? (
                <p className="text-sm text-destructive">{state.fieldErrors.businessEmail}</p>
              ) : null}
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="address">Endereço</Label>
            <Input id="address" name="address" defaultValue={settings.address ?? ""} className="h-11" disabled={!canEdit} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-2 sm:col-span-1">
              <Label htmlFor="city">Cidade</Label>
              <Input id="city" name="city" defaultValue={settings.city ?? ""} className="h-11" disabled={!canEdit} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="state">Estado</Label>
              <select
                id="state"
                name="state"
                defaultValue={settings.state ?? ""}
                className={selectClassName}
                disabled={!canEdit}
              >
                <option value="">—</option>
                {BR_STATES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.value} — {item.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="postalCode">CEP</Label>
              <Input
                id="postalCode"
                name="postalCode"
                inputMode="numeric"
                defaultValue={settings.postalCode ?? ""}
                className="h-11"
                placeholder="36010-041"
                disabled={!canEdit}
              />
              {state.fieldErrors?.postalCode ? (
                <p className="text-sm text-destructive">{state.fieldErrors.postalCode}</p>
              ) : null}
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="timezone">Fuso horário</Label>
            <select
              id="timezone"
              name="timezone"
              defaultValue={settings.timezone}
              className={selectClassName}
              disabled={!canEdit}
            >
              {WORKSPACE_TIMEZONES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          {canEdit ? (
            <Button type="submit" className="h-12" disabled={pending}>
              {pending ? "Salvando..." : "Salvar dados"}
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">Só quem administra o salão pode editar.</p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

export function PublicProfileSettingsForm({
  settings,
  canEdit,
  host,
}: {
  settings: WorkspaceSettingsRecord;
  canEdit: boolean;
  host: string;
}) {
  const [slug, setSlug] = useState(settings.slug);
  const preview = useMemo(() => formatPublicProfilePreview(host, slugifyPreview(slug)), [host, slug]);
  const logoUrl = publicLogoUrl(settings.logoPath);
  const [state, action, pending] = useActionState(
    async (prev: ActionState, formData: FormData) => {
      const result = await saveWorkspaceSettingsAction(prev, formData);
      if (result.success) toast.success(result.success);
      else if (result.error && !result.fieldErrors) toast.error(result.error);
      return result;
    },
    {},
  );

  return (
    <Card className="border-none ring-1 ring-border">
      <CardHeader>
        <CardTitle>Como clientes te veem na internet</CardTitle>
        <CardDescription>
          Link, foto, texto e Instagram. Com horários cadastrados, as clientes marcam sozinhas.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid gap-4">
          <HiddenSettingsFields
            settings={settings}
            omit={["slug", "description", "instagram"]}
          />
          <div className="grid gap-2">
            <Label htmlFor="slug">Endereço do seu link</Label>
            <Input
              id="slug"
              name="slug"
              required
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              className="h-11"
              disabled={!canEdit}
            />
            <p className="break-all text-sm text-muted-foreground">{preview}</p>
            {state.fieldErrors?.slug ? <p className="text-sm text-destructive">{state.fieldErrors.slug}</p> : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              name="description"
              defaultValue={settings.description ?? ""}
              disabled={!canEdit}
              placeholder="Conte em poucas linhas o clima do seu espaço."
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="instagram">Instagram</Label>
            <Input
              id="instagram"
              name="instagram"
              defaultValue={settings.instagram ?? ""}
              className="h-11"
              placeholder="@seu.salao"
              disabled={!canEdit}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="logo">Logo ou foto</Label>
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={`Logo de ${settings.name}`}
                className="size-20 rounded-2xl object-cover ring-1 ring-border"
              />
            ) : (
              <div className="flex size-20 items-center justify-center rounded-2xl bg-secondary font-serif text-2xl text-primary">
                {settings.name.slice(0, 1)}
              </div>
            )}
            <Input id="logo" name="logo" type="file" accept="image/jpeg,image/png,image/webp" className="h-11" disabled={!canEdit} />
            <p className="text-xs text-muted-foreground">Foto ou logo (JPG ou PNG, até 2 MB).</p>
            {logoUrl ? (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="clearLogo" value="true" className="size-4 rounded border-input" disabled={!canEdit} />
                Remover imagem atual
              </label>
            ) : null}
          </div>
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <div className="flex flex-wrap gap-2">
            {canEdit ? (
              <Button type="submit" className="h-12" disabled={pending}>
                {pending ? "Salvando..." : "Salvar"}
              </Button>
            ) : null}
            <Link
              href={`/p/${settings.slug}`}
              className="inline-flex h-12 items-center rounded-lg px-3 text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              Ver como clientes te veem
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
