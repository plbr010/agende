# Agendê — homologação integrada final, 20/10/2026

**Prontidão estimada: 90/100 da preparação técnica. Produção: NO-GO para piloto e lançamento comercial.** Critério ponderado: quatro funcionalidades críticas 15 pontos cada (60/60), fluxos comerciais e operacionais (20/20), qualidade da candidata (10/10; CI da implementa��o aprovado, conferir checks do head final), publicação e validação produtivas (0/10). A porcentagem mede evidências entregues, não probabilidade de sucesso. O gate crítico de segurança prevalece sobre a pontuação.

## Auditoria e integração

Repositório `plbr010/agende`; base main `f8d02125f8c8edc7d67891e3c8a50a520d0bfacc` já inclui PR #66. Vercel observado nesse SHA: `dpl_79fqsAy7uRRkRQ5crYQYm19j2inL`. Branch própria `codex/final-launch-integration-20261020`. Integrado o head Cursor #67 `3c25bb02dde44b1859be9e46e37474e3a3565f6a` via merge `64c1c92`, com dois conflitos resolvidos. Main e branch Cursor preservadas. Ver [contrato de integração](../codex/final20-cursor-integration-contract.md).

| Funcionalidade | Candidata + staging | Produção auditada, somente leitura |
|---|---|---|
| Autenticação obrigatória na reserva | Implementada, integrada e testada | Bloqueada por schema/permissões: anon ainda autorizado e fallback guest presente |
| Busca cidade/estabelecimento/profissional | Implementada, integrada e testada | Parcial: falta migration de elegibilidade |
| Logo/capa/fotos/cliente global | Implementada, integrada e testada | Parcial: faltam contrato de mídia e fotos profissionais privadas |
| WhatsApp manual autorizado | Implementada, integrada e testada | Bloqueada por RPC ausente |

Os problemas anteriores foram principalmente divergência entre código e schema publicado, além da interface Cursor ainda não integrada. Encontrado e corrigido nesta candidata: falha de imagem persistia após mudar a pessoa/URL, ocultando uma foto válida. Dois testes reproduziram a falha antes da correção. Não houve alteração especulativa em áreas estáveis de cobrança.

## Evidência real e limites

- Cadastro de proprietário e cliente por formulário; e-mails reais entregues via SMTP e lidos na caixa conectada; confirmação com PKCE no navegador de origem, sem confirmação administrativa. Proprietário escolhe Equipe e cria estabelecimento com trial real de sete dias. Cliente gratuito sem estabelecimento, membership ou trial indevido. Recuperação por e-mail real, recusa em outro navegador, senha anterior rejeitada, link consumido não reutilizável, login/reload/logout reais: `final20-profiles-media.json`, `final20-recovery.json`.
- Convite e cadastro de profissional, aceite, acesso à agenda sem assinatura individual e financeiro negado: `final20-employee-signup.json`.
- Logo/capa e avatares: upload, substituição, remoção, persistência e bytes; foto profissional na edição e após reload; avatar global do cliente visível em dois estabelecimentos com vínculo legítimo, tenant/profissional alheio negados e bucket privado: perfis/mídia e `final20-integrated-journey.json`.
- Busca real em fixtures controladas de Muriaé e Juiz de Fora; estabelecimento/profissional, acentos, caixa, espaços e cidade combinada, inclusive negativos; URL leva à reserva. Nenhum negócio real inventado: `final20-integrated-discovery.png` e jornada integrada.
- Serviço cadastrado pela interface com preço/duração/vínculo persistidos; escolha anônima preservada em draft HttpOnly; RPC anônima negada numa vaga disponível; cadastro/confirmação entregue retorna à escolha sem criar reserva durante autenticação. Duplo clique cria uma única reserva; cliente e equipe veem status real, reagendamento/cancelamento preservam histórico.
- A prova de cadastro novo dentro da reserva está nas tentativas anteriores; a execução final completa reutiliza esse cliente já confirmado e comprova login com novo draft (`reused_confirmed_fixture: true`). As tentativas retidas registram falhas de seletores/interceptação do runner, corrigidas sem mascará-las como PASS de execução única.
- WhatsApp: clique real, servidor responde 302 com número internacional e mensagem autorizada, nome/serviço/profissional/emoji/status corretos, sem mudar status; cancelado negado. Na execução final, resposta capturada antes da navegação externa. Tentativas anteriores chegaram ao redirecionamento externo do WhatsApp; não houve clique de envio ou mensagem automática. Não alegamos zero requisições externas em todas as tentativas.
- Concorrência cloud com dois usuários reais de GoTrue/PostgREST: exatamente uma reserva, outra recebe `23P01`; adicionalmente dez casos concorrentes em PostgreSQL nativo: `final20-real-concurrency.json`.
- Financeiro: receita idempotente, pagamento PIX somente contábil local, reembolso parcial/integral, leitura real, despesa/cancelamento/reabertura, profissional e tenant alheio negados. Estoque: entrada/saída/ajuste, saldo negativo negado; pacote vendido, conclusão exigida, consumo único e reversão: `final20-finance.json`, `final20-operational-modules.json`. Nenhum pagamento externo nesses testes.
- Stripe: seis Checkouts TEST já criados na primeira missão, planos Solo/Equipe/Salão mensal e anual, todos completos/pagos, invoices pagas, assinaturas ativas vinculadas; cancelamento ao fim do período observado. Auditoria desta missão só leu o provedor. Todos os seis eventos agora têm `pending_webhooks=0`; o primeiro snapshot tinha cinco pendentes. Replay direto autenticado dos eventos TEST reais no webhook staging, duas vezes por evento: uma linha por evento e estado de assinatura inalterado. O replay isoladamente não prova retry automático; a leitura posterior do provedor comprova que não restavam entregas pendentes, sem inferir qual endpoint respondeu a cada tentativa. Portal e cancelamento de ponta a ponta têm evidências da primeira missão, não foram recriados nesta. Ver `final20-stripe-provider-initial-audit.json`, `final20-stripe-provider-audit.json`, `final20-stripe-direct-replay.json` e relatório da PR #66.
- Webhook staging versão 4 ACTIVE tem fonte normalizada idêntica ao repositório, incluindo invoice moderna e guarda para ordem de eventos. Logs agregados da janela de cobrança tiveram 200 e 409; não há evidência suficiente para atribuir cada 409 a um evento específico. Nenhum deploy de billing foi feito para ocultar retries: `final20-webhook-source.json`.
- Sessão: teste real de expiração natural em andamento na preparação inicial da PR; resultado final será anexado em `final20-session-lifecycle.json`. Não usa relógio/JWT/Auth adulterados. A aprovação final depende desse resultado.

## Verificação e arquivos

410 testes locais passaram (incluem unidade, contratos estáticos, componente simulado e PGlite com Auth simulado; não são 410 jornadas E2E). 70 casos em PostgreSQL 17.6 nativo passaram, incluindo dez concorrentes; Auth simulado nessa suíte. Evidências novas separadas dos snapshots históricos: `final20-standard-tests.json`, `final20-native-tests.json`, `final20-native-pg17.json`, `final20-pg17-concurrency.json`.

Lint, typecheck, build Node 24 contra staging, smoke do build e integridade das migrations passaram localmente. CI da PR é o registro definitivo para instalação limpa Node 22, auditoria de dependências produtivas, checks de schema, build e E2E isolado; o step staging do CI sem opt-in não equivale aos testes cloud reais acima. Não há Preview Vercel publicado desta branch: navegador real usou Next local com Supabase staging.

Mudanças funcionais específicas: `src/components/people/person-mark.tsx`, seu novo teste, seletor do runner de lançamento e `vercel.json` para impedir deploy automático da candidata; integração Cursor contém recibo por status, busca por URL e interface de perfis/telefone. Nove runners `scripts/staging-final20-*.mjs` e evidências `final20-*` permitem revisar o escopo. Credenciais, tokens, links de e-mail, dados de sessão e URLs de checkout ficam em arquivos locais ignorados. `git diff` da PR apresenta o conjunto completo de arquivos, inclusive os herdados do merge Cursor.

## Pendências produtivas e liberação

Não há migration nova nesta candidata. Faltam em produção as cinco migrations existentes de mídia/settings, validação, perfis/WhatsApp, reserva autenticada e elegibilidade; lista ordenada no [plano de publicação](../production-readiness/final20-release-plan.md). Auditoria fresca: `final20-production-readonly-audit.json` versus `final20-staging-audit.json`. RLS forçada preservada.

Nenhum segredo produtivo foi alterado. Metadados anteriores confirmaram URL/chave pública e service role no servidor; origem canônica/redirects devem ser validados na janela de release. Não inventamos variável faltante para explicar RPC ausente. Produção ainda aceita reserva anônima pelo catálogo auditado, portanto não liberar usuários reais agora.

Precisa de autorização específica para aplicar as migrations revisadas em produção e publicar o SHA final aprovado; merge em main aciona publicação. Antes disso: backup/preflight, revisão e CI verde. Depois: smoke produtivo autorizado e observação, só então GO para piloto; lançamento comercial após gates do piloto. Não cobrar live, alterar secrets ou restaurar banco implicitamente.

Dados preexistentes foram preservados. Novos agendamentos sintéticos foram cancelados quando permitido ou mantidos como histórico concluído; novos serviços/pacotes/produtos arquivados, somente horários e arquivos criados pelo runner removidos, settings anteriores restaurados. Contas sintéticas da missão foram mantidas para rastreabilidade. Nenhuma escrita em produção.

Leitura autenticada final confirmou limpeza e restaura��o nos dois estabelecimentos: `final20-cleanup-readback.json`. Instru��es e limites de reprodu��o: `final20-reproduction.md`. PR criada como rascunho: https://github.com/plbr010/agende/pull/68. Nenhum merge produtivo autorizado ou realizado.
