# Agendê — candidata segura de lançamento, 05/11/2026

## Decisão e escopo

**NO-GO para produção e para homologação externa completa neste momento.** A falha administrativa foi corrigida e testada localmente, a integração sobre a main está pronta em branch separada e a migration incremental está preparada. A correção do banco ainda não foi aplicada no staging, conforme o limite de autorização. O próximo passo exige autorização específica para essa aplicação e para os testes remotos que criam/alteram dados sintéticos. Não houve publicação de Preview.

Checkout de integração: C:/Users/PLBR/Documents/Codex/agende-release-safe-20261105. Branch: codex/release-safe-20261105, baseada em dcc545403ef8556f9da2e80a43d286aae12f9e31. A consulta final ao remoto confirmou esse SHA como a main vigente. O commit exato da candidata é registrado em artifacts/release/candidate.json após o commit local.

O checkout anterior foi mantido intacto, incluindo as alterações não commitadas. codex/priority-fixes-review-20261105 continua em daa29b57d074da7e9ca2f165720a076871eec282. Não houve merge automático, rebase de trabalho alheio, push ou alteração de main. Como o gerenciador do aplicativo recusou sourceRoot fora das raízes cadastradas, a integração foi feita em cópia Git local isolada, sem trocar a branch do checkout anterior.

## Diagnóstico e correção do Super Admin

A autorização instalada consultava apenas uma entrada ativa em app.platform_admins depois de verificar que a conta tinha e-mail confirmado. O trigger de concessão validava o e-mail ao escrever a permissão, mas a função de autorização não o revalidava em cada uso. Uma mudança posterior de e-mail mantinha o UUID e o grant ativos. Além disso, claim_official_platform_admin podia reativar um grant revogado quando a conta voltava a atender ao e-mail oficial.

A candidata implementa:

- **Banco:** app.is_platform_admin verifica o UUID privado, revoked_at, o e-mail atual em auth.users e sua confirmação. Nenhuma decisão depende de claims de e-mail ou user_metadata.
- **Revogação persistente:** um trigger adicional em auth.users revoga a permissão quando o e-mail deixa de ser o oficial ou perde a confirmação. A mudança é auditada sem gravar e-mail/senha/token. Voltar ao endereço oficial não restaura automaticamente o grant.
- **Compatibilidade do trigger existente:** enforce_official_platform_admin continua recusando concessões ativas a identidades inválidas e passa a permitir a gravação da revogação de uma identidade que acabou de se tornar inválida. Isso evita que a própria proteção antiga impeça a revogação.
- **Sem autoconcessão:** claim_official_platform_admin torna-se uma consulta idempotente de acesso já concedido; não faz INSERT, UPDATE ou reativação. A ação de autoconcessão da aplicação foi desativada e o painel não oferece provisionamento pelo navegador. A API já existente para operador mantém suas restrições e não foi chamada remotamente.
- **Servidor:** o guard consulta novamente Auth getUser e a permissão privada a cada entrada administrativa, compara o UUID à sessão e exige o e-mail oficial confirmado. Flags de sessão antigas ou respostas RPC antigas não bastam. Falhas de Auth/RPC negam o acesso; o fallback remove flags administrativas antigas para evitar redirecionamento em loop.
- **Acesso direto:** os loaders administrativos também passam pelo guard; no banco, todas as RPCs que já usam require_platform_admin recebem a correção por esse contrato central. O menu ou o layout não são a única proteção.

## Comparação dos modelos e decisão de arquitetura

| Área | Proposta antiga de daa29b5 | Modelo atual preservado / decisão |
| --- | --- | --- |
| Autoridade privada | app.platform_roles, texto super_admin | app.platform_admins, registro privado global independente dos papéis de estabelecimento; manter uma única autoridade |
| Bloqueios | app.account_controls | app.platform_account_holds, com histórico de suspensão/liberação; preservado |
| Auditoria | app.admin_audit e RPC de leitura | app.platform_audit_events e contratos atuais; acrescentar evento de invalidação de identidade |
| Acesso vitalício | Função substituída sem ramo lifetime | app.lifetime_entitlements e função atual intactas |
| Cortesias | app.complimentary_entitlements obrigatório | Caminho opcional já suportado pela função atual; preservado |
| Indicadores | admin_dashboard, snapshots próprios de MRR | admin_dashboard_overview e indicadores atuais da main; não trocar contratos ou definições financeiras nesta correção |
| Listagens | admin_list/admin_detail genéricos | RPCs atuais de profissionais, clientes, estabelecimentos, assinaturas, eventos, usuários, agendamentos e suporte; preservadas |
| Leads/convites | Nova tabela privada de leads e listagem própria | Não criar tabela paralela de leads ou migrar dados inexistentes por suposição; suporte/convites existentes mantidos |
| Interface | Rotas dinâmicas [section]/[id] | Páginas específicas e painel master da main; preservados |
| Provisionamento | Proposta sem criação automática de administrador | Migrações históricas da main já continham bootstrap; não repeti-las. O novo delta não concede acesso e desativa a autoconcessão corrente |
| Billing/Stripe | Mudanças locais anteriores em Edge e snapshots | Não portar essas mudanças de outras branches nesta candidata; nenhum webhook ou Stripe LIVE alterado |

A decisão foi documentada antes da implementação em architecture-20261105.md. A migration de 30/10 não foi copiada, aplicada ou incluída nesta candidata.

## Migration revisada e preservação

Arquivo: supabase/migrations/20261105152258_platform_admin_live_identity_guard.sql, criado pelo comando local supabase migration new. O SHA256 LF está em candidate-manifest.json e candidate.json. Não foi executado apply remoto.

O delta substitui somente quatro funções de autorização/proteção, acrescenta uma função de trigger privada e um trigger de invalidação em auth.users. Não cria uma segunda tabela de papéis, não altera policies, entitlements, subscriptions, benefícios ou grants de tabelas, e não atualiza linhas administrativas ao ser aplicado. O acesso existente continua válido enquanto a identidade oficial e a concessão ativa permanecerem válidas.

O teste aplica o delta sobre o baseline atual e compara antes/depois: linhas de grants, lifetime, cortesias, assinaturas, todas as policies de app/public/storage e o texto integral de workspace_has_entitlement. As comparações passaram. O teste de troca de e-mail confirmou também que o benefício vitalício continua presente e efetivo após a revogação administrativa.

Foi testado rollback transacional deliberado: após executar o delta dentro de uma transação e gerar uma exceção, os snapshots anteriores permanecem iguais e a nova função de trigger não existe. Após aplicação confirmada, a recuperação recomendada é uma correção para frente; restaurar a autorização vulnerável ou desfazer automaticamente revogações não é rollback seguro.

A leitura remota de staging confirmou os helpers e tabelas exigidos, a presença de lifetime e a ausência da versão nova no histórico. O MD5 observado de workspace_has_entitlement continua f83eecbda48d7e840ae19fa31bc7b242. As definições/ACLs observadas estão em staging-functions-observed-20261105.json. staging-preflight.sql é somente leitura e deve ser repetido imediatamente antes de qualquer aplicação autorizada; parar em caso de drift ou falta de permissão de TRIGGER em auth.users. Os timestamps históricos remotos diferem dos arquivos locais; não os reconciliar repetindo migrations antigas.

## Integração comercial sobre a main

Foram portados o componente reutilizável de WhatsApp e sua validação, sem importar o painel antigo ou as alterações Stripe de outra branch. O número autorizado é 5532998064217, definido na configuração de homologação; .env.example documenta a variável pública e o comportamento de ocultar o CTA quando inválida/ausente.

A entrada Sou cliente conserva o cadastro direto escolhido pelos PRs recentes da main e acrescenta next=/cliente/descobrir. O cadastro continua separado de profissional, sem plano de salão. O login reconhece o destino de cliente e preserva esse retorno no link de cadastro. Sessões já autenticadas respeitam next sanitizado e permitido. Cadastros client sem next explícito também seguem para descoberta após confirmação, em vez de exigir passagem pela apresentação de perfil. Convites, retorno a agendamento, cadastro profissional e recuperação de senha foram preservados.

O contrato que proíbe destinos externos permaneceu intacto. Os testes atualizados distinguem a rota de entrada /cadastro do destino interno de retorno, sem proibir incorretamente a palavra descobrir em uma query segura. Também foi corrigida uma asserção antiga da main que esperava o texto anterior do card de cliente, já substituído na própria main.

## Resultado das verificações

| Verificação | Resultado e alcance |
| --- | --- |
| Lint | Aprovado, zero erros; dois avisos preexistentes de variável source em scripts de preparação |
| Typecheck | Aprovado |
| Build | Aprovado, Node 24.22.1; backend público fictício e WhatsApp autorizado incorporados ao build local |
| Suíte completa | 547 aprovados, zero falhas, dois ignorados por exigirem concorrência nativa |
| PostgreSQL 17 | 50 aprovados, zero falhas/ignorados, incluindo concorrência, booking, autorização e nova regressão administrativa |
| Rollback adicional | Nova regressão com rollback deliberado aprovada em PGlite e PostgreSQL 17 nativo |
| Navegador Edge/Playwright | 22 aprovados, zero falhas/bloqueios: CTA, WhatsApp celular/desktop, cadastro profissional separado, cadastro de cliente, retorno do login, recuperação de sessão, descoberta e guards |
| Assinaturas | Testes de integração/estado SQL e mocks Stripe aprovados; nenhuma sessão Checkout remota, webhook ou cobrança executada |
| Dependências | npm audit: oito achados moderados, zero altos/críticos; cadeia de desenvolvimento ESLint/TypeScript/minimatch. Requer atualização revisada; não executar automaticamente a sugestão de troca major/downgrade |

Os novos testes cobrem explicitamente e-mail alterado com o mesmo token, perda de confirmação, revogação manual, retorno do e-mail sem reativação, tentativa de claim sem operador, metadata forjada, acesso direto à tabela, flags antigas no servidor, divergência de UUID, Auth/RPC indisponíveis e preservação dos benefícios.

O verificador histórico de recuperação também passou após distinguir conteúdo LF de conversão CRLF do checkout Windows. Nenhum checksum histórico foi alterado; a nova migration tem pin separado como proposta local, sem representar aprovação remota.

Esses testes de navegador usam backend sintético local; as integrações PostgreSQL usam fixtures de Auth/Storage. A homologação Auth real da rodada anterior é evidência histórica, não validação externa desta candidata. Cadastro profissional, cliente, booking, permissões e assinaturas ainda precisam de aceitação no Preview exato com serviços externos autorizados. Não se afirma que a correção do banco remoto esteja instalada.

## Preview e pendências de autorização

**URL: não criada.** O projeto Vercel existente também atende produção, o staging ainda está sem a nova migration e o modo efetivo das credenciais Stripe do runtime de staging não foi comprovado nesta rodada. Não é seguro apresentar um Preview herdando configurações genéricas ou anunciar o painel como corrigido antes de aplicar o delta autorizado.

Foi preparada a configuração preview.env.example para o ref fkpdudnnperufnmdwdlv, callbacks do hostname exato e número comercial autorizado. O build local usa backend fictício e não deve ser reaproveitado como prebuilt de staging; a candidata deve ser reconstruída com as variáveis de Preview efetivas. O arquivo candidate-source.tar e seu hash, gerados localmente após o commit, identificam a fonte exata pronta para revisão/upload; não houve upload.

Próxima autorização necessária:

1. Aplicar **exclusivamente** 20261105152258_platform_admin_live_identity_guard.sql no staging fkpdudnnperufnmdwdlv, após conferir seu SHA256, helpers, ACLs, histórico e preflight. Não reaplicar migrations antigas nem conceder/revogar administradores manualmente.
2. Configurar e publicar somente um Preview isolado da candidata, com variáveis específicas de branch/deployment, sem chaves/dados de produção e sem possibilidade de herdar Stripe LIVE. Confirmar o modo TEST de forma independente antes de qualquer integração financeira remota.
3. Autorizar os dados sintéticos necessários aos testes externos de profissional, cliente, agendamento e assinatura TEST. Repetir as regressões de identidade em contas sintéticas, sem trocar o e-mail da conta administrativa real ou conceder privilégios reais para testar.

Depois dessa etapa: confirmar o SHA do deployment, cadastro/login/confirmação/recuperação, isolamento e booking reais; validar as definições de autorização e os grants no banco corrigido; revisar os achados moderados de ferramentas; e emitir novo GO/NO-GO. Deploy produtivo, aplicação de schema em produção e qualquer alteração de privilégios exigem autorizações separadas.

## Encerramento

Produção permaneceu inalterada. Nesta rodada, as operações remotas foram leituras de repositório, configuração e catálogo; não houve alteração de dados, schema ou privilégios, nem novo cadastro remoto, push, merge, publicação, Stripe LIVE, cobrança ou alteração de webhook. Os clusters de teste locais foram encerrados.

Evidências: docs/homologation/{standard-tests,native-tests,native-pg17,pg17-concurrency}.json e artifacts/release/{tests,native-pg17,native-migration-final,browser,build,typecheck,lint}.log. Os resultados e limites acima devem acompanhar qualquer revisão ou autorização posterior.
