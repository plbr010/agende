# PR #84 — correções após a segunda auditoria

Data: 26/10/2026. Base da correção: `1a28f7a5b6bd45dee793a185a129df2760a6732f`. Branch exclusiva: `cursor/commissions-finance-permissions-e0c4`.

O proprietário confirmou nesta conversa que as cinco migrations originais de comissão **não foram aplicadas fora dos testes locais** e autorizou corrigi-las. Essa confirmação permitiu fechar a exposição nos próprios arquivos, desde a primeira etapa. Se o inventário futuro de algum destino contradisser essa informação, interromper a aplicação e revisar o SQL/histórico daquele destino; não reaplicar nem reparar versões por suposição.

## Evidência individual

| Achado | Correção | Regressão específica |
|---|---|---|
| R01 / P1 — quitação real sem idempotência | A tela financeira envia chave estável para `public.settle_financial_entry`. O banco guarda operação imutável por workspace/chave, confere entrada/método/data e devolve o resultado anterior inclusive depois de reabertura, sem mudar o estado atual. `mark_financial_entry_paid` preservada para compatibilidade retorna a entrada já paga com o mesmo método e recusa método divergente. | `pr84-final-sql.test.mjs`: parcial R$40 + saldo R$60; retry; payload conflitante; retry após reabertura; nova chave sem duplicar receipt. Duas conexões PG17 aguardam lock real e convergem para uma operação e um receipt. `actions.test.ts` verifica que a action envia a chave à nova RPC; teste SQL executa a action duas vezes. |
| R02 / P1 — dados pagos com receipts incompletos | Preflight da sexta migration rejeita receita paga com receipts parciais ou excessivos; nenhuma abertura é presumida nesses casos. A sétima repete a conferência final. Constraint triggers diferíveis impedem commit de receita paga com soma diferente do valor, ou receipts acima do valor da receita. Baixa normal registra apenas o saldo na mesma transação. | `pr84-final-upgrade.test.mjs`: falha sem alteração com parcial, excesso e refund histórico; ausência total de receipts segue a abertura legada com data/método já registrados; reconciliação sintética explícita permite continuar e estornar integralmente. `pr84-final-sql.test.mjs`: produto R$20, R$5 cash + R$15 Pix, refund integral e recusa de excesso; INSERT privilegiado paid sem receipt falha no commit. |
| R03 / P1 — janela de privilégios | Primeira migration habilita RLS+FORCE, revoga grants automáticos nas oito tabelas e EXECUTE dos helpers. Segunda também revoga imediatamente seus helpers, usa fechamento sem UPDATE de snapshot imutável e já filtra comissão por autorização. Terceira nasce com a política restrita de snapshots. Não depende da sexta para fechar essa brecha. | `pr84-final-upgrade.test.mjs`: default grants simulando plataforma; cada arquivo confirmado separadamente; anon sem acesso, authenticated sem DML nas tabelas, helper de sync sem EXECUTE; tentativa direta de outro salão recusada após primeira/segunda etapas. Rollback com falha após o conjunto completo, replay recusado e retomada após reconciliação explícita. Evidência final cobre sete etapas. |
| R04 / P2 — grants e actions | `managementAction` autoriza por operação e permissão efetiva, com sessão confirmada. Trial/pacotes preservam seu contrato de papéis. O banco continua autorizando cada RPC; despesas exigem finance.manage. A tela financeira separa consulta, recebimento e gerenciamento. | Unitários: grant/deny de profissional/admin e trial recusado. Teste da action real transpilada, com permissões carregadas do banco PG17, efetua movimento e quitação, confirma retry, recusa deny, outro salão e ausência de identidade. Transporte Auth/cookies é fixture, conforme limite abaixo. |
| R05 / P2 — resumo financeiro incorreto | Fechamento mostra Total, Recebido e Pendente. Comissão null não vira afirmação de inexistência: a informação é omitida. Lista financeira mostra bruto recebido, devolvido, líquido e saldo pendente; ações de escrita acompanham permissões. | `checkout-message.test.ts`: recebimento zero/parcial/integral, desconto integral e comissão oculta. Typecheck/build verificam integração do helper na action e props da tela. Não há evidência visual autenticada de navegador nesta rodada. |

## Reprodução anterior

Antes de editar a implementação, os testes da segunda auditoria foram reexecutados sobre sua cópia do SHA base. Sete eventos SQL passaram comprovando os defeitos e um teste de action confirmou o bloqueio indevido de grants. Logs locais: `C:/Users/PLBR/Documents/Codex/reaudit-pr84-1a28f7a/final-correction-baseline.log` e `final-correction-actions-baseline.log`. A evidência estática anterior de R05 identifica as mensagens incorretas; as regressões agora exigem total/saldo corretos e ausência de afirmação sobre comissão oculta.

## Preservação das decisões e correções anteriores

- Estorno explícito continua obrigatório antes de cancelar/converter recebível com dinheiro retido.
- Beneficiária continua imutável após qualquer pagamento histórico, inclusive após recovery; cada pagamento tem destinatária própria.
- Payout/recovery continuam gerando um único movimento financeiro vinculado, na mesma transação, e caixa usa datas reais.
- Desfazer sessão mantém avulso cancelado e bloqueia reabertura genérica. Saldo pendente continua atual; competência operacional permanece separada.

As suítes anteriores de comissões, isolamento, estoque, pacote, relatórios e sete pares de concorrência foram preservadas e reexecutadas. A operação nova acrescenta um oitavo par de conexões, com PIDs diferentes e `pg_blocking_pids` comprovando espera real.

## Execução e limites

Resultados consolidados e evidências estão em `docs/homologation/pr84-final-*.json`. Os reporters contam contêineres além de subtestes: não interpretar eventos como quantidade de casos independentes.

| Validação desta correção | Resultado |
|---|---|
| Suíte completa | **481 eventos aprovados, 0 falhas**, `pr84-final-standard-tests.json` |
| PG17: comissões, integridade, upgrades e actions SQL | **49 eventos aprovados, 0 falhas**, `pr84-final-native-tests.json`; cluster encerrado em `pr84-final-pg17.json` |
| Sete etapas revisadas, após ampliação das verificações finais | **Aprovadas** em execução nativa adicional; `pr84-final-migration-stages.json` |
| Concorrência financeira | Oito pares nativos: sete existentes em `pr84-concurrency.json`, novo retry de quitação em `pr84-final-concurrency.json`; bloqueio real, sem 40P01 observado |
| Typecheck | Aprovado: `next typegen` e `tsc --noEmit` |
| ESLint | Zero erros, apenas dois warnings anteriores em scripts prepare-prelaunch |
| Build | `next build --webpack` aprovado, compilação, TypeScript e páginas geradas |
| Supabase security advisors, nível error | Nenhum problema nesse nível, somente banco próprio PG17 em loopback; `pr84-advisors.txt` |

Comandos locais, Node >=22 e `AGENDE_PG_BIN` apontando para PostgreSQL 17:

```powershell
npm test
npm run test:commissions
npm run typecheck
npm run lint
npx next build --webpack
node scripts/prepare-pr84-plan.mjs
```

Também foi executada a integração mais ampla `scripts/action-sql-integration.test.mjs` em PG17 e o Supabase security advisor em nível error contra banco próprio em loopback. O runner verifica versão, cluster_name e data_directory; não lê DATABASE_URL para selecionar destino. Todos os clusters usados são encerrados.

**Limites obrigatórios:** Auth/GoTrue, PostgREST, cookie/JWT, HTTP de Server Actions e navegação desktop/mobile autenticada não foram comprovados. Docker e Go não estão no PATH e WSL não está instalado. As actions foram executadas com código real e SQL real usando identidades/claims sintéticos; isso não equivale a autenticação real. Não foram usadas credenciais produtivas ou staging como substituto. Não foi executado teste de carga nem restore de backup. O build validado usa webpack; a junction de dependências continua sendo uma limitação do build Turbopack neste ambiente.

Não houve merge, deploy, SQL remoto, alteração Stripe/Vercel ou mudança em branches do Codex. Este documento não autoriza rollout. O PR continua sujeito a **nova auditoria independente**, principalmente do ledger de idempotência, constraints diferíveis, sequência revisada das migrations e homologação autenticada pendente.
