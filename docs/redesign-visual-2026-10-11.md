# Redesign visual — 11/10/2026

A identidade da referência (creme, rosa, pêssego e vinho) passou a ser o
sistema visual do Agendê. Nenhuma rota, ação, migration, RLS, RPC ou
cobrança foi alterada.

## Tokens

| Papel | Cor | Uso |
| --- | --- | --- |
| Creme `#FCF5F0` | fundo | páginas |
| Branco `#FFFFFF` | cartão | painéis e formulários |
| Rosa pastel `#F3C8C7` | secundário | chips, dia vazio, item ativo da barra |
| Pêssego `#E6A78F` | acento | ilustração e detalhes |
| Rosa `#B95B76` | ilustração | flores e a marca desenhada |
| Vinho `#631D38` | primário | botões, títulos fortes, barra do salão |
| Rosa de texto `#8E3A55` | texto | o acento do logotipo |

O rosa `#B95B76` sobre creme fica em 4.04:1, abaixo do mínimo para texto
pequeno. Por isso ele não pinta botão nem parágrafo. O vinho com texto
claro fica em 11.9:1.

Receita no relatório usa verde. Despesa usa vermelho. Os dois não
dependem só do rosa da marca.

## O que mudou na interface

- Botões, campos e rótulos com altura de toque de 44px e cantos em pílula.
- Cartões brancos, arredondados e com sombra curta.
- Barra lateral do salão em vinho, no computador. No celular o menu continua claro.
- Agenda com dias em cartão e o horário vazio explicado.
- Flores só na página inicial e no acesso. O restante do produto não vira anúncio.
- O título da página inicial acompanha a referência: "Organize sua agenda, encante seus clientes."

## O que foi visto no navegador

1366×768, iPhone 13 e 360×740, sem rolagem horizontal nas páginas públicas.
A agenda vazia foi aberta num preview local, sem conta e sem dados gravados.
Não houve sessão autenticada nem escrita no Supabase de produção.

## Testes

npm run lint, typecheck, npm test (225), npm run build e npm run test:smoke
(32 rotas) passaram nesta revisão.
