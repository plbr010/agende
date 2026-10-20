# Agendê — auditoria final da main e janela de lançamento

Auditoria em 20/10/2026. **NO-GO para piloto produtivo e lançamento comercial.** Preparação operacional estimada em **65/100**; código/jornadas staging permanecem tecnicamente homologados, mas configuração Auth/SMTP, schema produtivo, recuperação e prova produtiva ainda bloqueiam a janela. Nenhuma migration, deploy, merge, alteração de secret/configuração, cobrança, restauração ou escrita de negócio em produção foi executada nesta missão. Em staging foram feitas somente consultas de leitura.

## 1. Main, PRs, CI e publicação efetiva

- Main: `bce96f65c673d0033eaaecfcceac38ac0f81740d`.
- Vercel produtiva READY, domínio `agendeapp.online` atribuído: `dpl_HexMies5ur68oeiu385fdFqXvQML`, mesmo SHA, publicação Git de main. Isso foi disparado pelo merge anterior, não por esta auditoria.
- #66 MERGED em `f8d02125f8c8edc7d67891e3c8a50a520d0bfacc`; #68 MERGED em `bce96f6`; #67 MERGED por seu commit de integração `64c1c92e1f961ce9c6feb3c086641c8574afafba`, já ancestral de #68. Seu head `3c25bb0` é ancestral de main. A árvore de main é **idêntica** à árvore do head homologado #68 `2751fc5`: não houve segunda aplicação/duplicação ao o GitHub reconhecer #67 como integrado.
- [CI da main aprovado](https://github.com/plbr010/agende/actions/runs/39474516800), SHA `bce96f6`. [CI final anterior de #68 aprovado](https://github.com/plbr010/agende/actions/runs/39471831979).
- Branch própria desta missão: `codex/prelaunch-main-audit-20261020`, criada limpa de origin/main. Deploy automático da branch explicitamente desabilitado em `vercel.json`. Não fazer merge desta PR como simples entrega documental: main aciona produção.

Registro: `prelaunch20-state.json`. O catálogo remoto foi consultado em transações READ ONLY, com metadados e contagens agregadas, sem nomes/telefones/e-mails de clientes nem valores de secrets.

## 2. Matriz funcional: código versus ambientes

| Área | Main + staging homologado | Produção atual | Prova necessária na janela |
|---|---|---|---|
| Reserva autenticada, e-mail confirmado, draft preservado | PASS real da missão #68, sem confirmação administrativa; guards de UI/Server Action/SQL e corrida real | FAIL de segurança no banco: anon ainda executa wrapper; app sem gate de confirmação e com fallback guest | Cinco migrations + vaga válida, anon/unconfirmed negados, confirmado e equipe autorizados |
| Busca cidade/estabelecimento/profissional | PASS Muriaé/Juiz de Fora, acentos/espaços, URL, negativos e elegibilidade | Parcial: busca base instalada, falta correção de elegibilidade/REINDEX; GET de páginas retorna 200, não prova conteúdo de negócios | Fixture controlada nas duas cidades e profissional ligado a serviço ativo |
| Logo/capa/profissional/cliente global | PASS real de bytes, upload/troca/remoção/isolamento | Parcial: avatar privado existente; cover/photo/RPCs/filas novas ausentes | Migrations e smoke autorizado com arquivos exclusivamente novos |
| WhatsApp manual | PASS clique/302, número/mensagem/status, sem envio ou mutação de status | RPC ausente | Migrar e verificar nome/telefone autorizado, pendente coerente e cancelado negado |
| Proprietário/trial/equipe/serviços/agenda/financeiro/estoque | PASS real staging na missão #68; equipe sem assinatura individual, trial 7 dias | Guards base internos presentes; nenhum smoke de escrita produtiva nesta missão | Jornada QA autorizada; preservar trial/histórico reais |
| E-mail e recuperação | PASS real staging/SMTP/PKCE | BLOCKED: Site URL localhost, redirects vazios, SMTP custom off | Configuração produtiva aprovada e e-mail entregue no host correto |
| Sessão natural | PASS definitivo #68: 3.600 s reais, JWT original recebeu 403/bad_jwt, refresh preservou identidade, logout limpou | Não repetido com usuário produtivo | Evidência staging definitiva suficiente para código; smoke produtivo após autorização |
| Stripe | Seis sessões TEST conciliadas, idempotência/portal/cancelamento e replay distinguidos no #68 | Endpoint LIVE ativo/8 eventos, zero entregas no período exibido; webhook fonte desatualizada | Publicar fonte revisada e validar gates; entrega positiva LIVE continua não comprovada |

O resultado definitivo de sessão está em `docs/homologation/final20-session-lifecycle.json`. Não há mais pendência daquele teste de uma hora. Esta missão não repetiu cadastros/reservas cloud porque o escopo atual é somente leitura remota.

## 3. Cinco migrations e diferenças históricas

Revisão completa de cada tabela/função/política/grant, compatibilidade, risco e pós-consulta: [prelaunch20-migrations.md](prelaunch20-migrations.md). Ordem única:

1. `20261015054116_workspace_media_and_settings_contract.sql` — capa, lifecycle/filas/locks de mídia, políticas server-write e contrato de settings.
2. `20261015054818_workspace_settings_validation.sql` — reafirma validação e ACL privada de settings, sem duplicar objetos ou linhas.
3. `20261016075244_profiles_booking_whatsapp.sql` — perfil/foto privada, avatar relacionado, WhatsApp autorizado e primeira guarda de reserva.
4. `20261016235000_require_confirmed_public_booking.sql` — elimina fallback guest, mantém apenas reserva de conta confirmada; essencial aplicar junto de #3.
5. `20261020162935_launch_discovery_eligibility.sql` — normaliza busca, exige vínculo/serviço elegível e reconstrói índice dependente.

Produção: 67 entradas históricas; os cinco nomes ausentes. Staging possui as definições, apesar de timestamps diferentes. Nada de `db push`/`migration repair` indiscriminado. Produção tem quatro workspaces, seis appointments históricos, um cliente vinculado e zero reservas futuras no instante da consulta; zero referência logo fora do tenant. Não foram lidas linhas privadas. Não há DELETE/backfill de clientes, tenants ou agendamentos nos cinco DDLs; há locks e mudança de comportamento em novos writes. Terceira migration não é idempotente; aplicação parcial/replay exige parada, não limpeza para forçar instalação.

Preparado e testado: `prelaunch20-apply-five.sql`, manifest de hashes UTF-8 LF e gerador local sem conexão. Bundle de uma transação, stop-on-error, timeouts, detecção de histórico/objetos já presentes e registro apenas das cinco fontes. **Termina com criação de reservas pausada**; reabrir é outra autorização. Gates pós-retomada: `prelaunch20-postchecks.sql`. Nenhum desses arquivos foi executado remotamente.

## 4. Segurança e infraestrutura

| Item | Evidência e avaliação |
|---|---|
| Supabase | `ACTIVE_HEALTHY`, Postgres 17.6.1.166; todos os tables públicos auditados com RLS. Novas filas exigem RLS forçada. Não alteramos policies/grants remotos |
| Reserva direta | Risco crítico confirmado por grants/corpo SQL, mesmo com Server Action fechada. Não fizemos POST anônimo vulnerável em produção para provar algo já demonstrado pelo catálogo |
| Telefone/tenant | Guards internos normalizados de criação e can_write coincidem staging/prod; nova RPC WhatsApp só authenticated + confirmação + autorização da appointment. Sem diretório global; provas dinâmicas staging e locais passam, aceitação produtiva futura condicionada |
| Storage | `workspace-logos` público (2 objetos), `account-avatars` privado (1), bucket privado de fotos profissionais ausente. Logo público não implica avatar público. Não abrimos fotos privadas nem alteramos bytes |
| Vercel env | URL/chave pública globais presentes, service role sensível apenas no target production; valores não descriptografados. Helper `avatar-admin.ts` usa `server-only`, valida ref/role e não persiste sessão. Nenhum NEXT_PUBLIC service role encontrado nos nomes |
| Origem de app | SITE_URL/NEXT_PUBLIC_SITE_URL globais ausentes; fallback validado de origem Vercel existe. Classe produtiva é embutida por next.config.ts, não uma variável faltante. Não inventar diagnóstico por ausência de variável opcional |
| Auth | Cadastro/e-mail provider/Confirm email habilitados; anonymous sign-in off. **Site URL localhost + nenhuma redirect URL** bloqueiam confirmação/recuperação canônicas. SMTP custom off; não foi disparado e-mail produtivo |
| SMTP | Requer provedor/remetente já aprovado, credenciais seguras e prova de entrega. Nenhum serviço/plano foi contratado ou configurado |
| Credencial no browser | 21 assets JS referenciados por páginas inspecionadas não contêm JWT service_role, sb_secret ou chave privada LIVE literal; limite: amostra pública, não garantia universal nem validação runtime do secret servidor |
| Domínio/HTTPS | GET HTTPS normal com TLS validado: home/login/buscas 200; API avatar sem sessão 401. Não prova que as buscas têm resultados ou que upload autenticado funciona |
| Stripe LIVE | Dashboard de conta LIVE: destino produtivo ativo e oito eventos esperados, API 2026-08-26.dahlia, zero entregas e zero falhas no período exibido. Não revelar segredo de assinatura. Zero entregas não certifica assinatura, ativação ou pagamentos |
| Credencial billing | Secret `STRIPE_API_KEY` existe em Edge e `stripe_webhook_secret` em Vault; valores não lidos. Presença não comprova prefixo LIVE, permissões ou correspondência do signing secret. Connector pediu reautenticação; dashboard autenticado forneceu leitura de configuração |
| Edge Functions | stripe-billing v5 ACTIVE/verify_jwt=true coincide com main. **stripe-webhook v4 ACTIVE difere**: faltam guardas de API key/event.livemode por ambiente e logging sanitizado. Assinatura continua sendo exigida; não há evidência de exploração. Publicação própria necessária, sem trocar segredo ou cobrar |
| Advisors | WARN de RPC SECURITY DEFINER inclui APIs públicas intencionais e reserva anônima indevida; não corrigir tudo revogando leitura pública. INFO de filas RLS sem policy é coerente com server-only. Leaked-password protection off é hardening pendente; não habilitar plano/custo sem aprovação |

Fontes sanitizadas: `prelaunch20-infrastructure.json`, catálogos, `prelaunch20-http.json`, hashes de Edge no registro de estado. Documentação oficial: [backups/Storage](https://supabase.com/docs/guides/platform/backups), [SECURITY DEFINER público](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [proteção de senhas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). A existência de avisos não foi usada para enfraquecer RLS ou revogar funcionalidades sem análise.

## 5. Backup e reversão: bloqueio real

Dashboard autenticado confirma plano **FREE**, sem backup agendado e sem PITR. Existem dois conjuntos de backup produtivo criptografado de 16/10, o mais novo com snapshot 16/10/2026 **01:01:42, horário de Brasília**. Os quatro ciphertexts desse conjunto e do anterior conferem em hash/tamanho. Os manifests registram `restore_verified=false` e `full_platform_restore_verified=false`; autenticação do manifest e descriptografia não foram refeitas. Não há integridade lógica/restauração recente comprovada. Hashes legíveis do manifest não equivalem a autenticidade criptográfica validada.

Cobertura declarada: app/public/auth/extensions/histórico e arquivo de roles, sem prova de plataforma completa. **Não inclui bytes Storage**; banco guarda apenas metadados. Selftests antigos são sintéticos e não substituem essa prova. Nenhum restore executado hoje. RPO/RTO produtivos desconhecidos; não usar os segundos do teste sintético como SLA. Precisa de backup novo, cópia independente e restore isolado autorizado, incluindo os três objetos existentes e configurações pertinentes. Ver `prelaunch20-backup-audit.json`.

Rollback antes do commit SQL: transação aborta sem aplicar parcialmente; pausa prévia fica ativa. Depois do commit: preferir fix-forward, não DROP de colunas/filas/bucket nem restauração de fallback guest/grant anon. Rollback de frontend não desfaz schema/Auth/Storage; inversão de DDL não recupera bytes. Suspensão/retomada preparadas e testadas em `prelaunch20-stop-bookings.sql` / `prelaunch20-resume-bookings.sql`. Restore produtivo precisa de nova autorização por ponto, escopo e perda aceitável de writes.

## 6. Testes executados nesta missão

- Main: **410/410 locais**, categorias preservadas (unidade/contratos/mocks/PGlite, não 410 E2E); **70/70 PostgreSQL 17.6 nativo**, incluindo dez de concorrência, com Auth/Storage simulados. Novos snapshots `prelaunch20-main-*`, sem sobrescrever os históricos de homologação.
- Lint, typecheck, build Node 24 com configuração pública staging e smoke de build: PASS. CI da main também verde; nenhum build local recebeu service role produtivo.
- Novo teste incremental em PGlite e PostgreSQL 17.6 nativo: fontes/bundle antes das cinco, dados preexistentes preservados, histórico anterior mantido e cinco registros exatos, ausência de intenção/replay recusados, final em manutenção e retomada authenticated sem anon; grants/índice/bucket/RLS pós-apply passam. Evidência `prelaunch20-upgrade-native-*`. Duas suítes de descoberta foram repetidas pelo runner auxiliar; não somá-las aos 70 como testes novos independentes.
- Teste incremental adicionado ao `npm test` e categorizado como SQL: **411/411 na candidata** e lint aprovado. Também valida hashes do bundle/fontes para impedir uso de pacote desatualizado. Gerador é offline; verificação de HTTPS usa exclusivamente GET. Nenhum smoke de escrita produtiva foi executado.
- Pequena correção documental: duas linhas do relatório anterior #68 tinham bytes mistos de encoding; normalizadas para UTF-8 sem alterar os resultados. Nenhum bug de aplicação novo reproduzido, nenhuma alteração TSX ou migration histórica.

## 7. Plano, smoke e autorizações

[Runbook completo](prelaunch20-runbook.md): pausar por autorização, backup/restore isolado, Auth/SMTP, transação SQL mantendo pausa, webhook revisado, eventual app por SHA, retomada e smoke, observação e decisão. Contém comando executável e separa **A1–A12**: export/Storage, restore isolado, suspensão, Auth URLs, SMTP, cinco migrations, webhook, eventual app, retomada/fixtures, HTTP negativo, contenção/rollback e restauração produtiva em desastre.

[Smoke de 17 etapas](prelaunch20-smoke.md): atores/ações, PASS/FAIL, evidências e limites, incluindo ambas as cidades, confirmação, criação interna, concorrência, fotos privadas, WhatsApp sem envio, trial, tenant e webhooks sem cobrança. Todos os writes produtivos estão **NOT RUN**. Requisição negativa de assinatura/modo prova rejeição, não entrega positiva LIVE. Não fabricar evento financeiro válido para obter um PASS.

## 8. Estimativa fundamentada e decisão

| Dimensão operacional | Pontos obtidos / peso |
|---|---:|
| Código e jornadas homologadas em staging, árvore integrada sem regressão detectada | 40/40 |
| Qualidade automatizada, ensaio incremental e plano executável | 20/20 |
| Infraestrutura (HTTPS/backend/env/endpoint presentes; Auth/SMTP e drift pendentes) | 5/10 |
| Schema produtivo revisado e instalado/validado | 0/10 |
| Recuperação recente banco + bytes Storage demonstrada | 0/10 |
| Jornadas e aceite produtivo após publicação/configuração | 0/10 |
| **Prontidão operacional estimada** | **65/100** |

Essa escala mede **prontidão da janela produtiva**, diferente dos 90% anteriores de preparação técnica da candidata. Não é probabilidade de sucesso; qualquer gate de segurança prevalece sobre a soma. Plano preparado: GO para revisão e autorização consciente. Execução da janela agora: NO-GO enquanto backup/recuperação e configurações não satisfizerem os gates. Piloto real: NO-GO até migrations/Auth/SMTP/webhook e smoke autorizado passarem. Comercial: NO-GO adicional até aceite de faturamento LIVE e recuperação operacional. Uma aprovação de deploy isolada não autoriza banco, secrets, eventos, fixtures ou restore.
