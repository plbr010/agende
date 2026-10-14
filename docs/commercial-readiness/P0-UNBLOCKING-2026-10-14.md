# Desbloqueio P0 — 14/10/2026

Recomendação atual: **NO-GO comercial**. Há implementação e homologação novas; confirmação por SMTP, cobrança integrada e recuperação produtiva ainda dependem de acesso/configuração do proprietário. Não houve alteração de banco, Auth, Edge Functions ou variáveis de produção nesta missão.

## Estado revalidado

Main e produção: `ad24a7f9ac7b09fedb1ee0a6cfdecacfe170b043`, após merge humano do PR #41. Vercel `dpl_3GaQJAjW8Z3jfng9KXaQRdCmN4LE` READY. PRs #31–42 integrados; trabalho do Cursor preservado. Nova branch `codex/p0-launch-unblocking-2026-10-14`, baseada nessa main, sem merge automático.

Entrega: [PR #44](https://github.com/plbr010/agende/pull/44). Preview isolado READY: `dpl_87m2oanQBCCy6Lcn9paxBeAChXef`, commit `cbce09bf20bcedacf5c627aa241eeec27de13560`; isso comprova deploy, não aceite comercial. Overrides registrados em `docs/staging/p0-preview-bindings.json`.

Produção `wohimauqgywshbbejjcl`, PostgreSQL 17.6, 63 migrations no histórico: RPC de serviços e descoberta continuam ausentes. Staging `fkpdudnnperufnmdwdlv`, PostgreSQL 17.11: ambas existem. O staging foi parcialmente provisionado por SQL exato e possui timestamps diferentes no histórico; comparar apenas a contagem de migrations seria incorreto. Não executar `db push` ou reparar história em massa.

As 31 tabelas públicas produtivas e as 32 de staging têm RLS + FORCE RLS. Guards produtivos de email confirmado, manager e entitlement foram lidos; o lock de membership é compatível. Os definers inspecionados usam search_path vazio e os guards internos não têm EXECUTE público. Isso não constitui certificação de todos os endpoints ou capacidade em nuvem.

Advisors dos dois ambientes continuam sinalizando RLS sem policy na tabela interna, EXECUTE de definers por anon/authenticated e proteção contra senhas vazadas desativada. São quatro categorias agrupadas, não quatro funções: revisar os objetos listados, mantendo os wrappers públicos necessários e seus guards. Referências: [RLS/policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [definers anon](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [definers authenticated](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Não removemos APIs nem contratamos recursos para ocultar avisos.

Snapshot sem dados de clientes/segredos: [p0-current-state-2026-10-14.json](p0-current-state-2026-10-14.json). As diferenças de hashes de definição entre ambientes exigem revisão semântica; não afirmar identidade binária de todos os guards.

## Implementação e operação realizadas

- Retorno padrão do Checkout produtivo corrigido no código para `https://agendeapp.online`, com teste dos URLs de sucesso/cancelamento. A Edge produtiva não foi atualizada.
- Edge Functions **somente staging** atualizadas: stripe-billing v2 e stripe-webhook v3. Incorporam as correções já integradas de logs sem mensagens brutas de provedores. JWT gateway permanece no modo anterior; billing valida o token com GoTrue e manager membership, webhook valida assinatura Stripe. Testes reais negativos passaram após deploy.
- Novo payload exclusivo `docs/production-readiness/apply-discovery-only.sql`, gerado da fonte exata. Preflight de dependências/drift, grants verificados, default privado, fonte exata no único registro de história e recusa de replay. Não aplicado em produção.
- Jornada real do navegador ampliada: busca → perfil → serviço → profissional único → dia → horário → dados → reserva → confirmação → presença na agenda profissional. Reserva sintética cancelada, serviço arquivado, publicação/cidade restauradas e horário temporário removido ao concluir.
- Novos runners de pré-requisitos, Auth assistido por mailbox e Checkout/Portal pelo Agendê. Têm opt-in de staging, origem fixa autorizada e evidência que distingue pré-requisito, integração parcial e aceite comercial. Não registram senhas, tokens ou links de Auth.
- Modelos de email preparados para `/auth/confirm` e `/auth/recovery` via TokenHash, permitindo abrir a mensagem em outro navegador. Ainda não aplicados nem homologados.
- Overrides de Preview específicos desta nova branch apontam para staging. Bindings globais produtivos preservados; guard existente recusa inicialização de produção fora de deployment production.

## Evidências desta rodada

| Verificação | Resultado e limite |
| --- | --- |
| Aplicação | 295 PASS, 0 FAIL, 0 SKIP no Node 24; inclui 30 testes PGlite, 11 integrações com Auth mock e 14 mocks Stripe. Não é SMTP/Stripe E2E. |
| PostgreSQL 17.6 nativo | 49 PASS + cinco suítes SQL; 8 de concorrência, 30 SQL e 11 integrações com Auth fixture. Não somar como casos únicos aos 295. |
| Lint e build | PASS; Next 16.3.8, tipos compilados. Uma primeira execução concorrente de testes falhou no worker signup; teste isolado e suíte completa seguintes passaram. Falha preservada. |
| Navegador staging real | 8 jornadas PASS, incluindo login, 8 páginas operacionais, criação atômica de serviço, publicação/retirada, descoberta e reserva na agenda. Contas anteriores confirmadas por fixture; isso não prova signup/SMTP. |
| Descoberta API real | 7 checks PASS; consentimento, cidade, nomes globais, páginas distintas, privacidade e autorização. |
| API operacional reexecutada | 5 grupos PASS; concorrência de reserva BLOCKED por `booking_rate_limited` do cliente sintético. Casos dependentes não reexecutados. Proteção mantida, não apagamos eventos nem aumentamos quota. |
| Auth/Edge HTTP | Confirmação obrigatória, sessão real de fixture, billing anônimo/token inválido recusados e webhook sem assinatura recusado. Chave billing ausente: BLOCKED. |
| TLS de backup | TLS 1.3, certificado validado no pooler; sem autenticação, cópia de dados ou escrita. |
| Ensaio cifrado sintético | PASS: fingerprints, catálogo, roles, Auth SQL, sequência, autenticação dos arquivos; adulteração e senha incorreta recusadas. 2 tabelas, RTO 17,802 s; não é RTO/backup produtivo. |

Receipts: `docs/homologation/{standard-tests,native-tests,native-pg17}.json`, `docs/staging/{browser-functional,discovery-real-api,real-api-results,launch-prerequisites}.json`. Tentativas iniciais preservadas com prefixo `p0-`. Captura final: `docs/evidence/functional-2026-10-14/booking-confirmed-mobile.png`.

## Bloqueios e ações exatas

| Problema / impacto | Correção preparada | Dependência e ação do proprietário | Comprovação necessária |
| --- | --- | --- | --- |
| Backup produtivo: senha 28P01; impede migration segura | Exportação em snapshot read-only, AES-256-GCM e restauração local isolada, com integridade/roles/Auth SQL | Recuperar a senha existente em seu gerenciador e digitá-la apenas no prompt oculto. Se indisponível, pedir aprovação específica para um plano de redefinição após inventariar conexões afetadas. Nenhum reset autorizado/executado. | Export real completo + restore real igual + segunda cópia cifrada e senha disponíveis + aceite dos limites de RPO/RTO/cobertura. |
| Serviços: RPC ausente em produção | `apply-service-rpc-only.sql`, fonte hash `d13be7931bf92be45ef754858d4642881186f5bd8f9ce8a0d5f919419e5c0b37`; preflight/rollback transacional e testes reais staging | Após backup recuperável, autorizar especificamente versão `20261010232248` em produção. Teste com gravação produtiva exige autorização adicional. | História única, funções/grants/cache PostgREST e catálogo prévio preservados; depois, cadastro autorizado + vínculo persistido. |
| Auth produção: Site URL localhost, sem Redirect URLs | Proposta Site URL `https://agendeapp.online`; callbacks `/auth/callback`, `/auth/confirm`, `/auth/recovery` no mesmo domínio; NEXT_PUBLIC_SITE_URL produtivo explícito | Aprovar essas configurações produtivas separadamente. A ordem atual do usuário limita testes a staging; não as aplicamos. | Links recebidos retornam ao domínio correto; inválidos/reutilizados recusados; sessão e login persistem. |
| SMTP ausente nos dois ambientes; signup e reset não homologados | Templates TokenHash e runner mailbox assistido | Proprietário confirmou que configurará **somente staging** com Resend. Inserir chave diretamente em Auth → Emails → SMTP Settings, domínio/remetente verificados, tracking desativado. Não enviar chave ou links pelo chat. | SMTP ativo + evento delivered no Resend + mensagem recebida + confirmação/login/trial real + recuperação e rejeição de reutilização. Expiração por tempo e login com nova senha têm aceite separado. |
| Stripe TEST: chave ausente; Checkout do app responde 503 | Runner cria seis Checkouts e Portals pelo billing Edge, verifica reuse e binding sem ativar assinatura prematuramente | Proprietário configurará `stripe_api_key` no Vault staging, com RAK TEST da conta agende-staging. Avisar conclusão; não compartilhar chave. | Checkout do app → pagamento TEST → webhook recebido → billing_events → assinatura/entitlement. Depois Portal, troca, cancelamento, falha, replay e renovação. |
| Descoberta ausente em produção | Payload exclusivo versão `20261014030220`, hash `d86c2a9c666d34ec7fc66c1a60a30eb5dce20dfda197219f1f979dbd69d16224` | Após backup, autorizar especificamente esta migration. Nenhum opt-in automático. | Todos privados inicialmente; publicação consentida por manager; busca e retirada verificadas. |
| Outros quatro deltas produtivos | Fontes existentes: reviews, FORCE RLS reviews, owner guard observado e billing excess seats; testes locais existentes | Revisão individual, backup e aprovação própria. Owner guard já tem objetos observados fora da história; não reaplicar cegamente. | Preflight atual, ausência de perda de dados e aceite por função. Limites pagos devem ser comprovados com Stripe sincronizado. |
| Isolamento global Preview/Development | Guard de código impede conexão produtiva; branch atual tem overrides staging | Aprovar plano de separar bindings globais futuramente; não mudar variáveis com target production por inferência | Manifesto por ambiente, Preview com backend staging e erro fechado ao apontar indevidamente para produção. |
| Abuso/monitoramento/capacidade | Booking quota real ativa; descoberta limita input, limit 1–50 e offset 0–10000 | Escolher e aprovar política de limite no ingresso/API e alertas antes de exposição comercial ampla | Ataques por IP/identidade, latência de busca e alertas exercitados. Limites de consulta não equivalem a rate limiting distribuído. |

### Backup: alternativas suportadas

Organização Free e painel atual: **Free Plan does not include project backups**. A [documentação Supabase](https://supabase.com/docs/guides/platform/backups) recomenda exportação regular no Free. O caminho gratuito preparado exige a credencial SQL; OAuth do MCP e chave pública não substituem senha para pg_dump. Não classificamos dumps parciais de linhas pelo MCP/CSV como cópia consistente e recuperável.

Backups físicos pagos/PITR não são arquivos lógicos diretamente baixáveis e sua contratação/restauração exigiria autorização própria. Não pausamos projeto, contratamos plano ou restauramos sobre produção/staging. Se o proprietário já tiver cópia externa, validar formato, data, checksum, cobertura e restore antes de considerá-la suficiente.

O ensaio de core SQL não recupera automaticamente arquivos Storage, configurações GoTrue/SMTP, Edge secrets, Vault root key, DNS ou Cron operacional. Ver `FREE-BACKUP-RECOVERY.md`; backup previamente autorizado, execução ainda bloqueada por credencial. Nenhuma nova tentativa de senha foi feita nesta rodada.

### Auth/SMTP e DNS

O [guia oficial Resend](https://resend.com/docs/send-with-supabase-smtp) exige chave e domínio verificado: smtp.resend.com, porta 465, usuário resend, senha inserida diretamente como chave Resend. Remetente pertence ao domínio verificado, nome Agendê Staging. A sessão Resend disponível está sem login; DNS público consultado não comprovou TXT/DMARC, e seletores DKIM/return-path não foram inventados. Os valores SPF/DKIM devem vir do painel do domínio Resend; comparar no DNS antes de liberar envio. Nenhuma configuração/DNS produtiva alterada.

Site/Redirect URLs do staging já permitem localhost/127.0.0.1 na porta 3000 para callback e recovery. O ensaio de email mantém servidor loopback nessa porta, proprietário abre o email e escolhe sua senha diretamente no formulário. Tokens ficam apenas em memória para provar recusa de replay; nenhum inbox/código/link é solicitado. Cadastro cliente com confirmação própria, convite por email e expiração natural ainda não são PASS.

### Stripe TEST atual

Conta `acct_1UPNGJQQUyqAaZvS`, livemode false. Seis preços ativos BRL: Solo 8990/79900, equipe 16990/149900, salão 29990/279900, períodos mês/ano. Endpoint `we_1UPO4UQQUyqAaZvSJGQYJzu5` enabled, webhook staging, API 2026-08-26.dahlia e oito eventos necessários. Vault possui signing secret, mas não chave API; valores não lidos.

Portal TEST ativo com cancelamento e troca de preço; bloqueio de downgrade com usuários excedentes/open invoices não foi comprovado no Portal. Cinco sessões históricas unpaid agora expired; uma sessão histórica complete/paid não comprova o fluxo integrado da aplicação atual. Ciclo com Test Clock de 11/10 é histórico e não inclui persistência no Agendê. Nenhum preço ou configuração LIVE foi modificado e nenhum pagamento real foi feito.

## Deploy e rollback

1. Revisar e integrar o PR por decisão humana; não tratar código integrado como migrations/Edge produtivos aplicados.
2. Concluir SMTP e Stripe TEST em staging, com recibos reais e falhas/replays. Usar dados sintéticos separados e respeitar quotas; não remover proteções para tornar testes verdes.
3. Concluir backup real e restore isolado. Registrar RPO/RTO e cobertura aceita imediatamente antes da janela de mudança.
4. Obter autorização distinta para cada payload produtivo e para configurações/Edge propostas. Revalidar fontes/hashes/dependências/drift imediatamente antes.
5. Aplicar payload aprovado via psql `-X --set=ON_ERROR_STOP=1 --single-transaction`, TLS verify-full. Timeouts e qualquer falha abortam catálogo e registro de história juntos. Sem `db push` abrangente.
6. Verificar objetos, grants, RLS, história e cache PostgREST por leitura. Somente depois de autorização de gravação, homologar serviço/reserva sintética produtiva e sua limpeza prevista.
7. GO apenas após jornadas comerciais essenciais e operação/recuperação aceitas.

Antes de commit SQL: rollback da transação. Depois de commit: preferir correção aditiva revisada; não derrubar tabelas/colunas nem restaurar banco descartando gravações posteriores. Descoberta pode ser retirada por manager e UI bloqueada em rollback de frontend; preservar consentimentos/dados. Frontend pode voltar ao deployment READY anterior pelo proprietário; verificar compatibilidade de banco. Edge staging anterior é preservada localmente em `.test-postgres/staging-stripe-*.ts`; produção permanece na versão anterior e exigirá snapshot/revisão própria antes de deploy.

Autorizações ainda necessárias: redefinição de senha somente se escolhida; serviços, descoberta e demais migrations produtivas separadamente; Auth URLs/SMTP/variáveis/Edge de produção; testes com escrita produtiva; qualquer contratação ou pagamento LIVE. SMTP/chave TEST staging estão dentro do escopo autorizado, aguardando apenas configuração segura do proprietário.
