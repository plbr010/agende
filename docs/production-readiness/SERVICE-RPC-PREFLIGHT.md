# Preparação exclusiva da RPC — 12/10/2026, horário de São Paulo

**NÃO EXECUTADO EM PRODUÇÃO. BLOQUEADO POR BACKUP NÃO COMPROVADO.**

Alvo: wohimauqgywshbbejjcl. Fonte: 20261010232248_atomic_service_professional_links.sql. SHA256 reconfirmado: d13be7931bf92be45ef754858d4642881186f5bd8f9ce8a0d5f919419e5c0b37. Checkout be418af5463e88f6927db2a1a056b99c6d59ac89.

## Verificações somente leitura

Migration ausente no histórico e zero funções homônimas em app/public. Projeto ACTIVE_HEALTHY PG17.6; organização Free. Dashboard Database → Backups informa: Free Plan does not include project backups. Nenhum backup manual ou restore ensaiado comprovado nos artefatos consultados. Isso não prova que o proprietário não tenha cópia externa; é necessário identificar origem, horário, checksum, cobertura e ensaio de restauração antes de liberar a migration.

Procedimento de recuperação documentado pelo Supabase: exportação lógica protegida para Free; restauração em destino isolado autorizado, validação de schema/dados/roles/Auth, registro de duração e aceite de RPO/RTO. Arquivos Storage requerem cobertura própria; backup DB cobre metadados. Exportação de dados produtivos e ensaio de restore NÃO realizados/autorizados nesta rodada. Não restaurar sobre staging existente nem contratar plano/add-on por inferência. Antes do commit, rollback da transação basta; depois do commit, preferir correção aditiva revisada, sem restore indiscriminado que descarte gravações posteriores.

Dependências confirmadas: require_workspace_manager exige usuário/e-mail confirmados, entitlement vigente e membership ativo owner/admin. require_confirmed_email, require_authenticated_user, assert_workspace_entitled, workspace_has_entitlement e has_workspace_role existem e foram inspecionados. lock_workspace_membership existe, com advisory lock/lock da linha do workspace. Índice unique(professional_member_id,service_id) permite o ON CONFLICT. services, professional_services, professional_profiles e workspace_members mantêm RLS+FORCE. Triggers de entitlement, identidade imutável, updated_at e auditoria continuam presentes; SQL novo não ativa bypass de guards.

A migration é exclusivamente CREATE FUNCTION, REVOKE/GRANT, COMMENT e NOTIFY. INSERT/UPDATE constam no corpo da função, não são chamados durante a aplicação. Não remove/modifica serviços, vínculos ou clientes existentes. Cria API manager-only e libera seu EXECUTE para authenticated, com autorização interna/search_path vazio; interna não tem EXECUTE anon/authenticated. Seu uso futuro autorizado pode criar/editar serviço/vínculos, como esperado.

## Payload e comando propostos

apply-service-rpc-only.sql contém preflight, fonte exata, verificações de assinatura/grants/security e INSERT de **um único registro** de histórico (versão20261010232248, nome e fonte exata). Essa inserção é metadado de aplicação desta migration, apresentada para revisão; não corrige/remove registros antigos. Não inclui outras migrations ou chamadas à RPC de negócio.

Comando a partir da raiz do checkout, SOMENTE depois de backup recuperável comprovado, aprovação específica e configuração segura de credencial/certificado TLS:

```powershell
& 'C:/Users/PLBR/Documents/Codex/.agende-test-runtime/pg17/pgsql/bin/psql.exe' --dbname='host=db.wohimauqgywshbbejjcl.supabase.co port=5432 dbname=postgres user=postgres sslmode=verify-full connect_timeout=10' -X --set=ON_ERROR_STOP=1 --single-transaction --file=docs/production-readiness/apply-service-rpc-only.sql
```

Nenhuma senha na linha de comando/Git/chat. Conexão direta/credencial e confiança TLS ainda não foram testadas para produção; se indisponíveis, interromper e revisar transporte, sem retirar verify-full. Reconfirmar hashes da fonte e do payload imediatamente antes. --single-transaction encapsula BEGIN/COMMIT; ON_ERROR_STOP aborta na primeira falha. SET LOCAL lock_timeout=5s, statement_timeout=60s e idle_in_transaction_session_timeout=60s. Timeout/erro fecha a conexão e reverte toda a transação, incluindo histórico. Fonte/payload divergentes ou objetos já existentes interrompem o procedimento.

Pós-aplicação somente leitura: confirmar exatamente um registro version20261010232248 e que os outros registros permaneceram; duas funções/assinaturas/definições, search_path e grants; RLS/triggers existentes; exposição autenticada no schema PostgREST após NOTIFY. Não chamar a RPC nem submeter formulário em produção. Aceite funcional produtivo exige autorização separada.

Riscos: locks/latência do catálogo, atraso do cache PostgREST, divergência concorrente de schema e requisitos de conexão/TLS. Trial vencido/assinatura inválida continuam bloqueando operações legitimamente. As outras quatro migrations pendentes, inclusive reconciliação de excesso de assentos, permanecem fora deste escopo; não afirmar que os problemas gerais de lançamento foram resolvidos.

## Evidência local desta preparação

Ensaio em PostgreSQL17.6 sintético: payload aplicado em transação; snapshot integral dos serviços/vínculos existentes permaneceu igual; somente histórico próprio adicionado; histórico anterior preservado; segunda execução recusada. Quatro testes de catálogo e cinco suítes SQL PASS. Nenhuma consulta de negócio ou alteração remota produtiva nesta preparação.

Fontes: [backups Supabase](https://supabase.com/docs/guides/platform/backups), [backup/restauração CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).
