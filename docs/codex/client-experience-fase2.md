# Agendê — backend da Fase 2

Alvo único de homologação: `fkpdudnnperufnmdwdlv`. Produção `wohimauqgywshbbejjcl` não foi alterada. Não houve alterações de DNS, secrets persistidos, preços, Stripe LIVE ou merge.

## Auditoria antes da implementação

- Repositório confirmado: `https://github.com/plbr010/agende.git`.
- Checkout encontrado: `agende-auth-pkce-20261014`, branch `codex/auth-pkce-homologation-2026-10-14`, HEAD `b6743ea483a7edde547914c8a07273fede23f48f`. Havia alterações em `scripts/staging-auth-observer.mjs`, `docs/homologation/standard-tests.json` e evidências não rastreadas. Esse checkout não foi editado.
- PR #47 auditado pelo conector GitHub e pelo resultado incorporado à main: `cd4326ec860726b4a37f1ff9e63851a43e553ed2`. Os dois documentos obrigatórios foram lidos; o primeiro só existia na main.
- Checkout exclusivo criado: `agende-client-phase2`; branch `codex/client-phase2-2026-10-14`. Atualizado por fast-forward para `537fc99` antes da implementação, incorporando também os PRs #46/#48 existentes.
- Staging tinha 27 perfis, 11 workspaces, `appointment_reviews`, RPCs de agenda/reviews/descoberta e apenas o bucket público `workspace-logos`. Não existiam favoritos, cidade residencial, referência de avatar ou bucket privado de conta.
- Todas as tabelas public/app inventariadas tinham RLS. O histórico das migrations de staging não representa todos os objetos já presentes: versões foundation foram renumeradas e há funcionalidades efetivas sem a mesma linha histórica do repositório. Não foi executado `db push` nem replay das migrations antigas. As novas migrations foram aplicadas individualmente após comparar objetos, destino e impacto.
- `list_my_appointments` já retorna id, salão, profissional, serviço, horário, preço/duração registrados e status, com filtro por `workspace_clients.linked_user_id`. Reutilizado.
- `appointment_reviews` já tem avaliação única por atendimento, validação, imutabilidade e FORCE RLS. `submit_appointment_review` e suas permissões foram reutilizados.
- Encontrada falha: `find_or_create_public_client` podia vincular um cliente interno por telefone digitado. Corrigida sem backfill/reassociação de históricos existentes. Registros históricos possivelmente vinculados antes desta alteração precisam de auditoria própria; não foram reassociados automaticamente.
- Encontrada falha de permissão: o CHECK de telefone em `profiles` chama `app.is_valid_br_national`, mas authenticated não podia executar esse validador puro. Grant explícito adicionado para permitir atualizações válidas do próprio perfil.

## Migrations e autorização

1. `20261014172158_client_phase2_profiles_favorites.sql`: `profiles.residence_city`, `profiles.avatar_path`, favoritos com PK composta, RLS/FORCE RLS, três RPCs, bucket privado `account-avatars`, fila privada de limpeza, RPCs de avatar exclusivas de service_role, correção do vínculo de identidade.
2. `20261014173903_client_phase2_avatar_upload_cleanup.sql`: lease de uploads pendentes e trigger que cancela a limpeza ao confirmar a referência. Upload interrompido fica elegível à limpeza depois de uma hora.

São aditivas, sem backfill, exclusão de registros existentes ou mudança de billing. O rollback destrutivo de tabelas/colunas não deve ser executado com dados: preferir correção aditiva. As versões registradas pela ferramenta MCP no staging diferem do timestamp local; comparar por nome/conteúdo, não renumerar migrations já aplicadas.

Todas as funções privilegiadas usam `search_path=''`, nomes qualificados e revogação de PUBLIC. Funções app de favoritos não são executáveis por anon/authenticated; wrappers public autenticados chamam validação de e-mail confirmado e `client_profiles`. Avatar e fila são exclusivamente service_role. Nenhuma chave privilegiada é enviada ao navegador.

## Favoritos

| RPC | Parâmetros | Resposta | Autorização/erros |
| --- | --- | --- | --- |
| `list_my_workspace_favorites` | nenhum | `{ items: WorkspaceFavorite[], total: number }` | authenticated, e-mail confirmado, client_profile; `email_not_confirmed`, `client_profile_required` |
| `add_my_workspace_favorite` | `p_workspace_id: uuid` | void/null | mesma autorização; idempotente; `workspace_unavailable` |
| `remove_my_workspace_favorite` | `p_workspace_id: uuid` | void/null | mesma autorização; noop se ausente; permite retirar após despublicação |

`WorkspaceFavorite = { workspace_id: string; name: string; slug: string; city: string; state: string; logo_path: string|null }`.

Existe também `loadWorkspaceFavorites()` / `changeWorkspaceFavorite(workspaceId, add)` em `src/lib/client/favorite-actions.ts`, com invalidação das páginas `/cliente` e `/cliente/favoritos`.

INSERT/DELETE diretos não são concedidos: só RPC com autorização e elegibilidade. SELECT direto é próprio usuário. Unique composta evita duplicação. A listagem só expõe campos do contrato público e oculta estabelecimentos despublicados/sem entitlement; o registro privado continua existindo até o cliente remover.

**Ajuste técnico ao contrato da Fase 1:** `get_workspace_discovery` é uma RPC exclusiva de gestores, não uma função de elegibilidade de clientes. As RPCs usam o mesmo predicado público da descoberta: publicação, localidade e entitlement. Erro único `workspace_unavailable` não permite distinguir IDs inexistentes de salões privados.

### Integração do Cursor

Reutilizar `FavoritesPanel`, `ClientHome` e as páginas atuais, carregando `loadWorkspaceFavorites`. Trocar aviso de contrato ausente por lista real somente após sucesso da RPC. Empty/error são estados distintos. Criar os botões de adicionar/remover nos componentes atuais, sem localStorage. `slug` gera `/p/{slug}` e `/p/{slug}/agendar`. Na busca atual, a resposta não tem workspace_id: obter o ID do perfil público existente antes de chamar a RPC; não deduzir IDs.

## Perfil

`profiles.residence_city: string|null`, opcional, 2–80 caracteres após trim, sem controles. Não altera cidade da busca, localização GPS ou dados do workspace. `updateClientProfileAction` aceita `residenceCity` junto de nome/telefone. O campo não é atualizado se não foi enviado, preservando compatibilidade com o formulário da Fase 1.

`profiles.avatar_path` é referência privada, sem grant UPDATE ao usuário. A leitura own-row já existente continua. E-mail, intenção/papel e identidade continuam protegidos pelas permissões/triggers existentes.

Cursor: acrescentar campo opcional à `ClientProfileForm`, carregar `residence_city` da linha própria, manter segurança/reset de senha existentes. Preferências de notificações não foram criadas: não há confirmação de envio real que justifique flags funcionais. Não comunicar notificações inexistentes.

## Foto privada de clientes e profissionais

Endpoint único: `/api/account/avatar`, runtime Node.js. Requer sessão cookie válida, e-mail confirmado e linha própria de profiles. Não recebe user_id nem path; todos os IDs são obtidos de `auth.getUser()`.

| Método | Entrada | Resposta |
| --- | --- | --- |
| GET | sessão | 200 `image/webp`, ou 204 quando sem foto; 401 não autenticado |
| PUT | corpo binário da imagem (File/Blob), header Origin da própria aplicação | 200 `{ avatarUrl: '/api/account/avatar', cleanupPending: boolean }` |
| DELETE | sem corpo, header Origin da própria aplicação | 200 `{ avatarUrl: null, cleanupPending: boolean }` |

Erros JSON `{ error: string }`: `auth_required` 401; `origin_denied` 403; `image_size_invalid` 413; `image_invalid` 422; `avatar_changed_retry` 409; falhas de banco/Storage/configuração 503 com códigos genéricos. Não repetir automaticamente 409 sem recarregar estado próprio.

Aceita bytes JPEG/PNG/WebP; até 5 MiB de entrada, dimensão de cada lado entre 32 e 4096, até 16 milhões de pixels. Sharp decodifica completamente, rejeita erros/truncamento/animação, aplica orientação, remove metadados e gera WebP de até 512px/2 MiB. Nome original, extensão e Content-Type fornecido não autorizam o formato. SVG, executáveis e arquivos corruptos são rejeitados.

Bucket privado `account-avatars`, objetos `avatars/{auth-user-id}/{random-uuid}.webp`. Não há upload direto pelo SDK do navegador. Política restritiva bloqueia acesso de anon/authenticated ao bucket, inclusive se outra policy permissiva for adicionada futuramente. Apenas API de servidor com validação pode escrever/ler bytes.

**Leitura segura escolhida:** proxy autenticado, com autorização em cada GET, `private, no-store` e `nosniff`. Não são emitidas URLs assinadas transferíveis nem URLs públicas permanentes. Assim, expiração/revogação de URL assinada é **não aplicável**; logout e ausência de sessão impedem nova leitura. Cache privado já recebido em memória pelo navegador não pode ser apagado retroativamente. O CDN de Storage pode levar até um minuto para invalidar downloads internos após exclusão; o proxy seleciona sempre a referência atual.

A troca usa compare-and-swap com `p_expected_path`, impedindo concorrência de sobrescrever outro upload. Objeto antigo entra na fila apenas após commit da nova referência. Remoção zera referência antes de limpar os bytes; se Storage falhar, `cleanupPending=true` e fila preservada. Uploads pendentes são registrados antes da escrita e só limpos após lease de uma hora. Trigger retira leases que viraram foto atual. A listagem de limpeza nunca retorna caminhos referenciados em profiles. Fila é drenada em mutações subsequentes; sem tráfego, precisa de execução operacional do mesmo procedimento pelo servidor. Não foi criada automation/cron sem solicitação.

RPCs `swap_account_avatar`, `queue_account_avatar_upload`, `list_avatar_cleanup`, `finish_avatar_cleanup` são internas, executáveis apenas por service_role. O frontend não deve chamá-las.

### Configuração e acabamento do Cursor

- O servidor precisa de `SUPABASE_SERVICE_ROLE_KEY` no ambiente **exclusivo do servidor**, vinculada ao mesmo projeto de `NEXT_PUBLIC_SUPABASE_URL`. Nenhum secret persistido foi criado ou alterado. A homologação local usou a chave existente via CLI somente em memória. O Preview da futura PR não foi configurado automaticamente: conferir esse binding antes de mostrar upload funcional.
- Enviar o File/Blob como corpo raw: `fetch('/api/account/avatar', {method:'PUT', body:file})`. Não usar multipart, `user_metadata`, localStorage, URL pública ou upload direto.
- Input pode usar `accept='image/jpeg,image/png,image/webp'`; galeria/câmera dependem do navegador. Recorte circular/previsualização são acabamento do Cursor; pode enviar Blob recortado com as mesmas validações do backend.
- Se a própria linha tem avatar_path, usar `/api/account/avatar` em cabeçalho, menu e perfil. Se 204/ausência, manter `AvatarFallback` com iniciais. Após sucesso, invalidar/recarregar imagem (pode usar query de versão apenas como cache-buster) e `router.refresh()`; não tratar 503 como foto persistida.
- Mesma API serve contas profissionais. A foto privada não foi adicionada ao catálogo público. Fotos públicas de profissional continuam sendo um recurso separado que precisa de consentimento explícito antes de implementação.

## Continuidade da reserva

`continueBookingAfterLogin(input: BookingDraft)` valida selectors, consulta disponibilidade, grava cookie HttpOnly `agende_booking_draft` por 30 minutos e redireciona para `/login?next=/p/{slug}/agendar` usando encoding. Inputs: slug, serviceId, professionalMemberId (uuid|null para qualquer profissional), localDate YYYY-MM-DD, startsAt ISO com offset. Apenas esses campos são aceitos, sem nome/telefone/e-mail/preço.

A navegação atual foi conectada ao action ao escolher horário sem autenticação. Cadastro já preserva o parâmetro next pelo contrato existente de Auth. Após login, a página lê cookie, valida expiração/schema/slug, catálogo, associação profissional-serviço e slots reais. Cookie não é prova de disponibilidade/identidade e não cria hold. Conteúdo manipulado precisa passar pelas mesmas regras; preço, duração e usuário são resolvidos no servidor/banco.

Se o horário foi ocupado durante login, serviço/profissional/data válidos são preservados e a UI volta à escolha de horário com aviso. Se profissional deixou de atender o serviço, mantém serviço válido e pede nova escolha. Confirmação exige sessão confirmada, usa e-mail de Auth e a RPC existente, que revalida jornada, duração, janela e conflito; exclusão PostgreSQL e índice único existentes impedem duplicações. Cookie removido depois do sucesso. Fluxo de cadastro por e-mail precisa da homologação SMTP já existente para garantir callback completo.

## Histórico e avaliações

Sem endpoint/sistema paralelo. `list_my_appointments`, cancelamento, reagendamento e `submit_appointment_review` mantêm seus contratos. O vínculo de criação autenticada usa Auth uid/e-mail confirmado, nunca telefone/nome digitado ou e-mail de outra pessoa. Atendimento mantém snapshot de preço/duração/status.

Avaliações são imutáveis e continuam próprias/visíveis somente ao workspace competente segundo RLS. Nenhuma avaliação privada foi publicada automaticamente. A publicação pública de avaliações exige um contrato de consentimento/moderação separado.

## Evidências e limites

Resultados automatizados: `docs/homologation/standard-tests.json`, logs `client-phase2-*.log`. PostgreSQL nativo registra separadamente SQL/concorrência; Auth/Storage/Cron locais são fixtures, não serviços reais.

Resultados reais: `docs/staging/client-phase2-real-tests.json`, `client-phase2-booking-history-reviews.json`, `client-phase2-avatar-http.json`, `client-phase2-booking-browser.json`. Requerem opt-in explícito `AGENDE_STAGING_ACCEPTANCE=fkpdudnnperufnmdwdlv`; config privada via `AGENDE_PHASE2_CONFIG_FILE`. Senhas/chaves/tokens não aparecem nas evidências. Novos usuários/serviços/atendimentos/reviews sintéticos de teste permanecem em staging; registros preexistentes não foram apagados.

Avisos do Security Advisor: funções SECURITY DEFINER executáveis pelos papéis definidos (exposição intencional, autorização testada); fila privada RLS sem policy (nega acesso padrão, service_role exclusivo); proteção contra senhas vazadas já estava desabilitada. Nenhuma configuração de Auth foi alterada. Referências: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable e https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection.

**Prontidão:** backend disponível e verificável no staging; a jornada comercial inteira ainda depende da integração visual de favoritos/cidade/foto nos componentes existentes do Cursor, binding de credencial no servidor do Preview e aceite do cadastro com confirmação por e-mail. Não declarar Fase 2 comercialmente concluída apenas por esses RPCs/endpoints existirem.
