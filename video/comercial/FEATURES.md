# Funcionalidades verificadas no produto (não inventadas)

Fonte: código em `src/` e rotas reais do Agendê.

## Mostradas no comercial

- Link público de agendamento: `/p/[slug]/agendar`
- Etapas reais: Serviço → Profissional → Data → Horário → Seus dados → Confirmar
- Textos oficiais: `Agendar horário`, `Você escolheu`, `Reservar este horário`
- Recibo de sucesso: `Agendamento confirmado!` + status `Confirmado`
- Painel da profissional (`/app`): `Olá, {nome}!`, métricas Agendamentos hoje / Receita do dia / Clientes ativos / Avaliação média
- Agenda (`/app/agenda`): cards com horário, cliente, serviço, profissional, status, duração e preço
- Status reais: `Agendado`, `Confirmado`
- Clientes (`/app/clientes`): Clientes ativos, Com contato, Com observações
- Serviços (`/app/servicos`): Serviços, Ativos, Preço médio, Duração média
- Equipe (`/app/equipe`): Pessoas ativas, Na agenda, Serviços por profissional
- Financeiro (`/app/financeiro`): Dinheiro que entrou, Dinheiro que saiu, Ainda em aberto, Quanto sobrou
- Período `Este mês` (seletor real: Hoje, 7 dias, 30 dias, Este mês, Mês anterior)
- Navegação mobile: Início, Agenda, Clientes, Mais

## Não apresentadas como prontas

- Pagamento online no ato do agendamento (não faz parte deste fluxo)
- WhatsApp automático de confirmação (existe texto/link, não foi encenado como automação)
- Relatórios, estoque e pacotes (existem no app, fora do roteiro)
- Recibo `Solicitação recebida` / `Aguardando confirmação` (caminho real quando o salão não confirma na hora; o filme usa o recibo de horário já confirmado)

## Dados

Tudo ilustrativo: Studio Pétala, Marina Alves, Camila Ribeiro, Beatriz Nunes.
Nenhum cliente real. Nenhum acesso a banco de produção.
