# Aceite real de staging — preparado, BLOQUEADO

Não executado: faltam projeto/stack Supabase isolado com Auth/SMTP/PostgREST e Stripe TEST acessível. Não marcar PASS por mocks. Após aprovação de recursos e bindings, registrar commit, IDs dos ambientes, timestamps, modo de execução, resultado e evidência sem cookies/tokens/PII.

## Pré-condições

Backend distinto de `wohimauqgywshbbejjcl`, keys do staging, Stripe TEST confirmado, SMTP controlado, hostname Preview aprovado. Aplicar baseline do Git e cinco migrations após conferir divergências; não copiar registros/history/vault produtivos. Criar dois salões fictícios com owners diferentes e profissionais/admins/recepcionistas. Testes de concorrência devem usar sessões reais independentes, não requests sequenciais.

## Auth e trial

Cadastro profissional e cliente → receber e-mail na caixa TEST → confirmar → login e cookie → criar salão → verificar trial de sete dias persistido. Logout deve invalidar sessão/retirar acesso; token de reset deve funcionar uma vez e expirar; sessão vencida deve renovar ou redirecionar sem acesso residual. Conferir callbacks de origem correta, `next` malicioso, e-mail não confirmado e tentativa de novo trial. Testar os quatro papéis e trocar identificadores pelo salão B via API real. Vencer trial apenas no staging com relógio/fixture controlada aprovada; registrar bloqueio de operações e acesso à regularização.

## Jornadas autenticadas

Profissional: salão → serviço → associação → horários → reserva → reagendamento → cancelamento → segunda reserva → atendimento concluído → pagamento local fictício → financeiro → estoque → pacote vendido/resgatado → relatório → avaliação. Cliente: cadastro confirmado → link público → serviço/profissional/slot → reserva → listagem → reagendamento/cancelamento → avaliação de atendimento concluído. Conferir dados efetivamente persistidos via PostgREST/SQL staging e reload do navegador. Repetir IDOR em ambos salões e colisão de duas reservas. Financeiro fictício não é pagamento Stripe.

## Stripe TEST

Criar catálogo com lookup keys `agende_{solo,equipe,salao}_{monthly,annual}` e valores BRL 8990/79900,16990/149900,29990/279900. Confirmar TEST em cada objeto. Realizar seis checkouts TEST; trial inicial sem cartão permanece o trial da aplicação, não novo trial a cada checkout. Verificar trial restante original na assinatura, últimos minutos, ativação e limites 1/5/15.

Usar cartões TEST e test clocks: renovação, recusa, cancelamento ao fim do período, pagamento em atraso, Portal, upgrade/downgrade e excesso de assentos. Webhook: assinatura inválida → rejeitar; replay → mesmo efeito; evento fora de ordem → reconciliar estado atual; falha temporária → retry seguro; evento com livemode errado → rejeitar antes de billing writes. Conferir fatura, assinatura, evento e subscription local de staging; não considerar success_url prova de ativação.

Registrar **Stripe TEST real**, **Auth/SMTP real de teste**, **navegador autenticado** e **PostgREST real** separadamente. Somente depois destes gates preparar aprovação de produção.
