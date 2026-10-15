# P0: cadastro, perfis, persistência e imagens

Base inicial `1efb913` (main com PR #55), branch isolada `codex/profiles-media-p0-20261015`. Integração final com `origin/main` em `bf60012` (PR #56 do Cursor), via merge local `1fa623c`. Checkouts anteriores e alterações do Cursor preservados. Nenhum merge de PR, deploy ou escrita produtiva; duas migrations aplicadas somente em staging.

## Diagnóstico e causa de cada problema

**Cadastro de cliente:** a separação e `client_profiles` já existiam; não era necessário criar um segundo sistema Auth. Havia uma precedência incorreta: `plan` na URL forçava a seleção profissional mesmo com `intent=client`. A intenção explícita agora prevalece e o banner profissional não aparece nesse caminho. Formulário/SMTP/PKCE reais comprovaram entrada direta em `/cliente`, sem salão, membership ou trial. Uma identidade profissional também ativou a área cliente, mantendo um único workspace/subscription.

**Foto pessoal:** produção continua sem `profiles.avatar_path`/`residence_city` e sem bucket `account-avatars`; PostgreSQL registrou `column profiles.avatar_path does not exist`. A listagem Vercel não tem binding Production de `SUPABASE_SERVICE_ROLE_KEY` (não lemos valores). São pré-requisitos reais de persistência ausentes, não falha do recorte. As migrations já preparadas e o binding exclusivo do servidor dependem de autorização produtiva. O mesmo endpoint foi reexecutado com Storage real no staging para cliente e profissional.

**Salvar dados comerciais:** produção tem a RPC e todas as linhas de settings, e telefone normalizado passa na constraint atual. O banco registrou `workspace_subscription_inactive` às05:31:15,05:31:27 e05:35:07 UTC. A RPC usada pelas duas telas chama `require_workspace_manager`, que exige entitlement; existem dois estabelecimentos expirados e um com trial válido. A mensagem genérica escondia esse motivo. Corrigimos o tratamento e o link para assinatura, preservando a negação de escrita. A captura do proprietário não foi correlacionada independentemente a um workspace/request específico; não afirmamos que todo erro das telas foi esse. Os mesmos campos passaram no staging pelo formulário e pela RPC, inclusive campos opcionais vazios. Não renovamos trial nem desativamos billing para testar.

**Outros defeitos confirmados no código:** leitura de settings ignorava erro e podia produzir formulário com defaults sobre dados desconhecidos; logo usava `upsert` em filename fixo, confiava no MIME informado, publicava bytes antes de concluir a RPC e não tinha ciclo consistente de remoção. UF inexistente passava pelo Zod e timezone inválido virava Brasília silenciosamente. A camada de Server Actions tinha limite padrão1 MB, incompatível com o formulário antigo que anunciava imagens até2 MB. Capa não tinha coluna, upload ou renderização. Essas causas foram corrigidas com persistência e regressões, sem atribuir automaticamente cada uma à captura produtiva.

## Implementação

- Cliente preserva nome/telefone editáveis com schema anterior: a sessão informa disponibilidade dos campos opcionais e o formulário omite cidade indisponível. Cidade opcional/limpa persiste no schema atual. UPDATE exige retorno da própria linha para não declarar sucesso com zero linhas alteradas.
- Settings falham explicitamente na leitura, validam endereço/cidade/UF/CEP/fuso e retornam erros por campo. RPC mantém assinatura, valida também chamadas diretas e grava atomicamente. Campos opcionais não se tornam obrigatórios.
- Fotos pessoais continuam privadas, com API autenticada, proteção de origem, isolamento e normalização. Chave server-side é validada contra papel/projeto; não vai para browser/logs.
- Logo e capa usam ação de servidor separada, consentimento público explícito, bytes JPEG/PNG/WebP decodificados/reencodificados sem EXIF, caminho aleatório, lease, compare-and-swap e fila com lock/claim. Falha de transporte não apaga upload possivelmente confirmado. Apenas o servidor escreve bytes no bucket público; policies restritivas negam upload/update/delete diretos inclusive ao owner. Nenhuma foto pessoal é publicada automaticamente.
- Capa é exibida no perfil público. Galeria não tinha contrato/modelo/tela no produto inspecionado; não foi introduzida como nova funcionalidade.
- Limite de entrada4 MiB, saída2 MiB; logo/pessoal até512px, capa até2048px. Multipart4300 KiB fica abaixo do [limite Vercel4,5 MB](https://vercel.com/docs/functions/limitations). Não prometemos superar limite de plataforma via config Next.

Arquivos e integração de frontend: [contrato atualizado](../codex/profiles-media-contract.md). Preservadas as telas dedicadas de cadastro, progresso de fotos, onboarding e recorte de logo do Cursor. O `LogoCropField` mantém os defaults e aceita nome/id de input configuráveis para enviar `image` à ação segura; a remoção usa o botão próprio. O runner final executou o recorte real antes do upload. Backend principal: `session-profile.ts`, `session.ts`, `client/actions.ts`, `avatar-image.ts`, `avatar-admin.ts`, avatar route, `workspace/actions.ts`, `queries.ts`, `images.ts`, `image-actions.ts`, validação e erros. Migrations novas e regressões acompanham o PR.

## Resultados executados

| Jornada/verificação | Estado | Evidência |
| --- | --- | --- |
| Cadastro cliente e profissional pelo formulário, SMTP recebido e confirmação PKCE no navegador original | PASS | [jornada real](profiles-media-real-20261015.json) |
| Cliente sem negócio/trial; profissional escolhe Solo e cria trial de7 dias | PASS | Auth, ownership e subscription persistidos; mesmo relatório |
| Nome/telefone/cidade opcional e remoção da cidade; reload | PASS | Formulário e PostgREST reais |
| Dados comerciais completos e reload; opcionais omitidos; UF/fuso/CEP/telefone inválidos sem gravação parcial | PASS | [validação real](profiles-settings-real-20261015.json) |
| Cliente e profissional: foto privada, leitura, troca, remoção, nova sessão, arquivos inválidos, tamanho e CSRF | PASS | [HTTP/Storage real](profiles-avatar-http-20261015.json) e jornada nova |
| Logo/capa: consentimento, upload, normalização, exibição pública, troca, limpeza do antigo e remoção | PASS | Jornada real, banco e catálogo Storage |
| Usuário alheio: leitura de foto privada, assinatura de URL, settings, RPC e alteração de imagem | PASS | Storage/RLS/RPCs reais; testes SQL adicionais |
| Mesma identidade profissional usa `/app` e `/cliente` | PASS | Ativação real de client profile, sem segunda assinatura |
| Cliente busca por cidade, reserva, consulta histórico; mesmo ID na agenda profissional | PASS | [reserva real](profiles-booking-real-20261015.json) |
| Chave privilegiada ausente dos assets públicos | PASS | Valor staging comparado em memória com todos os JS públicos; nenhum valor registrado |
| Schema anterior, erros de rede/RLS, retorno incerto de commit, concorrência lógica/leases, DDL reaplicável | PASS | Regressões unitárias e PostgreSQL isolado; não são prova de SMTP |
| `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` | PASS | Node24; [354 testes categorizados](profiles-standard-tests-20261015.json); build Next16.3.8 |
| PostgreSQL17.6 nativo:11 testes novos/descoberta + cinco suítes SQL completas | PASS | [runner](profiles-native-pg17-20261015.json), [casos](profiles-native-tests-20261015.json) |
| Produção: escrita de perfil/foto e aceite pós-publicação | BLOQUEADO | Sem autorização de migrations/binding/deploy; captura não correlacionada à sessão própria |
| Recuperação do backup produtivo | BLOQUEADO | Não foi exportado/restaurado backup produtivo nesta rodada |

Os testes têm categorias separadas: SQL usa identidade/plataforma sintéticas, Stripe mocks não significam pagamento real, e a jornada de staging usa Auth/SMTP/Storage reais. A jornada final foi repetida com contas novas após integrar o PR #56; o [PASS anterior à integração](profiles-media-pre56-20261015.json) também foi preservado. O CI inicial detectou inventário estático de 70 migrations; a lista revisada passou a 72 com os dois arquivos novos, sem alterar hashes ou snapshots históricos. Cinco advisories HIGH existentes na cadeia de desenvolvimento não foram corrigidos com downgrade forçado; não foram adicionadas dependências.

Tentativas intermediárias preservadas: [primeira](profiles-media-first-attempt-20261015.json), [segunda](profiles-media-second-attempt-20261015.json), [terceira](profiles-media-third-attempt-20261015.json). O runner precisou reenviar arquivo/consentimento depois de reset do formulário e substituir espera indefinida de `Response.finished()` por resposta HTTP + comprovação de persistência/limpeza. Apenas servidor/browser headless próprios foram encerrados; processo do Cursor não foi tocado. O primeiro probe de descoberta usou limit100, rejeitado pelo contrato; a [tentativa inicial](profiles-booking-first-attempt-20261015.json) teve cleanup e foi repetida com limit20, sem afrouxar validação. Auditoria SQL antiga esperava upload direto pelo owner; foi atualizada para exigir a negação, sem enfraquecer policies.

[Limpeza verificada](profiles-cleanup-20261015.json): zero imagens/referências/fila das contas novas, zero serviços ativos e nenhum agendamento não cancelado; publicação da fixture retirada. Contas e histórico sintéticos são preservados. Configurações comerciais usadas no probe foram restauradas. Relatórios históricos reescritos pelos runners ficaram preservados fora do commit; evidências desta rodada têm nomes próprios.

## Produção e conclusão

[Diagnóstico produtivo seguro](profiles-production-diagnostics-20261015.json) e [snapshot](profiles-infrastructure-20261015.json), sem contatos nem segredos. Agora há dez arquivos pendentes (oito anteriores e dois novos), com uma divergência histórica remota conhecida.

[Plano de backup, restauração e rollout](../production-readiness/PROFILES-MEDIA-ROLLOUT-2026-10-15.md): autorização específica para backup/export e restauração isolada, DDL revisado, binding server-side correto e deploy Production. Não promover Preview staging. Não apagar dados nem enfraquecer RLS/entitlement; não redefinir senhas, alterar Auth/Stripe LIVE/DNS ou cobrar para homologar.

**NO-GO comercial** enquanto as dependências produtivas, backup recuperável e teste pós-publicação não forem resolvidos. O código e a homologação de staging estão entregues para revisão; a infraestrutura produtiva ainda não oferece os recursos ausentes.
