# Preparação final de produção — 11/10/2026

**NO-GO comercial.** Todos os checks locais passaram; dependências de produção sem vulnerabilidades. Ainda faltam ambiente de homologação completo, schema de produção e aceite real de Auth/SMTP/Stripe. Nenhuma escrita remota, migration, deploy manual/Edge, alteração de DNS ou pagamento real foi executado.

## Código

PRs #19–#24 incorporados. Base desta missão `86b909925ca88fcd2ddd2ff9a68394d2de52a885`; branch exclusiva `codex/production-readiness-final`. Next.js e eslint-config-next mantidos em 16.3.8. Não modificou componentes visuais ou branch do Cursor. Contratos e regressões das jornadas anteriores preservados.

Depois da confirmação de custo mínimo, main recebeu #25 (`602ea83`), com redesign do Cursor. Branch própria atualizada por rebase; único conflito era a evidência gerada, regenerada pelos testes completos de ambos os trabalhos. Nenhum componente do redesign foi alterado. Organização foi confirmada como Free; veja [opção de custo zero](./ZERO-COST-STAGING.md). Nenhuma contratação autorizada/executada.

Corrigido nesta rodada:

1. Factories Supabase recusam o backend produtivo conhecido em Preview/Development. A classe do deployment é compilada em servidor/browser; NODE_ENV=production local não permite acesso ao projeto produtivo. Servidor exige também runtime Vercel production. Testes cobrem browser, runtime divergente, host com ponto final e URLs malformadas.
2. Edge billing/webhook recusam chaves TEST no projeto de produção conhecido e LIVE fora dele, antes de construir cliente Stripe. Webhook recusa evento assinado com livemode incompatível antes de gravar billing. Chaves dos testes são strings sintéticas, nunca credenciais reais.
3. Billing fora de produção exige AGENDE_SITE_URL explícito e válido, impedindo fallback de redirect para a origem produtiva.
4. Arquitetura/bindings de ambientes, proposta de Portal, roteiro de aceite real, manifesto com SHA256 das cinco migrations, validação SQL read-only e runbook operacional preparados.

Estas proteções ainda são código no PR. Preview atual continua com bindings errados e será bloqueado quando usar o backend produtivo; só poderá homologar após isolamento aprovado. Edge Functions precisam de publicação aprovada separada; não foram redeployadas.

No primeiro CI, o verificador de recuperação falhou ao comparar hashes históricos das Edge v2 com o arquivo atual modificado. Corrigido para verificar o commit exato `compared_pr_sha` já registrado no manifesto imutável. Nenhum hash histórico foi alterado, e as fontes atuais continuam verificadas pelos testes de comportamento Edge.

## Verificação e evidências

| Verificação | Resultado / categoria |
|---|---|
| npm ci | PASS, Node24.19.0; cinco alertas dev preexistentes |
| lint e typecheck | PASS |
| npm test | **233 PASS** após integrar #25, zero falhas/skips: 135 unitários/contratos estáticos, 51 mocks plataforma, 12 mocks Stripe, 26 SQL PGlite, nove integrações SQL com Auth simulado |
| build Next.js16.3.8 | PASS |
| test:smoke | **32 PASS** no build local, GETs anônimos |
| executor test:postgres | **43 PASS**, zero falhas/skips, PostgreSQL17.6 real local: 26 SQL, nove integrações com Auth simulado, oito concorrências de sessões independentes |
| cinco suítes SQL nativas | PASS; todas as 67 migrations do Git aplicadas no cluster sintético |
| npm audit --omit=dev | zero vulnerabilidades |
| validate-release-plan.mjs | PASS hashes e checks read-only no alvo PGlite; histórico CLI usa fixture vazia para testar sintaxe |
| produção atual | 32 GETs HTTPS PASS; nenhum login/formulário/pagamento; certificado do alias válido e autorizado em tls.json |

Evidências detalhadas dos runners em `../homologation/{standard-tests,native-tests,native-pg17,pg17-concurrency}.json`, atualizadas nesta rodada. SQL/Auth fixtures não são GoTrue/PostgREST. Os 35 casos SQL/integração repetem casos da suíte padrão; não somar 233 +43 como casos únicos. O cluster PostgreSQL foi parado após execução, com dados sintéticos preservados/ignorados pelo Git. #25 não mudou SQL/migrations; seus dois testes visuais foram preservados, e lint/typecheck/build/smoke repetidos após rebase.

A primeira validação local do SQL de pós-migration encontrou ausência do schema de histórico CLI no harness; foi corrigida no validador com fixture explicitamente vazia. Não houve falha de migration nem alteração de histórico remoto. A suíte final passou depois da correção de origem billing. Build/typecheck não cobrem Deno: entradas Edge foram executadas por transpilation com imports de plataforma substituídos; execução Deno/PostgREST/Stripe real segue bloqueada.

## O que é real e o que falta

| Jornadas | Evidência atual | Aceite externo |
|---|---|---|
| Cadastro profissional/cliente, confirmação, login/logout, reset, sessão, redirects | mocks + GETs anônimos | BLOQUEADO: Auth/SMTP/cookies reais de teste |
| Trial único sete dias, vencimento, owner/admin/professional/receptionist, assentos, IDOR/isolamento | SQL PostgreSQL17.6 real local com identidade Auth fixture | BLOQUEADO: PostgREST/GoTrue staging |
| Serviço/profissional/horários/reserva/reagendamento/cancelamento/conclusão/avaliação | ação + SQL local; concorrência real de reservas/reagendamentos/reviews | BLOQUEADO: navegador autenticado staging |
| Financeiro, estoque, pacotes, relatórios | SQL local e testes de contratos | BLOQUEADO: jornada completa staging e persistência via API real |
| Seis Checkouts, trial, upgrade/downgrade, recusa/renovação/cancelamento/Portal/webhooks | 12 mocks Edge + SQL local; configuração LIVE lida por GET | BLOQUEADO: Stripe TEST e test clocks externos |

Rate limiting de booking já existe no SQL (workspace/contato/IP), com guard de concorrência; inputs, RLS e autorização das RPCs são exercitados localmente. Não adicionar rate limit visual que deixe RPC direta exposta. OTP/SMTP limit e WAF precisam de revisão no ambiente real aprovado. Testes de segurança não comprovam ausência absoluta de vulnerabilidades.

## Estado remoto atual

`remote-state.json`: Supabase saudável, PG17.6.1.166. Todos os oito grupos de catálogo (tabelas/colunas/constraints/índices/policies/grants/funções/triggers) iguais ao snapshot de 09/10. 31 tabelas públicas com RLS+FORCE. 63 entradas remotas contra 67 arquivos locais; cinco pendentes em `migration-plan.json`. Reviews/tabela e RPCs de reviews/slots/gravação atômica continuam ausentes. History remoto exclusivo e placeholders permanecem não reproduzíveis; não reparar por suposição.

Advisor: senha vazada desativada; wrappers SECURITY DEFINER públicos intencionais ainda alertados (5 anon/53 authenticated); lease privada sem policy deliberada. Ver URLs oficiais de remediação no JSON. A implementação autoriza chamadas e fixa search_path; não revogar APIs necessárias cegamente.

Stripe: só LIVE acessível, nenhum sandbox. Nove preços recorrentes ativos, sendo seis lookup keys esperados com valores corretos e três anuais adicionais sem lookup. Portal updates=false / opção inativa end_trial; webhook ativo com oito eventos, API2026-08-26.dahlia. Nenhuma assinatura/Checkout externo criado, nenhum dado de assinante lido.

Vercel: production READY `dpl_77p22CGciyCTEscpELNHqCS4aXAo`, commit86b9099. Preview/Development ainda compartilham as duas variáveis Supabase de produção; Site URL explícita ausente. Consulta error/fatal dos últimos30min sem grupos; alcance limitado, não prova zero erros em todas as jornadas. Alias agende-lac.vercel.app tem HTTPS validado; agendeapp.online está NXDOMAIN, não associado ao projeto, TLS desse domínio não verificável.

Preview do PR26 READY `dpl_2tSuErY6vMJB1jVbr8jahGsTkqGk`: GET `/login` retorna500 porque a configuração compartilhada é recusada. Logs filtrados confirmaram `Production Supabase is forbidden` nessa rota. É evidência do bloqueio no build real, não homologação de login; configurar staging aprovado para usar o Preview. Supabase Edge remoto ainda tem billing/webhook ACTIVE versão2; código desta missão não foi publicado lá.

## Pendências classificadas

**P0:** provisionar/isolar staging e credenciais, homologar Auth/SMTP/Stripe TEST e navegador autenticado, aplicar cinco migrations de produção somente após aceite/backup/aprovação. Sem isso não declarar funcionalidades comerciais integradas.

**P1 antes de clientes:** aceitar e validar política de Portal (trial/proração/intervalos/assentos), publicar Edge guards aprovados, configurar domínio/origens/SMTP e senha vazada, comprovar backup recuperável, planejar atualização PostgreSQL17.11 conforme changelog do provedor. A consulta de upgrade não encontrou índices ltree/GiST float sensíveis, operadores afetados ou uso PGP encrypt em app/public; não substitui homologação da versão nova.

**P2:** investigar uso dos três preços anuais adicionais antes de qualquer arquivamento; acompanhar patch braces dev (produção audit limpa), automatizar PostgreSQL nativo no CI e reforçar observabilidade. Sem downgrade de Next/eslint ou archive financeiro arbitrário.

## Aprovação e próxima decisão

Organização Supabase confirmada; orçamento não disponível pelo MCP. É necessário confirmar custo/plano no Dashboard antes de aprovar criação. [Ambientes](./ENVIRONMENTS.md), [Portal](./PORTAL-PROPOSAL.md), [aceite real](./STAGING-ACCEPTANCE.md) e [runbook](./RELEASE-RUNBOOK.md) definem ações, riscos, validação e recuperação. Aprovações separadas para recursos/bindings, schema produtivo, Edge/Portal LIVE, Auth/SMTP produtivo e DNS/domínio. Valores/custos não confirmados não foram assumidos.

Não há percentual de prontidão inventado: código tem evidência local forte; operação ainda falha em gates essenciais. Lançamento em15/10 só pode receber GO quando houver evidência externa e aceite dos gates do runbook.
