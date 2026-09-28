import { redirect } from "next/navigation";
import { RecoveryForm } from "@/components/auth/recovery-form";
import { createClient } from "@/lib/supabase/server";

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/recuperar-senha?status=expired");
  return <div className="space-y-6"><h1 className="font-serif text-3xl">Definir nova senha</h1><RecoveryForm reset /></div>;
}
