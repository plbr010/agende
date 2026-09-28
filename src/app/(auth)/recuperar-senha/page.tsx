import { RecoveryForm } from "@/components/auth/recovery-form";
import { RECOVERY_ERROR } from "@/lib/auth/password";

export default async function RecoveryPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  return <div className="space-y-6"><h1 className="font-serif text-3xl">Recuperar senha</h1>
    {status === "expired" && <p role="alert" className="text-destructive">{RECOVERY_ERROR}</p>}
    <RecoveryForm />
  </div>;
}
