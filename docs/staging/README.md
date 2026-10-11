# Staging real e sandbox TEST — 11/10/2026

**NO-GO comercial.** A autorização específica para Supabase Free por US$0 e sandbox Stripe TEST foi recebida. O responsável criou `agende-staging`; a consulta posterior confirmou ID próprio `fkpdudnnperufnmdwdlv`, ACTIVE_HEALTHY, PG17.11, região ca-central-1 e banco inicialmente vazio (zero tabelas públicas, usuários e arquivos). Produção `wohimauqgywshbbejjcl` não foi alterada. Dashboard da organização confirmou Free, limite de gastos ativo e faturas US$0; não houve contratação/add-on pago.

## Banco e histórico

Os 67 arquivos Git foram executados no staging vazio. `provisioning.json` registra SHA256 de cada fonte e modo de execução. A ferramenta apply_migration registrou os primeiros 14 com timestamps gerados; falhou no seguinte com Invalid or expired requestState em duas tentativas. Continuamos a inicialização pelo SQL exato, sem inserir/repair registros de histórico. Portanto o **schema foi inicializado, mas o histórico remoto não é equivalente ao Git**. Não usar db push nem repair genérico nesse projeto; uma futura padronização do histórico exige plano explícito separado. Nenhum histórico produtivo foi tocado.

Falha do executor desta rodada: concatenação dos cinco últimos arquivos encontrou função sem ponto e vírgula final no arquivo fonte. A consulta confirmou que o lote não fora aplicado. Execução separada dos cinco passou, como nos runners locais. Não alterar migrations já publicadas por causa dessa concatenação.

Verificações atuais: 32 tabelas públicas com RLS e FORCE RLS, 82 triggers app/public e zero SECURITY DEFINER nesses schemas sem search_path vazio. Reviews, slots de reagendamento e serviço atômico existem. Dez grupos de testes **GoTrue e PostgREST reais de staging PASS**, incluindo convites/papéis owner/admin/professional/receptionist, tentativa de elevação, outro salão, trial persistido de sete dias, catálogo/horários, reservas e avaliações simultâneas, reagendamento/cancelamento, receita fictícia paga/idempotência/relatório e refresh/logout. Resultados em `real-api-results.json`. As operações usam publishable key e JWT real, sem bypass RLS no transporte de negócio.

As seis contas confirmadas são **fixtures sintéticas preparadas em SQL**, com identidades GoTrue; isso não homologa cadastro, SMTP ou confirmação de e-mail. Não copiar esse preparo para produção. Um probe de cadastro com domínio .invalid retornou email_address_invalid (400), sem sessão; esse resultado não prova tentativa de entrega SMTP. O responsável confirmou que não possui SMTP de teste. Cadastro, confirmação e recuperação continuam BLOQUEADOS até haver caixa/provedor controlados. Confirmação por e-mail não foi desabilitada.

Advisors: cinco wrappers públicos SECURITY DEFINER e 56 autenticados são contratos intencionais sujeitos a autorização interna; não revogar por contagem. O INFO da tabela privada app.stripe_checkout_leases sem policy é bloqueio intencional de acesso direto. Os testes reais de papéis/IDOR e os locais complementam a revisão, sem afirmar que advisories são todos falsos positivos.

## Navegador

Aplicativo local em localhost:3000 conectado ao staging, sem mudar .env.local ou bindings Vercel. Login profissional redirecionou a /app; dashboard mostrou salão e datas de trial. Financeiro mostrou R$50 fictícios pagos; relatórios refletiram categoria; avaliações mostrou uma nota de cinco estrelas. Logout retornou ao início e /app redirecionou ao login. Login cliente com next=/app terminou em /cliente e exibiu histórico e avaliação imutável. Isso é navegador autenticado com backend real, mas **não** aceite integral de todos os formulários ou do redesign ainda em PR do Cursor. Nenhum TSX/CSS/branch do Cursor alterado.

Site URL staging localhost:3000; allowlist exata dos callbacks /auth/callback e /auth/recovery para localhost e 127.0.0.1. Nenhuma origem produtiva adicionada. Guards de isolamento preservados.

## Stripe TEST e webhook

Sandbox separado `acct_1UPNGJQQUyqAaZvS` criado sem copiar configuração LIVE e conectado com aprovação humana. Três produtos e seis preços TEST com lookup keys/valores mensais e anuais corretos. Seis hosted Checkouts criados; Solo mensal foi concluído com cartão TEST 4242 e comprovado complete/paid e assinatura active por API. O envio anual foi bloqueado pela revisão automática por suspeita de repetição; o responsável informou conclusão manual, mas a API ainda mostrou open/unpaid/sem assinatura. **Não marcar PASS nem reenviar** até reconciliar. Os outros quatro permanecem criados e não submetidos.

Test clock e API Stripe reais comprovaram trialing → active com fatura TEST paga, deadline preservado, upgrade/downgrade diagnósticos sem proração, renovação paga, outro cartão TEST pm_card_chargeCustomerFail gerando past_due/fatura aberta/zero pago e cancelamentos efetivos. `stripe-lifecycle.json` mantém também a leitura intermediária enquanto o clock processava; o resultado final, após UI pronta, foi canceled para ambas. Não classificar esses ciclos como sincronização com o Agendê.

Portal TEST foi criado com seis preços próprios, continue_trial, downgrade no fim do período e proração proposta. Visão geral real abriu com assinatura e fatura TEST paga. Não submetemos mudança pelo Portal. A API real rejeitou features.subscription_update.restrictions embora o catálogo de parâmetros a anunciasse. O protótipo TEST foi criado sem esse parâmetro; bloqueio de troca com fatura aberta **não está comprovado** e não deve ser aplicado a LIVE. Política comercial de produção continua aguardando aceite.

Função stripe-webhook v1 publicada somente no staging, fonte Git, autenticação própria HMAC/timestamp e verify_jwt=false por esse contrato. Endpoint TEST `we_1UPO4UQQUyqAaZvSJGQYJzu5` aponta exclusivamente para esse projeto com oito eventos e API2026-08-26.dahlia. Signing secret armazenado criptografado no Vault, não no Git. HTTP real sem assinatura e com assinatura inválida retornou 400. Falta chave servidor Stripe TEST para reconciliar assinatura; OAuth do conector não fornece a credencial ao runtime. Formulário Vault stripe_api_key preparado para entrada humana segura. Não afirmar entrega/replay/retry ou sincronização aprovados apenas com checks de assinatura.

## Próximos gates

Runtime atualizado: stripe-billing v1 também foi publicado somente no staging. O código autentica via GoTrue getUser(token) e membership manager no banco, com verify_jwt=false por esse contrato próprio. Billing anônimo retornou 401 auth_required. AGENDE_SITE_URL=http://localhost:3000 foi salvo somente no staging.

Rascunho de chave restrita TEST agende-staging-billing preparado: Customers, Checkout Sessions e Customer Portal em Gravação; Prices e Subscriptions em Leitura. A geração/copiar/salvar fica com o responsável, sem chat ou Git. Permissões efetivas e eventuais dependências adicionais ainda exigem teste com a chave criada.

Regressão posterior: npm ci, lint, typecheck, build Next16.3.8, smoke (32), PostgreSQL nativo (45 + cinco suítes SQL) e audit de produção (zero vulnerabilidades) passaram. Primeira execução padrão: 234 PASS e uma falha de inicialização do arquivo recovery.test.ts, sem seus quatro casos. Os quatro passaram isoladamente e a repetição completa passou com 238 PASS, zero falhas/skips. Causa inicial não determinada; registro preservado em local-first-failure.json, sem mudança de aplicação para mascarar a falha. Cinco alertas HIGH dev conhecidos permanecem.

1. Salvar chave TEST do sandbox no Vault; verificar somente prefixo/mode e permissões, sem mostrar valor. Runtime e Billing já publicados no staging; validar Checkout da aplicação, customer binding, webhook, replay e entitlements reais.
2. Reconciliar Checkout anual sem duplicação; concluir quatro restantes e Portal de ponta a ponta, incluindo trial, mudanças, excesso de assentos e invoices abertas.
3. Obter SMTP/caixa controlados sem contratação não aprovada e homologar cadastro/confirmar/reset no navegador.
4. Preview isolado, backup/restore, domínio/origens e operação continuam gates separados. Cinco migrations de produção, Edge/Portal/SMTP/DNS produtivos e merge exigem autorização explícita.

Executor opt-in: definir AGENDE_STAGING_ACCEPTANCE=fkpdudnnperufnmdwdlv e rodar node scripts/staging-real-flows.mjs. Config/credenciais locais ficam em arquivo .env ignorado. O script recusa outra URL e não lê DATABASE_URL; gera somente resultados sem tokens/chaves. Não é executado pela CI padrão. Dados sintéticos e recursos TEST foram preservados, sem apagar/recriar tabelas ou dados produtivos.
