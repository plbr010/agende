import { RecoveryForm } from "@/components/auth/recovery-form";
import { AuthPanel } from "@/components/app/auth-panel";
import { RECOVERY_ERROR, RECOVERY_BROWSER_MISMATCH } from "@/lib/auth/password";

export default async function RecoveryPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  return (
    <AuthPanel
      eyebrow="Acesso"
      title="Recuperar senha"
      description="Informe o e-mail da conta. Se ele existir, mandamos um link para criar uma senha nova."
    >
      {status === "expired" || status === "browser_mismatch" ? (
        <p role="alert" className="mb-4 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {status === "browser_mismatch" ? RECOVERY_BROWSER_MISMATCH : RECOVERY_ERROR}
        </p>
      ) : null}
      <RecoveryForm />
    </AuthPanel>
  );
}
