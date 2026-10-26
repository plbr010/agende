# PR #84 — estratégia de aplicação e recuperação

Este plano é artefato de revisão. Nenhuma aplicação remota foi executada ou autorizada pela correção.

## Condições de entrada

1. Fixar o SHA do PR após nova auditoria e comparar os sete arquivos com `pr84-final-manifest.json`. Os hashes são SHA256 do conteúdo normalizado para LF; `node scripts/prepare-pr84-plan.mjs` apenas regenera esse manifesto, sem acessar banco.
2. Inventariar por leitura catálogo, ACL/default grants, políticas, funções, constraints, índices e `supabase_migrations.schema_migrations` do destino futuramente autorizado. Os sete timestamps do manifesto precisam estar ausentes. Se algum existir, parar e comparar o SQL exato aplicado: esta revisão das cinco originais se baseia na confirmação expressa de que ainda não tinham sido aplicadas.
3. Conferir dependências anteriores e drift. Não executar db push geral nem migration repair para forçar equivalência com o fixture.
4. Consultar os diagnósticos de `pr84-preflight.sql`: payouts anteriores, receitas paid com receipts não vazios divergentes, refunds e cancelled com dinheiro retido. Payouts exigem mapeamento explícito de beneficiária/caixa. Paid parcialmente documentado exige reconciliação explícita. Não apagar receipts e não inferir complemento, método ou data por coincidência.
5. Confirmar backup restaurável e ensaiar restauração isolada. Medir DDL/backfill e locks em volume representativo; isso não foi comprovado nos dados sintéticos.

## Ordem e transações

Usar exatamente a ordem do manifesto: cinco migrations originais revisadas, corretiva de integridade, corretiva final de quitação/constraints. Preferir uma única transação revisada para o conjunto e seus registros de histórico, com `ON_ERROR_STOP`, lock_timeout/statement_timeout definidos pela janela operacional e verificações antes do commit.

Cada arquivo também foi ensaiado como transação separada: a primeira etapa já deixa tabelas sob RLS+FORCE e revoga ACLs; a segunda não deixa helpers públicos nem altera snapshot imutável. Não existe mais dependência de aplicar a terceira/sexta para retirar o EXECUTE indevido. A aplicação por etapas ainda requer uma janela de manutenção ou compatibilidade de versões revisada; não liberar a funcionalidade ao usuário antes das sete.

Uma falha do preflight deixa a migration sem alterações quando o arquivo é aplicado atomicamente. Preservar o erro e os diagnósticos; corrigir dados somente com operação explícita e auditável, aprovada para aquele caso. Receipts excessivos não devem ser reduzidos por DELETE/UPDATE: exigem desenho de compensação/reconciliação revisado. Não foi inventada uma regra automática para isso.

## Pós-condições

- Oito tabelas de comissão e novo ledger de quitação com RLS+FORCE, sem DML para anon/authenticated; ledger interno sem SELECT para esses papéis.
- Helpers internos sem EXECUTE público; somente RPCs autorizadas expostas. Confirmar também schema cache/PostgREST do ambiente real.
- Toda receita paid possui receipts iguais ao valor bruto; receipts não ultrapassam o valor. Refunds não ultrapassam recebido; somas por salão conciliam caixa, saldo e comissão.
- Repetição de quitação com a mesma chave retorna o mesmo ID sem nova operação/receipt; payload diferente conflita. Retry antigo após reabertura não quita uma nova operação.
- Pagamentos/recuperações de comissão preservam payee e vínculo único no caixa. Cancelamento/pacote exige devolver dinheiro retido; estoque permanece coerente.
- Histórico de migrations e hashes corresponde ao conjunto efetivamente executado, sem marcar versão ausente como aplicada por inferência.

## Recuperação

Falha antes do commit: rollback integral, inclusive histórico, e comparação de catálogo/saldos com o snapshot de entrada. Os testes incluem erro depois de todo o DDL para verificar esse rollback.

Se arquivos anteriores já tiverem sido confirmados em transações separadas, preservar seus registros e não repetir os arquivos. As primeiras etapas agora são fechadas para chamadas indevidas; investigar o motivo da falha antes de retomar. Se houver drift de SQL ou dado financeiro sem reconciliação, parar.

Depois de receber/pagar dinheiro, não usar DROP CASCADE ou rollback de frontend como reversão financeira. Preservar ledger, snapshots, receipts e eventos; preparar correção aditiva/compensação e conciliar por salão. Restauração de backup é decisão operacional separada; o ensaio de rollback local não comprova restore produtivo.
