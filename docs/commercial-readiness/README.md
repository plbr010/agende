# Prontidão comercial — 13/10/2026

**NO-GO para lançamento comercial em15/10.** Produção READY não basta: cadastro de serviços segue bloqueado, recuperação de produção/SMTP/ciclo Stripe integrado não foram comprovados e a hospedagem atual é Hobby, não comercial. Nenhuma alteração produtiva, exportação de dados reais, upgrade, cobrança real, DNS ou migration foi executada. Frontend do Cursor preservado.

## Estado real reconfirmado

Repositório plbr010/agende; checkout inicial limpo em codex/service-write-diagnosis/d2428d3. Main atualizada bba86bc8288ec9317ce972f9e3fcf530a9a67e5f, merge#28 Cursor. #26/#27/#29/#30 incorporados; #31 aberto, identidade visual de lançamento. Branch própria baseada nessa main. Commits anteriores de backup foram preservados na branch antiga e consolidados no PR32; sem reescrever Cursor.

Produção: dpl_4uyPZNjL81he71UWYchVGtaKBRuQ READY, main bba86bc, agendeapp.online e /login200. Preview#31 READY, /login500; envs compartilhados continuam proibidos pelo guard. Vercel API/CLI confirmou Hobby/active. Supabase org Free, PostgreSQL17.6, banco17.771.667bytes, max_connections60, 31 tabelas públicas com RLS+FORCE e63 registros de migration. Zero funções save_service_with_professionals em app/public; version20261010232248 ausente. Fonte SHA256 d13be7931bf92be45ef754858d4642881186f5bd8f9ce8a0d5f919419e5c0b37.

Auth público via GET settings: e-mail habilitado, cadastro habilitado, mailer_autoconfirm false e anonymous_users false. Confirmação obrigatória preservada. Não houve novo aceite de cadastro/entrega/reset; SMTP e redirects administrativos não foram reconfirmados diretamente nesta sessão. Não inferir que SMTP está homologado apenas desses flags ou da renderização200.

Stripe GET LIVE/TEST: seis lookup keys esperados e valores corretos; LIVE contém três anuais adicionais sem lookup key (799,90/1.499,90/2.799,90), não selecionados pelo Checkout que valida catálogo. Não arquivar sem revisar uso e aprovar. Portal LIVE updates=false; end_trial inativo, cancelamento fim do período. TEST updates=true, continue_trial, proração e downgrade por preço ao fim do período; isso ainda não comprova limite de assentos/fatura aberta no Portal. Endpoints LIVE/TEST ativos, oito eventos, API2026-08-26.dahlia e projetos próprios. Os endpoints não incluem paused/resumed que o código sabe tratar; validar necessidade antes de configurar. Nunca afirmar que versão de API/configuração prova entrega/replay/sync.

Reconciliados os seis Checkouts existentes TEST: um complete/paid com subscription e cinco expired/unpaid sem subscription; não há prova de pagamento anual. Não recriamos/submetemos cobranças. Vault staging sem stripe_api_key; probe autenticado GoTrue, action readiness_probe sem caminho de cobrança, retornou503 stripe_api_key_missing. Portanto runtime de billing integrado permanece bloqueado. Produção Edge billing/webhook versão2, sem republicação nesta rodada; ajustes de segurança na main não confirmam atualização Edge.

Advisors produtivos: cinco wrappers anon e53 authenticated SECURITY DEFINER alertados; autorização/grants/search_path requerem revisão funcional e não revogação por contagem. Lease privada sem policy é bloqueio intencional; proteção de senha vazada desativada continua pendente de suporte/plano/configuração aprovada.

## Bloqueios por gravidade

| Nível | Bloqueio | Condição para avançar |
|---|---|---|
| P0 | RPC de serviços ausente | Backup recuperável aceito, guards/hash/preflight renovados e autorização para exclusivamente20261010232248; sem DML de teste produtivo |
| P0 | Backup real não demonstrado | Aprovar exportação cifrada e restore core isolado; senha existente/CA em canal seguro; registrar cobertura/RPO/RTO e aceitar limitações Vault/Cron/GoTrue/Storage |
| P0 | Auth/SMTP | Caixa/provedor controlados, domínio e redirects aprovados; signup profissional/cliente, confirmação, reset e onboarding reais |
| P0 | Stripe integrado | Chave restrita TEST privada; app Checkout→webhook→DB/entitlements; seis seleções, idempotência, renovação/recusa/cancelamento/Portal/assentos |
| P0 | Hosting comercial | Aprovar plano que permita negócio; Hobby não é permitido para uso comercial |
| P0 | Preview/Dev compartilham produção | Bindings próprios e rebuild por ambiente, mantendo guard; desenvolvimento completo ainda precisa stack local |
| P1 | Edge/grants/downgrade | Publicação e configuração revisadas, política comercial aceita, bloqueio antecipado de downgrade incompatível — bloquear acesso após downgrade não substitui isso |
| P1 | Operação/capacidade | Instrumentação, limites/alertas, responsáveis e ensaios no hardware/HTTP reais autorizados; p95/SLO da carga local não comprovam cloud |
| P2 | Descoberta | Contrato proposto ao Cursor, consentimento/projeção/índices; integração somente após aceite, sem migration nesta rodada |

## Evidências e limites do aceite

PR32 baseado em main+preparação: lint/typecheck/build PASS;248 testes padrão PASS;47 PostgreSQL17.6 PASS e cinco suítes SQL;32 smoke GETs locais PASS. SQL Auth é fixture; Stripe da suíte padrão é mock. Dez grupos GoTrue/PostgREST de staging foram repetidos PASS com as seis contas sintéticas confirmadas via SQL, incluindo roles/IDOR, trial persistido, catálogo/booking concorrente, reagendamento/cancelamento/review, financeiro, refresh/logout. Isso não valida cadastro/SMTP/reset nem todos os formulários do PR31.

Backup sintético refeito PASS, TLS1.3 real verificado sem autenticar. Core/restored rows/catalog/roles/sequences comparados; clusters próprios parados/removidos. Nenhuma cópia de cliente/Auth produtivo. A documentação/arquivo preparado não é backup real nem autorização para usar apply-service-rpc-only.sql.

Modelo econômico: quatro testes PASS (anual≠MRR, caixa, bandas fiscais, mínimo inteiro/opex). Carga SQL opt-in: quatro cenários reais locais descritos abaixo. Os testes financeiros são offline; custos/uso são previsões, não fatura ou promessa de lucro.

## Limites atuais e quando pagar

Supabase Free:50k MAU/mês, DB500MB, egress5GB +cached5GB, Storage1GB, CPU compartilhada/RAM500MB; sem backup automático e pausa após semana inativa. Projeto real max_connections60; limite do pooler deve ser reconfirmado por compute, não somado ao teto de backends. Pro25USD inclui primeiro Micro/crédito10; projeto adicional Micro10, DB8GB/projeto,100kMAU/250GBegress/100GBStorage e backups diários7d. Micro10USD/1GB/60conexões; Small15/2GB/90; Medium60/4GB/120. Não é necessário upgrade Pro só por um número de salões: observar disk/egress/MAU, CPU/IO, p95 e recuperação. No modelo Free estoura rapidamente DB/egress com crescimento; Pro é o orçamento de operação contínua, não contratação feita.

Vercel Hobby: pessoal/não comercial; quotas Fluid4CPUh/360GBh/1M invocações, transferência100GB. Pro20USD/um builder com crédito de uso20USD; CPU/memória/invocações cobradas por uso. Flat Rate CDN precisa de configuração aprovada: tier incluso1Mreq/1TB, adicionais20USD/10Mreq e100USD/50Mreq; transição de tier pode afetar ciclo seguinte. Não assumir antigas franquias16CPUh/1440GBh além do crédito atual. Plano/uso real Hobby reconfirmado; não habilitamos Pro/FlatRate/spend cap.

Supabase Free pode atender fase inicial se backup manual real/RPO aceitos e quotas controladas; Vercel Hobby não pode sustentar comercial. Dev Supabase local completo preserva isolamento sem custo de terceiro projeto cloud. Se preferir três projetos cloud Pro na mesma org, considerar pelo menos +10USD/mês de compute além do staging já previsto; não criar/mover projetos automaticamente.

SMTP sugerido Resend Free (3k/mês,100/dia); pago se >3k ou pico diário impedir onboarding. Base usa dez e-mails Auth/salão/mês, portanto100/300/1k⇒1k/3k/10k. Orçamento assume26dias ativos e pico2×média:78/232/770e-mails/dia; reserva Pro20USD/50k já com300 e1k. Se picos reais forem menores, Free pode continuar dentro das duas quotas; não atribuir necessidade de compra apenas ao número de salões. Não instalar e-mails por agendamento por suposição: o código atual não os envia. Duas mensagens por400agendamentos/salão mudariam volume para80k/240k/800k, exigindo orçamento separado e revisão. Domínio SMTP próprio é verificado por SPF/DKIM/DMARC sem pagar custom-domain Supabase ou dedicadoIP. [Plano preparado de ambientes/SMTP](./ENVIRONMENTS-SMTP.md).

Fontes de limites: [Supabase](https://supabase.com/pricing), [Hobby](https://vercel.com/docs/plans/hobby), [Pro](https://vercel.com/docs/plans/pro-plan), [FlatRate](https://vercel.com/docs/pricing/flat-rate-cdn), [Fluid](https://vercel.com/docs/functions/usage-and-pricing), [Resend](https://resend.com/pricing.md). Consultadas13/10; quotas/perfis devem ser checados novamente antes de contratar. Sem compras.

## Carga e capacidade

```powershell
$env:AGENDE_LOCAL_LOAD_ONLY='1'
$env:AGENDE_PG_BIN='C:/Users/PLBR/Documents/Codex/.agende-test-runtime/pg17/pgsql/bin'
& 'C:/Users/PLBR/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' scripts/run-pg17-tests.mjs scripts/capacity-load.test.mjs
```

100tenants/10kclientes/100serviços/100profissionais sintéticos. Burst de uma ação por ator,60% catálogo público,20% leitura tenant/RLS+IDOR,20% reserva. Pool16; atores compartilham100identidades SQL, não sessões GoTrue/browser distintas. Banco novo, loopback, marker/data_directory verificados; DATABASE_URL remoto ignorado. Hardware local Ryzen4600G/16GB, PG17.6/max_connections100; produção Free500MB/sharedCPU/max60 não foi submetida à carga.

| Atores do burst | p95 total com fila | p95 transação PG | Erros | SLO p95≤2s |
|---|---:|---:|---:|---|
|100|1,179s|0,540s|0|PASS local|
|500|1,374s|0,086s|0|PASS local|
|1.000|2,083s|0,060s|0|FAIL local|
|5.000|7,924s|0,047s|0|FAIL local|

Não declarar suporte a5.000 usuários cloud. Valores mostram fila do pool e warm/cold effects, não capacidade comprovada da rede/Supabase/Vercel. Para5k usuários com intervalo30s por ação, a hipótese seria167ações/s; ainda falta validar chegada constante/soak, jitter, picos por salão/profissional, cold starts, GoTrue/PostgREST, HTTP/cookies e hardware cloud. Nenhum e2e de carga externo foi autorizado/executado.

Primeiro ensaio FAIL620 reservas porque o harness tratava candidatos a cada15min como reservas disjuntas de30min. Constraint de overlap foi preservada; alocação corrigida para intervalos≥30min. Evidência inicial em load-first-attempt.json; final em load-results.json. Não alteramos produto/locks/rate limit para conseguir PASS. O SLO continua FAIL em1k/5k, embora o executor funcional passe com zero erros.

Operação proposta: pool/circuit breaker limitado, timeouts, índices por workspace+data, paginação de históricos/relatórios, não carregar todo cliente/agenda. Monitorar p95/API, erros, waitingCount, CPU/RAM/IO e bloat. Considerar upgrade compute quando CPU/IO/backlog/p95 sustentados excederem limites sob workload real; não comparar VUs a conexões ou um ensaio Windows a capacidade de Nano/Micro. Não mudar configuração produtiva nesta missão.

## Orçamento, crescimento e R$5mil líquidos

[Modelo reproduzível](../../scripts/commercial-model.mjs), [resultado JSON](./cost-model.json). MoedaUSD→BRL **assumida5,50**, não cotação atual; reserva5% para câmbio/spread/tributos de importação não confirmados. Sensibilidade5,00/5,50/6,00 disponível. Uma seat Vercel; Supabase Pro para produção+Micro de staging; Dev local. Compute Micro/Small/Medium por cenário é **reserva de planejamento**, não necessidade comprovada pelo número de salões.

Por salão: quatro profissionais,36MAU Auth,400agendamentos/mês,5krequests dinâmicos,13krequests CDN, três consultas/req de2KiB,8KiB/agendamento com índices/auditoria, doze meses de retenção,1MB de dados-base e5MBStorage. Não são volumes medidos; monitorar e recalibrar. Stripe processa assinatura do estabelecimento, não400 pagamentos de serviços nem assinatura de clientes finais.

| Pagantes | MAU | Agendamentos/mês | ConsultasAPI/mês | DB após12m | Egress/mês | E-mailsAuth |
|---|---:|---:|---:|---:|---:|---:|
|100|3.600|40.000|1,5M|4,05GB|3,07GB|1.000|
|300|10.800|120.000|4,5M|12,11GB|9,22GB|3.000|
|1.000|36.000|400.000|15M|40,34GB|30,72GB|10.000|

Free MAU não seria o primeiro limitador; DB/egress e recuperação vêm antes. Fonte de8KiB não é requisito físico garantido e depende de audit/índices/status/retention. O crescimento projetado de100salões ultrapassa500MB em cerca de1,2meses após dados-base; não prometer retenção anual no Free.

| Pagantes | InfraUSD/mês | InfraBRL com reserva | Opex totalBRL | Opex equivalenteUSD | MRR econômico | Resultado estimado |
|---|---:|---:|---:|---:|---:|---:|
|100|75,00|433,13|4.793,13|871,48|15.577,00|7.116,31|
|300|100,51|580,47|6.940,47|1.261,90|46.731,00|27.786,87|
|1.000|229,04|1.322,72|14.682,72|2.669,59|155.770,00|98.048,13|

Opex inclui anúncios1.000BRL, remuneração do proprietário2.000, contabilidade300, domínio10, equipamento/backup50 e suporte10/salão. Reservas de trabalho/encargos são hipóteses e não contratação ou enquadramento de folha. Não inclui desenvolvimento inicial, dívidas ou IRPF do proprietário. Resultado também deduz taxa Stripe, tributo estimado e reserva3% de risco. Não é garantia de lucro nem de aquisição com1k em anúncios.

Tarifa de planejamento: cartões nacionais3,99%+0,50BRL/cobrança +Billing0,7% do volume. Página Payments atual mostra0,39 fixo e Billing mostra0,50: usamos0,50 conservadoramente; contrato real não consultado. Cartões internacionais/refunds/disputas/taxas extras exigem cenário próprio. [Payments](https://stripe.com/br/pricing), [Billing](https://stripe.com/br/billing/pricing).

Tributos: cenário central hipotético AnexoV com faixas/deduções e RBT12≈12×MRR estável. Efetivas modeladas100/300/1k=15,59%/17,73%/19,68%. Alternativas III e flat12% são sensibilidade, **não escolha fiscal confirmada**. Não escolher III sem verificar fatorR: atingir a condição pode exigir maior folha e opex, alterando o resultado otimista que mantém despesas fixas. CNAE, elegibilidade, regime caixa/competência e encargos precisam de contador; faturamento anual antecipado muda apuração/caixa. [Norma oficial CGSN140](https://normas.receita.fazenda.gov.br/sijut2consulta/link.action?idAto=92278), [fatorR](https://www8.receita.fazenda.gov.br/SimplesNacional/Arquivos/manual/PerguntaoSN.pdf).

Mix40%Solo/40%Equipe/20%Salão e20%anuais: preço mensal médio163,90; anual médio1.479,00/ano (MRR123,25). MRR misto155,77/pagante, não426,92. **81pagantes** ⇒MRR12.617,37; Stripe624,83; tributo1.955,69; risco378,52; opex4.603,13; resultado5.055,20BRL. São pagantes ativos, excluindo trials/leads/inadimplentes. CenárioIII hipotético requer70; flat12%76; V81. Anúncios1k não garantem esses clientes; churn/CAC e capital inicial são riscos separados.

| Só um plano | Mensais necessários | Anuais necessários (MRR anual/12) |
|---|---:|---:|
|Solo89,90 /799|153|217|
|Equipe169,90 /1.499|73|103|
|Salão299,90 /2.799|40|52|

Exemplo coorte100,20%anual, sem novos clientes/churn: mês1 entra42.692BRL brutos; mês2 entram13.112, enquanto MRR econômico permanece15.577. Ao fim do mês1 ainda há27.115 de receita anual não apropriada. O caixa antecipado não é lucro mensal; custos futuros/possível reembolso exigem reserva. Coorte100%anual recebe uma vez e meses2–12 sem novas cobranças. JSON mostra doze meses de caixa, fees e tributo sobre recebimentos **ilustrativo**, sem afirmar regime fiscal real. Renovação distribuída ao longo do ano pode suavizar caixa; não transformar ticket anual em doze cobranças.

## Implantação/rollback e aprovações

1. Aprovar separadamente exportação/restore real (PR32); inserir credenciais privadas e aceitar RPO/cobertura, mantendo dados fora de Git.
2. Reconfirmar ausência/hash/guards e aprovar **exclusivamente**20261010232248. Aplicar payload transacional/timeouts/grants/history próprio; sem outras migrations e sem teste de escrita em produção. Verificar catálogo/metadata só por leitura. Rollback antes de commit; depois correção aditiva revisada/retorno de app compatível aprovado, sem apagar dados.
3. Aprovar Vercel Pro, bindings Preview/Dev, SITE_URL/redirects/SMTP/DNS e sandbox runtime TEST em gates distintos. Custos modelados não são autorização de compra. Sem restore de produção em staging.
4. E2E real de cadastro/reset/Checkout-webhook-Portal/renovação e load cloud somente após ambientes/credenciais/caixas controlados autorizados. Não contornar segredo ausente com LIVE.
5. Edge guards/code precisam de aprovação/deploy próprio e retorno baseado no bundle anterior, sem alterar billing externo por inferência.
6. GO somente com P0 resolvidos e evidências externas; monitoramento/recovery responsáveis, preços/assentos/Portal política aceita, domínio/TLS/origens coerentes e orçamento aprovado. Não fazer merge/deploy produtivo automático a partir destes relatórios. P2 aguarda contrato com Cursor.

Metrica de fatura/uso Vercel dos ultimos7dias indisponivel no CLI Hobby; isso nao significa consumo zero. Orçamento continua hipotetico, sem associar faturamento desconhecido a cota zero.

Segundo PR (modelo/carga), base main sem os dois testes extra do PR32:250 testes padrão PASS em Node24, incluindo quatro financeiros. Primeira rodada230 PASS/3 FAIL de inicializacao/carregamento, preservada em standard-first-attempt.json;11 casos SQL/action e9 casos billing afetados passaram isolados e a suite completa passou na repeticao. Bundle pgcrypto existia; causa inicial nao determinada. Nenhum teste/guard do produto foi afrouxado. Carga opt-in e modelo offline nao sao executados em producao.
