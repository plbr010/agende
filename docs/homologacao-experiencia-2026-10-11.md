# Homologação de experiência — 11/10/2026

Branch `cursor/launch-final-validation`, a partir da main `f391d5d`
(PRs #18, #19, #20, #21 e #22 já incorporados). Nenhuma migration, RLS,
RPC, Stripe, webhook ou configuração de produção foi alterada. Nenhum
write foi feito no Supabase de produção.

Esta leitura não inventa participantes nem sessão autenticada. O navegador
desta máquina não tem conta real nem banco isolado. Jornadas que exigem
e-mail, trial, Stripe ou gravação foram exercitadas só até o ponto em que
a interface pública ou o código fonte permitem. O restante está registrado
como bloqueio para o Codex, com a evidência já publicada em
`docs/launch-audit-2026-10-10.md` (snapshots de produção daquela leitura,
não uma nova consulta remota).

## 1. Bugs encontrados

### Interface corrigida nesta branch

| Classe | Onde | O que acontecia |
| --- | --- | --- |
| P1 | Financeiro, estoque e pacotes | `window.confirm` pede confirmação na caixa do navegador. No celular ela é fácil de dispensar sem querer e não combina com o restante do Agendê. |
| P1 | Financeiro | Receita pendente aparecia como "A pagar", a mesma palavra de uma conta a pagar. |
| P1 | Equipe, serviços e clientes | O botão Editar media cerca de 28px de altura. |
| P1 | Agenda, primeiro horário | Os atalhos "cadastre cliente / serviço / profissional" eram links sublinhados pequenos. |
| P1 | Meus agendamentos | O erro ao desmarcar ficava atrás do diálogo, que continuava aberto. |
| P1 | Área da cliente no celular | O atalho "Área profissional" era um ícone de 32px. No desktop, os itens do menu tinham 36px. |
| P1 | Menu do salão | "Ver página do salão" tinha 28px. |
| P2 | Estoque | "Registrar movimentação" e "no ajuste, informe o saldo final" exigem vocabulário de sistema. |
| P2 | Pacotes | O cancelamento falava em "operação" e "situação financeira". A caixa do serviço era pequena. |
| P2 | Reagendar | "Falha ao carregar profissionais." |
| P2 | Avaliações | As estrelas tinham cerca de 44px só no limite, e o texto falava em "não poderá ser editada". |

### Já resolvido na main (não refeito)

PR #22: confirmação acessível (`ConfirmAction`) e editor de horários
(incluir, alterar, remover, copiar, pausa, folga, sobreposição, começo
antes do fim, feedback e toque). PR #20: textos do cadastro e da jornada
pública. PR #21: origem de Auth no código e gravação atômica de serviço
(a RPC ainda depende de rollout no banco).

### Bloqueios para o Codex (não corrigidos aqui)

| Classe | Problema | Evidência |
| --- | --- | --- |
| P0 | Avaliações e slots de reagendamento ausentes no remoto | Auditoria de 10/10: `to_regclass` / `to_regprocedure` nulos. Sem isso, avaliar e reagendar falham em produção mesmo com a tela pronta. |
| P0 | Preview e development apontam para o mesmo Supabase de produção | Não há banco isolado para teste de escrita. Por isso esta homologação não criou conta, salão, serviço nem agendamento reais. |
| P0 | Só existe Stripe LIVE | Escolher plano e iniciar trial com cobrança não pode ser ensaiado sem sandbox. |
| P0 | Downgrade com excesso de assentos | Correção de billing ainda não aplicada em produção, segundo a auditoria de 10/10. |
| P1 | SMTP e sessão real no navegador | Confirmar e-mail e entrar de verdade não foram comprovados. |
| P1 | RPC `save_service_with_professionals` | O código não faz fallback parcial, mas a função precisa estar aplicada no remoto. |
| P1 | Histórico de migrations incompleto e proteção de senha vazada desligada | Registrado na auditoria de 10/10. Nenhuma configuração de Auth foi mexida. |

## 2. Bugs corrigidos

- Confirmações de financeiro, estoque e pacotes abrem um diálogo da própria página, com a pergunta em foco, botões altos e "Voltar". O formulário não é enviado até a pessoa confirmar, então os campos continuam preenchidos.
- Situação do dinheiro: "Ainda vai entrar", "Ainda vai sair", "Já entrou", "Já saiu". O filtro diz "Ainda não entrou ou saiu" e "Já entrou ou saiu". O cartão de pendências diz "Ainda em aberto".
- Editar em equipe, serviços e clientes, atalhos da agenda vazia, menu da cliente e "Ver página do salão" passam de 44px.
- Erro ao desmarcar aparece dentro do diálogo, recebe foco e o diálogo permanece aberto.
- Estoque: "Chegou produto", "Saiu produto", "Corrigir a quantidade", com a explicação de que a correção é o saldo que deve ficar.
- Pacote: "As sessões que ainda não foram usadas deixam de valer." Caixa de seleção maior.
- Reagendar: "Não deu certo carregar quem atende. Tente de novo." e "Não deu certo ver os horários. Tente outra data."
- Estrelas de avaliação com alvo de 44px e texto direto sobre o que acontece depois de enviar.

## 3. Fluxos testados

| Etapa | O que foi possível ver | Limite |
| --- | --- | --- |
| Landing, cadastro, entrar, páginas públicas | Playwright anônimo nas rotas públicas, quando a suíte abaixo registrar o resultado | Sem sessão e sem salão `estudio-luna` no Supabase sintético |
| Confirmar e-mail, plano, trial | Telas e cópia já existentes na main | SMTP e Stripe LIVE bloqueiam a prova real |
| Criar salão, serviços, profissionais, horários | Código e testes de fonte/SQL em memória da main | Sem write de produção |
| Compartilhar link e receber cliente | Botão "Copiar link do salão" já está na home profissional | Não houve reserva real |
| Agenda do profissional | Diálogo de primeiro horário agora tem botões grandes | Não houve horário gravado |
| Cliente: achar salão | Colar o link, com salões já conhecidos quando existem | Não há busca por nome. É uma decisão de produto, não um botão morto |
| Serviço, profissional, dia e hora | Fluxo público já enxuto na main | Slots reais dependem do banco |
| Confirmar, consultar, reagendar, cancelar | Diálogos revisados no código e nos testes de cópia | Slots RPC ausente no remoto impede reagendar em produção |

Módulos lidos nesta passagem: agenda, clientes, serviços, equipe, financeiro,
estoque, pacotes, relatórios, avaliações, configurações e assinatura.
Relatórios e assinatura continuam dependentes do contrato de backend; a tela
já explica quando não carrega. Não encontrei botão principal sem ação além
dos casos corrigidos.

## 4. Evidências dos testes

Ambiente local, Node do sistema, URL e chave públicas sintéticas
(`example.supabase.co`). Nenhum cookie de usuário. Playwright 1.55 foi
instalado só para rodar os scripts que já existem; `package.json` e o
lockfile não mudaram. As capturas em `docs/evidence` foram descartadas
para não misturar binários desta máquina com o histórico.

| Comando | Resultado | O que isso prova |
| --- | --- | --- |
| npm ci | Passou, 401 pacotes | Lockfile da main |
| npm run lint | Passou | ESLint |
| npm run typecheck | Passou | next typegen e tsc |
| npm test | 220 passaram, zero falha | Inclui a cópia nova e os testes dos PRs #20 e #22. SQL em memória não é navegador autenticado |
| npm run build | Passou | Next 16.3.8, ambiente sintético |
| npm run test:smoke | 32 rotas passaram | GET anônimo do build. App, cliente e onboarding redirecionam para login |
| scripts/audit-browser-flows.mjs | 18 passaram, 9 falharam | Desktop 1366, iPhone 14 e Android 360×740. Falhas só em `/p/estudio-luna`: o Supabase sintético não tem esse salão |
| scripts/audit-browser-polish.mjs | 18 passaram, 3 falharam | Desktop 1366, iPhone 13 e Android 360×740. As 3 falhas são o mesmo perfil inexistente |

Conferência extra, numa página local de exemplo que não foi commitada:
em 1366×768, iPhone 13 e Android 360×740, a confirmação abre com foco na
pergunta, Voltar conserva o texto digitado, Esc fecha, e os botões medidos
ficaram com pelo menos 44px. Desmarcar contra o Supabase sintético manteve
o diálogo aberto com "Não foi possível concluir. Tente de novo." Isso não
é um cancelamento real.

## 5. Melhorias de usabilidade

- A pessoa confirma com a mesma linguagem da tela, no celular e no computador.
- Voltar numa confirmação não apaga o que já foi digitado.
- Dinheiro que vai entrar não parece uma conta a pagar.
- Estoque e pacote dizem o efeito da ação.
- O erro de cancelamento fica na frente da pergunta, não escondido.
- Os próximos passos da agenda vazia são botões, não texto sublinhado.

## 6. Problemas ainda pendentes

Os P0 e P1 de backend da tabela do Codex continuam. Também ficam como P2,
sem bloquear o uso quando o backend existe:

- Achar um salão só pelo link. Quem não tem o link não descobre o salão pelo nome.
- Painéis de "Adicionar" no financeiro e no estoque ainda usam `<details>`. Funciona, mas o estado aberto não é óbvio para quem nunca viu essa seta.
- Relatórios continuam densos (várias colunas). O vocabulário já evita "ticket médio".
- Não houve sessão com cinco pessoas reais. A tabela em `docs/usabilidade-roteiro-usuarios.md` segue vazia de propósito.

## 7. Pull request

https://github.com/plbr010/agende/pull/23

Rascunho, sem merge.

## 8. Experiência mobile

Landing, cadastro, login, verificação de e-mail e os bloqueios de `/app` e
`/cliente` passaram no Playwright em 1366×768, iPhone 13 (e iPhone 14 no
outro script) e Android 360×740. Os botões novos usam 44px: editar
cadastros, atalhos da agenda vazia, menu da cliente, área profissional,
página do salão, estrelas e a caixa de serviço do pacote. As estrelas não
encolhem quando a linha fica curta. Os diálogos empilham Voltar e a ação
em coluna. No exemplo local, o foco foi para a pergunta e o erro de
desmarcar apareceu dentro do diálogo nos três tamanhos.

## 9. Dificuldades para quem está começando

1. Sem e-mail confirmado e sem trial de verdade, a pessoa para antes de criar o salão. Isso não se resolve com mais texto na tela.
2. O primeiro agendamento pede cliente, serviço, profissional e horário. A agenda agora aponta cada peça que falta, mas ainda são quatro cadastros antes do primeiro horário.
3. Reagendar e avaliar dependem de funções que a auditoria de 10/10 não encontrou no banco remoto.
4. Quem chega como cliente precisa do link do salão. A frase na busca deixa isso explícito.
5. Confirmações nativas do navegador foram o maior susto evitável: sumiam do layout do Agendê e no celular não deixavam claro o que seria salvo.
