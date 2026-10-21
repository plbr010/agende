# Comercial Agendê para WhatsApp

Produção audiovisual isolada. Não altera o app, o banco nem o deploy.

## Arquivos prontos para envio

| Arquivo | Formato | Uso |
|---|---|---|
| `video/comercial/out/agende-comercial-whatsapp.mp4` | 1080×1920, 72s, 7,1 MB | **Enviar no WhatsApp** |
| `video/comercial/out/agende-comercial-horizontal.mp4` | 1920×1080, 72s, 4,6 MB | Site, e-mail, YouTube |

O vertical é H.264 + AAC, 30 fps, sem fala. Os textos bastam no mudo.

## Como visualizar e enviar

1. Baixe `agende-comercial-whatsapp.mp4`.
2. Abra no celular e confira as 6 cenas (cerca de 1 min 12 s).
3. No WhatsApp, envie como **vídeo** (não como documento) para a cliente ver no player nativo.
4. O arquivo tem 7 MB — cabe em conversa e em status.

Prévia local do projeto:

```bash
cd video/comercial
npm install
npm run studio
```

## O que foi verificado no produto real

Mostrado no filme, com os textos oficiais do Agendê:

- Link público `/p/[slug]/agendar`
- Etapas: Serviço, Profissional, Data, Horário, Confirmar
- Recibo `Agendamento confirmado!`
- Painel: Início e Agenda
- Clientes, Serviços e Equipe
- Financeiro: Dinheiro que entrou, Dinheiro que saiu, Ainda em aberto, Quanto sobrou

Tudo com dados fictícios (Studio Pétala). Nenhum cliente real.

Detalhes em `FEATURES.md`.

## Limitações honestas

- O recibo `Solicitação recebida` existe quando o salão não confirma na hora. O filme usa o caminho **já confirmado**.
- Relatórios, estoque e pacotes existem no app e ficaram de fora do roteiro.
- Sem voz ou música — o anúncio foi feito para funcionar no mudo.

## Renderizar de novo

```bash
cd video/comercial
npm install
npm run render:vertical
npm run render:horizontal
```
