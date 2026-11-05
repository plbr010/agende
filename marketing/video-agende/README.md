# Comercial Agendê — 45 segundos

Estrutura isolada para um anúncio em motion. Não entra no build do SaaS, não altera banco, autenticação, pagamentos nem RLS, e não faz deploy.

As telas são reconstituições fiéis da interface real, com o salão fictício **Ateliê Lumière**. Não há telefone, e-mail, documento, senha nem dado financeiro de pessoa real.

## Como ver

Na pasta `marketing/video-agende`:

```bash
npm install
npm test
npm run typecheck
npm run stills
npm run studio
```

- `npm run stills` gera PNGs em `out/stills/` (não versionar).
- `npm run studio` abre o preview do Remotion.
- `npm run render` gera `out/agende-comercial.mp4` (1920×1080, 30 fps, 1350 frames).

Composições prontas:

| ID | Cena |
| --- | --- |
| `AgendeComercial` | Filme completo, com fade de 12 frames |
| `Cena01Acesso` | Página pública no celular |
| `Cena02Servico` | Serviço e profissional |
| `Cena03Horario` | Data e horário |
| `Cena04Reserva` | Reserva |
| `Cena05Painel` | Painel e confirmação da profissional |
| `Cena06Agenda` | Agenda do dia e da semana |
| `Cena07Equipe` | Equipe |
| `Cena08Estoque` | Estoque |
| `Cena09Financeiro` | Financeiro |
| `Cena10Marca` | Marca e teste grátis |

O tempo mora em `src/timing.ts`. As dez durações menos nove transições de 12 frames fecham 45 segundos. O teste `src/timing.test.ts` trava essa conta.

## O que a interface mostra de verdade

O fluxo público cria o horário como **solicitação** (`scheduled`: “Solicitação recebida” / “Aguardando confirmação”). A profissional confirma depois, no painel, com a ação **Confirmar cliente**. A cena 4 e a cena 5 seguem essa ordem. Não existe confirmação automática no produto.

A cena 4 omite celular e e-mail. No produto, a cliente autenticada vê esses campos na confirmação.

A cena 7 omite e-mail dos membros. No produto, o cartão da equipe mostra o e-mail.

Relatórios (`/app/relatorios`) existem e funcionam, mas não têm cena própria: a sequência pedida vai do acesso ao CTA. O item **Relatórios** aparece na barra lateral.

Pacotes, avaliações, clientes e assinatura também existem no produto e aparecem só como navegação, sem cena dedicada.

## Roteiro sugerido para a locução

| Tempo | Fala |
| --- | --- |
| 0:00 | Sua cliente abre o salão no celular. |
| 0:04 | Escolhe o serviço e quem vai atender. |
| 0:09 | Vê o dia e marca um horário livre. |
| 0:13 | A reserva entra na hora. |
| 0:17 | No painel, a profissional confirma. |
| 0:22 | A agenda do dia e da semana fica clara. |
| 0:26 | A equipe, com a função de cada pessoa. |
| 0:30 | O estoque avisa antes de faltar. |
| 0:34 | E o financeiro mostra o que entrou e o que saiu. |
| 0:37 | Agendê. Sete dias grátis. Sem cartão. |

Não há trilha nem narração renderizada. O próximo agente pode gravar por cima das legendas, que já entram com cada cena.
