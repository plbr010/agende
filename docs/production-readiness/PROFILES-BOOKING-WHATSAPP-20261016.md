# Entrega — perfis, imagens, reserva autenticada e WhatsApp

16/10/2026, America/Sao_Paulo. Branch `codex/profiles-booking-whatsapp-20261016`, base `b937621` de `origin/main`.

## Auditoria e preservação

O diretório inicial é um repositório PetGestor que contém o checkout Agendê. O checkout Agendê original estava na branch `codex/agende-visual-redesign`, commit `7074992`, com alterações locais extensas em autenticação, componentes visuais, agenda, contratos e dependências. Outros checkouts também tinham evidências e mudanças locais. Nenhum foi resetado, modificado ou usado como base de escrita. A missão usa um worktree Git separado a partir do main atualizado, que já contém os PRs #59, #60 e #61. Na consulta GitHub não havia PR aberto do Cursor; os pontos de integração foram mantidos pequenos e documentados.

Auditoria de código: Auth/PKCE/convites e três jornadas, perfis globais, workspace_clients.linked_user_id, catálogo/vínculos de profissionais e serviços, agenda/reagendamento/cancelamento, migrations, RPCs SECURITY DEFINER/grants, RLS/FORCE RLS, Storage e cliente server-only. Nenhuma alteração Stripe foi necessária.

A consulta somente leitura ao projeto produtivo `wohimauqgywshbbejjcl` encontrou 67 versões aplicadas, bucket de logos público e avatar pessoal privado. `profiles.avatar_path` existe; `workspace_settings.cover_path` e `professional_profiles.photo_path` não existiam. As cinco tabelas centrais têm RLS/FORCE RLS. A RPC de reserva ainda concedia EXECUTE a anon e a função interna aceitava usuário nulo: a barreira da Server Action não bastava. A evidência está em `docs/homologation/profiles-booking-production-audit-20261016.json`.

## Funcionalidades entregues e reutilizadas

1. Logo, capa, edição pública do salão e avatar global pessoal já estavam implementados no main. Foram preservados e seus testes de normalização, troca, remoção, autorização e isolamento foram executados. As migrations de logo/capa continuam pendentes em produção; não se deve confundir código existente com recurso já liberado nesse ambiente.
2. Foto opcional do profissional, separada por membro/estabelecimento, com editor para proprietário/admin e para o próprio profissional ativo, preview, substituição, remoção e fallback com iniciais. A foto aparece na equipe, no diálogo da agenda e na escolha pública de profissional.
3. Proxy privado para o avatar global do cliente na agenda. Exige vínculo de conta e agendamento que o membro da equipe possa gerenciar. O estabelecimento não consegue alterar o avatar. Duas relações legítimas de salões diferentes usam a mesma referência global.
4. Bloqueio de reserva anônima no próprio banco. Assinatura da RPC preservada; e-mail verificado obtido do Auth; preço, duração, serviço, profissional e disponibilidade continuam autoritativos. A criação pela equipe permanece separada e protegida.
5. WhatsApp manual com dados atuais, texto próprio para solicitação pendente e para agendamento confirmado, horário local, telefone internacional validado e mensagem codificada. Clique nativo abre aplicativo/Web; cópia manual tem fallback. Não envia automaticamente, não cobra, não altera status e não registra envio.

## Migration e infraestrutura

Nova migration: `supabase/migrations/20261016075244_profiles_booking_whatsapp.sql`, criada com Supabase CLI 2.121.0. SHA-256 do arquivo normalizado LF: `f647bd497bb4af9a73b6e584da39e7d663bcda1c2a83993e70d0e58e2b44f31a`.

Ela substitui a função interna de reserva com guard de conta confirmada; revoga anon no wrapper público; adiciona photo_path com constraint de propriedade; cria bucket privado professional-photos e fila app.professional_photo_cleanup com RLS/FORCE RLS; cria RPCs de lease/CAS/limpeza somente para service_role e consultas autorizadas de foto, avatar relacionado e dados de WhatsApp. Não faz backfill, não apaga dados existentes, não altera planos/Stripe e não modifica migrations históricas.

Aplicada **somente em staging** `fkpdudnnperufnmdwdlv`, registrada pelo MCP como versão `20261016080427`, nome `profiles_booking_whatsapp`. O corpo anterior da reserva foi comparado com a base local antes da substituição: MD5 normalizado `089cb5c079de2bfe3da9a3f81060d5e4` em ambos. Não renumerar o arquivo local nem reparar histórico por inferência; mapear o conteúdo/nome entre ambientes.

Após aplicação, anon não tem EXECUTE da reserva, authenticated não tem acesso às trocas privilegiadas, professional-photos é privado e a fila tem RLS/FORCE RLS. Ao término dos testes reais: zero objetos de fotos de profissionais, zero referências e zero itens nessa fila. Somente imagens sintéticas desta rodada foram removidas pelo fluxo normal. Reservas sintéticas foram canceladas, preservando os registros. Nenhum dado comercial anterior foi apagado.

## Contratos para o Cursor

Ver `docs/codex/profiles-booking-whatsapp-contract.md`: endpoints, cabeçalhos, estados, permissões, campos, componentes e semântica de erro/limpeza. Tipagem de RPC e photo_path incluída em `src/lib/supabase/database.types.ts`. A única nova dependência é `libphonenumber-js` 1.13.15, fixada com lockfile.

## Validação executada

Node 24.19.0 do runtime local; Next.js 16.3.8. O Node padrão da máquina é 20, portanto foi usado o executável compatível para as verificações finais.

| Verificação | Resultado |
| --- | --- |
| npm ci | PASS com lockfile final |
| npm run lint | PASS |
| npm run typecheck | PASS |
| npm run test | 388 PASS, zero falhas/skip |
| npm run build | PASS; nenhuma publicação |
| npm run test:postgres | 70 PASS, incluindo 10 casos de concorrência real em PostgreSQL 17.6; cluster próprio em loopback, encerrado ao final |
| Auditoria SQL dos cinco módulos legados | foundation/catalog/workspace_settings/agenda/public_booking PASS |
| Staging: fotos e WhatsApp | 8 PASS com GoTrue/PostgREST/Storage reais, Next local e Edge headless |
| Staging: rascunho e login | 3 PASS: seleção anônima, login real e horário ocupado durante login com escolhas preservadas |
| Staging: avatar pessoal existente | 6 PASS: inválidos/CSRF, upload privado, troca, novo login, remoção e conta profissional independente |
| npm audit --omit=dev | Zero vulnerabilidades reportadas |
| npm audit completo | Cinco alertas high já presentes na árvore de ferramentas ESLint/glob; não foi aplicado downgrade automático do Next/ESLint |

Evidências: `docs/homologation/standard-tests.json`, `native-tests.json`, `native-pg17.json`, `pg17-concurrency.json`, `profiles-booking-staging-20261016.json`, e `docs/staging/client-phase2-booking-browser.json`, `client-phase2-avatar-http.json`. Os testes SQL locais emulam identidade Auth; não são apresentados como login real. Os três runners de staging usam os serviços reais e credenciais existentes em memória, sem configurar secrets.

## Segurança e limites

Testados: escrita direta de photo_path e RPC privilegiada negadas; tenant/profissional alheio e recepção não editam foto; próprio profissional ativo pode; inativos/removidos deixam de aparecer publicamente; objeto privado não permite download/assinatura por outra conta; conteúdo executável/SVG/corrupto/dimensões/tamanho excessivos negados; EXIF removido; referências não são trocadas antes de bytes válidos existirem; CAS concorrente não perde a foto vencedora; limpeza não reclama referência atual; requests repetidos e concorrentes não duplicam reservas; reagendamento e cancelamento mantêm autorização e estado; WhatsApp não aceita estados terminais nem escreve status; cliente de outro salão não recebe foto global sem relação legítima.

Advisors de staging: nenhuma indicação ERROR; há avisos genéricos de RPCs SECURITY DEFINER intencionalmente expostas e INFO sobre filas privadas sem policies (acesso só por service_role). A nova leitura pública de foto usa o catálogo autorizado; as consultas privadas validam ator/relacionamento. Não foram criadas policies permissivas para silenciar avisos. Detalhes em `docs/homologation/profiles-booking-advisors-20261016.json` e remediações oficiais: [RPC pública](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [RPC autenticada](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [RLS sem policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy). A proteção de senhas vazadas segue desabilitada no staging: [documentação](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection); configuração Auth não foi alterada.

A remoção via Storage é confirmada pela listagem e pelas referências; bytes previamente obtidos podem permanecer brevemente em caches do provedor. O proxy sempre resolve a referência atual e responde no-store. Upload abandonado é elegível para limpeza após uma hora; nova operação bem-sucedida daquele profissional processa a fila. A fila deve entrar na manutenção operacional para profissionais sem novas operações; não há cron novo ativado nesta entrega. Em falha de transporte após possível commit, nunca apagar o upload às cegas.

WhatsApp foi validado sem efetivar envio nem seguir o redirecionamento externo. A entrega ao telefone, conta WhatsApp do destinatário e ação final de Enviar dependem do usuário. Validação E.164 não comprova que um número possui conta WhatsApp.

## Homologação e decisão de publicação

**GO para revisão/homologação. NO-GO para publicação produtiva nesta rodada.**

1. Revisar o PR e o contrato do Cursor. Revalidar em Preview explicitamente ligado ao staging; as provas atuais de navegador usam Next local com backend real de staging, não o novo domínio Vercel de produção.
2. Aprovar separadamente a janela e o SQL produtivo exato. Além da migration nova, logo/capa dependem de `20261015054116_workspace_media_and_settings_contract.sql` e `20261015054818_workspace_settings_validation.sql`, ainda ausentes em produção. Há outras diferenças históricas fora do escopo: não executar db push geral, replay ou migration repair.
3. Revalidar backup/restauração, hashes, schema/grants e projeto da credencial server-only existente. Não copiar credencial de staging para produção nem criar NEXT_PUBLIC com service_role. A credencial produtiva não foi lida ou alterada nesta missão.
4. Aplicar somente o conjunto explicitamente autorizado, de forma transacional e com limites de lock/statement. Coordenar ativação do editor de logo/capa com as policies que bloqueiam uploads diretos antigos. Preservar dados e histórico existentes.
5. Após autorização de deploy, gerar build com variáveis produtivas corretas, testar as três jornadas, troca/remoção e isolamento com contas autorizadas, e fluxo pendente/confirmado/reagendado/cancelado. Não promover o build de staging para produção.
6. Confirmar a revogação de anon na reserva e os testes negativos antes do aceite. A falha permanece na produção até a aplicação autorizada; corrigir somente a UI não a resolve.
7. Acompanhar filas de limpeza e caches. Rollback preferencial por correção aditiva/reversão de código, mantendo RLS, buckets e referências. Não reabrir reservas anônimas ou remover dados para recuperar uma interface antiga.

Nenhuma migration produtiva, deploy, secret produtivo, cobrança ou alteração Stripe foi executada.

## Arquivos modificados ou adicionados

- `docs/codex/profiles-booking-whatsapp-contract.md`
- `docs/homologation/native-pg17.json`
- `docs/homologation/native-tests.json`
- `docs/homologation/pg17-concurrency.json`
- `docs/homologation/professional-photo-removed-staging-20261016.png`
- `docs/homologation/professional-photo-staging-20261016.png`
- `docs/homologation/profiles-booking-advisors-20261016.json`
- `docs/homologation/profiles-booking-production-audit-20261016.json`
- `docs/homologation/profiles-booking-staging-20261016.json`
- `docs/homologation/profiles-booking-staging-audit-20261016.json`
- `docs/homologation/profiles-booking-validation-20261016.json`
- `docs/homologation/standard-tests.json`
- `docs/production-readiness/PROFILES-BOOKING-WHATSAPP-20261016.md`
- `docs/staging/client-phase2-avatar-http.json`
- `docs/staging/client-phase2-booking-browser.json`
- `docs/staging/client-phase2-booking-resumed-mobile.png`
- `docs/staging/client-phase2-slot-revalidated-mobile.png`
- `package-lock.json`
- `package.json`
- `scripts/pg17-concurrency.test.mjs`
- `scripts/profiles-booking-whatsapp-sql.test.mjs`
- `scripts/run-pg17-tests.mjs`
- `scripts/run-tests.mjs`
- `scripts/staging-booking-draft-browser.mjs`
- `scripts/staging-profiles-booking-whatsapp.mjs`
- `scripts/test-category-reporter.mjs`
- `scripts/workspace-media-sql.test.mjs`
- `src/app/api/appointments/whatsapp/route.ts`
- `src/app/api/clients/avatar/route.ts`
- `src/app/api/professionals/photo/route.ts`
- `src/components/agenda/agenda-board.tsx`
- `src/components/agenda/appointment-whatsapp.tsx`
- `src/components/booking/public-booking-flow.tsx`
- `src/components/catalog/directories.tsx`
- `src/components/catalog/own-professional-profile.tsx`
- `src/components/catalog/person-photo.tsx`
- `src/components/catalog/professional-photo-editor.tsx`
- `src/lib/agenda/whatsapp-actions.test.ts`
- `src/lib/agenda/whatsapp-actions.ts`
- `src/lib/agenda/whatsapp.test.ts`
- `src/lib/agenda/whatsapp.ts`
- `src/lib/booking/calendar.ts`
- `src/lib/media/http.test.ts`
- `src/lib/media/http.ts`
- `src/lib/media/professional-photo-route.test.ts`
- `src/lib/supabase/database.types.ts`
- `src/lib/validation/international-phone.ts`
- `supabase/migrations/20261016075244_profiles_booking_whatsapp.sql`
- `supabase/tests/public_booking.sql`
