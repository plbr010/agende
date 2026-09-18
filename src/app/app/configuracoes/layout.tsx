import { SettingsNav } from "@/components/workspace/settings-nav";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-6">
      <div>
        <p className="text-sm text-muted-foreground">Estabelecimento</p>
        <h1 className="font-serif text-3xl">Configurações</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          O jeito como o salão se apresenta, o time e o plano. Sem painel genérico — só o que o
          negócio precisa agora.
        </p>
      </div>
      <SettingsNav />
      {children}
    </div>
  );
}
