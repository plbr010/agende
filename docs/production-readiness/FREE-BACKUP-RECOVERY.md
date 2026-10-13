# Backup lógico gratuito — preparação, não exportação produtiva

Alvo exclusivo: wohimauqgywshbbejjcl. **Nenhum dado de cliente/Auth foi exportado nesta preparação. Nenhuma migration foi aplicada.** Inventário de catálogo e tamanho, parâmetros de conexão, certificado público e negociação TLS foram lidos; não houve autenticação por senha no banco nem escrita remota. Ferramentas já presentes: PostgreSQL17.6, pg_dump, pg_dumpall, pg_restore, psql, Node24 e PowerShell7. Não instalamos serviços nem contratamos add-ons.

## Método e cobertura

pg_dump17.6 em formato custom exporta schema/dados, funções, triggers, policies/RLS, constraints, índices, sequences, owners e grants. Um dump completo não usa filtros de schema. Inclui os schemas de negócio, auth, storage, realtime, cron, vault e histórico existentes, sujeito às permissões reais do usuário postgres. Não usar enable-row-security: a ferramenta deve falhar se não puder ler a totalidade das tabelas, evitando um backup silenciosamente parcial. Um erro interrompe o procedimento; não ignorar tabelas/objetos sem autorização.

pg_dumpall --roles-only --no-role-passwords captura definições e memberships de roles, sem hashes de senhas dos logins PostgreSQL. Essas credenciais serão necessárias por canal separado para recuperação operacional; não redefinir senha de produção nesta missão. Isso não exclui auth.users.encrypted_password: hashes dos usuários do Agendê são dados e ficam no dump cifrado, junto de identities, sessions, refresh_tokens, MFA/OAuth/SSO e demais tabelas auth. O histórico Auth e triggers próprios também são incluídos.

Um segundo arquivo, core.dump.enc, é exportado do **mesmo snapshot** para ensaiar app/public/auth/extensions/supabase_migrations no PostgreSQL Windows. Extensões compatíveis são explicitamente incluídas com --extension; filtrar apenas --schema não exporta suas definições. Roles são objetos globais e o dump de roles tem leitura própria; o ensaio compara seus atributos/memberships contra o inventário do snapshot, recusando divergências.

Arquivos privados: database.dump.enc (banco completo), core.dump.enc (escopo de ensaio), roles.sql.enc, snapshot.json.enc (contagens, fingerprints SHA256 e catálogo), manifest.json e restore-evidence.json. Arquivos de backup cifrados com AES256-GCM, nonce por arquivo, nome autenticado como AAD e chave derivada via scrypt(N32768/r8/p1). A senha de criptografia é fornecida em entrada oculta e não é armazenada. Guardá-la separadamente do computador e do backup; perder a senha impede restauração. A solução é portátil e não depende de DPAPI/perfil Windows.

## Limitações que não serão mascaradas

- PostgreSQL Windows instalado não tem pg_cron1.6.4 nem supabase_vault0.3.1; Docker e WSL Linux não estão disponíveis. O dump completo preserva seus objetos/config-data quando permitido, mas o ensaio nativo restaura apenas o core. Não ignora erros nem simula essas extensões como se a plataforma estivesse recuperada. Não agenda jobs, sobe app/GoTrue/Edge ou chama funções de negócio.
- O estado SQL do Auth pode ser comparado byte a byte por fingerprints sem mostrar usuários, hashes ou tokens. Isso não testa login, SMTP, recuperação de senha, MFA nem OAuth no serviço GoTrue. Configuração externa do Auth (origens/redirects, confirmação, SMTP, provedores OAuth, JWT/signing e chave raiz de criptografia quando necessária) precisa de inventário/preservação separados para recuperação completa; o pg_dump não substitui isso. A chave raiz não foi lida/copied/rotacionada nesta preparação.
- SQL do Storage contém metadados, não os arquivos dos buckets. Edge sources/secrets, Vercel bindings, DNS, certificados de domínio e Stripe externo não são recuperados por pg_dump. Não existe PITR neste método.
- Um backup apenas neste disco não protege contra perda do computador. Depois de validar, manter outra cópia **cifrada** em mídia já disponível/autorizada. Não enviar a nuvem, GitHub ou terceiros automaticamente.
- Durante o restore, o cluster temporário contém dados em claro sob ACL privada, acessível apenas ao usuário Windows, com senha aleatória SCRAM e bind127.0.0.1. O cluster é parado e sua pasta própria removida após o ensaio. Exclusão lógica não é apagamento forense; criptografia de disco continua recomendável para esse risco. Crash/falha de parada pode deixar pasta privada residual, que deve ser verificada antes de encerrar. Nunca apagar diretórios desconhecidos.

## Proteção e conexão

Raiz fixa fora do repositório e de Documents: C:\Users\PLBR\AppData\Local\AgendePrivateRecovery. DACL com herança desativada e acesso apenas ao SID do usuário; script verifica DACL e recusa caminhos fora da raiz. .gitignore reforçado para dumps, roles/data/schema SQL e arquivos cifrados. A verificação Git passou. Não abrir dumps em painéis/chat, imprimir SELECT de usuários ou copiar dados ao staging.

Endpoint confirmado pelo Connect do projeto: aws-0-us-east-2.pooler.supabase.com:5432 (session pooler IPv4 gratuito), usuário postgres.wohimauqgywshbbejjcl, database postgres. Não usar transaction pooler6543. Conexão direta IPv6 também aceita se disponível; sem add-on IPv4. Configuração sem senha em source.json privado. CA baixada pelo link oficial exibido no Dashboard: https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt. SHA256 do arquivo CA: 700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7.

Negociação sem autenticação confirmou TLS1.3, cadeia e hostname válidos. pg_dump usa PGSSLMODE=verify-full e PGSSLROOTCERT; Node pg exige CA/rejectUnauthorized. Em caso de falha TLS, parar, sem downgrade. Os processos recebem senha somente em memória/environment transitório, nunca em linha de comando, .env, Git ou logs. Senhas são recebidas via Read-Host -AsSecureString e stdin JSON interno. Logs de erros reais do provider/COPY são suprimidos para não expor linhas/segredos; um FAIL nunca vira PASS por supressão de log.

## Comandos preparados

Executar da raiz do checkout com o PowerShell7 disponível:

```powershell
$taskPwsh='C:/Users/PLBR/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/powershell/pwsh.exe'
& $taskPwsh -NoProfile -File scripts/backup-recovery.ps1 -Mode prepare
& $taskPwsh -NoProfile -File scripts/backup-recovery.ps1 -Mode check-tls -ConfigPath 'C:/Users/PLBR/AppData/Local/AgendePrivateRecovery/source.json'
& $taskPwsh -NoProfile -File scripts/backup-recovery.ps1 -Mode selftest
```

Os comandos acima não exportam dados produtivos. A execução principal não depende de Docker/Supabase CLI; emprega ferramentas PostgreSQL nativas gratuitas.

**Somente após autorização específica para ler/copiar dados reais e restaurar o core local:**

```powershell
& $taskPwsh -NoProfile -File scripts/backup-recovery.ps1 -Mode export -AuthorizedProject wohimauqgywshbbejjcl -ConfigPath 'C:/Users/PLBR/AppData/Local/AgendePrivateRecovery/source.json'
# Informar senha de criptografia e senha EXISTENTE do banco nos prompts ocultos.
# O export retorna private_run; atribuir esse caminho à variável abaixo.
$taskRunPath='<private_run retornado pelo export>'
& $taskPwsh -NoProfile -File scripts/backup-recovery.ps1 -Mode restore -AuthorizedLocalRestore -RunPath $taskRunPath
```

Entradas SQL de produção: BEGIN REPEATABLE READ READ ONLY, snapshot exportado, timezoneUTC, row_security=off para falhar se faltar privilégio, e SELECTs de verificação. PGOPTIONS força default_transaction_read_only=on; lock_timeout5s e statement_timeout600s. São opções de sessão, não mudança de configuração persistente. Sem DDL/DML produtivos, reset de senha, cron, apply_migration ou configuração de serviço. Dump faz leituras/locks ACCESS SHARE e pode consumir CPU/IO; agendar horário de baixa atividade. Sem backup completo bem-sucedido, não declarar proteção completa nem prosseguir com a migration.

Restore cria cluster novo sob pasta própria, porta efêmera, credencial aleatória, verifica data_directory/cluster_name antes de qualquer SQL e ignora DATABASE_URL/variáveis PG herdadas. Não aceita servidor de destino indicado pelo usuário nem URL de staging. Roles e core usam single-transaction/ON_ERROR_STOP/exit-on-error. DROP SCHEMA public aparece apenas no cluster recém-inicializado vazio para receber o schema do arquivo, sem CASCADE e sem qualquer conexão remota. Nenhuma migration pendente é executada no ensaio.

## Evidências, tempos e critérios

Manifesto registra início, snapshot_at e fim em UTC, tamanho/SHA256 de cada ciphertext, nonce/tag/KDF. Restore autentica todos os GCM, verifica todos os SHA256, lê TOC do arquivo completo e restaura o core. Compara contagem e fingerprint SHA256 de cada tabela do core (inclusive auth), colunas/defaults, constraints, RLS/policies, triggers, views, funções próprias/owners/ACLs, ACLs de tabelas/sequences e atributos/memberships de roles. Extensões compatíveis devem ter mesma versão. Sequences são verificadas contra extremos das colunas relacionadas sem executar nextval. Erro de permissão, schema desconhecido, diferença de conteúdo, certificado inválido, senha incorreta ou checksum divergente interrompem o aceite.

RPO: ponto de consistência do banco em snapshot_at; idade do backup = instante da avaliação/incidente menos snapshot_at. Não é zero e não inclui gravações posteriores. Sequence/roles globais não têm a mesma semântica MVCC das tabelas; o restore valida integridade e roles e recusa divergência. RPO máximo aceitável deve ser aprovado pelo proprietário; regenerar backup antes da janela se houver defasagem não aceita.

RTO: medido para criação do cluster local, decrypt/restore, verificação e parada/limpeza. Não inclui recuperação de GoTrue/Vault/Cron/Storage/SMTP/DNS nem intervenção humana; não confundir com RTO do produto. Horário, checksums e RTO de **produção permanecem indisponíveis até autorização e execução**, sem números inventados. O teste sintético demonstra o método, não a recuperação dos dados reais. Evidência sintética e TLS sem PII registrada separadamente.

Para avaliar liberação exclusiva da migration20261010232248: autorização de exportação, credencial existente/TLS, dump completo concluído, core real restaurado/igual, integridade/roles/Auth SQL verificados, cópia cifrada e senha disponíveis, riscos/limites de recuperação aceitos, e preflight da migration renovado. Um core PASS não é um restore integral do Supabase. Se o gate exigir restore integral da plataforma, continua NO-GO até homologar também extensões/root key/configurações. A aprovação de backup não autoriza aplicar migration; execução produtiva continua separada.

## Fontes

[Backup/restauração Supabase](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore), [pg_dump17](https://www.postgresql.org/docs/17/app-pgdump.html), [roles/pg_dumpall17](https://www.postgresql.org/docs/17/app-pg-dumpall.html), [pg_restore17](https://www.postgresql.org/docs/17/app-pgrestore.html), [TLS libpq](https://www.postgresql.org/docs/17/libpq-ssl.html).

Manifesto formato3 autenticado com HMAC-SHA256, incluindo projeto, horarios e hashes. Ensaio final: PASS; senha incorreta, checksum adulterado e alteracao do timestamp do manifesto recusados. RTO sintetico medido20,057s (nao representa RTO produtivo). TLS, checksums sinteticos e resultados em backup-preparation-evidence.json. Lint do executor, parser PowerShell e git diff --check passaram. As falhas iniciais de ensaio (schema public preexistente e extensoes omitidas pelo filtro de schema) foram corrigidas no alvo/seletores locais, sem ignorar erros ou alterar fonte produtiva.
