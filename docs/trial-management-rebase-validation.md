# Recuperação e integração de trial e gestão — 26/09/2026

## Recuperação

- Escrita no checkout e em `.git` confirmada por criação e remoção de arquivo temporário.
- Fetch de `https://github.com/plbr010/agende.git` concluído.
- Base confirmada: `daaf7988aeaf607384a6eaefa166242a0f9d361f`.
- Branch recuperada do bundle validado no HEAD `937ee3422be003fa7681d3f1451c4e53cc340037`.
- Backup adicional: branch local `backup/trial-management-ux-937ee342-20260926` e bundle completo `trial-management-before-rebase-937ee342-new.bundle` na pasta da tarefa.
- Os seis commits foram rebaseados sem conflitos. `git range-diff` confirmou equivalência dos seis patches.
- As seis migrations Stripe e as duas Edge Functions da main permanecem idênticas. A migration `20260926194038_trial_selected_plan.sql` foi reconciliada com o histórico remoto; a única diferença textual são dois comentários e a formatação de fim de linha, sem mudança funcional.
- Tipos regenerados usando o gerador existente e todas as migrations em PostgreSQL local em memória: 31 tabelas, 61 funções e 16 enums. Foram acrescentadas as cinco RPCs Stripe da nova main, sem alterar contratos por suposição.

## Validação

Node 24.19.0. Os scripts npm foram invocados pelo runtime Node 24, pois o npm global usa Node 20.17.0.

- `npm test`: 111 testes aprovados, zero falhas e zero ignorados.
- `npm run lint`: aprovado, sem avisos.
- `npm run typecheck`: aprovado.
- `npm run build`: aprovado, 30/30 páginas geradas.
- `git diff --check`: aprovado, incluindo comparação com a main.

Cobertura existente executada: seleção e troca de plano, trial único de 168 horas, preservação de datas, proteção de downgrade, Estoque, Pacotes, Financeiro, contratos de Relatórios, autorização entre papéis e tenants, períodos inclusivos e fusos. As migrations e operações de gestão são executadas em PGlite local; Auth/Storage e registro de cron usam fixtures da plataforma. Tipos foram regenerados a partir desse banco e verificados pelo TypeScript.

## Limites

Nenhuma alteração no Supabase remoto, execução de db push/db reset, migration remota ou redeploy de Edge Functions. Stripe frontend continua com `checkout: false` e `portal: false`. Nenhum merge realizado.

Nenhuma regressão detectada pelas verificações executadas. Não foi realizado teste fim a fim autenticado no ambiente remoto nem teste de concorrência com múltiplas conexões. A migration de trial já consta no histórico remoto como `20260926194038_trial_selected_plan`; esta reconciliação realizou somente leitura remota.

Permanecem as limitações funcionais já documentadas: comparação com os ZIPs de referência indisponíveis, backend de Avaliações e limites das listas carregadas (100 lançamentos, 30 vendas, 20 movimentos). Os bloqueios antigos de publicação e a ausência dos arquivos Stripe citados no registro histórico não descrevem o estado desta integração.
