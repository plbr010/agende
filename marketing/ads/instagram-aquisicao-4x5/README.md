# Anúncio Instagram 4:5 — Agendê

Peça de aquisição 1080 × 1350 (4:5). Não altera o SaaS.

## Arquivo final

- PNG para veiculação: `output/agende-instagram-4x5.png`
- PNG em 2x (2160 × 2700): `output/agende-instagram-4x5@2x.png`
- HTML gerado (prévia no navegador): `ad.html`

## Como editar o texto

1. Abra `copy.json`.
2. Altere `headlineLines`, `supportLines`, `badge`, `closing`, `cta` ou `domain`.
3. Regenere só a arte:

```bash
node marketing/ads/instagram-aquisicao-4x5/export.mjs --compose-only
```

## Como substituir as telas

As capturas reais ficam em `captures/`:

| Arquivo | Origem no produto |
| --- | --- |
| `painel-profissional.png` | `/identidade` — painel com agenda do dia |
| `agenda.png` | recorte de “Agenda de hoje” |
| `servicos.png` | `/identidade/servicos` |
| `servico-card.png` | card real de serviço |
| `painel-mobile.png` | `/identidade` em viewport de celular |

Substitua o PNG e rode `--compose-only`. Não use dashboards genéricos.

Para recapturar as telas do sistema local:

```bash
node marketing/ads/instagram-aquisicao-4x5/export.mjs
```

As telas vêm da prévia oficial de identidade do Agendê (componentes reais do produto, com dados ilustrativos já existentes no código). Os prints de homologação/staging não entram na arte porque contêm nomes sintéticos de teste.
