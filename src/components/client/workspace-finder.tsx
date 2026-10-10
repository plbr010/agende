"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { extractPublicWorkspaceSlug, publicProfilePath } from "@/lib/workspace/slug";

export function WorkspaceFinder({
  knownWorkspaces = [],
}: {
  knownWorkspaces?: { slug: string; name: string }[];
}) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function openWorkspace(event: React.FormEvent) {
    event.preventDefault();
    const slug = extractPublicWorkspaceSlug(value);
    if (!slug) {
      setError("Cole o link que o salão te mandou, pelo WhatsApp ou Instagram.");
      return;
    }
    setError(null);
    router.push(publicProfilePath(slug));
  }

  return (
    <div className="grid gap-4">
      {knownWorkspaces.length > 0 ? (
        <div className="grid gap-2">
          <p className="text-sm font-medium">Seus salões</p>
          <ul className="grid gap-2">
            {knownWorkspaces.map((workspace) => (
              <li key={workspace.slug}>
                <Button
                  variant="outline"
                  className="h-11 w-full justify-between rounded-2xl"
                  render={<a href={publicProfilePath(workspace.slug)} />}
                >
                  <span className="truncate">{workspace.name}</span>
                  <span className="text-xs text-muted-foreground">Abrir</span>
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <form onSubmit={openWorkspace} className="grid gap-3">
        <div className="grid gap-2">
          <Label htmlFor="workspace-ref">Abrir um salão</Label>
          <Input
            id="workspace-ref"
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setError(null);
            }}
            className="h-11"
            placeholder="Cole o link que você recebeu"
            autoComplete="off"
          />
        </div>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Use o link que o salão te mandou. Não buscamos salões pelo nome.
          </p>
        )}
        <Button type="submit" className="h-11 rounded-full">
          Ir para agendar
        </Button>
      </form>
    </div>
  );
}
