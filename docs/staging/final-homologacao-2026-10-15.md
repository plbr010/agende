# Agendê — homologação final de 15/10/2026

**Parecer comercial: NO-GO.** O staging funciona nas jornadas abaixo; produção ainda carece de oito migrations e de recuperação real comprovada. Nenhuma migration, configuração Auth, segredo, variável ou pagamento LIVE produtivo foi alterado. Não houve merge automático.

## Base e alterações

Checkout exclusivo `agende-final-20261015`, branch `codex/final-homologation-2026-10-15`, iniciado em `de15980` após PRs #49–#52. Os outros checkouts e o processo do Cursor foram preservados. A main recebeu o PR #53 (`24d35c9`) durante a execução e foi integrada. Somente o relatório gerado de testes conflitou; foi regenerado com327 PASS, sem editar o código visual do Cursor.

Não foi necessário modificar telas ou contratos de produto. As falhas reproduzidas eram dos executores:

- `staging-modules.mjs`: reserva anônima associava outro contato e a tentativa de resgate corretamente retornava `package_client_mismatch`. O teste agora usa identidade confirmada, seleciona o contato vinculado ativo mais antigo e verifica o `client_id` da reserva. A limpeza de reserva usa a sessão do cliente.
- `staging-browser.mjs`: passou a testar login obrigatório, rascunho HttpOnly, revalidação do horário, recibo atual e persistência de uma única reserva. Pode usar o profissional recém-confirmado por SMTP e seu único workspace/trial, isolando a rodada das quotas das fixtures compartilhadas. Preserva todos os campos de configuração ao preparar/restaurar publicação e verifica a restauração real. Capturas novas usam a data da execução; e-mail e senha do ator ficam redigidos nos erros.
- `staging-auth-final-browser.mjs`: valida build exclusivamente staging, confirmação de e-mail obrigatória e disponibilidade da porta antes de criar contas. Usa Next próprio em `::1:3000`, navegador resolvendo `localhost` para IPv6, e observador do processo; mantém callbacks em `http://localhost:3000`. O Cursor ocupa IPv4 nessa porta e não foi parado. PKCE continua obrigatório.
- `staging-preview-avatar-config.mjs`: exige branch explícita `codex/...`, validada antes de interpolação no CLI; credencial staging permanece somente no servidor e no Preview daquela branch.
- Novos executores cobrem pagamentos hospedados, Portal/recusa, cartão de renovação, replay de eventos reais e expiração natural de sessão. Todos exigem o projeto staging exato; scripts financeiros recusam sessões LIVE. Links e credenciais ficam em arquivos ignorados; evidências públicas não contêm esses valores.

## Matriz de jornadas reais

| Jornada | Resultado | Evidência e limite |
|---|---|---|
| Cadastro novo pelo formulário, e-mail e confirmação PKCE | PASS | `final-auth-owned-20261015.json`; POST observado pelo processo próprio, código/verificador e cookie de sessão, mesma origem, sem confirmação administrativa |
| Login → onboarding → trial → dashboard | PASS | Conta nova confirmada por SMTP; membership owner e trial de exatamente 604.800 segundos persistidos |
| Recuperação, senha anterior/nova, sessão e logout | PASS | `final-auth-owned-20261015.json`: repetição completa em servidor próprio; primeira tentativa e limitação de IPv4 preservadas no relatório anterior |
| Link aberto em outro navegador | PASS da proteção PKCE | Sem verificador: recusado e sem sessão; redefinição feita somente no perfil de origem |
| Links reutilizados | PASS | Confirmação e recuperação reais recusam segundo uso |
| Expiração natural JWT + refresh | EM EXECUÇÃO | `final-session-20261015.json`; espera real de 3.600 s; nenhum relógio, token ou configuração Auth alterado. Não contar RUNNING como PASS |
| Serviços, equipe/permissões e disponibilidade | PASS | `real-api-results.json`; GoTrue/PostgREST e persistência, com negativas de outro salão |
| Reserva pública, confirmação na agenda, busca cidade/nome e consentimento | PASS | `browser-functional.json`: oito etapas de navegador com backend real; `discovery-real-api.json`: sete grupos; fixture de publicação restaurada |
| Estoque, pacotes e financeiro | PASS | `modules-real-api.json`: cinco grupos; resgate único, estorno e saldo. Financeiro/idempotência em `real-api-results.json` |
| Favoritos, cidade opcional, histórico e acesso privado a fotos | PASS | `client-phase2-real-tests.json` e `client-phase2-avatar-http.json`: upload/leitura/substituição/remoção, limpeza dos bytes antigos e negativas de Storage/CSRF |
| Seis preços, Checkout e pagamento TEST | PASS | `final-checkout-payments-20261015.json`; Solo/Equipe/Salão mensal/anual, cartão TEST 4242, seis sessões `cs_test_` e eventos reais |
| Persistência, entitlement e isolamento de assinaturas | PASS | `billing-access-verification.json`: ativos permitem operação; `canceled`/`past_due` recusam; outro tenant não lê nem escreve |
| Customer Portal, troca de plano e cancelamento | PASS | Portal real confirma cancelamento programado mantendo acesso pago; avanço do relógio TEST até o fim do período confirmou `canceled` e escrita negada. Solo→Equipe via API TEST persistiu após webhook. Cancelamento imediato também persistiu `canceled` |
| Pagamento inicial recusado e renovação com falha | PASS | Cartão TEST de recusa não ativa assinatura. Cartão off-session TEST salvo no Portal; relógio TEST avançado pelo Stripe resultou em `past_due` em Stripe/Supabase e `invoice.payment_failed` de R$169,90 |
| Replay seguro de eventos reais | PASS de integração direta | `final-event-replay-20261015.json`: 12 eventos reais TEST, duas entregas assinadas por evento, uma linha persistida; eventos pagos antigos preservam plano e estados atuais `canceled`/`past_due` |
| Reenvio pelo Dashboard/CLI do próprio Stripe | BLOQUEADO nesta rodada | Conector disponível não oferece operação de reenvio e não há sessão Dashboard conectada. Replay assinado pelo executor não é apresentado como reenvio do provedor. Há prova histórica distinta de 14/10 |
| Backup/restore criptografado sintético | PASS limitado | `../production-readiness/final-synthetic-restore-20261015.json`: integridade, roles, Auth SQL, schemas, sequências e rejeição de adulteração; 11,396 s para fixture pequena, sem projeção de RTO produtivo |
| Backup recuperável de produção e rollout | BLOQUEADO | Export anterior falhou na autenticação; não redefinimos senha. Nenhum restore produtivo ou de backup produtivo foi executado nesta rodada |

## Execuções obrigatórias

Node 24.19.0 e npm via `npm-cli.js`, evitando o wrapper local que usa Node20. Logs em `../homologation/final-20261015/`.

| Comando | Resultado observado |
|---|---|
| `npm ci` | PASS — 406 pacotes instalados |
| `npm run lint` | PASS após integração e na repetição final; lint específico dos últimos executores registrado separadamente |
| `npm run typecheck` | PASS |
| `npm test` | PASS — 327, zero falhas/skips após integrar PR #53; 326 na base inicial |
| `npm run build` | PASS — build staging integrado com cache novo; Preview Vercel READY |
| `npm run test:postgres` | PASS — 49 casos PG17 e suítes SQL; cluster próprio parado |
| `npm audit --omit=dev` | PASS — zero vulnerabilidades |
| `npm audit` completo | FAIL — cinco HIGH na cadeia de lint/dev; proposta automática exige downgrade incompatível de eslint-config-next para14.2.35 e não foi aplicada |

Não somar testes SQL repetidos em PGlite/PG17 como casos únicos. Mocks e fixtures SQL estão identificados no relatório padrão e não comprovam SMTP, Stripe ou Storage. O primeiro `npm test` teve uma falha EACCES no loopback do sandbox; a repetição com rede passou. O primeiro PG17 não tinha caminho do binário configurado; a repetição com PG17 explícito passou. O browser inicialmente procurou Chromium ausente; passou usando Edge instalado. As expectativas antigas de logout e texto de recusa foram corrigidas no executor, sem alterar o produto. O build integrado encontrou falha interna do worker CSS/Turbopack também fora do sandbox; um cache novo resolveu, preservando o cache anterior em pasta ignorada, sem trocar bundler ou dependências.

A repetição da reserva na fixture compartilhada foi recusada corretamente pelo limite de5/hora; não alteramos limites ou eventos. `final-browser-main-rate-limit-20261015.json` preserva essa tentativa. O teste completo integrado passou em workspace isolado do profissional criado por SMTP nesta rodada, com a mesma autenticação/RLS e todas as validações. A UI gerencia o primeiro workspace do usuário; o executor recusa um ator com múltiplos workspaces no modo isolado. Selecionar outro workspace só pela API não muda o contexto da UI.

## Infraestrutura e integração com Cursor

O Preview desta branch recebeu somente bindings próprios de staging: URL, publishable key e service role server-only. O valor do segredo não foi impresso. Os bindings compartilhados de Preview/Development ainda apontam para produção; o guard existente continua recusando esse backend fora de Production. Não removê-lo: novas branches precisam de overrides staging. As variáveis Production ficaram intactas.

Na revisão integrada `6bedaf6`, o Preview `agende-lme3386lk-pedros-projects-cfddfd39.vercel.app` passou nos seis grupos de avatar HTTP real (`stabilization-preview-avatar-http.json`). A inspeção de17 assets JavaScript públicos e HTML não encontrou o valor da service role; o vínculo staging foi comprovado pelas operações reais de Auth/Storage, sem exigir URL Supabase em bundles de formulários que usam server actions (`final-preview-credential-boundary-20261015.json`).

O Vault staging contém exatamente um `stripe_api_key` e um `stripe_webhook_secret`; classificação segura confirmou `rk_test` e segredo de assinatura, sem revelar valores. Seis preços ativos BRL foram consultados no sandbox `acct_1UPNGJQQUyqAaZvS`. Nenhum preço foi criado/alterado.

Cursor: preservar telas, ilustrações e layout do PR #53. Não reintroduzir reserva anônima para consumir pacote vinculado; não substituir PKCE por OTP/bypass. O callback precisa manter esquema/host/porta e o contexto do navegador. Usar os contratos já versionados em `docs/codex/frontend-backend-contract.md`. Quando testar localmente junto do Cursor, usar o executor IPv6 próprio; não mudar automaticamente a porta ou matar o processo IPv4. Nenhuma alteração visual é solicitada por este PR.

Dados sintéticos foram cancelados/arquivados pelas operações autorizadas; histórico, avaliações e transações foram preservados. A reserva residual da primeira falha de pacote foi cancelada como seu próprio cliente (`final-fixture-cleanup-20261015.json`). Capturas antigas modificadas pela execução inicial foram preservadas fora do commit; novas evidências são datadas.

## Bloqueadores comerciais

1. Aplicar somente após autorização específica as oito migrations e dependências do [procedimento de produção](../production-readiness/FINAL-ROLLOUT-2026-10-15.md), precedidas por backup recuperável real. Bucket de avatars e `stripe_api_key` ausentes em produção; revisar diferenças de versões/configuração das Edge Functions sem modificar LIVE.
2. Comprovar backup real cifrado, cópia independente e restauração isolada, incluindo cobertura separada de Storage/configuração externa; a credencial existente deve ser fornecida pelo mecanismo seguro local, nunca pelo chat. Sem reset de senha.
3. Conferir configuração e jornada produtiva em janela autorizada. HTTP200 nas páginas públicas não comprova onboarding, serviços, favoritos ou busca com schema produtivo defasado.
4. Revisar alertas de segurança e operação: [proteção contra senhas vazadas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) desativada (decisão de plano/configuração produtiva depende do proprietário); funções SECURITY DEFINER públicas são wrappers intencionais e exigem [revisão individual de EXECUTE](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), sem revogar permissões indiscriminadamente. RLS sem política nas filas privadas é negação por padrão. Ver `final-security-20261015.json`.
5. Encerrar a expiração natural e registrar resultado; conferir retries pendentes do provedor e, se necessário, reenvio oficial de eventos TEST. Não executar cobranças LIVE para homologar.

Os bloqueios produtivos permanecem mesmo com todos os testes de staging aprovados.
