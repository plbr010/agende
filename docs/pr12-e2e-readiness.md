# Agendê — auditoria preparatória do PR #12

Data: 27/09/2026 UTC, iniciada em 26/09/2026 America/Sao_Paulo.
PR único: https://github.com/plbr010/agende/pull/12
Branch: codex/stripe-checkout-live → main. Sem merge e sem deploy manual.

**Não está liberado para primeira venda.** A auditoria local e anônima passou,
mas a aceitação autenticada no preview e o ciclo financeiro externo em sandbox
continuam BLOCKED. Não confundir testes locais com E2E externo concluído.

## Evidências e limites

Validação final local em Node 24.19.0: verificador de recuperação PASS,
npm test PASS (128 testes, zero falhas/skips), lint PASS, typecheck PASS,
build PASS (30 páginas) e git diff --check PASS. Cinco suítes SQL adicionais
passaram (99 cenários identificados). A primeira execução usou Node 20.17.0 do PATH e apresentou quatro
falhas por URL.parse; o runtime foi corrigido para satisfazer engines >=22.

Preview inicialmente auditado: agende-9p0ueiy7q-pedros-projects-cfddfd39.vercel.app,
deployment dpl_4ehrNK3D3XxmWtFbmvWohw7M3Qgz, SHA 392622b.
CI e Vercel desse SHA estavam aprovados/READY. O relatório final da sessão
informa o novo SHA e a verificação de CI/preview após push; estes resultados
iniciais não são apresentados como validação remota do novo commit.

- R: [reconciliação somente leitura](migrations/checkout-reconciliation-2026-09-27.md),
  [inventário remoto](migrations/remote-inventory-2026-09-27.json),
  [fontes v2](migrations/edge-v2-2026-09-27.json).
- U: npm test: testes TypeScript/React, adapters/actions e execução dos entrypoints
  reais em VM com mocks de Stripe/Supabase. A VM não tem fetch de rede.
- D: scripts/database.test.mjs: SQL real local para trials, billing, estoque,
  pacotes, financeiro e relatórios. Plataforma Auth/Storage emulada.
- S: node scripts/audit-local-flows.mjs: foundation, catalog, workspace_settings,
  agenda e public_booking. Cada suíte é executada em transação com rollback.
  [Resultados por cenário](evidence/pr12/local-flows.json).
- P: node scripts/audit-preview.mjs URL: GETs anônimos, sem submissão de forms.
  [Resultados por rota](evidence/pr12/preview-routes.json).
  Navegador também confirmou landing, login, seleção de cadastro profissional,
  perfil público inexistente e redirect de assinatura para login.
- L: leitura Stripe LIVE: seis preços ativos, Portal padrão e endpoint webhook.
  Nenhum customer, Checkout, assinatura, pagamento ou evento foi criado.
- E: sondagens sem autorização: billing recusou POST sem bearer com 401;
  webhook recusou POST sem assinatura com 400 stripe_signature_missing.
  Essas sondagens não validam acesso da chave privada ao Stripe.

PASS abaixo é limitado à evidência da linha. BLOCKED significa que falta a
aceitação externa, não que a função foi aprovada por inspeção de código.
Nenhuma sessão de usuário real foi utilizada. Não existe conta E2E/inbox
controlada validada nesta sessão, nem backend de staging isolado validado.

## Matriz funcional

| Função | Perfil | Resultado | Evidência / limite |
| --- | --- | --- | --- |
| Landing e navegação pública | Ambos | PASS | P e navegador, página carregada |
| Cadastro — seleção e formulário | Profissional/cliente | PASS | P, navegador; validações e intents no código |
| Cadastro real completo | Profissional/cliente | BLOCKED | Sem submissão, inbox de teste e confirmação externa |
| Confirmação de e-mail | Ambos | BLOCKED | P rejeita callback sem token; S bloqueia usuário não confirmado; entrega/link válido não exercitados |
| Login positivo e logout | Ambos | BLOCKED | P carrega login; redirects e guards em U; sessão real E2E não criada |
| Recuperação de senha | Ambos | FAIL | Não existem página, action resetPasswordForEmail ou updateUser de senha |
| Onboarding com e-mail confirmado | Profissional | PASS | S/D: criação atômica; acesso anônimo bloqueado em P |
| Escolha Solo/Equipe/Salão e trial | Profissional | PASS | D: 7 dias, planos válidos, segundo workspace sem novo trial |
| Dashboard autenticado | Profissional | BLOCKED | P comprova guard; render com dados de tenant não exercitado no browser |
| Agenda e slots | Profissional | PASS | S: jornada, pausas, bloqueios, intervalos e exclusão |
| Criar agendamento | Profissional | PASS | S: preço/duração derivados; cross-tenant e sobreposição negados |
| Editar/reagendar agendamento | Profissional | PASS | S: RPC real e bloqueio após conclusão |
| Cancelar agendamento | Profissional | PASS | S: cancelamento libera vaga |
| Status confirmado/em andamento/concluído | Profissional | PASS | S: transições e preservação de snapshots |
| Clientes | Profissional | PASS | S/U: criação, validação, imutabilidade de tenant e isolamento |
| Serviços | Profissional | PASS | S/U: catálogo, preço/duração, arquivados/inativos ocultos e RLS |
| Profissionais/equipe | Profissional | PASS | S: perfil, desativação/reativação, owner protegido |
| Disponibilidade | Profissional | PASS | S: jornada/pausa/bloqueio; recepção não altera jornada |
| Convites e roles | Profissional | PASS | S: e-mail vinculado, link secreto, expirado/usado, vagas e IDOR |
| Configurações do negócio | Profissional | PASS | S: owner/admin, slug reservado/duplicado, tenant e Storage emulado |
| Perfil profissional/público | Profissional | PASS | S/U: perfil e campos públicos; sessão browser autenticada pendente |
| Assinatura — tela e autorização | Profissional | PASS | U: 6 seleções, Portal condicional, owner/admin, vagas desconhecidas bloqueiam |
| Troca local de plano durante trial | Profissional | PASS | D: datas preservadas; excesso de vagas, expiração e vínculo Stripe negados |
| Estoque | Profissional | PASS | D/U: criar/editar/arquivar/reativar, entrada/saída/ajuste e saldo insuficiente |
| Pacotes | Profissional | PASS | D/U: catálogo, venda local, sessões, cancelamento/reversão e contratos |
| Financeiro | Profissional | PASS | D/U: receita/despesa, idempotência, pagamento local, estorno, cancelar/reabrir |
| Relatórios | Profissional | PASS | D/U: contrato real, agregação e períodos; não é conferência de receita Stripe live |
| Proteções role/tenant | Ambos | PASS | S/D/U: owner/admin/professional/receptionist/outsider/anon; P exige login |
| Área /cliente | Cliente | BLOCKED | P protege rota; ainda sem sessão browser dedicada |
| Próximos/histórico/visualização | Cliente | PASS | S lista somente próprios, oculta notas internas; U particiona próximos/histórico |
| /p/[slug] válido e catálogo público | Cliente | PASS | S: dados públicos/ativos e tenant; P/browser só perfil inexistente |
| Serviço/profissional/data/horário | Cliente | PASS | S/U: slots, preço de override, timezone, lead/horizon; navegador com catálogo dedicado pendente |
| Reserva pública | Cliente | PASS | S: RPC real, reutilização de cliente e impedimento de duplicata/sobreposição |
| Cancelamento permitido/proibido | Cliente | PASS | S: próprio, outro usuário, prazo e status terminal |
| Reagendamento — RPC | Cliente | PASS | S: reagenda próprio e nega outro cliente |
| Reagendamento — interface | Cliente | FAIL | ClientAppointments não oferece ação; só cancelamento e link público |
| Avaliações — elegibilidade/compositor | Cliente | PASS | U/código: somente concluídos, nota 1–5 e envio explicitamente bloqueado |
| Avaliações — salvar/publicar | Cliente | BLOCKED | Não implementado no estado atual; nenhum RPC de envio conectado |
| Agenda em fuso diferente de São Paulo | Profissional | FAIL | Agenda usa PRODUCT_TIMEZONE; configuração/público aceitam outros fusos. Divergência preexistente, fora da integração Stripe |
| Jornadas completas autenticadas no preview | Ambos | BLOCKED | Sem fixtures de autenticação/inbox isoladas; testes SQL não substituem browser autenticado |

## Matriz Stripe

| Função | Perfil | Resultado | Evidência / limite |
| --- | --- | --- | --- |
| Solo mensal R$89,90 / anual R$799 | Profissional | PASS | L: preços ativos BRL mês/ano; U: payload e render |
| Equipe mensal R$169,90 / anual R$1.499 | Profissional | PASS | L + U |
| Salão mensal R$299,90 / anual R$2.799 | Profissional | PASS | L + U |
| Abrir/completar seis Checkouts externos | Profissional | BLOCKED | Só LIVE conectado; nenhum Checkout live criado |
| Portal — configuração e adapter | Profissional | PASS | L + U: cartão, faturas, cancelar no fim; troca desabilitada |
| Portal — jornada autenticada externa | Profissional | BLOCKED | Falta sandbox/customer sintético isolado |
| Redirects e retorno de Checkout | Profissional | PASS | U: HTTPS/hosts exatos, sem credenciais/porta, retorno não ativa assinatura |
| Vagas 1/5/15 | Profissional | PASS | D/U: limites, RPCs e fail-closed; nova validação também na Edge |
| Trial longo/curto/últimos 5min/vencido | Profissional | PASS | U/D: trial_end, anchor sem proração, recusa perto do fim, sem reinício |
| Trial externo/primeira fatura | Profissional | BLOCKED | Aceitação financeira real exige sandbox |
| Idempotência e A → B → A | Profissional | PASS | U: chave estável no retry, nova chave após mudar seleção; limite 100 alinhado à v2 |
| Checkout simultâneo/duplicatas | Profissional | PASS | D/U: lease/token/expiração e recusa de assinatura existente; não comprova corrida distribuída real |
| Concorrência com Stripe e múltiplas instâncias | Profissional | BLOCKED | Requer sandbox e teste de carga/latência reais |
| Webhook HMAC, replay e evento antigo | Profissional | PASS | U: assinatura inválida/expirada, estado atual prevalece e retries; E sem assinatura =400 |
| Renovação e invoice.paid de valor zero | Profissional | PASS | U/D: estado/período atual; trial não reativado por fatura antiga |
| past_due/falha/recuperação | Profissional | PASS | U/D: mapeamento e entitlements locais |
| Cancelamento | Profissional | PASS | L: ao fim do período; U/D: canceled não reativa via invoice antiga |
| Ressincronização | Profissional | PASS | U: leitura atual no replay, binding e preço; falhas retornam 409 |
| Entrega real de webhook e leitura privada de assinatura | Profissional | BLOCKED | Sem evento sandbox assinado; permissões da chave de produção não exercitadas |
| Pausa/retomada | Profissional | BLOCKED | Handlers existem; endpoint live não inscreve paused/resumed; Portal não oferece pausa |
| Troca de plano já vinculado ao Stripe | Profissional | BLOCKED | Portal live deliberadamente sem subscription_update; não há fluxo externo validado para mudança |

## Bugs corrigidos e achados preservados

1. Migration local tinha timestamp diferente do aplicado: rename exato, snapshot
   novo e verificador estrito. Não houve mudança de SQL.
2. Validador de redirect usava URL.parse também no browser: new URL com catch
   mantém fail-closed e compatibilidade. Regressão cobre ausência de URL.parse.
3. Seleção A → B → A reutilizava chave de sessão expirada: tentativa passa a guardar
   somente a última seleção; retry da mesma seleção continua idempotente.
4. Schema aceitava chave até 200 caracteres, enquanto v2 usa até 100: alinhado
   no frontend/action, com teste que impede invocação para chave de 101.
5. Testes SQL legados tinham assinaturas antigas, uma reserva duplicada agora
   proibida e um caso dependente do horário de execução. Fixtures atualizadas,
   grants/RLS de Storage emulados e suites isoladas por rollback.

A limpeza legada por DELETE de workspace falhou localmente com entitlement e
FK de audit_events durante cascata. O runner novo usa rollback e não chama
esse DELETE. Não afirmar que remoção de fixtures em produção está validada.
Não houve alteração nos triggers/migrations para ocultar esse achado.

Recuperação de senha, interface de reagendamento, publicação de avaliações e
fuso da agenda são achados preexistentes. Não foram transformados em novos
projetos de implementação dentro deste PR de integração Stripe.

## Dados, segurança e primeira venda

Zero dados E2E persistentes criados em Supabase/Stripe/preview. Os usuários
@agende-*.test, workspaces, convites, clientes, serviços, reservas, estoque,
pacotes, finanças e assinaturas sintéticas existiram somente no PostgreSQL
em memória. As suítes S fazem rollback sempre; D fecha/descarta o banco.
Os objetos Stripe são mocks em VM. Não foram lidas chaves do Vault.

Leitura remota confirmou RLS em todas as tabelas public e lease executável
somente por service_role. Advisors sinalizaram funções SECURITY DEFINER
intencionalmente públicas/autenticadas, lease com RLS sem policy (server-only)
e proteção de senhas vazadas desabilitada. Testar autorização é necessário;
a simples presença de RLS não certifica todas as combinações possíveis.
Referência: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

Para liberar a primeira venda:

1. Disponibilizar sandbox Stripe isolado e executar os seis pagamentos de teste,
   trial curto/longo, Portal, renovação, falha/recuperação, cancelamento,
   concorrência e webhook/replay com dados sintéticos.
2. Executar jornadas autenticadas de profissional e cliente em preview com
   Auth/inbox/fixtures isolados e limpeza comprovada, incluindo confirmação,
   logout, onboarding e CRUD pelo navegador.
3. Implementar recuperação de senha; corrigir ou restringir de modo explícito
   fusos de agenda suportados. Definir escopo de lançamento para reagendamento
   pelo cliente e avaliações (hoje incompletos).
4. Validar permissão server-side de leitura de subscriptions, destino/retornos
   e observação/reentrega de 409 em sandbox. Não extrapolar sucesso dos mocks.
5. Fazer revisão humana do PR e rollout do frontend depois da aceitação.
   Este trabalho não autoriza nem realiza merge. Backend v2 já corresponde ao PR.

A lacuna histórica 20260919201138 continua limitando uma reconstrução completa
do schema. Não reaplicar migrations para tentar contorná-la.
