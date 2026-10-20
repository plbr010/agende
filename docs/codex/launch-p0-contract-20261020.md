# Contratos de integração — P0, 20/10/2026

Base main `36693e3`, PRs #63–65 já integrados. As mudanças são aditivas e preservam o layout existente do Cursor.

- Reserva: visitante escolhe o horário e vê “Entrar para confirmar”. A seleção persiste pelo cookie HttpOnly; após login, a confirmação continua explícita. A Server Action obtém identidade/e-mail do Auth e a RPC revalida preço, tenant, vínculos e conflito. Não criar reserva no retorno do login nem aceitar clientId/preço do navegador. Equipe continua usando a RPC interna autorizada.
- Comprovante: `PublicBookingConfirmation.status === "confirmed"` permite “Agendamento confirmado!”. `scheduled` apresenta “Solicitação recebida!” e “Aguardando confirmação”. Não mudar status para fazer a mensagem coincidir com a interface.
- Busca: assinatura de `search_public_workspaces` inalterada. Cidade e termo são combináveis; cidade de residência não limita a busca. O backend normaliza espaços, caixa e acentos; nome profissional só corresponde se houver serviço/vínculo ativos. Não pesquisar tabelas privadas diretamente. Campos públicos continuam name, slug, description, city, state, logo_path e booking_open.
- Imagens: usar as rotas/ações existentes. Fotos profissionais e avatares são privados e servidos após autorização; logo/capa requerem consentimento público. Troca usa novo caminho e não depende de sobrescrever cache. O avatar global do cliente chega à agenda via `/api/clients/avatar?clientId=...`, resolvido pelo relacionamento autorizado; não enviar avatar_path privado ao navegador.
- WhatsApp: `prepareAppointmentWhatsApp(id)` e a rota `/api/appointments/whatsapp?id=...` continuam fontes autorizadas. O clique relê o estado atual. Template usa `👤 Profissional`; pendente não afirma confirmação, cancelado não fornece link. Link é internacional validado e mensagem codificada. Não enviar automaticamente, alterar status, registrar telefone em log ou declarar envio.
- Produção ainda não tem parte do schema necessário. Não transformar ausência de RPC/bucket em sucesso visual. Publicar exige autorização explícita para migrations e deploy; este PR não foi integrado nem publicado.

Homologação: `../homologation/launch-p0-20261020.md`. Os testes de navegador desta rodada usaram Next local e Supabase staging real, sem deployment de Preview. Cadastro novo com SMTP/PKCE ainda precisa de aceite atual.
