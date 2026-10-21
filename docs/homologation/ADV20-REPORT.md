# ADV20 — simulação de lançamento e testes adversariais

20/10/2026, America/Sao_Paulo; execuções finais após 00:00 UTC de 21/10 ainda pertencem à noite de 20/10 em Brasília. **NO-GO para piloto produtivo e vendas. GO para homologação controlada em staging.** Nenhuma mudança produtiva executada.

## Estado e escopo

Checkout começou limpo, preservado. Branch própria `codex/adversarial-launch-20261020`, base **`2bdd3564a2ca2b24de9dd23bfd02de8aab3b3a86`**, merge da #72. [CI da main 39485824832](https://github.com/plbr010/agende/actions/runs/39485824832) aprovado. Vercel READY `dpl_AMpCwHFDDDS8C9WY4sft5Uw57mW4`, publicado nesse mesmo SHA por integração anterior; esta missão não fez esse merge/deploy. PRs #71 e #73 abertas e preservadas. As mudanças de UX da #73 não foram incorporadas silenciosamente nesta candidata.

Ponto de partida: FINAL20/RC20 e runbook de produção. Foram priorizadas lacunas reais: transporte interrompido, resposta perdida após commit, cadastro inválido/duplicado, link usado, sessão inválida, interação antes da hidratação e operação real de staging. Só houve uma reconferência produtiva direcionada de migrations/grants, sem dados de clientes; não repetimos uma auditoria genérica.

## 1. Problemas críticos

Nenhuma nova exposição P0 demonstrada nesta rodada. **Bloqueio P0 produtivo anterior continua confirmado:** wrapper de reserva executável por anon, corpo privado com fallback guest, cinco migrations ausentes e contratos legados incompletos. [Consulta direcionada](adv20-production-gates.json), 23:59:24 UTC: `anon_booking_execute=true`, `guest_fallback=true`, reviews ausentes e billing antigo. A proteção da interface não substitui a autorização no banco.

## 2–4. Problemas importantes, menores e correções

| ID | Reprodução e causa | Correção e prova |
|---|---|---|
| P1-01 | Interromper POST da Server Action ao escolher o dia: a rejeição escapava do carregador de horários e levava à página de erro, perdendo o fluxo | Erro local recuperável, retry explícito, escolhas e proteção contra resposta obsoleta preservadas. [Antes](adv20-network-before.json) e [depois](adv20-network-after.json) |
| P1-02 | Deixar a reserva gravar e descartar sua resposta: o browser não sabe se houve commit | Sem comprovante inventado nem retry automático; confirmação fica bloqueada e oferece histórico. Teste observa exatamente uma reserva persistida. Mesmo caso coberto em harness React |
| P1-03 | Preencher cadastro, informar telefone inválido, receber validação: React limpava campos não controlados, inclusive nome/e-mail/senha | Impedir reset do formulário enquanto permanece na tela; sucesso continua redirecionando. [Falha real](adv20-form-reset-before.json), teste staging e regressão de navegador no CI |
| P2-01 | GoTrue pode responder a e-mail confirmado existente com `error=null`, sessão ausente e `identities=[]`; a action ignorava o retorno e afirmava envio | Orientação neutra para entrar/recuperar, sem afirmar novo cadastro/envio e sem sobrescrever cookies de intenção/e-mail pendentes do Agendê. [Retorno real sanitizado](adv20-duplicate-provider.json), teste da action e staging |
| P2-02 | Clicar na busca antes da hidratação podia submeter o formulário nativamente para `/descobrir?`, descartando a validação de cidade | Submit indisponível até os handlers estarem prontos via snapshot de hidratação; sem fetch novo ou mudança da busca. Regressão sem JavaScript e com JavaScript |
| QA-01 | Runner isolado aceitava build compilado com backend staging; trocar env em runtime não substitui `NEXT_PUBLIC_*`. A classificação ainda dizia PASS mesmo com falhas | Exigir URL/chave placeholder nos bundles antes de iniciar; leitura dos bundles server/client. Classificação agora respeita FAIL/BLOQUEADO. Teste de classificação e controle negativo com build staging |

Melhoria adicional: conflito da constraint de reserva repetida orienta a cliente a consultar seus agendamentos. A constraint já impedia duplicação entre profissionais: **não foi encontrado motivo para criar outra migration ou alterar essa regra**. Não corrigimos warnings antigos nem refizemos layouts estáveis. Permanecem dois warnings de variável sem uso nos geradores SQL anteriores, zero erros de lint.

## 5. Regressões adicionadas

`transport-recovery.test.ts`: rejeição/recuperação dos horários e resultado incerto da confirmação, sem dados privados nem novo dispatch. `booking-retry-sql.test.mjs`: repetição com qualquer profissional persiste uma única reserva; serviço arquivado, profissional desabilitado e horário de trabalho alterado rejeitam catálogo obsoleto sem novas linhas. Testes Auth: falha SMTP não afirma sucesso; resposta obfuscada não cria pendência falsa; cadastro novo continua no fluxo normal. Teste de mensagem de conflito e classificação do runner. E2E isolado ganhou preservação de campos e proteção antes da hidratação.

Fontes SQL históricas, migrations, Edge Functions, preços e dependências não foram alterados. Não há migration nova nesta candidata.

## 6. E2E e operação real

| Evidência desta missão | Resultado e limite |
|---|---|
| [Jornada final da cliente](adv20-integrated-journey.json) | **12 grupos PASS**, cliente nova, busca cidade/profissional, salão/serviço/profissional/slot, signup grátis, SMTP entregue e callback PKCE no browser original, draft preservado, duplo clique → uma reserva, reload/Voltar sem reserva extra, histórico, **diálogos reais de reagendamento e cancelamento**, WhatsApp manual interceptado antes de sair do app e avatar global em dois tenants legítimos |
| [Jornada fresca anterior](adv20-fresh-client-journey.json) | PASS separado, anterior à substituição do reagendamento/cancelamento por interação de UI; nessas etapas usava RPC + leitura de tela |
| [Perda de transporte/commit](adv20-network-after.json) | **12 grupos PASS**, inclui abort de horários, retry e resposta descartada após gravação real. Nenhum recibo falso; reserva encontrada no histórico |
| [Proprietária e mídia](adv20-profiles-media.json) | **16 grupos PASS**, contas novas confirmadas por SMTP, cliente sem workspace/plano, plano Equipe e trial exato de sete dias, perfil comercial, logo/capa/avatar com consentimento, troca/remoção, reload e isolamento; mesma identidade profissional também pode usar área cliente |
| [Bordas de Auth](adv20-auth-edges.json) | **5 grupos PASS**: telefone ausente/inválido, correção sem perder campos, conta existente, link real já usado negado com caminho de recuperação, cookie de sessão inválido sem acesso ao app. Link usado pode renderizar `status=error` com `otp_expired`, não necessariamente `status=expired` |
| [Financeiro](adv20-finance.json) / [estoque e pacotes](adv20-operational-modules.json) | **3 + 5 grupos PASS** por API/read models reais: lançamento idempotente, baixa/reembolso local, histórico, estoque/estorno/pacote e negativa de tenant/papel. Não é prova nova de cada formulário visual desses módulos; não envolve transferência de dinheiro |
| [Concorrência cloud](adv20-real-concurrency.json) | Dois usuários GoTrue, um slot real: um commit, um conflito `23P01` |
| [Readback de cleanup](adv20-cleanup-readback.json) | Exatamente duas reservas intencionais, ambas canceladas; nenhum órfão de reload/Voltar/duplo clique; serviços novos arquivados, horas novas removidas, settings/publicação dos dois salões restauradas e avatar novo removido |
| [E2E isolado](adv20-isolated-e2e.json) | **13 PASS**, build separado com placeholder, sem backend cloud. Inclui as duas novas regressões de UI. Não confundir com os E2E cloud acima |

Convite/aceite por SMTP e equipe profissional real permanecem provados na FINAL20, sobre o mesmo contrato; a profissional convidada foi reutilizada nesta missão e operou sua agenda/WhatsApp. Reuso de convite, escopo de recepcionista/admin, último dono e limites têm validação SQL nativa; não afirmamos novo clique de convite para cada papel nesta rodada. A expiração natural de JWT de uma hora com refresh/logout da FINAL20 continua válida: código de sessão não mudou. Cookie inválido e logins reais foram repetidos agora.

## 7. Stripe TEST

[Auditoria do provedor](adv20-stripe-provider-audit.json) **PASS**: os seis Checkouts reais anteriores — Solo, Equipe 5, Equipe 15, mensal/anual — continuam completos/pagos, invoices pagas, subscriptions ativas e vínculos corretos no app. Só GETs ao provedor nesta missão; nenhum Checkout foi pago novamente. Endpoint TEST e estado dos eventos invoice foram reconferidos.

[Replay direto](adv20-stripe-direct-replay.json) **PASS**: 12 POSTs com payloads reais de invoices TEST anteriores, assinados pelo runner e enviados exclusivamente ao staging. Uma linha por evento, período/plano/status preservados. Isso valida duplicidade e reconciliação de payload antigo, **não comprova retry automático do provedor**. [Negativos HTTP](adv20-webhook-negative.json): assinatura inválida, JSON inválido e evento LIVE assinado contra backend TEST retornam 400, sem novo evento nem alteração nas seis assinaturas.

Cancelamento no Portal hospedado e cartão TEST recusado têm prova real anterior em `docs/staging/final-billing-lifecycle-20261015.json`; não foram repetidos como novas transações nesta rodada. Falha assíncrona, status terminal, eventos fora de ordem, erro do SDK, trial e perda de entitlement foram reexecutados nos testes de Edge com adaptadores e PostgreSQL nativo. Esse limite é explícito: não chamar esses casos de nova transação end-to-end no provedor. Zero cobranças LIVE e zero mutações no provedor nesta missão.

## 8. Segurança e resiliência

**422 testes padrão PASS**: 255 unidade/contrato, 66 PGlite com identidade simulada, 16 mocks Stripe e 85 mocks de plataforma. **75 testes PG17 PASS**, incluindo 10 concorrentes e 11 integrações com Auth simulado; contagens se sobrepõem às regras exercitadas pela suíte padrão e não devem ser somadas como jornadas exclusivas. Cluster nativo encerrado. Evidências: [padrão](adv20-standard-tests.json), [nativo](adv20-native-tests.json), [concorrência](adv20-native-concurrency.json).

Cobertura: tenant/IDOR, papéis, preço/duração no servidor, convite/limites, serviço/profissional/agenda obsoletos, uploads inválidos e origem não autorizada, arquivos privados e leitura mediada pública, guest/unconfirmed negados, service role fora dos assets, duplicidade e status terminal. Falha física do Supabase/SMTP/Storage não foi provocada na infraestrutura compartilhada: foram usados abort real de transporte, erro real de validação/acesso e adaptadores de falha/timeout. Não alegamos interrupção real dos provedores.

As primeiras falhas foram preservadas, não convertidas silenciosamente em PASS: espera de links expirou durante interrupção da execução; outra tentativa tinha delimitador Markdown no link; isolamento com build staging produziu resultado cloud inesperado; um teste exigia `status=expired` embora a recuperação correta viesse como `status=error`. Foram corrigidas as premissas do harness. A tentativa com fixture reutilizada atingiu o limite real de 5/h e não criou reserva; mantivemos contadores e controles, usamos cliente/telefone novos. [Tentativa limitada](adv20-rate-limit-observed.json). Os relatórios finais PASS estão separados dos anteriores.

Lint **PASS, dois warnings preexistentes**; typecheck, build staging, build placeholder, smoke e E2E executados separadamente. CI da candidata consta no PR e na entrega, sem inventar resultado pendente.

## 9. Performance

[15 amostras mobile](adv20-performance.json), três por rota, Edge 390px, build de produção local contra staging, sem throttling. Medianas de navegação: home **308ms**, busca **581ms**, salão **569ms**, agenda **1502ms**, área cliente **915ms**. Máximos: 1959/960/569/2209/1133ms respectivamente. Nenhuma largura excedeu viewport nesses casos. JS codificado máximo observado por rota: cerca de 227/243/259/401/348 KB; cache pode zerar parte dos bytes. Inventário total dos 74 chunks: 2,58 MB, gzip 802 KB; **isso não é o payload inicial de uma rota**.

Medições anteriores à última proteção de hidratação; não são percentis de usuários reais nem benchmark de capacidade. [Índices e agregados de statements](adv20-indexes-statements.json) consultados em staging, sem textos/valores privados de queries. Não houve evidência suficiente para alterar índices ou consultas por performance. Falta carga representativa e tracing no piloto. A agenda semanal/UX mobile adicional está na #73, fora desta candidata; integrar e homologar a composição antes de alegar aprovação dessa versão.

## 10–11. Riscos restantes e migrations

Os cinco nomes continuam ausentes do histórico produtivo na reconferência direcionada; nenhum foi aplicado por esta missão. Renovar o preflight físico completo antes da janela:

1. `20261015054116_workspace_media_and_settings_contract.sql`
2. `20261015054818_workspace_settings_validation.sql`
3. `20261016075244_profiles_booking_whatsapp.sql`
4. `20261016235000_require_confirmed_public_booking.sql`
5. `20261020162935_launch_discovery_eligibility.sql`

Compatibilidade continua validada pelo ensaio 3+5 em PG17 com linhas preexistentes preservadas. Antes das cinco, faltam os três contratos legados já revisados: reviews/reschedule, FORCE RLS de reviews e reconciliação billing. Não reaplicar owner guard equivalente. Revisão de locks/ordem/REINDEX/timeouts e manifests permanecem em `docs/production-readiness/prelaunch20-migrations.md` e `prelaunch20-legacy-audit.md`. Nenhum SQL histórico foi editado.

Outros gates da RC20 continuam não resolvidos por esta missão: Auth/SMTP produtivos, publicação do webhook revisado e backup recente recuperável com bytes Storage. Não revalidamos genericamente esses painéis agora. As mudanças próprias desta missão ainda precisam publicação autorizada; aplicar SQL sozinho não publica as correções de UI. Risco adicional de integração: #73 também altera busca/reserva; preservar seus layouts/semântica ao incorporar estas proteções, testar o head combinado e não fazer merge automático.

## 12–13. Candidata e preparação técnica

Pacote final: head exato da PR draft, informado na descrição e na entrega para evitar autorreferência de hash dentro do próprio commit. Base e produção observadas: `2bdd3564a2ca2b24de9dd23bfd02de8aab3b3a86`. Branch possui `deploymentEnabled=false` antes do push. Fontes do Cursor preservadas na base; #71/#73 não foram sobrescritas ou publicadas.

**Estimativa técnica: aproximadamente 90/100**, restrita a código/staging: jornadas/operação 27/30; segurança/concorrência 23/25; resiliência 17/20; Stripe TEST 14/15; performance/preparação 9/10. É uma estimativa ponderada, não medição de probabilidade de sucesso ou readiness operacional. Não aumentar a porcentagem só por contar testes; limitações de provedor, carga, recuperação e produção permanecem gates absolutos.

## 14–16. Piloto, vendas e autorizações

**GO para continuar homologação em staging. NO-GO para piloto produtivo. NO-GO para lançamento comercial.** Checklist completo: [ADV20-RELEASE-CHECKLIST.md](ADV20-RELEASE-CHECKLIST.md). Piloto produtivo exige recuperação demonstrada, banco/Auth/SMTP/Edge/app alinhados, postchecks e smoke autorizados, zero P0/P1 aberto. Vendas exigem piloto monitorado aprovado, capacidade/erros acompanhados e contrato LIVE validado sob autorização própria; testes TEST não comprovam cobrança LIVE.

Dependem de autorização específica: backup/export produtivo e cópia; restore isolado; suspensão/drenagem; Auth URLs/SMTP; três legadas e cinco migrations; publicação Edge e aplicação no SHA aprovado; retomada; fixtures e smoke produtivos; teste HTTP negativo de webhook produtivo; eventual validação financeira LIVE; contenção/rollback com destino exato. Restore produtivo requer aprovação separada em desastre. Nenhuma dessas operações foi executada. Não houve merge, deploy, alteração de secret, cobrança real, exclusão de dados produtivos ou enfraquecimento de RLS.
