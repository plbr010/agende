# Configuração preparada — não aplicada

Produção ainda usa as duas variáveis Supabase nos três targets Vercel; NEXT_PUBLIC_SITE_URL não consta do inventário. Preview #31 /login500 reconfirmado. O guard de isolamento impede usar produção fora do deployment produtivo; mantê-lo. Development local precisa de stack Supabase completa (GoTrue/PostgREST/Storage), não apenas PostgreSQL de testes. Docker/WSL não estão instalados. Não considerar ambientes separados enquanto os bindings reais não forem alterados e testados com autorização.

| Target | NEXT_PUBLIC_SUPABASE_URL | Chave pública | NEXT_PUBLIC_SITE_URL / Auth |
|---|---|---|---|
| Production | https://wohimauqgywshbbejjcl.supabase.co | própria do projeto produtivo; preservar valor seguro | https://agendeapp.online |
| Preview | https://fkpdudnnperufnmdwdlv.supabase.co | própria de staging, armazenada no target Preview | hostname de Preview aprovado e callbacks exatos de staging |
| Development | http://127.0.0.1:54321 | própria da stack local futura | http://localhost:3000 |

Não registrar valores de chaves aqui. NEXT_PUBLIC_AGENDE_DEPLOYMENT_ENV é gerada pelo build/configuração existente; não forjar production em Preview. Origem do frontend é pública; service_role, SMTP, Stripe API/signing e cursor-key futuros nunca são NEXT_PUBLIC. NEXT_PUBLIC_SITE_URL é compilada no build: mudança requer rebuild do ambiente autorizado; não promover build Preview para Production.

Auth Production preparado: Site URL https://agendeapp.online; callbacks exatos /auth/callback, /auth/confirm e /auth/recovery dessa origem. Canonicalizar www → raiz somente após aprovação e verificar cookies/PKCE; não adicionar *.vercel.app ou wildcard global. Manter confirmação obrigatória e sanitização de next. Staging conserva localhost/127.0.0.1 existentes até aprovar origem Preview; não adicionar origem produtiva à allowlist de staging. Não retirar guard para testar em Preview.

Edge AGENDE_SITE_URL precisa corresponder à origem do respectivo ambiente. Production aceita somente Stripe LIVE; Preview/staging aceita TEST. Development usa mocks isolados neste momento; e2e futuro requer sandbox/endpoint próprios, sem dados LIVE. Publicação Edge é independente do deploy Next/Vercel e requer aprovação separada. Código de segurança na main não prova que as Edge versões2 de produção tenham sido atualizadas.

## SMTP econômico com domínio próprio

Stripe Directory foi consultado para SMTP; Resend foi encontrado. A recomendação é preparada, nenhum recurso/conta/chave/domínio foi provisionado. Resend Free atual: 3.000 mensagens/mês, limite100/dia, três domínios. Pro20USD/50k/mês se volume/picos exigirem. A ausência de limite diário pago não remove o limite de throughput do provedor. Não pagar dedicadoIP, custom-domain Supabase ou marketing para resolver Auth.

Passos para aprovação/execução:
1. Proprietário cria/conecta conta Free e aceita termos, se ainda não existir. Separar staging (Mailtrap sandbox controlado ou domínio/remetente de teste) de produção.
2. Cadastrar domínio de envio, por exemplo auth.agendeapp.online; copiar **os registros reais fornecidos** de SPF/DKIM/return-path para um plano de DNS revisável. Não inventar valores nem modificar DNS aqui. Planejar DMARC com monitoramento antes de enforcement mais rígido.
3. Criar credencial limitada ao envio para o domínio; inserir diretamente no SMTP Supabase, sem chat/Git. Configuração documentada: smtp.resend.com, porta465/TLS, username resend, password chave segura; remetente no domínio verificado, nome Agendê.
4. Verificar provedor e domínio, confirmação obrigatória, Site URL/redirects e templates (links sem tracking de clique que interfira em Auth). Ajustar limites conservadores após observar entrega/picos, sem afrouxar confirmação.
5. Homologar primeiro cadastro profissional/cliente, não confirmado sem sessão operacional, confirmação no mesmo browser PKCE, recuperação, senha nova e logout em caixa controlada. Testar links expirados/reutilizados e falha SMTP; só depois aprovar configuração produtiva. Não enviar mensagem a clientes reais sem autorização.

O código atual não envia confirmações/lembretes de cada agendamento por SMTP; envia Auth via GoTrue. O orçamento base usa apenas Auth. Adicionar notificações de booking é escopo separado com custos próprios; não presumir envio já existente nem desenvolver essa função nesta missão.

Reversão: registrar targets/origens anteriores sem segredos; interromper rollout se frontend/backend divergirem; reverter somente configuração revisada e rebuild correspondente. Não restaurar Supabase produtivo em Preview. Não revogar credenciais em uso sem plano aprovado. Testes de staging anteriores com contas confirmadas por SQL não homologam SMTP.

Fontes: [SMTP Resend/Supabase](https://resend.com/docs/send-with-supabase-smtp), [preços](https://resend.com/pricing.md), [SMTP Supabase](https://supabase.com/docs/guides/auth/auth-smtp), [variáveis Vercel](https://vercel.com/docs/environment-variables).
