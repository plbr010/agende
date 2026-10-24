import { requireActiveWorkspace, requireConfirmedSession } from "@/lib/auth/session";
import { PermissionEditor } from "@/components/commissions/permission-editor";
import { permissionEditorSchema } from "@/lib/commissions/queries";
import { createClient } from "@/lib/supabase/server";

export default async function PermissionsPage() {
  const session = await requireConfirmedSession("/app/configuracoes/permissoes");
  const workspace = requireActiveWorkspace(session);
  if (workspace.role !== "owner") {
    return <p className="rounded-3xl bg-secondary/70 px-4 py-6 text-sm">Só a proprietária altera as permissões do salão.</p>;
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_member_permission_editor", { p_workspace_id: workspace.id });
  if (error) {
    return <p className="rounded-3xl bg-secondary/70 px-4 py-6 text-sm">Não foi possível abrir as permissões. Tente de novo.</p>;
  }
  const editor = permissionEditorSchema.parse(data);
  return <PermissionEditor editor={editor} />;
}
