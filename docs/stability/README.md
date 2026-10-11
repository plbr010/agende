# Estabilidade e regressão — 11/10/2026

**NO-GO para clientes pagantes.** Código e verificações locais passam; cinco migrations ainda pendentes e serviços externos isolados ainda indisponíveis. Nenhuma alteração de produção, pagamento real, contratação, provisionamento, DNS, deploy manual ou merge foi executado nesta missão.

## Estado e escopo

Main `31c05278635275b76cb0b4dc92ba8cbbd2ceb369`, com #26 incorporado pelo responsável. Branch exclusiva `codex/launch-stability-regression`, criada do checkout limpo. Último PR visual integrado #25. No início desta rodada não havia PR aberto; o dashboard de alta fidelidade continua em andamento conforme informado pelo proprietário, sem novo PR visível. Não editar/check-out/escrever nas branches do Cursor. Nenhum TSX, CSS, componente visual ou identidade alterado. Não integrar trabalho visual ainda não aprovado.

## Falha reproduzida e corrigida

Após RPC de reagendamento com sucesso, a action chamava um helper que descartava erro da recarga. Quando `list_my_appointments` falhava, retornava `{appointments:[]}` e o consumidor substituía a lista por vazia. Os registros já persistidos permaneciam no banco, mas a interface podia indicar ausência de agendamentos.

Agora a action usa o resultado explícito da recarga; em falha responde que **o reagendamento foi salvo**, orienta atualizar a página e não fornece lista substituta. O loader também rejeita resposta malformada ou parcialmente inválida, mantendo distinção entre lista vazia válida e falha de contrato. Uma lista válida continua no mesmo contrato usado pelo redesign.

Reprodução antes da correção: dois casos de comportamento falharam (empty-success e read model malformado); controle com dados válidos passou. Depois: três casos passaram. Nova integração de Server Action + SQL salva o mesmo ID, injeta falha exclusivamente na leitura subsequente e verifica o novo horário diretamente no banco. Passou em PGlite e PostgreSQL17.6 nativo. Nenhum serviço externo/mensagem real é fornecido pelo transporte do teste.

## Checks executados

| Check | Resultado |
|---|---|
| npm ci | PASS, Node24.19.0 |
| lint / typecheck | PASS |
| npm test | **237 PASS**, zero falhas/skips |
| build | PASS, Next.js16.3.8 preservado |
| test:smoke | **32 PASS**, GETs anônimos no build local |
| npm run test:postgres | **44 PASS**, zero falhas/skips, PG17.6 nativo e oito concorrências reais |
| cinco suítes SQL no executor nativo | PASS; 67 migrations locais aplicadas no cluster sintético |
| npm audit --omit=dev | zero vulnerabilidades de produção |
| verify-stripe-recovery / validate-release-plan | PASS; snapshots históricos preservados e plano validado offline |

Suíte padrão:135 unitários/contratos estáticos,54 mocks plataforma,12 mocks Stripe,26 SQL PGlite e10 integrações SQL com identidade Auth simulada. Suíte nativa:26 SQL,10 integrações com Auth simulado e8 concorrências. Os36 casos SQL/integração repetem casos da suíte padrão: não somar237+44 como casos únicos. JSON completos em `../homologation/{standard-tests,native-tests,native-pg17,pg17-concurrency}.json`. Cluster nativo parado; dados sintéticos preservados fora do Git.

Cadastro/onboarding, catálogo/associação/horários, reserva/reagendamento/cancelamento/conclusão/avaliação, financeiro/estoque/pacotes e contratos de relatórios foram cobertos pelos testes já existentes, preservados e executados junto da regressão nova. Trial único, vencimento, papéis/IDOR/assentos/isolation e concorrência têm evidência SQL local. Não atribuir a isso aceite completo de botões/formulários/filtros no navegador autenticado.

**BLOQUEADOS:** Auth/SMTP/GoTrue/PostgREST de ambiente real isolado, navegador autenticado de ponta a ponta e Stripe TEST/Checkout/Portal/test clocks externos. Os testes Edge têm imports e chamadas de plataforma simulados. Caixa de e-mail local também não foi iniciada nesta máquina. Nenhum fluxo externo recebe PASS por mocks.

## Reconfirmação remota

`remote-recheck.json` foi coletado por consultas somente leitura. Supabase saudável PG17.6.1.166, organização Free; só Agendê ativo e PetGestor inativo, sem staging/branches. Todos os oito grupos de catálogo continuam iguais ao snapshot de09/10.31 tabelas públicas com RLS+FORCE; history63 versus67 arquivos locais, mesmos cinco pendentes. Não inventar histórico exclusivo/placeholder nem executar repair/db push genérico. Backup recuperável e restore continuam **não comprovados**; Free não inclui backups automáticos acessíveis/PITR.

Stripe só LIVE acessível; sandbox não criado/conectado. Apenas configuração LIVE lida, nenhuma simulação/transação. Portal continua updates=false, trial_update_behavior=end_trial inativo; webhook ativo com oito eventos na Edge produtiva. Proposta de política/allowlist de seis preços existe em `../production-readiness/PORTAL-PROPOSAL.md`, ainda não aplicada.

Vercel production READY `dpl_7xR5i9zea2vUgw4EMt6imP2bE6N8`, commit31c0527. Bindings Supabase continuam compartilhados com Preview/Development; guards do #26 recusam o backend produtivo nesses ambientes. Nenhum novo binding remoto foi escrito. Domínio agendeapp.online continua NXDOMAIN e não associado ao projeto; seu HTTPS ainda não pode ser validado. Logs error/fatal de30min sem grupos retornados, alcance limitado. Não configurar monitoramento futuro automaticamente nem inferir ausência universal de erros.

## Gates, aprovações e próximo aceite

**P0:** provisionar/isolar staging e credenciais; aplicar cinco migrations produtivas somente depois de staging/backup/aprovação; homologar Auth/SMTP, navegador e ciclo Stripe TEST. **P1:** Portal/trial/proração/assentos, domínio/origens/SMTP, backup recuperável e manutenção do PostgreSQL. Proteção gerenciada de senha vazada requer Pro; não contratar por conta própria. **P2:** revisar preços anuais extras sem arquivar assinaturas, acompanhar patch dev braces e automatizar observabilidade/PG nativo.

Arquitetura gratuita e limites estão em `../production-readiness/ZERO-COST-STAGING.md`. A documentação oficial confirma runtime nativo Supabase somente Linux/macOS ARM; [Windows requer containers](https://supabase.com/docs/guides/local-development/docker-and-native-runtimes). Docker/Podman/CLI não estão disponíveis neste host. PostgreSQL portátil não substitui a stack completa. A aprovação solicitada para criar `agende-staging` Free ainda não foi recebida; missão geral de preparação não autoriza criação remota, alterações de plano ou Windows.

Operações de aprovação: criação Free somente com US$0/cota confirmados; sandbox Stripe TEST e bindings; instalação de runtime local; migrations/schema, Edge/Portal/Auth/SMTP produtivos e DNS/domínio. Plano exato, riscos, validação e recuperação permanecem em `../production-readiness/RELEASE-RUNBOOK.md`, com hashes em migration-plan.json e aceite real em STAGING-ACCEPTANCE.md. Não alterar nenhum desses recursos sem a aprovação correspondente.

Para o novo dashboard do Cursor, executar o roteiro de navegador autenticado em staging assim que houver serviço isolado, conferir persistência por API/SQL e os quatro papéis em dois salões. Se houver falha visual, registrar passos/URL/viewport para Cursor; se houver falha backend reproduzível, corrigir nesta branch. Não promover redesign por conta própria.
