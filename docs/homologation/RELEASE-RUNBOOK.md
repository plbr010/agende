# Runbook de liberação — proposta, NÃO executado

Não existe aprovação nesta auditoria para provisionar serviços, mudar configuração ou aplicar SQL remoto. Cada etapa abaixo exige autorização explícita. Não fazer merge automaticamente. Não realizar pagamentos reais, apagar tabelas/dados ou reparar histórico por suposição.

## 1. Ambiente isolado

Solicitar autorização para criar/reutilizar projeto Supabase de homologação e um sandbox Stripe separado. Confirmar organização pretendida com o responsável e consultar custo antes de provisionar; não há orçamento aprovado. Produção é `wohimauqgywshbbejjcl`; não usar como teste. Development deve usar stack Supabase local ou projeto próprio; preview usa exclusivamente homologação; production usa exclusivamente produção.

Preparar três conjuntos de variáveis: URL/chave pública Supabase próprios; segredos service_role, Stripe e webhook somente no cofre de cada ambiente; NEXT_PUBLIC_SITE_URL correspondente. Stripe não produtivo exclusivamente TEST e produtos/preços TEST próprios. Não copiar chaves LIVE para teste. Configurar GoTrue Site URL e allowlist exata de `/auth/callback`, `/auth/confirm`, `/auth/recovery` para a origem aprovada, evitando wildcards amplos. Usar SMTP de teste com caixa controlada, contas sintéticas e nenhum dado de clientes copiado. Não iniciar cron/envio de mensagens reais em staging.

Risco: custo, e-mails indevidos ou ligação acidental a produção. Validação: `checkEnvironmentIsolation` de `scripts/environment-isolation.mjs` sobre URLs/modes públicos; conferência independente dos IDs dos provedores e escopos Vercel antes de qualquer formulário. O checker é política de configuração, não comprova segredos/integração real. Recuperação: reverter bindings à configuração previamente registrada, desligar automações de teste e revogar exclusivamente credenciais de teste; manter dados/evidência, sem apagar produção.

Depois, homologar cadastro dos dois perfis, confirmação/reenvio de e-mail, senha/reset com token expirado/reusado, login/logout, sessão/cookies, callbacks e papéis dos quatro perfis. Testar trial único/sete dias, tentativa de novo trial, vencimento e acesso entre dois salões via API real. Registrar timestamps, ambiente, IDs sintéticos e resultados sem tokens/senhas.

## 2. Schema de produção

Antes da aprovação: conferir novamente hashes/catalog/history remoto, identificar somente o projeto correto, confirmar backup/PITR disponível e procedimento de restore ensaiado em ambiente separado; reservar janela. Não afirmar backup confirmado nesta auditoria. Não executar `supabase db push` ou `migration repair` sobre histórico divergente.

Revisar/aplicar explicitamente, em ordem, os arquivos existentes:

1. `20260927014947_launch_readiness_reviews.sql` — reviews + consulta de slots/reagendamento.
2. `20261008131859_launch_hardening_reviews_force_rls.sql` — FORCE RLS em reviews.
3. `20261009172028_launch_observed_owner_guard.sql` — reproduz guarda de owner observada, após comparar definição atual.
4. `20261009173042_billing_reconcile_excess_seats.sql` — reconciliar downgrade acima do limite; pode bloquear acesso até regularização, sem excluir membros.
5. `20261010232248_atomic_service_professional_links.sql` — RPC atômica esperada pela aplicação já publicada.

Risco: locks breves, mudança de autorização, clientes temporariamente bloqueados por assentos, schema cache desatualizado. Validar todos os arquivos no staging real e conferir transações de cada migration antes da janela; planejar lock_timeout/statement_timeout e captura de logs sem mascarar falhas. Aplicar somente SQL aprovado e registrar histórico fiel apenas das operações efetivamente executadas. Nenhum SQL histórico desconhecido deve ser inventado para preencher 20260919201138.

Depois da aplicação: recarregar schema PostgREST de forma aprovada, verificar tabela/RPCs/assinaturas/RLS/grants/owner guard e obter novo snapshot + migration list; executar conta sintética de staging, e somente smoke de produção autorizado. Comparar API de listagem de slots/reviews e gravação atômica. Não testar com registros de clientes. Se falhar antes de COMMIT, rollback da transação; após COMMIT, preferir correção aditiva revisada ou rollback de app para versão compatível. Recuperação de dados por backup/PITR em projeto separado exige nova aprovação. Não usar drop/recriação/reversão destrutiva como rollback.

## 3. Stripe

No sandbox aprovado, configurar três produtos/seis preços TEST correspondentes; webhook TEST com os oito eventos documentados em `stripe-configuration.json`, segredo exclusivo e destino staging. Verificar assinatura inválida, evento duplicado/fora de ordem, retry depois de falha e API version; usar test clocks para renovação, recusa, cancelamento e vencimento. Executar seis Checkouts TEST, mensais/anuais, trial preservado, Portal, upgrade/downgrade e assentos. Não criar sessões ou relógios com chave LIVE.

Proposta de Portal (primeiro TEST; depois produção com autorização própria): habilitar atualização somente de `price`, permitir os três produtos/seis preços do ambiente, `trial_update_behavior=continue_trial`, preservar retorno à origem aprovada, cancelamento ao fim do período. Decidir e aprovar expressamente proração (`none`, `create_prorations` ou `always_invoice`) e momento do downgrade; não escolher uma política financeira silenciosamente. O estado LIVE atual tem updates desativados e opção inativa end_trial. Não basta habilitar um booleano.

Risco: fim prematuro de trial, fatura imediata, mudança de receita/acesso. Validação: TEST clock + invoices/subscriptions/eventos reais TEST e sincronização staging; downgrade com excesso deve cumprir comportamento de bloqueio documentado e plano de regularização. Recuperação: salvar configuração anterior, desabilitar novas trocas e restaurar Portal anterior. Config revertida não desfaz faturas/assinaturas já alteradas; qualquer crédito/reembolso/transação LIVE exige aprovação individual e não faz parte desta missão.

## 4. Domínio e Auth

Autorizar registro/controle DNS se necessário, adicionar `agendeapp.online` à Vercel, validar propriedade/TLS e só então definir origem canônica e redirects Supabase/Stripe/SMTP. Risco: indisponibilidade/links de e-mail para origem incorreta. Validar DNS de fontes distintas, TLS, GETs, cookies, confirmação/reset e Portal em staging antes de liberar. Recuperação: manter alias anterior e restaurar DNS/origens/allowlists registradas; links antigos podem exigir reenvio. Não alterar DNS remotamente sem aprovação.

## Gates para GO

Somente reconsiderar GO após: ambiente realmente isolado; cinco migrations aprovadas aplicadas e inventário verificado; Auth/e-mail real de teste aprovado; ciclo Stripe TEST completo e Portal validado; domínio/origem/TLS consistentes; backup recuperável confirmado; checks do PR e aceite operacional. Os testes locais não substituem esses gates.
