# Integração sobre main dcc5454

Decisão anterior à implementação da migration: conservar app.platform_admins como única autoridade privada de Super Admin, com as RPCs e o painel da main. Não importar app.platform_roles/account_controls/admin_audit nem a migration de 30/10. app.platform_admins representa a permissão global independente das funções de estabelecimento.

Revalidar a identidade Auth confirmada atual no servidor e no banco; manter revoked_at e invalidar a concessão quando a identidade deixa de ser a oficial. Autoconcessão será desativada, preservando consulta idempotente de acesso já concedido. Concessões por operador continuam separadas e exigem autorização específica.

Nenhuma definição de entitlement, lifetime, benefício ou policy RLS será substituída. Linhas administrativas existentes são preservadas na aplicação da migration; um trigger adicional revoga apenas uma concessão cuja identidade futura deixe de atender às condições.

Reversão transacional antes do commit é suportada. Após aplicação, usar recuperação para frente: restaurar funções vulneráveis ou reativar automaticamente acessos revogados reabriria a falha.
