# Runbook final — 11/10/2026

Rodada operacional posterior ao merge #27: [matriz de evidências, jornadas e aprovações A1–A10](./OPERATIONAL-ACCEPTANCE.md). Seguir cada gate individualmente; aprovação de staging não autoriza produção.

Todas as operações remotas abaixo estão **pendentes de aprovação**, inclusive staging. Organização confirmada não autoriza provisionamento. Não fazer merge/deploy manual, DDL, repair, pagamentos reais, DNS ou alteração de variáveis remotas nesta missão.

## Pré-lançamento

1. Revisar este PR e preservar o redesign do Cursor. Nenhum componente visual alterado aqui.
2. Confirmar orçamento do staging na organização `vknkolqntkxbagibgflk`: tool get_cost indisponível. Aplicar [arquitetura proposta](./ENVIRONMENTS.md) somente após aprovação explícita de custo/recursos/bindings.
3. Conferir IDs de projetos, modo Stripe, origens e destinos SMTP. Não copiar dados de produção. Aplicar/validar schema primeiro em staging real; executar [aceite completo](./STAGING-ACCEPTANCE.md).
4. Confirmar backup recente e capacidade de recuperação da produção no plano contratado. Backup/PITR **não comprovados** nesta missão. Registrar horário, retenção, RPO/RTO aprovado e restore ensaiado em projeto separado antes de qualquer migration produtiva. Não assumir PITR disponível.
5. Revisar os hashes em `migration-plan.json` contra arquivos do commit aprovado. Refazer consulta read-only de schema/history imediatamente antes da janela; mudanças não previstas interrompem a aplicação.

## Ordem exata do schema

Aplicar somente os cinco arquivos em `migration-plan.json`, em ordem. Sem `db push`/repair genérico. Reconciliation de owner verifica definições conhecidas e falha diante de função desconhecida; não contornar o guard. Não inventar SQL para `20260919201138` ou os três placeholders 20260918203839/40/41. Nenhum registro remoto histórico deve ser alterado por suposição.

Executar cada migration aprovada em transação separada, com lock_timeout=5s e statement_timeout=60s como proposta a validar em staging. Exemplo operacional para o cliente aprovado: BEGIN → SET LOCAL lock_timeout/statement_timeout → SQL exato do arquivo → validação do resultado → COMMIT. Não concatenar arquivos e prosseguir após erro. Timeout implica rollback, investigar locks e reagendar; não encerrar sessões de clientes automaticamente. Usar mecanismo de aplicação aprovado que registre fielmente apenas a migration executada; não escrever histórico manualmente sem revisão.

Dependências: readiness cria reviews e RPCs; FORCE RLS depende dessa tabela. Owner guard concilia objetos observados; billing altera entitlement de excesso de assentos. RPC atômica depende das tabelas de serviços/profissionais e é requerida pela aplicação atualmente publicada. A criação de reviews não é idempotente: se objeto existir mas history estiver pendente, parar e comparar, não ignorar o erro.

Após cada aplicação: executar `validate-schema.sql` (somente leitura), comparar grants/policies/definições contra alvo aprovado. Recarregar cache PostgREST somente com operação aprovada; verificar RPCs via staging real e, em produção, apenas smoke sintético explicitamente autorizado. Novo inventário/history deve comprovar cinco registros corretamente aplicados, reviews com RLS+FORCE, RPCs com autorização e último owner preservado. Não considerar COMMIT prova de funcionamento via API.

Risco: locks, interrupção temporária de chamadas, mudanças de autorização e bloqueio de workspace com assentos em excesso. Não excluir membros para resolver downgrade. Recuperação: rollback antes de COMMIT; depois, correção aditiva revisada e/ou app compatível. Restore/PITR apenas com nova aprovação e plano que preserve dados escritos após backup. Nunca drop/recriação destrutiva.

## Auth, Stripe e infraestrutura

Auth: Site URL/redirects exatos e SMTP controlado primeiro em staging; provar cadastro de ambos perfis, confirmação, reset, login/logout e sessão vencida. Ativar senha vazada apenas após confirmar suporte/plano e aprovação de configuração; [remediação oficial](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Produção continua desativada.

Stripe: criar/conectar sandbox aprovado, seis preços TEST próprios e webhook staging com oito eventos atuais. Aplicar [política proposta do Portal](./PORTAL-PROPOSAL.md) só depois de aceite comercial e ciclo TEST completo. Deploy das Edge Functions desta branch exige autorização separada: os guards versionados não estão no remoto. Não presumir que deploy Vercel publica Edge Functions. Registrar código anterior e plano de retorno; reverter configuração não desfaz invoices/subscriptions. Nenhuma autorização geral permite cobranças reais.

Vercel: Preview/Development devem usar backend próprio. Este código bloqueia o Supabase produtivo conhecido quando a configuração continuar compartilhada; não retirar o guard para homologar. Gerar build por ambiente, sem promover artefato Preview para Production. Manter Production existente enquanto PR não aprovado.

Domínio: `agendeapp.online` ainda NXDOMAIN e não associado à Vercel. Confirmar propriedade/custo e obter aprovação de registro/DNS/domínio; consultar registros exigidos pela Vercel no momento, sem inventar IP fixo. Verificar TLS/SAN, redirects, cookies, Auth Site URL/allowlist, templates, AGENDE_SITE_URL e retorno Portal antes de ativar origem canônica. Recuperação: alias anterior + DNS/origens registrados; links enviados podem exigir reenvio.

## Manutenção PostgreSQL e dependências

Remoto e testes nativos estão em PG17.6. O [changelog oficial de 25/09](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes) anuncia 17.11 com correções de segurança. Preparar upgrade do provedor, verificar disponibilidade no projeto/plano e testar primeiro em staging. Consulta read-only não encontrou índices ltree/GiST float sensíveis, operadores customizados afetados ou uso de PGP encrypt nas funções app/public. Isso não comprova ausência em workloads externos nem todos os dados. Não executar upgrade/reindex remoto nesta missão. A prova local em 17.6 valida compatibilidade com o remoto atual; ainda não comprova 17.11.

Audit de produção: zero vulnerabilidades. Alertas dev da cadeia braces continuam sem patch disponível; não aplicar downgrade automático de eslint-config-next/Next.js. Manter lint fora de inputs não confiáveis e acompanhar upstream.

## Pós-liberação e recuperação operacional

Registrar IDs/commit e baseline de métricas antes da janela. Executar smoke anônimo e jornadas sintéticas autorizadas após publicação. Monitorar Vercel error/fatal/5xx, Auth falhas de confirmação/reset, Edge Function falhas de webhook/retry, atraso de eventos, entitlements e reservas em duplicidade. Não logar cookies, tokens, chaves ou PII. Em 15/30/60 minutos conferir métricas e filas; observação manual nesta missão não configura monitoramento futuro automático.

Bloqueios críticos: suspender novas vendas se ativação/isolamento incorretos; reverter app a release compatível aprovada; conservar logs de IDs de evento sem conteúdo sensível. Erros de webhook devem ser reprocessados com idempotência, nunca criar segundo checkout/cobrança para remediar. Alterações remotas de emergência exigem autorização, não estão preautorizadas por este documento.

## GO/NO-GO

GO somente com: isolamento real, backup recuperável, schema/API aprovados, Auth/SMTP real de teste, Stripe TEST completo + política de Portal aceita, domínio/TLS/origens consistentes e observabilidade/recovery responsáveis definidos. Build/SQL/mocks isoladamente não liberam venda. **Estado atual: NO-GO.**
