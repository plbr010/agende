# Agendê — simplificação do Master Admin, 05/11/2026

## Entrega local

Branch: codex/master-admin-salons-20261105, criada sobre c352a2f5cd5c56796ba8da5a2e253d5f1f386c1c.
A branch original codex/priority-fixes-review-20261105 continua em daa29b57d074da7e9ca2f165720a076871eec282 no checkout original. Nenhuma alteração desse checkout foi editada.

Visão geral substituída por quatro indicadores e diretório de salões; busca por salão/proprietário, filtros, paginação e detalhes de consulta. A navegação principal contém somente Visão geral, Salões e Assinaturas. As demais áreas permanecem em Mais opções. Logo, cores, tipografia e componentes oficiais reutilizados.

As consultas do produto usam Supabase autenticado e RPC protegida, nunca fixtures. Fixtures existem exclusivamente nos testes. Não há chamadas financeiras Stripe na renderização, credencial administrativa no frontend ou valores de fallback simulados.

## Dados e regras

Inspecionados guard atual, migrations/RLS locais, schema de subscriptions do staging e metadados das políticas. A sincronização existente faz retrieve do estado corrente Stripe, grava subscription canônica e registra event_status bruto em billing_events; a UI reutiliza essas evidências.

Modelo novo app.admin_salon_rows/public.admin_salon_overview:
- Um registro por workspace, inclusive quando não há assinatura ou perfil de proprietário.
- Trial requer prazo futuro; prazo terminado aparece como Trial expirado.
- Pago requer vínculo Stripe, assinatura active, observação active, período vigente e invoice.paid com valor positivo dentro desse período. Acesso vitalício é identificado e não contado como pago.
- past_due e unpaid separados quando o evento de assinatura é consistente com a assinatura canônica e não precede o checkout mais recente.
- incomplete, estado inconsistente, evidência ausente ou período ativo vencido são Status não verificado, sem serem transformados em inadimplência.
- A falta de resposta Stripe não é uma condição de inadimplência; não há chamada Stripe no carregamento. Se Supabase falhar, a página mostra erro e não inventa quatro zeros.
- Contagens globais e página calculadas no mesmo snapshot SQL; busca/filtro/paginação não alteram os totais globais.
- Contagens de pagos/inadimplentes são conservadoras; salões não verificados aparecem em aviso e filtro próprio.
- Datas de período não são apresentadas como vencimento exato nem promessa de renovação.

A regra depende da qualidade da sincronização já existente. billing_events não possui ID de assinatura por evento; a proteção por workspace, corte no último checkout e consistência de status reduz associações históricas, mas não constitui consulta ao vivo ou garantia de frescor do provedor. Data de evidência disponível nos detalhes. Não inferir que o status foi confirmado diretamente na Stripe nesta tarefa.

## Limitações explícitas

O schema atual NÃO persiste cancel_at_period_end nem a data de vencimento da próxima fatura. Não é possível confirmar cancelamento agendado a partir de canceled_at, que a sincronização limpa em estados não cancelados. O painel declara essa indisponibilidade; não inventa cancelamento nem próxima cobrança.

Há rótulo distinto de cancelamento agendado preparado, mas nenhuma linha recebe esse status sem uma fonte confiável. Para completar esse requisito no futuro é necessária proposta separada de persistência/consulta desses campos, com testes de sincronização, contexto Stripe atestado e autorização para implantação. Não foi alterada a lógica de cobrança para contornar a lacuna.

O acesso vitalício continua sendo uma regra de entitlement separada do estado financeiro. Seu benefício não é concedido/removido pelo painel.

## Segurança e preservação

requireReadyPlatformAdmin mantém revalidação da identidade Auth atual e RPC is_platform_admin. A nova RPC chama app.require_platform_admin no banco, com search_path vazio; helper privado sem EXECUTE para usuários e serviço. Não depende de flags do frontend ou claims administrativas antigas.

A migration adiciona apenas duas funções de leitura. Não altera tabelas, dados, funções de entitlement, funções de cobrança, políticas RLS ou grants existentes. O GRANT novo permite chamar somente a RPC, cujo corpo exige autorização efetiva.

Detalhes principais não têm controles de cancelamento, troca de plano ou gratuidade. As ferramentas antigas de suspensão/equipe/histórico foram preservadas em rotas de gestão separadas, com suas autorizações/auditoria já existentes.

## Arquivos

- src/app/admin/page.tsx: nova visão geral.
- src/app/admin/estabelecimentos/page.tsx e src/app/admin/assinaturas/page.tsx: diretório comum de salões/assinaturas.
- src/components/admin/salon-directory.tsx e salon-status.tsx: indicadores, tabela, busca, filtros e estados.
- src/app/admin/estabelecimentos/[workspaceId]/page.tsx: detalhes somente leitura.
- src/components/admin/admin-shell.tsx: navegação simplificada.
- src/lib/admin/queries.ts e salon-status.ts: RPC e apresentação de trial/status.
- src/lib/supabase/database.types.ts: contrato da RPC.
- supabase/migrations/20261105194747_admin_salon_read_model.sql: proposta aditiva.
- Rotas preservadas: /admin/estabelecimentos/gestao, /admin/estabelecimentos/[workspaceId]/gestao e /admin/assinaturas/historico.
- scripts/admin-salons-sql.test.mjs, admin-salons-view.test.mjs, admin-salons-render-harness.mjs, admin-salons-browser.mjs e src/lib/admin/salon-status.test.ts: validação.
- scripts/run-tests.mjs e verify-stripe-recovery*: registro dos testes e checksum da migration local proposta, sem aprovação remota implícita.
- eslint.config.mjs e tsconfig.json: excluem artifacts de auditoria do lint/typecheck do aplicativo; os originais Stripe preservados são Deno, não fonte Next.

## Validação

Lint sem erros, com dois avisos preexistentes em prepare-prelaunch-legacy.mjs e prepare-prelaunch-window.mjs.
Typecheck e build passaram com backend fictício e WhatsApp autorizado; nenhum backend real usado no build.
Suíte completa: 557 aprovados, zero falhas, dois testes de concorrência pulados (exigem PostgreSQL nativo). Resultados em docs/homologation/standard-tests.json e artifacts/master-admin-salons/focused-tests.log.
Testes focados finais: 11 aprovados, incluindo upgrade de banco populado, preservação de lifetime/grants/RLS/registros, rollback da consulta e compatibilidade autorizada dos links antigos.
Browser do componente real com CSS do build e fronteira de dados substituída apenas no harness: 5 cenários aprovados, desktop/mobile, filtros/busca, vazio e indisponibilidade.
Browser público no servidor Next local: 22 aprovados, zero falhas ou bloqueios.
Os testes SQL usam PostgreSQL em memória (PGlite), Auth fixture; não substituem sessão real de Master Admin em staging.
Capturas desktop.png e mobile.png e resultados em artifacts/master-admin-salons. A captura móvel foi inspecionada; tabela rola internamente sem transbordar documento.
O primeiro ensaio público falhou por build sem variável WhatsApp; reconstruído com 5532998064217 e a rodada final passou. Nenhuma regressão comercial ocultada.

## Migration e rollout seguro

Arquivo: 20261105194747_admin_salon_read_model.sql.
SHA-256 LF: eafc535cbbf512af43ed78c588339e316117955081392c83b53b31d80815e622.
Não aplicada remotamente. Não executar db push nem migrations antigas/pacote pendente automaticamente.

Antes de homologar: revisar RPC e diff, confirmar schema/guardas atuais do staging, obter autorização específica para aplicar SOMENTE essa migration no staging, aplicar com preflight e verificar acesso autorizado/negado. Depois testar a interface com sessão real em Preview isolado, mediante autorização separada de publicação.

Sem a RPC, a nova visão falha com aviso, sem dados fictícios. Portanto o commit não deve ser publicado isoladamente antes da dependência.

Rollback após reverter o frontend: DROP FUNCTION public.admin_salon_overview(text,text,integer,integer,uuid); DROP FUNCTION app.admin_salon_rows();. Testado localmente com preservação integral dos registros/políticas/grants. Nenhuma renumeração de migrations nem remoção de histórico remoto autorizada.

## Recomendação

Pronto para revisão de código local. NO-GO para deploy produtivo: migration remota e homologação autenticada pendentes; cancelamento agendado e próximo vencimento não confirmáveis pelo contrato atual.
Nenhum deploy, push, merge, alteração remota, cobrança, mudança Stripe LIVE ou privilégio administrativo realizado nesta tarefa. O diagnóstico Stripe temporário anterior continua não executado.
