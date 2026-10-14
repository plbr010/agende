# Auditoria de lançamento — 13/10/2026

**NO-GO comercial para 15/10 enquanto os gates abaixo permanecerem abertos.** Esta rodada parte de main `1507908c12000e9d9dc8de712d54dfc4b320e71d`, depois dos PRs32–35. Branch exclusiva `codex/launch-final-audit-2026-10-13`, checkout inicialmente limpo. Nenhum frontend do Cursor alterado, merge automático, contratação, cobrança real, exportação produtiva ou migration remota executados.

## Estado renovado e bloqueios

| Gravidade | Evidência atual | Próxima ação |
|---|---|---|
| P0 | Supabase produção ACTIVE_HEALTHY, PostgreSQL17.6; RPC ausente em app/public e histórico20261010232248 ausente | Backup aceito e autorização independente para a única migration |
| P0 | Backup real ainda não exportado/restaurado | Autorizar cópia cifrada e ensaio SQL/Auth isolado; informar senha existente por entrada oculta |
| P0 | Cadastro de serviços continua bloqueado legitimamente | Não remover fallback seguro ou guards de escrita |
| P0 | Vercel bindings Supabase ainda nos targets production/preview/development; SITE_URL ausente | Aprovar alteração de bindings/origens e rebuild de cada ambiente |
| P0 | Vault staging não tem stripe_api_key | Proprietário inserir chave restrita TEST no projeto fkpdudnnperufnmdwdlv; testar permissões efetivas |
| P0 | Confirmação/recuperação por e-mail não homologadas | Resend Free, domínio verificado e caixa controlada; manter confirmação obrigatória |
| P0 | Edge de produção stripe-billing/webhook permanecem v2, anteriores às correções recentes | Comparar/deployar bundles por aprovação própria; deploy Next não atualiza Edge |
| P1 | Descoberta sem duas RPCs no staging; frontend retorna missing_backend | Coordenação com Cursor, consentimento de publicação, adapter e SQL em PR separado |
| P1 | Cinco HIGH em cadeia ESLint via braces3.0.3; npm indica downgrade incompatível | Acompanhar correção upstream; não aplicar audit fix --force; produção audit zero |
| P1 | Proteção Supabase de senhas vazadas desativada | Registrar risco e verificar disponibilidade/custo antes de qualquer configuração |
| P1 | Capacidade cloud/monitoramento contínuo e aceite comercial incompletos | Aprovar limiares, responsabilidades, política Portal e recuperação |

Vercel confirmou `dpl_2hzXnnbAd94RG249XcZNoszFYb9W`, target production, READY, main1507908, domínio agendeapp.online. Quatro GETs públicos200 em `availability-2026-10-13.json`; isso comprova shell HTTP, não cadastro/entitlements/booking. O inventário de envs foi consultado sem decriptação; nenhum valor foi salvo no relatório.

## Segurança e migration exclusiva

SHA256 do arquivo20261010232248_atomic_service_professional_links.sql:
`d13be7931bf92be45ef754858d4642881186f5bd8f9ce8a0d5f919419e5c0b37`.

Dependências require_workspace_manager, lock_workspace_membership, assert_workspace_entitled e require_confirmed_email presentes, SECURITY DEFINER com search_path vazio, sem EXECUTE anon/authenticated direto. Índice unique(professional_member_id,service_id) presente. Todas as tabelas públicas observadas mantêm RLS+FORCE. Histórico produtivo termina em20260927005815,63 registros; quatro arquivos202610 pendentes continuam fora de qualquer execução remota.

A migration contém apenas criação de duas funções, privilégios/comentário e NOTIFY. INSERT/UPDATE existem nos corpos, não são invocados pela aplicação da migration. Não contém DELETE nem chamada de negócio durante aplicação. Teste isolado do payload comprova preservação dos serviços/vínculos, registro exclusivo de histórico e recusa de reaplicação. Uso futuro da RPC pode editar serviços, conforme autorização manager e entitlement; não confundir isso com a operação DDL.

Advisors atuais:5 avisos de wrappers anon SECURITY DEFINER,53 authenticated,1 INFO de leases privadas sem policy e1 WARN de proteção de senha vazada. Os wrappers públicos de booking são contratos intencionais; sua contagem não prova ausência de risco, nem autoriza revogação geral. [Advisors para RPC anon](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [RPC autenticada](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [leases sem policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [senhas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Backup: ensaio e comando revisado

Plano completo: [FREE-BACKUP-RECOVERY.md](../production-readiness/FREE-BACKUP-RECOVERY.md). Preparação revalidada: TLS1.3/CA/hostname no session pooler, sem autenticação; ensaio sintético passou às19:48:02.817Z. Restore32,975s, fingerprints/tabelas/catálogo/roles/sequences iguais; checksum, senha e timestamp adulterados rejeitados; cluster temporário parado/removido. Esse RTO é sintético; não estimar RTO real com duas tabelas.

pg_dump17.6 custom completo + roles sem senhas PostgreSQL + core no mesmo snapshot, cifrados AES256-GCM com manifesto autenticado. Pasta privada fora de Git, ACL do usuário, transporte verify-full e logs sem linhas de clientes. Auth SQL inclui hashes/identidades/sessões; Storage binário, configuração SMTP/Auth/Edge, chaves raiz e Stripe externo ficam fora da recuperação SQL. Native restore não recupera integralmente Cron/Vault/GoTrue. Sem exportação real, RPO produtivo não comprovado; idade do último snapshot define perda potencial. Meta proposta RPO24h, RTO core2h, a aceitar e medir antes de lançar.

Após autorização específica para exportar e restaurar o core, executar os comandos export/restore do plano e validar o manifesto/ensaio real. Guardar senha separadamente e segunda cópia cifrada em mídia autorizada. Só então solicitar aprovação exclusiva da migration.

Comando DDL preparado, **não executar** nesta rodada:

```powershell
& 'C:/Users/PLBR/Documents/Codex/.agende-test-runtime/pg17/pgsql/bin/psql.exe' --dbname='host=aws-0-us-east-2.pooler.supabase.com port=5432 dbname=postgres user=postgres.wohimauqgywshbbejjcl sslmode=verify-full sslrootcert=C:/Users/PLBR/AppData/Local/AgendePrivateRecovery/prod-ca-2021.crt connect_timeout=10' -W -X --set=ON_ERROR_STOP=1 --single-transaction --file=docs/production-readiness/apply-service-rpc-only.sql
```

Senha em prompt oculto; apagar PGOPTIONS read-only herdado somente nesta sessão autorizada se necessário, nunca configuração do servidor. Payload usa lock_timeout5s, statement_timeout60s e idle_in_transaction_session_timeout60s. Reconfirmar fonte/payload e ausência imediatamente antes. Erro reverte a transação inteira. Depois: apenas leitura de histórico, assinatura das duas RPCs, grants/search_path/RLS/cache PostgREST; teste de escrita produtivo exige outra autorização.

Rollback: antes do COMMIT, transação aborta sem DDL/histórico parcial. Depois, preferir correção aditiva revisada e app compatível; não restaurar banco inteiro sobre novas gravações, apagar funções/serviços ou aplicar as demais migrations automaticamente. Backup aprovado não aprova DDL.

## Testes desta rodada

| Verificação | Resultado e limite |
|---|---|
| npm ci, Node24 | PASS,408 pacotes; cinco HIGH dev reportados |
| npm run lint | PASS |
| npm run typecheck | PASS |
| npm test |262 PASS,0FAIL,0SKIP; SQL/Auth fixture e Stripe mocks identificados no JSON |
| npm run build | PASS, Next16.3.8; não prova negócios externos |
| PostgreSQL17.6 real isolado |47 PASS + cinco suítes SQL; cluster encerrado; identidades SQL sintéticas |
| Smoke do build local |34 GETs/redirects PASS; backend placeholder, sem submit de negócio |
| GoTrue/PostgREST staging |10 grupos PASS; seis contas sintéticas previamente confirmadas por SQL |
| Backup/restauração sintética | PASS; integridade e tampering; não são dados produtivos |
| Audit omit dev |0 vulnerabilidades |
| Stripe sandbox GET Prices | Seis valores BRL/periodicidades ativos corretos; não equivale a pagamento aplicado no Agendê |

Evidências: `../homologation/standard-tests.json`, `../homologation/native-tests.json`, `../homologation/native-pg17.json`, `../staging/real-api-results.json`, `launch-audit-evidence.json`, `availability-2026-10-13.json`. A suíte real staging repetiu trial persistido, convites/papéis, tenant IDOR, catálogo, disputa de horário com único vencedor, reagendamento/cancelamento, review concorrente, financeiro fictício/idempotência e refresh/logout. Cadastro, entrega SMTP/reset e confirmação por link continuam sem aceite real. Nenhum pagamento de cliente real foi realizado.

Preços TEST corretos: solo8990/79900; equipe16990/149900; salao29990/279900 centavos BRL, month/year. Os IDs internos equipe/salao correspondem aos produtos Equipe até5/até15; não renomear IDs Stripe/schema por mudança de texto comercial. Trial sem cartão permanece único por identidade,7dias, troca sem prorrogação e cliente final sem assinatura. Limites/downgrade testados em SQL/staging; Portal externo atualizado e webhook integrado ainda precisam de evidência com chave runtime. Ciclos Stripe de renovação/recusa/cancelamento no relatório histórico11/10 não comprovam sincronização no Agendê hoje.

## SMTP e chave TEST: intervenção segura

Resend preparado sem contratação/configuração: verificar `auth.agendeapp.online` e remetente `nao-responda@auth.agendeapp.online`; usar os registros SPF/DKIM/return-path reais do Dashboard em plano de DNS revisável. Não publicar chave ou inventar registros. Free permite100/dia e três domínios; cota mensal deve ser conferida no Dashboard ao criar conta. [SMTP oficial](https://resend.com/docs/send-with-supabase-smtp), [preços](https://resend.com/pricing).

Em Supabase **staging**, Authentication → Email/SMTP Settings: host smtp.resend.com, porta465, usuário resend, senha chave Resend restrita a envio do domínio, nome Agendê Homologação e remetente verificado. Inserir diretamente no Dashboard. Desabilitar tracking dos links Auth e manter confirmação obrigatória. Usar caixa controlada; não presumir que o endereço de envio tenha inbox. Testar profissional/cliente, usuário não confirmado sem acesso, link válido/expirado/reutilizado, login/logout, recuperação e senha nova. Alteração de DNS ou configuração produtiva continua exigindo aprovação.

No sandbox `agende-staging` acct_1UPNGJQQUyqAaZvS: criar restricted key TEST, Customers/Checkout Sessions/Customer Portal write, Prices/Subscriptions read (estas últimas cobrem retrieve/list dos handlers). Demais permissões none. Inserir diretamente no Vault do projeto fkpdudnnperufnmdwdlv, nome stripe_api_key; nunca chat, GitHub ou NEXT_PUBLIC. OAuth do conector não substitui essa chave runtime. Após salvar, verificar somente presença/mode e exercitar checkout/webhook/replay/downgrade/renovação/recusa/Portal; eventuais403 exigem revisão do privilégio específico, não chave irrestrita. Configuração LIVE e cobranças reais não autorizadas.

## Capacidade, orçamento e operação

Modelo e hipóteses em [README.md](README.md) e cost-model.json, sem uso/fatura produtivos observados. Mix40%Solo/40%Equipe/20%Salão,20% anual; dólar5,50 de planejamento, reserva5%, anúnciosR$1.000, remuneraçãoR$2.000, contadorR$300, suporteR$10/estabelecimento, taxas4,69%+R$0,50 por pagamento, reserva de risco3%, tributos AnexoV apenas ilustrativos. Receita anual reconhecida /12; caixa anual é recebimento concentrado, sem confundi-lo com MRR.

| Pagantes | Infra prevista USD | Infra BRL com reserva | Operação total BRL | MRR BRL | Resultado econômico BRL |
|---|---:|---:|---:|---:|---:|
|100|75,00|433,13|4.793,13|15.577,00|7.116,31|
|300|100,51|580,47|6.940,47|46.731,00|27.786,87|
|1.000|229,04|1.322,72|14.682,72|155.770,00|98.048,13|

Nesse cenário81 pagantes geram resultado previstoR$5.055,20. Só mensal: Solo153/Equipe73/Salão40; só anual:217/103/52. Não é promessa nem enquadramento fiscal confirmado; custos/aquisição/inadimplência e suporte podem alterar resultados.

Carga histórica13/10:100/500 usuários passam p95total2s;1.000/5.000 excedem SLO (2,083s/7,924s), embora sem erros. É uma ação por identidade sintética em burst SQL local/pool16, não usuários cloud sustentados nem HTTP/Auth/Vercel. Não repetir contra produção. Supabase Free exige monitorar DB500MB/egress/MAU e recuperação; não contratar Pro por número de salões sem medições. Vercel Hobby é apenas uso pessoal não comercial: lançamento comercial exige decisão de hospedagem compatível, mesmo com baixa carga. [Regra Vercel](https://vercel.com/docs/plans/hobby).

Monitoramento preparado: `node scripts/check-public-availability.mjs` faz apenas quatro GETs com timeout10s, sem tokens, corpos/logs de cliente ou cadastro. Amostra não mede uptime mensal; nenhum agendamento/serviço externo ativado. Plano: amostras5min, alertar duas falhas consecutivas; p95/5xx e saturação, DB/storage/egress em70/85%, fila/falhas webhook e último backup/RPO. Logs sem e-mail, localização, tokens ou request bodies; retenção/operador a aceitar. Teste operacional diário sintético apenas em staging, separado do probe HTTP. Rollback de Vercel precisa preservar compatibilidade das RPCs e revalidar bindings; não promover Preview com envs diferentes.

## Descoberta e conclusão verificável

Contrato Cursor em ../discovery/backend-contract.md e PR35 em DISCOVERY-CONTRACT.md. Nomes list_public_localities/search_public_workspaces e DTO público preservados. Divergências pendentes: cidade obrigatória no frontend versus global/nearby sem cidade; OFFSET versus keyset; GPS sem dados geográficos persistidos/consentimento de diretório. Não ligar DISCOVERY_BACKEND_READY nem publicar coordenadas de estabelecimentos por inferência. Não implementado nesta rodada; entregar ao Cursor a proposta de adapter server-only, consentimento e POST nearby sem GPS em URL/logs, antes da integração visual.

Percentual:4 de12 gates completamente verificados nesta rodada =33,3% do checklist de aceite definido aqui, **não percentual de código desenvolvido**. PASS: integridade do repositório/deploy; regressão local; segurança/concorrência SQL; operações/papéis via API real staging. Abertos: backup produtivo; RPC produtiva; signup/SMTP/reset; billing sincronizado; bindings/origens; descoberta completa; capacidade/monitoramento operacional; aceite comercial/hosting/recuperação. Preparações parciais não recebem crédito de PASS. Um único P0 basta para NO-GO, independentemente dessa porcentagem.

Próximo passo restrito: autorização explícita para exportação cifrada/restore SQL local. Em paralelo, caixa SMTP e chave TEST devem estar disponíveis. Migration e demais alterações produtivas seguem com aprovações separadas.

Correções de produto: nenhum bug novo reproduzido nesta rodada exigiu mudança de aplicação. A correção atômica de serviços já está no Git e foi novamente testada; o problema produtivo é sua ausência no banco remoto. Os cinco alertas dev são pendência upstream identificada, não resolvida. Não atribuir PASS a signup, discovery ou Stripe integrado por os respectivos templates/rotas renderizarem.

Atualização ao final da rodada: o proprietário incorporou PR31 durante a auditoria. Main agora3725710b5891cec1dab6b93db18c97127e531a48; Vercel produção confirmou READY em dpl_D7KUUjoSRKYujdGCb98Qb95SaWtR. A branch de auditoria incorporou essa main preservando integralmente o frontend Cursor; conflito exclusivo no relatório gerado foi resolvido por nova execução:262 testes PASS. Ausência da RPC/migration produtiva reconfirmada em13/10 às19:55:36Z. Os fatos sobre1507908/deploy anterior acima são a leitura inicial histórica. Dependências/migrations não mudaram com PR31; ensaio PostgreSQL/staging desta rodada permanece aplicável. Lint/typecheck/build/smoke são repetidos para a integração final, com resultado a registrar abaixo.

Validação final sobre main3725710: lint/typecheck/build PASS e34 smoke GETs locais PASS. Matriz de carga novamente executada em PG17.6 isolado às19:57Z:100/500/1.000/5.000 ações concorrentes, zero erros; p95total774/754/1.351/5.636ms. SLO2s PASS até1.000 neste ensaio e FAIL em5.000. Variação frente ao ensaio anterior reforça que não é capacidade cloud certificada. Resultado novo em load-results-final-2026-10-13.json; load-results.json histórico preservado, sem reescrever as referências anteriores. native-load-runtime.json comprova cluster encerrado e native-load-tests.json registra o caso da matriz; os47 testes nativos completos ficam nos relatórios próprios. O invólucro PowerShell tentou preservar local-flows.json inexistente e emitiu erro local; não havia arquivo a preservar. O executor nativo/matriz terminou com exit0, e os dois relatórios nativos existentes foram preservados byte a byte. Nenhum erro de banco foi ignorado e nenhuma conexão produtiva/staging foi feita pela carga.
