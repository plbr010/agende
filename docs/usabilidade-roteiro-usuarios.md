# Roteiro curto de testes com pessoas reais

Use este roteiro com **pelo menos 5 pessoas** de idades e familiaridades diferentes (por exemplo: 15–20, 30–45 e 60+). Não explique o produto antes. Observe em **celular**, em voz alta.

Cada sessão dura cerca de 20 minutos. Anote: conseguiu sozinha? quantos toques? onde parou? que palavras confundiram?

## Antes de começar

- Peça para usar o próprio celular.
- Diga só: “Quero ver se o Agendê está fácil. Não tem resposta certa.”
- Não treine. Só ajude se a pessoa travar por mais de um minuto.

## Tarefas

### 1. Criar conta e entrar (profissional)

Meta: concluir cadastro e confirmação de e-mail sem ajuda.

Anote:

- Entendeu a escolha “marcar horários” vs “tenho salão”?
- Achou o botão **Criar minha conta**?
- Entendeu o e-mail de confirmação?
- Quantos passos até entrar?

Dificuldade esperada: abrir o e-mail no celular.

### 2. Cadastrar o salão

Meta: dar um nome e começar o teste grátis.

Anote:

- O nome “salão ou estúdio” fez sentido?
- A escolha de plano distraiu?
- Entendeu que **não precisa de cartão**?

Etapas de referência: 2 (nome + plano).

### 3. Cadastrar um serviço

Meta: criar um serviço com preço, tempo e quem faz.

Anote:

- Achou **Serviços** no menu?
- O botão **Novo serviço** estava óbvio?
- Entendeu “quem faz este serviço”?

Etapas de referência: 5.

### 4. Definir horários

Meta: informar os dias e horas de atendimento.

Anote:

- Achou **Horários de trabalho** na equipe?
- Usou **De** e **Até** sem dúvida?
- Entendeu **Usar estes horários nos outros dias**?

Etapas de referência: 5, ou menos se copiar o dia.

### 5. Agendar um horário (cliente)

Meta: reservar um serviço pelo link, sem ajuda.

Anote:

- Soube onde tocar em cada passo?
- Se só havia uma profissional, a tela pulou essa escolha?
- Entendeu **Reservar este horário** e o resultado?

Etapas de referência: 5 a 7, menos se a conta já tiver nome e e-mail.

### 6. Encontrar o próximo atendimento (profissional)

Meta: ver o próximo horário em poucos segundos.

Anote:

- Foi direto na **Visão geral**?
- O horário grande e o nome da cliente foram suficientes?

Etapas de referência: 1 ou 2.

### 7. Reagendar ou desmarcar (cliente)

Meta: trocar ou cancelar com segurança.

Anote:

- Achou **Reagendar** e **Desmarcar**?
- Entendeu que pode **Manter horário**?
- A mensagem de “2 horas antes” ficou clara?

### 8. Registrar dinheiro que entrou ou saiu

Meta: anotar uma receita ou despesa e marcar como pago.

Anote:

- Achou **Adicionar dinheiro que entrou**?
- Confundiu com palavras de contabilidade?
- Entendeu **Marcar como pago**?

Etapas de referência: 4.

## O que contar como sucesso

A pessoa conclui a tarefa **sem consultar documentação** e explica o que aconteceu com as próprias palavras.

Metas de referência:

- Agendar um horário sem ajuda.
- Cadastrar um serviço sem ajuda.
- Encontrar o próximo atendimento em poucos segundos.
- Entender mensagens de erro sem conhecimento técnico.
- Concluir tarefas comuns sem treinar.

## Depois da sessão

Pergunte:

1. O que você faria agora, se estivesse sozinha no salão?
2. O que te deixou insegura?
3. Se pudesse mudar uma coisa, qual seria?

Registre idade, familiaridade com celular (baixa / média / alta), tarefa, etapas usadas, pontos de parada e se pediu ajuda.

## Registro das sessões com pessoas reais

Preencha **uma linha por pessoa**, com pelo menos 5 participantes, incluindo quem tem pouca familiaridade com celular. Não copie exemplos. Se a sessão não aconteceu, deixe a linha em branco.

| Participante | Idade | Familiaridade com celular | Tarefa | Etapas usadas | Pediu ajuda? | Onde parou | Palavras que confundiram | Concluiu sozinha? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
|  |  | baixa / média / alta |  |  |  |  |  |  |
|  |  | baixa / média / alta |  |  |  |  |  |  |
|  |  | baixa / média / alta |  |  |  |  |  |  |
|  |  | baixa / média / alta |  |  |  |  |  |  |
|  |  | baixa / média / alta |  |  |  |  |  |  |

Nenhuma sessão com pessoa real foi feita na revisão de 10/10/2026. A tabela acima está vazia de propósito.

## Revisão de interface sem usuários (10/10/2026)

Isto **não** substitui o teste com pessoas. São pontos vistos no produto, antes de alguém usar.

Tarefas que pedem muitos toques ou podem gerar dúvida:

| Tarefa | O que pode travar | O que já foi ajustado nesta revisão |
| --- | --- | --- |
| Definir horários | O dia fechado escondia o formulário. O erro de um dia aparecia nos outros. Não dava para alterar um horário sem apagar. | Cada dia tem o botão Definir horário, Ver e editar ou Fechar. Dá para alterar. O erro fica só no formulário que foi enviado. |
| Achar horários na equipe | “Horários de trabalho” era um link pequeno. | Virou um botão alto, fácil de tocar no celular. |
| Confirmar uma remoção | O aviso abria por um elemento que o teclado não tratava como botão. Se a remoção falhasse, o aviso sumia. | O botão abre o aviso. Se não der certo, o aviso continua e explica o motivo. |
| Criar conta | Muitos campos na mesma tela e a confirmação depende de abrir o e-mail no celular. | Nada foi removido. Continua sendo o ponto mais fácil de travar para quem usa pouco o celular. |
| Cadastrar serviço | O botão Novo serviço já é visível. A escolha de “quem faz” ainda exige ler a lista. | Sem mudança de fluxo. |
| Agendar como cliente | Vários passos. Se só há uma profissional, essa escolha é pulada. | Sem mudança de fluxo nesta revisão. |
| Achar o próximo atendimento | O horário e o nome já aparecem grandes na visão geral. | A linha do atendimento ficou mais alta para o toque. O selo de “feito” nos primeiros passos agora diz Feito. |
| Anotar dinheiro | Vários campos (o que foi, valor, data, categoria) e, depois, marcar como pago. | Sem mudança. A tela continua densa para quem só quer anotar um valor. |

O que ainda dificulta para quem tem pouca experiência digital:

- O menu tem muitas entradas (estoque, pacotes, relatórios) além da rotina do dia.
- Confirmar o e-mail exige sair do Agendê e voltar.
- Financeiro e folgas pedem data e dois horários na mesma tela.
- Não houve observação de pessoas reais, então estes pontos ainda precisam ser conferidos com o roteiro acima.
