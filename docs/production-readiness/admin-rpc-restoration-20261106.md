# Recuperação das consultas do painel master — 2026-11-06

## Incidente verificado

A UI publicada no commit `051b966d5d2ed38a641c03483d46fc4dbed975e6` chama várias RPCs do painel master que não existem no Supabase de produção.

Evidência read-only, 2026-11-06: `POST /rest/v1/rpc/admin_list_workspaces` devolve HTTP 404; os logs também mostram 404 para `admin_list_professionals`, `admin_list_clients`, `admin_list_subscriptions`, `admin_list_appointments`, `admin_list_users` e `admin_list_audit_events`. Inspeção de `pg_proc` confirmou que apenas `admin_dashboard_overview` e `admin_set_account_hold` estavam instaladas dentre as funções `admin_%`.

O painel de visão geral foi testado com a identidade master oficial, em uma transação de leitura, e retornou métricas reais. Assim, não é necessário alterar a autenticação da conta master nem o esquema de faturamento.

## Correção isolada

Arquivo: `supabase/migrations/20261106101000_restore_platform_admin_read_rpcs.sql`.

Restaura **somente** estas 12 RPCs de leitura exatamente a partir da migração original `20261103180000_platform_master_admin.sql`:

- `admin_list_professionals`, `admin_get_professional`
- `admin_list_workspaces`, `admin_get_workspace`
- `admin_list_clients`, `admin_get_client`
- `admin_list_subscriptions`, `admin_list_billing_events`
- `admin_list_appointments`, `admin_list_users`
- `admin_support_overview`, `admin_list_audit_events`

Todas executam `app.require_platform_admin()` antes de ler dados. Nenhuma atualização de perfis, agendamentos, assinaturas, credenciais ou Stripe é feita por esta migração. As permissões de execução são revogadas de `PUBLIC` e `anon`, mantendo `authenticated` sujeita à checagem master.

## Validação concluída em staging

No projeto Supabase `agende-staging`, a migração foi aplicada com sucesso. Chamadas como o usuário master autenticado devolveram JSON válido para visão geral, as oito listagens, suporte e três detalhes. Após a aplicação, todas as 14 RPCs `admin_%` no catálogo têm execução habilitada para `authenticated` e desabilitada para `anon`. O staging possuía dados de teste suficientes para validar as rotas.

Validação de navegador end-to-end ainda é pendente; a prova foi no banco, não em sessão real de iPhone.

## Produção — precisa de aprovação explícita

**Não aplicar automaticamente, nem fazer merge na main como atalho.** O banco de produção registra migrações customizadas (`platform_master_admin_helpers`, `platform_master_admin_dashboard`) que não correspondem 1:1 aos arquivos do GitHub. Não executar `supabase db push` de todo o histórico sem conciliar as diferenças.

Após autorização do proprietário:

1. Confirmar backup e projeto alvo de produção `Agendê` (`wohimauqgywshbbejjcl`).
2. Revalidar pré-condições: `app.require_platform_admin()` e outras helpers existentes; sem funções alvo ou conflitos de assinatura.
3. Aplicar **apenas** o SQL isolado do arquivo acima em transação/migração rastreável.
4. Verificar catálogo de 12 RPCs, `GRANT` somente a `authenticated`, bloqueio a `anon`, e resultados positivos/negativos para master e não-admin, sem alterar dados.
5. Abrir `/admin`, `/admin/estabelecimentos`, `/admin/profissionais`, `/admin/clientes`, `/admin/assinaturas`, `/admin/agendamentos` e `/admin/suporte` em desktop e celular autenticados. Testar filtros, paginação e páginas de detalhe.
6. Validar suspensão/reativação apenas com registros de teste e plano explícito de reversão; nunca suspender conta real ou enviar cobrança para verificar a UI.

## Reversão

Se o único change aplicado foi esta recuperação, recuperar o estado anterior removendo **apenas** estas 12 RPCs com as assinaturas exatas, após confirmar que nenhum outro deploy passou a depender delas. Não remover as RPCs `admin_dashboard_overview` ou `admin_set_account_hold`, nem conceder acessos amplos. Preferir restaurar o dump de esquema anterior em ambiente isolado antes de uma reversão que afete produção.

## Limites conhecidos

- Testes diretos de SQL, segurança de grants e respostas JSON passaram em staging.
- Não foi executado um login real no frontend pelo navegador; a liberação como 100% operacional requer E2E.
- Nenhuma alteração em produção foi feita nesta correção, em respeito ao bloqueio de mudanças sem aprovação.
