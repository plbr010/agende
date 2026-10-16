# Contratos de perfis, fotos, agendamento e WhatsApp — Cursor

Base: `b937621` (main, PR #61). Branch independente: `codex/profiles-booking-whatsapp-20261016`.
Nenhum PR aberto do Cursor foi encontrado na consulta de 16/10/2026. As integrações nos componentes existentes são pequenas; os editores e botões novos ficam em módulos próprios. Este documento não constitui autorização para alterar produção.

## Fotos de profissionais

Componente reutilizável: `ProfessionalPhotoEditor({ memberId, name })`. Exibição: `PersonPhoto({ name, src })`, com iniciais quando ausente ou com erro. Não copiar a foto pessoal da conta para o perfil profissional: o usuário escolhe explicitamente a imagem pública de atendimento, separada por estabelecimento/profissional.

| Operação | Contrato |
| --- | --- |
| Ler na equipe/agenda | `GET /api/professionals/photo?memberId=UUID` com sessão de membro do estabelecimento |
| Ler na escolha pública | `GET /api/professionals/photo?memberId=UUID&slug=SLUG`; a RPC verifica que o profissional pertence ao catálogo público atual desse salão |
| Enviar/substituir | `PUT` no mesmo endereço, corpo binário JPEG/PNG/WebP; `Content-Type` da imagem, `X-Image-Extension: jpg/jpeg/png/webp`, `X-Public-Photo-Consent: true`; sessão e Origin da aplicação |
| Remover | `DELETE` no mesmo endereço, sessão e Origin da aplicação |
| Sucesso de gravação | `{ hasPhoto: boolean, cleanupPending: boolean }` |
| Imagem válida | Até 4 MiB, 32–4096 px por dimensão, até 16 milhões de pixels, uma página; decodificada integralmente, orientada, reduzida a até 512 px e reencodada WebP sem metadados |
| Respostas | Imagem `image/webp`, `private, no-store`, `nosniff`; erro JSON `{error:'photo_unavailable'}`; 400 contrato/consentimento, 401 sessão, 403 permissão/Origin, 404 indisponível, 409 alteração concorrente, 413 limite, 422 formato, 503 backend |

`professional_profiles.photo_path` é somente leitura para clientes SQL. Só o backend normalizador consegue escrever bytes e trocar a referência. Não oferecer edição de path, URL, bucket ou actorId no frontend. `p_actor_id` das RPCs privilegiadas vem exclusivamente de `auth.getUser()` no servidor.

Bucket `professional-photos` privado; caminhos UUID aleatórios sem upsert. Nunca construir URL pública desse bucket nem emitir URL assinada transferível. O proxy consulta a autorização em cada leitura. Um profissional inativo/removido ou sem vínculo ativo com serviço não é exposto pelo catálogo público. Disponibilidade efetiva continua sendo validada pela agenda ao escolher um horário.

## Avatar global do cliente

Continuam válidos `GET/PUT/DELETE /api/account/avatar`, o editor existente e `profiles.avatar_path`; não existe avatar por estabelecimento. O cliente continua sendo o único editor da sua imagem pessoal.

Para exibir na agenda: `GET /api/clients/avatar?clientId=UUID`. O UUID é de `workspace_clients`, nunca o userId global. Retorna bytes privados `image/webp` ou 404, sempre `no-store`. A RPC exige conta confirmada, cliente não arquivado, vínculo com conta global e pelo menos um agendamento que a pessoa da equipe possa gerenciar. Outro salão, um profissional alheio ao atendimento ou um cadastro manual sem relacionamento não obtém o avatar. A rota não permite gravação nem enumeração.

## Reserva autenticada

Reutilizar `continueBookingAfterLogin(BookingDraft)` e `createPublicAppointmentAction`, sem criar agendamento na seleção ou no cadastro. `BookingDraft` contém somente slug, serviceId, professionalMemberId ou null, localDate e startsAt. Cookie HttpOnly/SameSite=Lax/Secure em produção, com validade de 30 minutos. O retorno revalida catálogo e horários; os IDs do rascunho nunca autorizam gravação.

A assinatura de `create_public_appointment` foi preservada, mas anon perdeu EXECUTE. A função interna exige `app.require_confirmed_email()` antes de qualquer escrita e usa o e-mail do Auth. `p_email` permanece por compatibilidade, sem autorizar identidade ou substituir o e-mail verificado. Preço/duração, tenant, vínculo de serviço, janela e conflitos são calculados no banco. Locks, índice de duplicidade e exclusão GiST continuam ativos. A equipe continua usando `create_appointment`, com suas permissões existentes. Clientes não recebem assinatura SaaS nem precisam de plano para reservar.

## WhatsApp manual

Componente: `AppointmentWhatsApp({ appointmentId, confirmed })`. A prop controla somente o rótulo; a autorização e o texto usam o banco no clique. Não derivar mensagem do snapshot do dialog.

- Link de clique: `GET /api/appointments/whatsapp?id=UUID`, aberto por âncora nativa `target=_blank`, `noopener noreferrer`. O servidor relê o agendamento, contato, serviço, profissional e fuso. Retorna 302 para `https://wa.me/DIGITOS?text=ENCODED` ou 422 com orientação. O redirecionamento tem `private, no-store` e `Referrer-Policy: no-referrer`.
- Cópia alternativa: `prepareAppointmentWhatsApp(appointmentId): Promise<{message?:string;url?:string;error?:string}>`. Sempre relê e autoriza. Quando Clipboard falha, a mensagem aparece em textarea somente leitura para cópia manual. Telefone inválido impede link, mas permite copiar mensagem autorizada.
- `scheduled`: solicitação recebida, ainda aguardando confirmação. `confirmed`: confirmação. Cancelados, concluídos, faltas e em atendimento não oferecem essa ação.
- Somente owner/admin/receptionist do salão ou o profissional responsável pelo atendimento. Outra conta ou outro profissional não recebe mensagem/telefone.
- Validação internacional por `libphonenumber-js/max`, sem país padrão; exige `+` explícito, valida DDI e numeração, remove apenas separadores de apresentação. O wa.me recebe somente dígitos, e o texto usa `encodeURIComponent`.
- Abrir ou copiar nunca muda status, registra envio, chama API paga ou envia mensagem automaticamente. Não adicionar analytics com telefone, mensagem ou URL completa. O usuário revisa e aperta Enviar no WhatsApp.

## Persistência e atualização

Trocas usam compare-and-swap da referência anterior. Não remover bytes quando a confirmação do banco for incerta: pode ter havido commit. Uploads pendentes expiram em uma hora; a fila de limpeza só reclama referências inativas. Substituição/remoção limpa os bytes antigos via API Storage após commit. `cleanupPending` precisa ser tratado como salvamento concluído com manutenção pendente, nunca como falha que justifique repetir upload automaticamente.

Fotos novas pedem refresh da equipe e dos perfis públicos. O diálogo da agenda agora resolve o agendamento pelo ID na lista atualizada, evitando status/horário congelados após uma Server Action.
