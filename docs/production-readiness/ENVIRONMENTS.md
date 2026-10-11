# Ambientes — configuração proposta, não aplicada

Organização Supabase confirmada pelo responsável: `vknkolqntkxbagibgflk`. Inventário: apenas Agendê ativo e PetGestor inativo (outro produto, não reutilizar). Sem branches. Única conta Stripe acessível: LIVE. A consulta MCP `get_cost` está indisponível (`tool was not returned by tools/list`); **custo não confirmado e nenhum provisionamento autorizado/executado**. Confirmar orçamento no Dashboard antes de criar projeto.

| Ambiente | Backend | Dados | Stripe | Origem e e-mail |
|---|---|---|---|---|
| Development | stack Supabase local completa em 127.0.0.1:54321, ou projeto exclusivo aprovado | sintéticos | sandbox TEST exclusivo | localhost:3000; caixa local de teste |
| Staging | novo projeto proposto `agende-staging`, us-east-2, organização confirmada | somente fixtures, dois salões fictícios | sandbox TEST exclusivo | hostname fixo de Preview aprovado; SMTP de teste controlado |
| Production | `wohimauqgywshbbejjcl` | dados reais | LIVE atual | `agende-lac.vercel.app` até domínio verificado; SMTP aprovado |

O PostgreSQL portátil dos testes não é uma stack Supabase: Auth/Storage/Cron são fixtures; faltam GoTrue, PostgREST e SMTP. Docker, Supabase CLI e Stripe CLI não estão disponíveis neste host. Preparar/instalar stack local é alternativa após conferir runtime e escopo, sem reutilizar segredos de produção.

## Variáveis e bindings

Vercel Production: conservar URL/chave pública do projeto de produção; configurar `NEXT_PUBLIC_SITE_URL` somente após aprovação da origem. Vercel Preview: substituir URL/chave pública pelas do staging e definir `NEXT_PUBLIC_SITE_URL` como origem fixa aprovada. Development: URL/chave da stack/projeto local e origem localhost. Não usar `vercel env pull` com escopo errado. Não criar variáveis server-only com prefixo NEXT_PUBLIC_.

`NEXT_PUBLIC_AGENDE_DEPLOYMENT_ENV` é calculado no `next.config.ts` a partir de VERCEL_ENV e compilado no bundle; não configurar manualmente. Build local assume development, mesmo quando NODE_ENV=production. O factory Supabase recusa o host de produção fora da classe production; no servidor também exige VERCEL=1 + VERCEL_ENV=production. O browser Preview recebe a classe preview compilada. URLs com credenciais/path/query são rejeitadas. **A proteção é contra o host de produção conhecido; novos projetos de produção/domínios de API exigem atualizar e revisar o inventário.** Ela não substitui separação de credenciais, rede e bindings.

Efeito de rollout: o Preview atual ainda aponta à produção. Depois deste PR, tentativas de inicializar esse backend serão bloqueadas (a página dependente pode responder erro de configuração). Esse bloqueio é deliberado; um Preview READY não significa jornadas funcionais. Para homologar, aprovar e provisionar staging, substituir bindings e gerar novo build. Não restaurar acesso ao banco produtivo para tornar o Preview utilizável. Não promover um artefato Preview a Production: gerar build novo com classe production.

Edge Functions de staging: SUPABASE_URL/service-role exclusivos; STRIPE_API_KEY TEST; segredo webhook TEST no vault/config do mesmo projeto; `AGENDE_SITE_URL` obrigatório para a origem de staging. Não copiar vault/dados de produção. As funções agora recusam chaves LIVE em qualquer backend fora do projeto de produção conhecido, chaves TEST nesse projeto e eventos assinados com livemode incompatível. Isso é código versionado; nenhuma Edge Function remota foi redeployada nesta missão.

Auth de cada ambiente: Site URL correspondente, allowlist exata `/auth/callback`, `/auth/confirm`, `/auth/recovery`, SMTP de teste para staging, templates com links da origem certa. Sem wildcard geral. Ativar proteção de senha vazada primeiro em staging; conferir disponibilidade/plano e impacto no cadastro, depois solicitar autorização separada para produção.

## Aprovação necessária

1. Confirmar orçamento e plano Supabase; criar `agende-staging` sem dados reais. Risco/custo: cobrança recorrente e configurações incorretas. Validar projeto/ref, stack e migrations antes de vincular Preview; recuperação: desvincular Preview e revogar somente credenciais TEST, preservando evidências.
2. Criar/conectar sandbox Stripe, três produtos/seis preços TEST, webhook TEST e Portal TEST aprovado. Custo não assumido; não presumir que recursos de terceiros são gratuitos. Validar livemode=false, keys TEST e destino staging; recuperação: desabilitar webhook/Portal TEST e revogar chaves TEST, sem tocar LIVE.
3. Alterar variáveis Preview/Development e Auth/SMTP de staging. Risco: Preview indisponível ou envio indevido. Validar política de isolamento + formulário real com caixa controlada; recuperação: manter Preview bloqueado e restaurar configuração de staging anterior. Nunca voltar ao banco de produção.

Nenhum pedido de aprovação cobre automaticamente produção, DNS, Portal LIVE, pagamento real ou migrations remotas.
