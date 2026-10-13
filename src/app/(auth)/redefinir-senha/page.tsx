import { redirect } from "next/navigation";
import { RecoveryForm } from "@/components/auth/recovery-form";
import { AuthPanel } from "@/components/app/auth-panel";
import { createClient } from "@/lib/supabase/server";

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/recuperar-senha?status=expired");
  return (
    <AuthPanel
      eyebrow="Acesso"
      title="Definir nova senha"
      description="Escolha uma senha fácil de lembrar e difícil de adivinhar."
    >
      <RecoveryForm reset />
    </AuthPanel>
  );
}
