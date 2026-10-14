# Finalização funcional — 14/10/2026

**Decisão: NO-GO para lançamento comercial em 15/10 enquanto os P0 permanecerem abertos.** Houve correções de produto e homologação real; não houve merge, implantação manual, DDL produtiva, cobrança real ou contratação.

## Base auditada e trabalho preservado

Repositório `plbr010/agende`, checkout inicialmente limpo, HEAD inicial `53a2121`. Fetch encontrou main `64b37af2a228cb0c747d2e0c13631ffea08b39e7`; atualização fast-forward preservou todos os commits e o trabalho Cursor, inclusive PR37. Branch própria `codex/functional-completion-2026-10-13`. Nenhuma alteração local anterior sobrescrita.

| PR | Estado confirmado | Implementação efetiva |
|---|---|---|
|31|Merged, `3725710`|Complemento da identidade visual/dashboard e etapas de agendamento; não acrescenta backend|
|32|Merged, `c3b6161`|Backup cifrado/restauração isolada, payload exclusivo de serviços e preflight; não executou produção|
|33|Merged, `1507908`|UX de entrada/agenda/módulos, validação portuguesa e tela de descoberta; SQL de descoberta ainda ausente|
|34|Merged, `76b2070`|Modelo de custos e carga PostgreSQL local; não prova capacidade cloud|
|35|Merged, `20e5ebd`|Proposta de contrato HTTP/IBGE/PostGIS/keyset, somente documento|
|36|Merged, `dc1d5da`|Auditoria, gates, disponibilidade GET e evidências; não corrigiu objetos produtivos|
|37|Merged, `64b37af`|Adapter real de busca/GPS, intenção profissional, reenvio de convite, guards e frontend; RPCs ainda faltavam|

Metadados GitHub confrontados com commits/diffs locais. Vercel confirmou main64b37af READY em `dpl_6LQ3TiXP8b5Mt8RKviiGZE533Qgn`, Node24. Quatro GETs `agendeapp.online` passaram; isso não comprova negócios autenticados. Inventário Vercel sem decriptação ainda contém apenas URL/chave Supabase compartilhadas nos targets production/preview/development; SITE_URL ausente. Plano Hobby consta da auditoria anterior; consulta atual de Team não retornou billing, portanto não declarar mudança de plano nem conformidade comercial comprovada.

## Correções implementadas

1. **P0: páginas autenticadas quebravam apesar do build PASS.** O Input compartilhado criava `onInvalid`/`onInput` no servidor e passava eventos ao componente cliente Base UI. E2E de serviços exibiu error boundary; servidor registrou “Event handlers cannot be passed to Client Component props”. Adicionado `use client` ao Input, mantendo validação e aparência. Após rebuild, oito páginas operacionais renderizaram e o formulário gravou serviço + vínculo profissional via API real.
2. **Busca global limitada pela cidade anterior.** Ao trocar cidade → nome, os valores anteriores ainda eram enviados. A normalização agora elimina cidade/UF no modo global; regressão e navegador demonstram São Paulo encontrado mesmo após selecionar Salvador.
3. **Backend de descoberta v1.** Migration aditiva implementa duas RPCs públicas e get/set de publicação. Opt-in false inicial, autorização dono/admin, e-mail confirmado, lock de membership, entitlement para publicar/listar; retirada permitida após expiração. Projeção limitada a nome, slug, descrição, cidade, UF, logo e disponibilidade do catálogo. Pesquisa literal sem wildcard acidental, acentos normalizados, paginação limitada/ordenada e índice parcial de cidade. Aplicada somente ao projeto de staging.
4. **Frontend integrado sem refazer o design.** Consentimento de publicação no perfil, Mostrar mais, descarte de sugestões atrasadas, validação de entradas e informação correta sobre envio de localização ao geocoder. GPS não é persistido/enviado ao Agendê. Nearby v1 busca cidade atual, não raio/PostGIS.
5. **Recuperação e diagnósticos seguros.** Launcher interativo com senhas ocultas exporta/cifra/restaura automaticamente após autorização. Falhas geram somente códigos seguros, sem mensagens do provedor, segredos ou linhas de clientes.

## Evidências executadas

| Verificação | Resultado e alcance |
|---|---|
|npm ci|PASS usando Node24.19.0 explicitamente; invólucro npm Windows inicialmente usava Node20, corrigido na execução|
|npm run lint|PASS, repetido após os últimos runners/documentação|
|npm run typecheck|PASS; build final também concluiu TypeScript|
|npm test|284 PASS na integração final, zero falhas/skips;173 unit/contrato,58 mocks plataforma,13 mocks Stripe,29 SQL PGlite,11 integrações com Auth fixture|
|npm run build|PASS Next16.3.8/Turbopack após Input corrigido; cache anterior preservado em pasta ignorada ao resolver falha local de processo auxiliar|
|PostgreSQL17.6 isolado|48 PASS e cinco suítes SQL; cluster parado; inclui catálogo atômico, discovery, autorização e concorrência|
|Smoke HTTP local|34 PASS; configuração sintética, nenhuma escrita|
|GoTrue/PostgREST staging|10 grupos PASS: sessão/trial, catálogo, papéis/convites, IDOR, disputa de horário, reagendamento/cancelamento, review único, financeiro fictício e logout|
|Discovery API staging|7 checks PASS: opt-in, projeção pública, cidade/acentos/páginas, sugestões, IDOR e retirada; fixtures restauradas|
|Browser → Next → staging real|7 jornadas PASS: login, publicação persistida, oito módulos renderizados, serviço/vínculo, busca móvel/global, retirada e logout com rota protegida bloqueada|
|Estoque/pacotes API real|5 grupos PASS: movimentos/estoque insuficiente, IDOR, catálogo/venda/saldo cliente, resgate único após atendimento concluído, reversão/cancelamento; sem pagamentos externos|
|Backup/restauração sintética|PASS: fingerprints, catálogo, roles/memberships, Auth SQL, sequence; cifragem/integridade e adulterações recusadas; RTO sintético9,951s; somente duas tabelas, não RTO produtivo|
|Stripe TEST|Seis Prices ativos BRL/periodicidades oficiais confirmados por API; não comprova checkout/webhook integrado|
|npm audit --omit=dev|Zero vulnerabilidades de runtime; cinco HIGH dev da cadeia ESLint permanecem|

Não somar casos PostgreSQL aos284 como casos únicos: há repetição intencional. Contas de homologação foram confirmadas por fixture SQL; login real não comprova signup, confirmação/SMTP ou reset. E2E usa Edge headless em sessão própria, não a sessão do proprietário. Dados de teste identificados como sintéticos; produto de estoque e pacote arquivados, venda cancelada, resgate revertido. Atendimento sintético concluído retido para rastreabilidade; nenhuma linha produtiva manipulada.

Falhas iniciais preservadas: Chromium empacotado ausente (usado Edge instalado), error boundary de Input, expectativa incorreta do harness sobre logout (produto retorna home), e resgate antecipado corretamente recusado antes de concluir atendimento. Erros do produto e do harness são distintos; nenhum guard removido para fazer teste passar.

## Produção, schema e backup autorizado

Snapshot de catálogo read-only de14/10 e comparação reproduzível em `../migrations/remote-functional-2026-10-14.json` e `drift-functional-2026-10-14.json`. História:63 registros; seis arquivos pendentes (cinco anteriores + descoberta). Um registro apenas remoto irrecuperável por histórico e três placeholders antigos persistem. Não aplicar repair/db push indiscriminadamente. Baseline tem owner guards já observados; target diverge também por reviews/reschedule, billing excesso de assentos e nova descoberta. Grants gerados pela plataforma diferem do fixture local, sem autorização para sincronização cega.

RPC de serviços e history20261010232248 continuam ausentes. Dependências existentes foram reconferidas no catálogo. Fonte SHA256 `d13be7931bf92be45ef754858d4642881186f5bd8f9ce8a0d5f919419e5c0b37`. Payload exclusivo existente foi novamente testado em PostgreSQL17: catálogo/histórico anteriores preservados, reaplicação recusada. Nenhuma das seis migrations foi aplicada em produção.

O proprietário autorizou exportação cifrada + restore local e abertura de prompts ocultos. Tentativas retornaram **28P01 (senha Database recusada)** antes de gerar arquivos; proprietário informou não possuir a senha atual. Backup real/restore real continuam NÃO COMPROVADOS. Não houve reset de senha nem exportação de dados. Launcher e registros sanitizados em `../production-readiness/authorized-backup-{status,error}.json`; não incluir arquivos cifrados, senhas ou dumps em Git. Autorização de backup não inclui migration.

Detalhes de recuperação: [FREE-BACKUP-RECOVERY.md](../production-readiness/FREE-BACKUP-RECOVERY.md). Snapshot lógico consistente, arquivos AES256-GCM, manifesto autenticado, SHA256, TLS verify-full, pasta privada com ACL; restore exclusivamente em cluster próprio de loopback. SQL/Auth core não restaura integralmente GoTrue/SMTP/Edge, Vault/root key, Cron ou objetos binários Storage. Não declarar recuperação integral da plataforma por core PASS.

## Bloqueios exatos e preparação de release

| Gate | Estado / próximo requisito |
|---|---|
|P0 backup recuperável|Autorizado, bloqueado por senha atual indisponível. Obter credencial existente por via segura; qualquer reset futuro exige outra autorização produtiva|
|P0 cadastro produtivo de serviços|Somente após backup aceito, autorização específica para payload20261010232248; depois verificações read-only e autorização para teste produtivo de escrita|
|P0 Auth/SMTP|Caixa controlada, credencial Resend e domínio verificado ainda não disponíveis para aceite; signup/link/reset/envio de convites não homologados|
|P0 billing integrado|Vault staging continua sem stripe_api_key. Owner inserir restricted TEST diretamente no Vault; exercitar Checkout/Portal, entrega/replay webhook, renovação, troca, recusa e cancelamento até persistência no Agendê|
|P0 ambientes/origens|Vercel URL/chave compartilhadas e SITE_URL ausente. Configurar bindings/origens por aprovação separada, rebuild e verificar cookies/callbacks|
|P0 Edge/schema produtivo|billing/webhook versões2 observadas permanecem anteriores às correções; deploy Next não publica Edge. Comparar bundles e aprovar release separado; revisar todas as migrations pendentes|
|P1 descoberta produtiva|V1 funciona em staging. Migration/consentimentos ainda ausentes em produção; aplicar apenas após backup e autorização. Offset/substring/rate-limit/capacidade cloud e geocoder externo ainda sem aceite amplo|
|P1 operação comercial|Monitoramento, limiares/RPO/RTO reais, plano de hosting comercial compatível e aceite de políticas/Portal pendentes. Nenhuma compra realizada|

SMTP preparado no [plano de ambientes](ENVIRONMENTS-SMTP.md): Resend prioritariamente Free, remetente em `auth.agendeapp.online`, SPF/DKIM reais do Dashboard, smtp.resend.com:465/TLS, usuário resend, chave restrita a envio inserida no Dashboard Supabase. Não inventar DNS/chave ou remover confirmação obrigatória; domínio/DNS produtivo exige aprovação própria. Quotas e disponibilidade devem ser reconferidas ao ativar. Testar links válidos/expirados/reutilizados, cliente/profissional e recuperação usando caixa controlada.

Preços TEST confirmados: Solo8990/79900; Equipe até5 16990/149900; Equipe até15 29990/279900 centavos BRL month/year. IDs internos equipe/salao preservados. Mocks e ciclos Stripe históricos não substituem sincronização externa atual. Nenhuma cobrança LIVE/configuração LIVE executada.

## Implantação e recuperação

1. Recuperar senha existente, repetir launcher autorizado e aceitar restore real; guardar senha separada e segunda cópia cifrada em mídia autorizada. Sem esse gate, não executar DDL.
2. Aprovação exclusiva da RPC de serviço: usar payload já preparado com psql17, session pooler/TLS verify-full, prompt oculto, ON_ERROR_STOP e single-transaction; comando atualizado em [auditoria13/10](LAUNCH-AUDIT-2026-10-13.md). Revalidar hashes, objetos ausentes e dependências imediatamente antes. Timeout5s de lock/60s de statement; falha reverte tudo.
3. Pós-aplicação: histórico exclusivo, assinatura/grants/search_path, RLS e cache PostgREST. Teste real produtivo de cadastro é autorização separada. Não executar demais migrations por implicação.
4. Novo backend de descoberta é release próprio: validar dependências e source SHA256 `d86c2a9c666d34ec7fc66c1a60a30eb5dce20dfda197219f1f979dbd69d16224`; aplicar só a migration revisada com registro de histórico e transação, sem db push geral. Starts false, sem publicar estabelecimentos automaticamente. Verificar DTO anon, isolamento e uma publicação consentida autorizada. Recusar ativação ampla sem proteção de abuso/medição.
5. Rebuild/release da aplicação, bindings, SMTP e Edge cada um em escopo aprovado. PR merge não aprova execução produtiva. Release mantém design Cursor; não promover build de staging com suas configurações para produção.
6. Rollback: antes do commit, abortar transação; depois, preferir correção aditiva e rollback da aplicação compatível. Descoberta pode ser contida revogando EXECUTE apenas de suas duas RPCs por aprovação; manter coluna/consentimentos e dados. Não apagar dados ou restaurar banco inteiro sobre gravações posteriores. Recuperação de desastre usa ambiente vazio e procedimento revisado; RPO/RTO produtivos ainda desconhecidos.

**Prontidão verificável:4/12 gates completos =33,3% do checklist de aceite comercial anterior, não porcentagem de código.** Passam integridade de repo/build, regressão local, autorização/concorrência SQL e operações/papéis via API staging. Backend de discovery e E2E fortaleceram o último gate; não recebem crédito de lançamento completo enquanto rollout/abuso/ambientes estiverem pendentes. Permanecem oito gates incompletos: backup, RPC produtiva, signup/SMTP/reset, billing integrado, bindings/origens, descoberta produtiva completa, capacidade/monitoramento e aceite comercial/recuperação. Um P0 aberto basta para NO-GO.

## Integração final com Cursor

Main avançou durante a rodada com PR38 `8c8d8eb` (paginação, cenário Muriaé/Juiz de Fora e prevenção de cliques duplicados) e PR39 `f108438` (E2E público isolado e teclado do radiogroup). Ambos confirmados merged. Integrados nesta branch, sem merge na main. Preservados teclado, searchLock, paginação e textos mais recentes do Cursor; reaplicados somente descarte de sugestões atrasadas, aviso de localização e limite do backend. Conflitos de contrato foram resolvidos por união; JSON de testes foi regenerado, não escolhido por preferência de branch.

Base final `f10843851d7e58ca95ae7836814022952351052d`. Vercel produção READY `dpl_CYvCrqk7j3GjHtPuyehhLckhFcP4`, observado após merge do proprietário; nenhuma implantação manual nossa. `npm ci` final410 pacotes, lint e284 testes PASS; build/TypeScript PASS. E2E de staging novamente7 jornadas PASS em14/10 às03:53Z. Runner público do Cursor11 PASS usando configuração sintética; GPS desse runner é simulado, não geocoder externo validado. Correção de portabilidade permite escolher Edge e pasta de artefatos local, sem modificar sua intenção de teste. PostgreSQL48 e cinco suítes permanecem aplicáveis: PR38/39 não alteraram migrations nem ações SQL verificadas.

Evidências finais: `../staging/{browser-functional,public-browser-final,discovery-real-api,modules-real-api,real-api-results}.json`, `../homologation/{standard-tests,native-tests,native-pg17}.json`, `functional-evidence-2026-10-14.json`. Os screenshots de jornadas reais usam exclusivamente fixtures de staging. O roteiro/proteções de produção e a decisão NO-GO permanecem os mesmos.
