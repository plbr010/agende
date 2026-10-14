# Estabilização após PR #49 — 14/10/2026

Base `165f5f5` (merge do PR #49); branch `codex/stabilization-post49-2026-10-14`.
Checkout original `agende-client-phase2`, branch `codex/client-phase2-2026-10-14`, HEAD `cf9114b`, estava limpo e foi preservado. Novo checkout em `agende-stabilization-20261014`. Main atualizada por fetch; nenhum merge automático.

## Correções

- **Foto após commit incerto:** uma resposta de erro da RPC pode ocorrer depois de a referência ter sido persistida. A API não remove mais o upload nesse caso. A lease existente preserva o retry; a fila exclui referências atuais. Falha confirmada de compare-and-swap continua removendo o upload que perdeu a disputa. Regressão executa o endpoint simulando perda de resposta após commit, sem confundir isso com Storage real.
- **Destino de autenticação:** cadastro sem destino válido limpa o cookie pendente antigo; login de conta não confirmada preserva o `next` da reserva no reenvio. Nenhum dado pessoal é adicionado ao rascunho.
- **Origem do servidor:** `SITE_URL` permite configurar callbacks/CSRF em runtime sem depender de `NEXT_PUBLIC_SITE_URL`, que é incorporado ao build. A validação de protocolo, credenciais na URL e origem continua ativa. O navegador usa apenas a configuração pública. Teste cobre ambas as prioridades.
- **Runner:** quatro workers limitam o consumo simultâneo dos bancos WASM. A execução irrestrita no Node 24 falhou em seis arquivos SQL; os mesmos testes passaram isoladamente e na execução completa com limite. Nenhum caso foi removido, ignorado ou teve validações relaxadas.
- Runner de foto aceita somente o hostname do Preview desta branch para homologação remota. Runner de e-mail guarda cookies PKCE/senhas/links apenas em arquivos `.env*` ignorados e não usa confirmação administrativa.

Nenhum componente, página ou estilo sob responsabilidade do Cursor foi modificado.

## Evidências desta rodada

| Verificação | Resultado | Evidência |
|---|---|---|
| npm ci | PASS | `../homologation/stabilization-ci.log` |
| npm run lint | PASS | `../homologation/stabilization-lint.log` |
| npm run typecheck | PASS | `../homologation/stabilization-typecheck.log` |
| npm run test | PASS — 321, zero skipped | `../homologation/standard-tests.json`, `stabilization-tests.log` |
| npm run build | PASS | `../homologation/stabilization-build.log` |
| PostgreSQL 17.6 isolado | PASS — 49 casos | `../homologation/native-tests.json`, `stabilization-pg17.log` |
| GoTrue/PostgREST reais | PASS — 7 casos | `client-phase2-real-tests.json` |
| Reserva concorrente, histórico e avaliações reais | PASS — 4 casos | `client-phase2-booking-history-reviews.json` |
| HTTP local → Auth/Storage reais | PASS — 6 casos | `client-phase2-avatar-http.json` |
| Vercel Preview → Auth/Storage reais | PASS — 6 casos | `stabilization-preview-avatar-http.json` |
| Navegador → staging, continuidade e horário ocupado | PASS — 3 casos | `client-phase2-booking-browser.json` |
| Chave privilegiada nos assets do browser | PASS — zero ocorrências em 66 assets | `stabilization-browser-secrets.json` |
| npm audit --omit=dev | PASS — zero vulnerabilidades | `../homologation/stabilization-runtime-audit.json` |
| Cadastro SMTP de cliente/profissional | PASS apenas da solicitação GoTrue | `stabilization-email.json` |
| Confirmação por e-mail recebido, reutilização, recuperação completa | BLOCKED — aguardando links recebidos | `stabilization-email.json` |

Os checks npm finais usam Node 24.19.0 invocando o `npm-cli.js` com esse runtime. O `npm.cmd` instalado força Node 20 mesmo quando PATH aponta para Node 24; a primeira instalação e execução não são a evidência final. O primeiro build falhou no subprocesso Turbopack; o build com runtime suportado passou. A primeira foto retornou 403 por origem incorporada ao build; a correção `SITE_URL` foi reexecutada contra Storage real com sucesso.

Testes SQL locais usam fixtures de Auth/Storage; os 26 casos de staging (incluindo Preview) usam serviços reais. Nenhum desses casos comprova a jornada SMTP completa. Os dois aliases Gmail foram autorizados pelo responsável; nenhuma senha da conta Gmail foi solicitada, e a conta existente foi preservada. Novas contas e registros sintéticos permanecem no staging. Fotos/favoritos criados pelos próprios testes foram removidos pelas APIs autorizadas; nenhuma foto preexistente foi substituída. Reservas temporárias são canceladas, não apagadas.

## Infraestrutura e segurança

Preview padrão herda URL/chave pública de produção: **FAIL** de configuração global. Esta rodada não altera a configuração compartilhada. A proteção existente do aplicativo recusa inicializar produção fora do deployment produtivo.

Foram criados overrides **somente** para o Preview da branch desta rodada: URL e chave pública de `fkpdudnnperufnmdwdlv`, classe staging e `SUPABASE_SERVICE_ROLE_KEY` como Secret exclusiva do servidor. Chave existente obtida em memória; `ref` e `role` conferidos antes de configurar. Evidência sem valor da chave: `stabilization-preview-avatar.json`. Produção e outras branches não foram alteradas. A presença de bindings é distinta da prova HTTP: consultar `stabilization-preview-avatar-http.json` para o resultado do teste remoto.

Staging confirma bucket privado de 2 MiB apenas WebP e policy restritiva para anon/authenticated. RPCs internas de avatar e função de associação de clientes não são executáveis por esses papéis; wrappers de favoritos só authenticated. `search_path` vazio verificado. RLS de favoritos próprio usuário; UPDATE do perfil usa ownership em USING/WITH CHECK. Testes verificam IDOR, foto profissional/cliente, CSRF, arquivo inválido, limpeza de bytes antigos e persistência em novo login.

O Advisor mantém avisos sobre RPCs SECURITY DEFINER intencionalmente públicas/autenticadas e filas privadas com RLS sem policies. A fila de avatar nega usuários e é exclusiva do servidor. Não se enfraqueceu nenhuma policy. A proteção contra senhas vazadas permanece uma pendência operacional anterior.

`npm ci` identifica cinco alertas altos na cadeia **de desenvolvimento** `eslint-config-next → fast-glob → micromatch → braces`; advisory `GHSA-vfj7-8cjw-p6xm`. A versão mais recente de braces consultada no registry é 3.0.3, ainda coberta pelo advisory. Não executar o downgrade automático proposto pelo npm para Next 14 nem `audit fix --force`. Avaliar atualização compatível quando houver correção; não processar padrões de glob não confiáveis no lint. Auditoria omitindo dev tem zero vulnerabilidades nesta rodada.

## Plano produtivo — executar posteriormente, com revisão

Nenhuma migration foi aplicada em produção, nem nesta rodada no staging. As duas do PR #49 já existem no staging com timestamps MCP diferentes dos arquivos locais:

1. `20261014172158_client_phase2_profiles_favorites.sql` → staging `20261014173144/client_phase2_profiles_favorites`.
2. `20261014173903_client_phase2_avatar_upload_cleanup.sql` → staging `20261014173933/client_phase2_avatar_upload_cleanup`.

A segunda depende integralmente da primeira, inclusive fila, coluna de avatar e função de limpeza. A primeira depende das tabelas profiles/client_profiles/workspaces/workspace_settings/workspace_clients, schemas app/storage, roles anon/authenticated/service_role, Auth guards `require_confirmed_email`, entitlement, validadores BR e objetos Storage existentes. Preserva histórico e avaliações; não faz backfill de identidades antigas.

Consulta produtiva **somente leitura** confirmou guards/normalizador/tabelas e ausência de favoritos/coluna avatar. Isso não é autorização para aplicar nem prova de todos os pré-requisitos. Executar e revisar `production-post49-preflight.sql`; verificar especialmente grants por coluna em profiles (não pode existir UPDATE amplo), RLS, triggers, assinatura da função substituída, bucket e histórico efetivo. Se algum objeto novo já existir ou divergência aparecer, interromper a aplicação e preparar migração reconciliadora revisada.

Antes de aplicar: backup/PITR verificado e contagens de profiles/clientes/appointments/reviews; comparar definição das funções e conteúdo de migrations, não apenas timestamps. Não usar `db push` indiscriminado: o histórico remoto anterior diverge dos arquivos. Aplicar a primeira de modo controlado, validar permissões/dados, depois a segunda; só disponibilizar a API de foto após ambas estarem concluídas. Verificar reload do PostgREST e ausência de writes em billing. Smoke autenticado e de isolamento; comparar contagens. Falha implica correção aditiva e feature indisponível temporariamente, sem DROP de tabelas/colunas/bucket com dados.

Vínculos históricos criados antes da correção por telefone exigem auditoria própria. Não reassociar clientes ou apagar histórico automaticamente. A regressão confirma que telefone/e-mail digitados não autorizam tomar a identidade de outra conta.

## Integração para o Cursor e prontidão

Reutilizar `docs/codex/client-experience-fase2.md`: favoritos via RPC/actions existentes, cidade opcional e foto por `/api/account/avatar`; distinguir erro, vazio e persistência. Enviar bytes raw, atualizar imagem após sucesso, tratar 409/503 sem inventar gravação. Rascunho continua HttpOnly, expira em 30 minutos, não reserva horário e é revalidado na volta e na confirmação. Não gravar identidade, preço, token ou avatar público em localStorage.

Callback e reenvio preservam `next`; abrir link no contexto PKCE original. Configurar `SITE_URL` exclusivo do servidor quando necessário e conferir allowlist Auth correspondente. Não inferir que um link recebido foi validado até o teste executar. Interfaces de favoritos/cidade/foto continuam sendo tarefa do Cursor conforme contrato já publicado.

**Prontidão: lançamento comercial BLOCKED.** Backend e recursos reais listados passaram; ainda falta finalizar confirmação/recuperação via caixa recebida e a jornada completa cadastro → confirmação → reserva, validar integração visual, resolver Preview global que herda produção e realizar rollout produtivo revisado das migrations. Zero Stripe LIVE, cobranças, DNS, secrets produtivos, merge ou exclusão de dados existentes nesta rodada.
