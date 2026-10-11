# Homologação operacional — 11/10/2026

Estado anterior ao provisionamento autorizado. Para resultados posteriores em staging real e sandbox TEST, consultar [relatório atual](../staging/README.md).

**NO-GO.** A entrega anterior (#27) foi integrada pelo responsável em main `d20d6fd518d4b13840a5d31ef6f0b65b4c707d6d`. Ela corrigiu a lista vazia após reagendamento salvo e leitura posterior com falha; a correção e os testes foram preservados. Branch desta etapa: `codex/operational-acceptance`. Nenhum componente visual ou branch do Cursor foi alterado.

## Evidência atual e alcance

Consultas remotas somente leitura nesta rodada: Supabase Agendê `wohimauqgywshbbejjcl` ACTIVE_HEALTHY, PG17.6.1.166; apenas este projeto ativo e PetGestor inativo, sem projeto de staging disponível. Histórico continua com 63 migrations e as cinco pendências listadas em `migration-plan.json`. As 31 tabelas públicas têm RLS e FORCE RLS. `appointment_reviews` e `list_my_reschedule_slots(uuid,uuid,date)` continuam ausentes. Não inferir que grants/triggers/policies passaram apenas por esse resumo: o inventário completo anterior está em `../stability/remote-recheck.json` e deve ser comparado novamente antes de aplicação remota.

Stripe: única conexão disponível `acct_1UH3D6Kii3CCJXtc`, LIVE. Nenhum sandbox TEST acessível. GET do Portal `bpc_1UJovBKii3CCJXtcbHEUcBZm` reconfirma ativo, troca de assinatura desativada e cancelamento no fim do período, sem proração. `trial_update_behavior=end_trial` continua configuração inativa da troca desabilitada; não tratá-la como trial atualmente interrompido. Webhook permanece evidência histórica, não foi reconfirmado nesta rodada. Nenhuma transação ou alteração Stripe realizada.

Vercel: produção READY `dpl_AaDBBEnuhfFVTPuvDsDz1astdaGH`, commit main acima. Isso comprova publicação, não funcionamento autenticado. Bindings, domínio, SMTP e backup permanecem sem novo aceite nesta rodada; consultar o relatório anterior, sem tratar observações históricas como atuais.

## Jornadas solicitadas

| Jornada | Cobertura local existente | Aceite real nesta rodada |
|---|---|---|
| Profissional, passos 1–13 | SQL de perfil/trial único, salão, catálogo, horários, reserva, reagendamento, cancelamento, conclusão, financeiro e relatórios; actions via transporte simulado | BLOQUEADO: Auth, confirmação/SMTP, PostgREST e navegador isolados ausentes |
| Cliente, passos 1–11 | SQL e actions de reserva, listagem, reagendamento, cancelamento e avaliação única | BLOQUEADO: cadastro/confirmar e jornada autenticada real |
| Assinatura, passos 1–10 | SQL de trial/entitlements/assentos/replay e mocks Edge/Stripe | BLOQUEADO: Checkout, webhook externo, Portal e test clocks TEST |

Novo teste de integração exercita actions reais de cancelamento/reagendamento e RPC financeira sob role anon sem identidade e identidade estrangeira; exige erro, ausência de payload financeiro e snapshot de agendamentos inalterado. A identidade JWT é fixture SQL, não sessão expirada real GoTrue. A regressão de falha de leitura após gravação e as oito concorrências PostgreSQL existentes são preservadas. Nenhum novo defeito de aplicação foi confirmado nesta etapa; não atribuir correção a simples ampliação de teste.

Resultados desta rodada ficam nos JSON de `../homologation/`: padrão, nativo, concorrência e versão/encerramento do cluster. Os casos SQL/integração repetidos entre PGlite e PG nativo não devem ser somados como casos únicos. Smoke é GET anônimo local. Não há skips que representem aceite externo: essas jornadas não foram executadas e estão BLOQUEADAS.

Executado: npm ci, lint, typecheck, npm test (**238 PASS**: 135 unitários/contratos, 54 mocks plataforma, 12 mocks Stripe, 26 SQL PGlite, 11 integração SQL com Auth simulado), build Next16.3.8, smoke (**32 PASS**), PostgreSQL17.6 (**45 PASS**: 26 SQL, 11 integração com Auth simulado, 8 concorrências) e cinco suítes SQL. Zero falhas/skips nos testes executados. Audit de dependências de produção: zero vulnerabilidades; npm ci continua apontando cinco alertas HIGH de desenvolvimento já conhecidos, sem atualização forçada. Snapshot histórico Stripe e plano de migrations foram verificados offline. O cluster sintético é encerrado pelo runner e seus dados permanecem fora do Git.

## Sequência de aprovação individual

Cada linha precisa de aprovação própria, evidência e responsável antes da seguinte. Uma aprovação não autoriza pagamentos LIVE ou merge.

| Etapa | Operação proposta e critério de conclusão | Recuperação / parada |
|---|---|---|
| A1 | Confirmar US$0 e cota; criar Supabase Free separado, schema Git e fixtures sintéticas | Sem adicionais pagos; parar se houver custo ou destino produtivo |
| A2 | Criar/conectar sandbox Stripe; seis preços TEST e webhook exclusivo staging | Rejeitar livemode; nenhum objeto LIVE alterado |
| A3 | Configurar somente Preview para staging, URLs Auth, e-mail de teste e Stripe TEST | Guard de produção mantido; salvar bindings anteriores sem expor secrets |
| A4 | Executar todas as jornadas e negativos de STAGING-ACCEPTANCE.md no navegador/API real, anexar IDs e evidências sem tokens | Falha P0/P1 impede avanço; corrigir backend nesta branch, encaminhar falha visual ao Cursor |
| A5 | Comprovar backup, retenção, RPO/RTO e restore em destino isolado | Não aplicar produção sem recuperação demonstrada; nenhum dado produtivo copiado sem autorização |
| A6 | Aprovar hashes das cinco migrations, janela e executor; aplicar uma por transação na ordem do runbook | Divergência/timeout: rollback e parar; nunca repair por suposição |
| A7 | Aprovar deploy Edge e configurações produtivas Auth/SMTP/Portal após ciclo TEST | Versão anterior registrada; retorno não desfaz faturas ou eventos |
| A8 | Aprovar domínio/DNS/origem canônica, confirmar TLS/callbacks/retornos | Manter alias anterior e registrar DNS; não inventar IP ou contratar domínio |
| A9 | Revisão humana e merge/publicação autorizados, smoke e jornadas sintéticas autorizadas | Release compatível anterior; correção aditiva após COMMIT |
| A10 | Responsável monitora em 15/30/60min: 5xx, Auth, retries/atraso webhook, entitlements, reservas e cobrança | Falha de ativação/isolamento suspende novas vendas; emergência remota requer aprovação |

GO exige A1–A10 concluídas, zero P0/P1 abertos e evidência de backup recuperável, isolamento, schema/API, Auth/SMTP, ciclo Stripe TEST e origens consistentes. **P0:** ambientes ausentes, cinco migrations pendentes e ausência de aceite externo. **P1:** backup/restore, domínio/origens, Portal e operação/monitoramento ainda sem aceite. Build e SQL locais não autorizam lançamento comercial.

Plano de custo gratuito, limitações SMTP e alternativa local em ZERO-COST-STAGING.md. Instalação Docker/WSL não foi autorizada; PostgreSQL portátil não fornece Auth/SMTP/PostgREST. Solicitações de criação Free e sandbox estão pendentes; falta de resposta não autoriza provisionamento.
