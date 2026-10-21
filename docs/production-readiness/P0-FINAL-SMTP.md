# Auth/SMTP produtivo — proposta concreta, não aplicada

Leitura de 21/10 no Supabase: Site URL `http://localhost:3000`, lista de redirects vazia, SMTP custom desligado. Signup/e-mail provider ligados, confirmação obrigatória e anonymous sign-in desligado. Nenhum campo foi editado.

Leitura autenticada de 21/10 no Resend, organização plbrpc: `agendeapp.online` **Verified**, região São Paulo, envio habilitado; DKIM e os registros de envio/SPF exibidos como **Verified**. Recebimento está desligado. O histórico contém entrega real do remetente **`"Agendê Staging" <no-reply@agendeapp.online>`** para a fixture QA. Consulta DNS somente leitura confirmou DMARC existente com `p=none` (monitoramento). Corpos/tokens e API keys não foram publicados no relatório. Isso comprova uso do remetente para envio, não existência de caixa postal/reply-to nem SMTP produtivo configurado.

## Valores propostos para autorização A2

| Campo | Valor/estado |
|---|---|
| Site URL | `https://agendeapp.online` |
| Redirect 1 | `https://agendeapp.online/auth/callback` |
| Redirect 2 | `https://agendeapp.online/auth/recovery` |
| Provider | Resend, domínio já verificado |
| SMTP host | `smtp.resend.com` |
| Porta | `465`, TLS implícito conforme suporte do provedor |
| Usuário | `resend` |
| Senha SMTP | API key Resend autorizada para produção, via campo seguro; não lida/reutilizada de staging nem criada nesta missão |
| Sender address proposto | `no-reply@agendeapp.online`, endereço existente observado em entregas; **pendente aprovação para produção** |
| Sender display name proposto | `Agendê`, pendente aprovação; não reutilizar nome Staging em produção |
| Confirm email | Manter ligado |
| Anonymous sign-in | Manter desligado |
| SMTP custom | Habilitar somente após aprovação e entrada segura da credencial |

Parâmetros conforme [documentação SMTP do Resend](https://resend.com/docs/send-with-smtp). A senha é uma API key, não a senha de uma caixa de e-mail. O endereço observado não foi criado nesta missão. Não criar chave, trocar DNS nem ativar SMTP por inferência da verificação do domínio.

## Validação e recuperação

Antes de salvar, registrar configuração anterior em local privado; registrar snapshot de metadados sem segredos. Conferir chave com permissão de envio no domínio correto e limites da conta/Supabase. Não exibir chave nem copiar a credencial de staging por conveniência. Verificar DMARC no DNS antes do aceite de entrega; o status Verified do Resend não é prova de política DMARC.

Após A2: usar endereço próprio de teste aprovado para signup, reenviar e recovery. Confirmar evento Delivered no Resend e chegada na caixa correta; callback HTTPS, PKCE de uso único, sessão válida, refresh/logout e recovery. Testar o callback com `next` de convite/booking gerado pelo app e conferir que o destino continua interno; não liberar wildcard de domínio/preview. A aplicação já sanitiza protocolos externos, barras/control characters codificados, loops de auth e rotas protegidas. As 16 verificações focadas Auth/recovery passaram nesta rodada.

O Supabase recomenda caminhos exatos de redirect em produção ([docs](https://supabase.com/docs/guides/auth/redirect-urls)). Se houver rejeição do callback com query, parar e validar o padrão mínimo necessário nesse caminho, antes de aprová-lo. Não ampliar para domínio arbitrário.

Falha de envio/callback: interromper novos testes, preservar sessões/dados, diagnosticar sem logs de token. Qualquer reversão da configuração é outra operação produtiva a autorizar; não considerar localhost uma configuração operacional aceitável. A mudança não exige migration e não altera secrets Stripe/Vercel.

**Falta para ativar:** aprovação explícita de A2 com remetente/nome e escopo; credencial produtiva disponível por entrada segura; destinatário QA próprio aprovado; aplicação no Supabase; entrega/PKCE/recovery reais aprovados. Domínio e remetente existente foram confirmados; SMTP produtivo ainda não está homologado.
