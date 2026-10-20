# Revisão individual das cinco migrations

Alvo auditado: `wohimauqgywshbbejjcl`, PostgreSQL 17, em 20/10/2026. Nenhuma migration aplicada nesta missão. Catálogos integrais sanitizados: `prelaunch20-production-catalog.json` e `prelaunch20-staging-catalog.json`. Produção tem 67 entradas históricas; comparar nome + definição + objetos, não apenas quantidade/timestamp. Os cinco nomes abaixo estão ausentes em produção e presentes em staging, com timestamps históricos divergentes em alguns casos.

**Pré-requisitos adicionais encontrados:** [prelaunch20-legacy-audit.md](prelaunch20-legacy-audit.md). Três contratos anteriores realmente faltam; autorizar/aplicar o bundle legado separado antes das cinco. Owner guards já equivalentes não são reaplicados nem registrados ficticiamente. O bundle das cinco recusa a produção atual enquanto esses pré-requisitos faltarem.

## 1. 20261015054116_workspace_media_and_settings_contract.sql

Adiciona `workspace_settings.cover_path` nullable e constraint `workspace_cover_owned`; cria `app.workspace_image_cleanup`, sua PK/FK/índice e RLS habilitada/forçada. Fila não é acessível a PUBLIC/anon/authenticated; service_role administra. Cria políticas RESTRICTIVE `workspace_images_server_insert`, `workspace_images_server_update`, `workspace_images_server_delete` em `storage.objects`, impedindo escrita direta dos papéis de usuário no bucket `workspace-logos`. Não torna bucket privado nem move objetos públicos existentes.

Funções públicas: `queue_workspace_image_upload(uuid,text,text)`, `swap_workspace_image(uuid,text,text,text)`, `claim_workspace_image_cleanup(uuid)`, `finish_workspace_image_cleanup(uuid,text)` só para authenticated, com autorização gerencial interna; `get_public_workspace_cover(text)` para anon/authenticated. Mutação troca referências com lock e compare-and-swap, leases e verificação de objeto. A fila só agenda remoção futura por ações explícitas; o DDL não apaga bytes.

Substitui `app.update_workspace_settings(uuid,text,text,text,text,text,text,text,text,text,text,text,text,boolean)`, mantendo a assinatura do wrapper público. Valida campos e serializa com swaps. A função privada tem EXECUTE revogado dos papéis públicos; wrapper continua autorizado pela guarda existente. Atualizar logo via parâmetros antigos passa a ser rejeitado: clientes precisam usar o fluxo novo já presente na main publicada.

Dependências verificadas: `app`/`storage`, `workspace_settings.logo_path`, `app.require_workspace_manager`, slug/telefone/timezone e wrapper existente. Produção: coluna/fila/RPCs/políticas novas ausentes; bucket público existente, dois objetos e zero referências logo nas settings. Risco de perda de linhas: nenhum backfill ou DELETE executado pelo DDL. Riscos operacionais: lock de ALTER/constraint e quebra intencional de upload direto antigo. Postchecks: coluna/constraint/fila/grants/políticas; upload/substituição/remoção em fixture autorizada na janela.

## 2. 20261015054818_workspace_settings_validation.sql

Reafirma a mesma implementação validada de `app.update_workspace_settings` e revoga EXECUTE privado. Não cria tabela, política ou coluna. A repetição da definição é intencional no histórico; não é duplicação introduzida pelos merges #67/#68. Produção ainda possui a implementação anterior. Depende do contrato anterior, especialmente a serialização com mídia.

Sem reescrita de contas/settings no momento de aplicar. Novas gravações passam a rejeitar cidade/UF/CEP/timezone/slug inválidos; registros antigos não são normalizados silenciosamente. Risco: clientes antigos tentando atualizar logo pelo parâmetro legado recebem erro. Postchecks: assinatura preservada, wrapper authenticated e privado sem EXECUTE direto; nome/cidade válidos persistem e inválidos não alteram dados.

## 3. 20261016075244_profiles_booking_whatsapp.sql

Substitui `app.create_public_appointment`, obtém identidade por `app.require_confirmed_email`, usa e-mail de Auth e conserva preço/duração/slot atômicos. Revoga reserva pública de PUBLIC/anon e mantém authenticated. Esta versão intermediária ainda contém `v_uid := NULL` ao perder confirmação: **não liberar após somente esta etapa**; aplicar junto da #4 na mesma transação.

Adiciona `professional_profiles.photo_path` nullable com CHECK de tenant/member/caminho WebP, bucket privado `professional-photos` (2 MiB/WebP), política RESTRICTIVE `professional_photos_server_only`, tabela `app.professional_photo_cleanup` com PK/FK/índice, RLS forçada e service_role exclusivo. Cria helper privado `app.require_professional_photo_editor(uuid)`.

Funções públicas service_role-only: `queue_professional_photo(uuid,uuid,text)`, `swap_professional_photo(uuid,uuid,text,text)`, `claim_professional_photo_cleanup(uuid)`, `finish_professional_photo_cleanup(text)`. O actor é reautorizado no SQL; parâmetros não substituem a checagem do servidor. Cria `get_related_client_avatar(uuid)` e `get_appointment_whatsapp(uuid)` para authenticated, com vínculo/appointment/permissão e e-mail confirmado; não concede diretório global de clientes. Cria `get_professional_photo(uuid,text)` para leitura mediada, por membro ou catálogo público elegível, anon/authenticated. Não torna os bytes privados diretamente públicos.

Dependências: perfis/avatar já instalados, require_confirmed_email, can_write_appointment, catálogo, settings/timezone, storage e rotas server-only. Produção: coluna/bucket/tabela/helper/RPCs ausentes; perfis, avatar e guards base presentes. Não altera criação interna `public/app.create_appointment`; as definições normalizadas dessa função e dos guards base coincidem entre staging e produção. Conta/equipe/agendamentos existentes são preservados. **Não idempotente**: ADD COLUMN, INSERT bucket e CREATE FUNCTION sem IF NOT EXISTS. Se houver aplicação parcial, parar e diagnosticar, nunca reaplicar cegamente nem deletar objetos para forçar passagem.

## 4. 20261016235000_require_confirmed_public_booking.sql

Substitui exclusivamente o corpo de `app.create_public_appointment` e reforça grants: privado sem EXECUTE para PUBLIC/anon/authenticated; wrapper público somente authenticated (service_role administrativo não é um cliente anônimo). Reconfirma e-mail em Auth e lança `42501` se identidade/confirmacão faltar, eliminando fallback guest. Mantém a assinatura, associação ao usuário, locks e exclusão de sobreposição, preço no servidor e histórico existente.

Depende de #3 e guards já presentes. Não cria tabela/política nem modifica linhas ao aplicar. Não remove agendamentos guest históricos nem transforma seus vínculos; isso precisaria de tarefa e autorização próprias. Risco principal é indisponibilidade intencional de reservas sem conta confirmada. Postchecks: grants e corpo sem atribuição nula; smoke futuro com vaga realmente disponível, anon e conta não confirmada negados sem writes, confirmado permitido; equipe autorizada continua operando. As provas dinâmicas existentes em staging e os testes locais cobrem essas fronteiras; não alegamos execução produtiva futura já aprovada.

## 5. 20261020162935_launch_discovery_eligibility.sql

Substitui `app.discovery_text(text)` para normalizar espaços/acentos; executa `REINDEX INDEX public.workspace_settings_discovery_city` por a expressão imutável do índice ter mudado; substitui `public.search_public_workspaces(text,text,text,text,integer,integer)`. Nome de profissional só casa com profissional ativo/booking_enabled, vínculo ativo e serviço ativo/não arquivado. Mantém consentimento `discovery_enabled`, entitlement, cidade/UF e limites/paginação. Não adiciona exposição de telefone/e-mail/endereço privado. Preserva ACL existente do search público; anon precisa continuar buscando, mas não reservando.

Dependências: migration de busca de 14/10, coluna consentimento, índice existente válido, profissionais/serviços/vínculos e entitlement. Tudo presente na produção auditada; falta a definição corrigida. Sem alteração de linhas de negócios; índice é reconstruído. **REINDEX não concorrente pode bloquear escritas**: executar em janela curta, com lock_timeout e statement_timeout; se exceder, rollback de toda a transação e reagendar. Não remover o REINDEX nem usar CONCURRENTLY dentro da transação única.

## Execução proposta e validação

Ordem: 1 → 2 → 3 → 4 → 5, **uma transação**, encerrando com catálogo pós-aplicação antes do commit. Executar somente depois de backup recente recuperável, cobertura Storage e aprovação específica das cinco. Preflight deve confirmar ausência dos novos objetos/histórico e comparar os hashes das fontes em `prelaunch20-migration-manifest.json`; se qualquer objeto já existir, o preflight muda e esta proposta perde validade. NÃO executar `db push`, reparar histórico em lote ou inserir registros de migrations já existentes sob outro timestamp.

O bundle `prelaunch20-apply-five.sql` foi gerado **localmente** por `scripts/prepare-prelaunch-window.mjs`, sem conexão remota. Ele contém as cinco fontes na ordem acima, registra exatamente cinco versões/nomes e o SQL revisado no histórico, aborta em replay/objetos parcialmente presentes e mantém reservas públicas/internas pausadas no final. Não cria sexta migration, não repara entradas antigas nem usa ON CONFLICT para esconder diferenças. Fontes e bundle têm hashes normalizados UTF-8 LF no manifest. Conexão TLS/project ref precisam de conferência externa: o GUC de autorização comprova intenção, não identidade do servidor.

Procedimento psql futuro: `-X --set=ON_ERROR_STOP=1 --single-transaction --file=docs/production-readiness/prelaunch20-apply-five.sql`, com GUC de intenção e credenciais fornecidos de modo seguro pelo operador. O bundle já inclui lock_timeout 5s, statement_timeout 120s, idle 60s e gates antes do commit. Após autorização específica de retomada, o script `prelaunch20-postchecks.sql` (BEGIN READ ONLY/COMMIT próprios) deve ser executado em sessão separada. Durante manutenção, authenticated sem EXECUTE é esperado e não é autorização para abrir reservas.

Ensaio executado em modelo local do estado físico observado, com conta/tenant/cliente/agendamento preexistentes: comprova recusa das cinco antes dos pré-requisitos; aplica 3 legadas e 5 em duas transações, com registros/assinatura/trial/histórico intactos. Gates passam e suspensão/retomada não restaura anon. Passou em PGlite e PostgreSQL 17.6 nativo. Fixtures Auth/Storage simuladas, não restore do banco produtivo. Nenhuma restauração ou migration remota nesta missão.
