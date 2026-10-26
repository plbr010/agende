# PR #84 — correções e pedido de reauditoria

Atualização de 26/10/2026: este relatório histórico foi sucedido por [pr84-final-corrections.md](pr84-final-corrections.md), após a segunda auditoria. Consulte também a sequência revisada em [pr84-final-rollout.md](pr84-final-rollout.md).

Data: 24/10/2026. Base auditada: `345d1e9f3e2abccf8dd7f53e4c33e9c9afa21f23`. Trabalho exclusivo em `cursor/commissions-finance-permissions-e0c4`, em checkout separado. Não houve alteração de branches do Codex, assinaturas Stripe, staging compartilhado, produção ou configurações Vercel. Não houve merge nem deploy.

## P1 corrigidos

| Achado | Correção da causa | Evidência automatizada |
|---|---|---|
| A01 — vazamento de comissão | O resumo de fechamento filtra comissão por permissão efetiva e beneficiária, em chamada inicial e retry. SELECT de snapshots exige permissão de comissão, sem conceder por finance.view. | Negação própria, recepção, colega com finance.view, grant restaurado e matriz de outro estabelecimento. |
| A02 — recebimentos parciais | Receipts são fatos de caixa por data/método; despesas por paid_at; refunds por refunded_at. Pendente é saldo atual, não o valor integral. Recebíveis antigos pagos geram um receipt de abertura, sem novo lançamento financeiro. | Parcial, Pix/dinheiro, período diferente da criação, saldo, refund e upgrade sem duplicar caixa. |
| A03 — parcial/cancelamento/pacote | Refund aceita pending com recebido líquido. Guardas impedem cancelamento e conversão com dinheiro retido; exigem devolução explícita. O histórico permanece. | Excesso rejeitado; refund idempotente; cancelamento após devolução; pacote concorrente rejeitado sem consumir sessão. |
| A04 — retry da quitação | Consulta da chave/payload precede validação pending. Chave confirmada retorna o mesmo receipt; mudança de payload gera conflito. | Retry integral sequencial e concorrente com duas conexões e apenas um ID. |
| A05 — deadlock | Helpers autorizam antes de locks e ordenam agendamento → settlement → entrada → comissão. Operações de pacote obtêm o agendamento antes do pacote; entradas de venda de pacote bloqueiam o pacote antes da entrada. | Sete cenários nativos com PIDs distintos e espera real verificada; pagamento/recebimento nos dois sentidos; nenhum 40P01. |
| A06 — estoque na reabertura | Reabrir venda cancelada refaz saída e marcador atomicamente, usando permissões e validação de estoque. | Estoque 10→8→10→8; saldo insuficiente desfaz toda a reabertura, mantendo entrada cancelada. |
| A07 — produtos quitados sem receipts | Trigger de quitação registra o saldo de toda receita, incluindo manual/produto/pacote, não apenas source appointment. | Produto parcialmente pago em dinheiro, restante em Pix; reabertura não duplica receipts. |
| A08 — beneficiária histórica | Pagamento tem FK composta da destinatária imutável; troca guarda IDs anterior/novo no evento e é recusada após qualquer pagamento histórico. | Troca antes de pagar, bloqueio após pagar e após recuperar, histórico preservado e caixa vinculado. |

Código principal: `supabase/migrations/20261024042359_pr84_financial_integrity.sql`. As cinco migrations anteriores não foram editadas: não se presumiu ausência de aplicação em outros ambientes.

## Situação dos cinco P2

| Achado | Situação |
|---|---|
| B01 — estoque/permissões | Corrigido: consulta usa inventory.view em RLS, RPC e rota. Default de consulta owner/admin preserva a tela/RPC anteriores. Grant abre consulta sem escrita; deny bloqueia mesmo com manage. A interface separa controles de consulta/movimento/gerenciamento. Produtos na agenda seguem permissões. |
| B02 — reabertura após pacote | Corrigido conforme aprovação: o recebível permanece cancelado após desfazer sessão e a reabertura genérica é recusada pelo banco. A tela informa necessidade de lançamento manual. |
| B03 — etapas intermediárias/recuperação | Mitigação documentada e ensaiada por transação única, com falha injetada e rollback. **Não resolvido para aplicação das cinco migrations originais em commits/transações separados:** elas contêm os estados intermediários apontados pela auditoria. Se ainda estiverem pendentes, o rollout deve aplicar o conjunto em uma única transação revisada, incluindo controle de histórico pelo operador. Se já estiverem aplicadas, a migration corretiva é aditiva. Nenhum rollout está autorizado. |
| B04 — recuperação e paginação | Corrigido: formulário de devolução efetivamente recebida, motivo obrigatório na action, limite indicado e idempotência; paginação por created_at/id alcança mais de 200 registros sem duplicação. |
| B05 — comissão e caixa | Corrigido conforme aprovação: um movimento financeiro único por pagamento/recuperação, na mesma transação; recuperação gera receipt; movimentos vinculados não podem ser reabertos, alterados ou estornados pela API financeira genérica. |

## Decisões aprovadas e limites

O proprietário aprovou explicitamente, nesta conversa: estorno antes de cancelar/converter parcial; bloqueio da troca após pagamento com destinatária imutável; integração de comissão ao caixa; caixa por data/método e competência separada; bloqueio de reabertura do avulso de pacote após desfazer sessão. Essas aprovações constam de `phase1-decisions.md`.

Não foi criado fluxo de transferência/compensação entre profissionais, crédito automático ou devolução automática. A API antiga de comissão não informa método: os movimentos vinculados usam `other`, com aviso na tela e observação disponível, sem afirmar Pix/dinheiro indevidamente. Outros termos comerciais originais do documento ainda precisam de aceite do proprietário antes de lançamento do produto.

## Validação

- Reprodução anterior à correção: 12 reproduções da auditoria voltaram a confirmar os defeitos no SHA original; log preservado localmente em `audit-pr84/correction-baseline.log`.
- Suíte completa: **474 eventos aprovados, 0 falhas**, entre testes TS, mocks e SQL PGlite. Essa contagem inclui contêineres, não significa 474 casos independentes nem aceitação externa. A expectativa antiga de menu que omitia Comissões foi corrigida para refletir o PR.
- PG17 nativo ampliado: **74 eventos aprovados, 0 falhas**, abrangendo comissões, banco, actions SQL, concorrência existente e hardening. Depois foi executado o conjunto específico novamente, com **32 eventos aprovados**, incluindo mais cenários de concorrência e upgrade.
- Concorrência financeira: sete pares de conexões/PIDs distintos, com `pg_blocking_pids` comprovando sobreposição; `pr84-concurrency.json` contém resultado e SQLSTATE. Rejeições de negócio esperadas usam 22023, sem 40P01.
- `next typegen` e `tsc --noEmit`: aprovados.
- ESLint: zero erros; somente dois warnings anteriores em scripts de preparação de prelaunch não alterados.
- Build: `next build --webpack` aprovado, compilação/TypeScript e 70 páginas geradas. O Turbopack padrão recusou a junction de node_modules fora da raiz; não foi alterado next.config/Vercel para contornar isso.
- Supabase CLI `db advisors`, somente contra o banco PG17 próprio verificado, com `--type security --level error --fail-on error`: nenhum problema nesse nível. Evidência em `pr84-advisors.txt`/`pr84-advisors.json`. O CLI usa a mensagem genérica “Connecting to remote database”, mas o destino efetivo foi 127.0.0.1 em porta temporária. Os testes de RLS/EXECUTE complementam essa checagem; isso não equivale a advisors no projeto real.
- Auth/Storage/Cron são fixtures SQL. Não foi testado PostgREST/Auth real nem navegação autenticada em navegador. Não houve chamadas a Stripe; os testes de billing são mocks/SQL locais.

Comandos reproduzíveis, com Node >=22 e binários PostgreSQL 17 configurados em `AGENDE_PG_BIN`:

```powershell
npm test
npm run test:commissions
npm run typecheck
npm run lint
npx next build --webpack
```

O runner `run-commission-pg17.mjs` cria cluster em 127.0.0.1/porta aleatória e verifica versão, data_directory e cluster_name. Não lê DATABASE_URL e não chama scripts de staging. Todos os clusters usados foram encerrados. Os dados sintéticos ficam no diretório ignorado `.test-postgres`.

## Migration e recuperação

1. Antes de aplicar em qualquer destino, inventariar histórico, definições, ACL, RLS, versões e dados existentes. Não presumir que o esquema alvo coincide com os fixtures.
2. **A migration aborta sem alteração se houver commission_payments anteriores.** Não é possível deduzir com segurança a destinatária histórica de comissão reatribuída ou se uma despesa manual já representa o pagamento. Preparar reconciliação/mapeamento explícito e uma migration revisada para esse cenário; não remover a guarda nem inferir vínculos por valor/data.
3. Também aborta se encontrar entrada cancelada com dinheiro líquido retido em receipts. Corrigir o caso por operação financeira explicitamente aprovada e auditada antes de retomar; nunca apagar receipts para satisfazer a guarda.
4. As fontes antigas de receita pagas sem receipt recebem somente registro de abertura com data/método existentes. Isso não cria receita financeira adicional nem comissão retroativa. Ensaiar também dados volumosos e casos de drift antes do rollout.
5. Quando as cinco migrations originais ainda estiverem pendentes, aplicar o conjunto em transação única, com histórico de migrations mantido pelo operador. O ensaio automatizado confirma rollback com erro injetado; o uso padrão de um runner que commita cada arquivo separadamente não cumpre essa condição.
6. Exigir backup/PITR restaurável e ensaio de restauração em destino isolado. Após novos pagamentos/receipts, preferir compensação/correção aditiva; não usar DROP CASCADE nem reverter frontend como se desfizesse caixa/estoque.
7. Conciliar por estabelecimento: recebimentos, estornos, caixa, saldo, comissão paga/liberada e estoque. Verificar limites e locks sob carga representativa. Este documento não autoriza execução desses passos em staging/produção.

## Pedido de nova auditoria independente

Solicito ao Codex uma nova auditoria do HEAD atualizado do PR #84, comparando-o com `345d1e9f3e2abccf8dd7f53e4c33e9c9afa21f23`, especialmente A01–A08, ordem de locks, projeções de dados, recibos legados e vínculo de comissões ao caixa. Reexecutar os testes nativos e revisar as limitações de B03 e do preflight sobre pagamentos anteriores. Verificar também as alterações de permissões de estoque e os novos endpoints de paginação.

O PR continua **aguardando reauditoria**, sem parecer de pronto para merge. Não fazer merge/deploy nem aplicar migrations em ambiente compartilhado para realizar essa revisão.
