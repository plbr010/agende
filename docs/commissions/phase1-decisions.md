# Fase 1 — decisões de comissão, fechamento e permissão

Este documento trava as regras que, se ficassem implícitas, poderiam gerar cobrança, comissão ou lançamento errado. A migration `20261023190000_commissions_permissions_settlement.sql` implementa exatamente estas decisões. Ela não foi aplicada em produção e não altera assinatura, Checkout, webhook ou qualquer outro fluxo Stripe.

## O que entra na comissão

- A base é o valor do serviço depois do desconto, em centavos inteiros.
- A regra do serviço, quando existe e está vigente na conclusão, prevalece sobre o percentual padrão da profissional.
- Sem regra vigente, a taxa é 0% e não nasce comissão a pagar. O fechamento guarda essa taxa.
- Produto vendido no atendimento vira outra entrada de dinheiro e saída de estoque. Não entra na base da comissão.
- Desconto maior que o preço do serviço é recusado. Desconto de 100% não cria recebível nem comissão.
- A taxa e o valor original ficam gravados no fechamento. Mudar a regra ou a opção do salão não reescreve atendimento já concluído.
- Atendimentos concluídos antes desta migration não ganham comissão retroativa.

## Quando a comissão pode ser paga

- Cada salão escolhe `on_receipt` (padrão) ou `on_completion`.
- O padrão é liberar só depois do recebimento, para não pagar comissão de um valor que ainda não entrou.
- `on_completion` libera a comissão integral do valor devido no momento da conclusão, mesmo com o recebimento pendente.
- A opção fica copiada na comissão. Trocar a opção vale só para os próximos atendimentos.
- Recebimento parcial libera a comissão na mesma proporção do valor líquido recebido quando a opção é `on_receipt`.
- Quando o líquido recebido cobre o valor devido, a comissão liberada é o valor cheio, sem sobra de arredondamento.
- O arredondamento é meio para cima, em centavos, com inteiros: `(base * taxa_em_pontos_base + 5000) / 10000`. 100% da taxa usa a base inteira.

## Estorno, cancelamento e correção

- Estorno reduz a comissão na proporção do valor original que permanece no salão. A taxa não é recalculada.
- Cancelar o recebível do serviço, ou consumir uma sessão de pacote, zera a obrigação. O histórico permanece.
- Comissão já paga acima do novo valor fica `adjusted` até a devolução da diferença. O pagamento original não é apagado.
- Ajuste manual é um teto: pode reduzir a comissão até zero, nunca aumentar acima do valor original. Um estorno posterior ainda pode reduzir abaixo desse teto.
- Troca de profissional antes da conclusão muda a beneficiária, porque a comissão nasce na conclusão.
- Depois do fechamento, trocar a beneficiária ou o valor exige ação própria, com motivo e evento. Não há reescrita silenciosa.
- Reabrir um lançamento pago não apaga os recebimentos. A comissão continua olhando o dinheiro registrado.
- Conclusão repetida, com a mesma chave ou outra, devolve o mesmo fechamento. Correção depois disso é estorno ou ajuste.

## Pacotes

- A receita do pacote nasce na venda, como já acontece hoje.
- Concluir o atendimento e em seguida consumir a sessão cancela o recebível avulso pendente e zera a comissão daquele serviço.
- Não há rateio automático da venda do pacote entre as profissionais das sessões. Esse rateio mudaria o quanto cada pessoa recebe e fica fora desta fase.
- Reverter o consumo da sessão devolve a sessão ao pacote e não reabre o recebível do serviço. A versão anterior reabria esse lançamento; isso voltaria a cobrar um serviço cuja receita já está na venda do pacote. A comissão zerada permanece zerada. Quem quiser cobrar o serviço avulso depois cria um lançamento manual.

## Produtos no fechamento

- A quantidade segue o estoque, com até três casas. O total da linha é `round(quantidade * preço em centavos)`, meio para longe de zero.
- O valor recebido no fechamento abate primeiro o serviço e depois os produtos, sem passar do total devido.
- Cancelar a entrada pendente do produto devolve a quantidade ao estoque uma única vez. Quem cancela precisa poder movimentar o estoque; se não puder, o cancelamento inteiro é desfeito.

## Permissões

- A proprietária sempre pode tudo no próprio salão e é a única pessoa que grava permissões. A permissão dela não pode ser reduzida.
- Onde não há override, vale o que o papel já faz hoje. Negar tira acesso. Conceder dá acesso acima do papel, dentro do catálogo.
- Consultar o financeiro (`finance.view`) começa só com proprietária e administradora, porque só elas abrem essa tela hoje. A recepção continua podendo registrar recebimento. A proprietária pode conceder a consulta a outra pessoa.
- A tela de financeiro, para quem pode consultá-la, inclui o resumo que essa tela já mostrava. O relatório avulso continua exigindo a permissão de relatórios ou a de gerenciar o financeiro.
- Profissional continua vendo e alterando só a própria agenda. Conceder "ver agenda" não abre a agenda das colegas.
- Comissão da equipe e pagamento de comissão são as exceções explícitas: quem pode pagar enxerga a lista para registrar o pagamento, sem poder mudar regra nem valor.
- Quem só pode ver a própria comissão não consegue ler a das outras, nem passando o identificador de outra pessoa.
- Autorização usa o membro ativo em `workspace_members` e `auth.uid()`. `user_metadata` não entra na decisão.
- O identificador de salão ou de profissional enviado pela tela é conferido no banco. Outro salão não lê estas tabelas.
- As restrições estão em RLS, grants e funções. A tela só acompanha.

## Correções aprovadas em 24/10/2026

O proprietário aprovou explicitamente estas escolhas durante a correção do PR #84:

- Recebimentos parciais podem ser estornados até o líquido recebido. Cancelamento ou conversão em pacote exige devolver explicitamente todo o dinheiro líquido antes; não há criação automática de crédito, transferência nem estorno.
- Depois de qualquer pagamento histórico, a beneficiária não pode ser trocada, mesmo após recuperação integral. Cada pagamento guarda a destinatária imutável. Antes do primeiro pagamento, o evento de troca guarda os IDs anterior e novo.
- Pagamento de comissão gera uma saída paga no financeiro; recuperação efetivamente recebida gera uma entrada paga e um receipt. Tudo é vinculado por movimento único e gravado na mesma transação. O usuário apenas registra dinheiro efetivamente movimentado: não há transferência bancária automática.
- A API anterior de comissões não informa o meio de pagamento. Esses movimentos usam `other` e a tela informa essa limitação; detalhes podem ser anotados na observação. Não atribuir Pix/dinheiro por suposição.
- Caixa segue a data e a forma de cada recebimento, e a data da despesa paga; devoluções seguem a data do estorno. Os indicadores operacionais por agendamento continuam separados e usam preço de tabela. O saldo em aberto é atual, dos registros criados até o fim do período, não uma reconstrução histórica de saldos.
- Desfazer uma sessão devolve a sessão, mantém o avulso cancelado e bloqueia a reabertura genérica desse recebível. Uma cobrança avulsa posterior exige lançamento manual auditável.

Compatibilidade de permissões: consultar estoque começa em owner/admin, preservando o acesso anterior da tela/RPC; um grant de `inventory.view` abre consulta sem liberar escrita. Deny dessa consulta vale tanto no SELECT quanto na RPC, mesmo se `inventory.manage` continuar permitido. Mover e gerenciar continuam permissões independentes. A agenda só oferece produtos quando há consulta e movimentação/gerenciamento autorizados.

Estas aprovações não constituem aceite retroativo de todas as decisões anteriores, nem autorização para aplicar migrations, fazer merge ou publicar o PR. A reauditoria continua obrigatória.
