# Portal de assinatura — proposta comercial para aprovação

Não aplicada. Configuração LIVE observada: updates desativados; `trial_update_behavior=end_trial` inativo; cancelamento ao fim do período. Habilitar apenas o booleano não é seguro.

O inventário completo tem nove preços recorrentes ativos: seis lookup keys esperados corretos e três anuais adicionais sem lookup key (R$799,90 / R$1.499,90 / R$2.799,90). Checkout da aplicação consulta a lookup key e valida valor/moeda/intervalo; não seleciona esses três por padrão. **Não usar todos os preços ativos do produto no Portal.** Permitir apenas os seis esperados em `prices.json`, e equivalentes TEST próprios no sandbox. Não arquivar adicionais sem conferir assinaturas existentes e obter aprovação; esta auditoria não leu dados de assinantes.

Política proposta, a validar primeiro em TEST e aprovar expressamente antes de LIVE:

- Trial: continuar o trial original, sem estender datas (`continue_trial`); sem cartão no trial inicial existente da aplicação.
- Upgrade dentro do mesmo intervalo: efeito imediato; `create_prorations` gera ajuste para faturamento conforme regra Stripe, não escolher `always_invoice` silenciosamente. Validar invoice preview e quando o ajuste será cobrado; explicitar ao cliente antes da confirmação.
- Downgrade: agendar ao fim do período, evitando retirada antecipada de plano pago. Validar a condição `schedule_at_period_end` no schema/API usado antes de configurar; não assumir que comparação de preço cobre todas as mudanças mensal/anual.
- Mensal ↔ anual: regra pendente de aceite comercial. Pode alterar billing_cycle_anchor e gerar fatura mesmo com `unchanged`; testar valores/resultados antes de disponibilizar. Não habilitar seis preços em LIVE até aceitar esse resultado.
- Cancelamento: fim do período, `proration_behavior=none`, acesso conforme entitlement até vencimento.
- Assentos: 1/5/15. Antes do downgrade orientar redução da equipe; quando o plano menor entrar em vigor com excesso, backend bloqueia acesso operacional até regularização, sem excluir membros. Exigir aceite dessa experiência antes de liberar downgrades.
- Portal: permitir somente alteração de `price`, três produtos do ambiente, prices TEST próprios no teste, `billing_cycle_anchor=unchanged`, `trial_update_behavior=continue_trial`, `restrictions.on_open_invoices=block`. Não autorizar quantity ou troca de cliente/estabelecimento.

O schema Stripe consultado confirmou os enums `continue_trial/end_trial`, `none/create_prorations/always_invoice` e a opção de agendamento ao fim do período. A configuração final permanece bloqueada até verificar TEST e aprovar política financeira; não é um payload pronto para disparar em LIVE. Referência: [atualização de configuração do Portal](https://docs.stripe.com/api/customer_portal/configurations/update).

Recuperação: arquivar configuração anterior; desabilitar novas trocas/restaurar Portal anterior se necessário. Isso não desfaz faturas/assinaturas já modificadas. Reembolsos/créditos/pagamentos LIVE exigem aprovação individual.
