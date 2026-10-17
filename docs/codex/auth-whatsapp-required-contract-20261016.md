# Contrato obrigatório — reserva autenticada e WhatsApp manual

Branch Codex: `codex/auth-whatsapp-contract-20261016`, baseada no main `5ceea68` após a integração do PR #63. Este complemento altera somente backend/helpers/testes/documentação. Nenhum componente TSX do Cursor é editado.

## Reserva: contrato real

`createPublicAppointmentAction(input)` em `src/lib/booking/actions.ts` exige sessão validada por `auth.getUser()`, sem erro de Auth, usuário não anônimo, e-mail existente e confirmado. A recusa ocorre antes de ler o payload, calcular IP ou chamar a RPC. IDs/slug/instante são validados no servidor, e campos extras como preço ou clientId são recusados. O e-mail fornecido no payload não estabelece identidade: é usado o e-mail verificado do Auth.

Payload compatível com a interface existente:

```ts
{
  slug: string;
  serviceId: string; // UUID
  professionalMemberId: string | null; // UUID ou qualquer disponível
  startsAt: string; // ISO com offset
  fullName: string;
  phone: string;
  email: string; // compatibilidade; identidade real vem do Auth
  customerNote: string | null;
}
```

Resposta: `{error?: string; confirmation?: PublicBookingConfirmation}`. Só mostrar sucesso se houver confirmation. `confirmation.status` é o estado real, atualmente `scheduled` para a criação pública. Não transformar esse valor em `confirmed` na interface.

A assinatura existente de `public.create_public_appointment` recalcula preço/duração, estabelecimento, vínculo de serviço/profissional, janela e disponibilidade, com locks, índice de duplicidade e exclusão GiST. A migration `20261016075244_profiles_booking_whatsapp.sql` já no main revoga EXECUTE de anon e exige conta confirmada também na função interna. A criação da equipe continua em `create_appointment` com autorização própria. A conta de cliente não exige plano ou assinatura; nenhuma operação SaaS é executada ao confirmar.

Para login/cadastro, usar `continueBookingAfterLogin(BookingDraft)` existente. O rascunho contém somente slug, serviceId, professionalMemberId, localDate e startsAt. Cookie HttpOnly/SameSite=Lax, Secure em produção, 30 minutos. O retorno a `/p/[slug]/agendar` revalida serviço/profissional/horário no servidor. Não criar reserva ao salvar rascunho, cadastrar ou entrar. Slot perdido mantém serviço/profissional/dia e exige nova escolha; falha de confirmação mantém o rascunho.

## Detalhes autorizados para o Cursor

`AgendaAppointment` em `src/lib/agenda/queries.ts` já fornece os dados para todos os estados: id, clientName (nome completo), **clientPhone**, serviceName, professionalName, startsAt, localDate, localStart, localEnd e status. A consulta usa a sessão do usuário e o isolamento existente do banco. Nos detalhes, renderizar clientPhone, além dos outros dados; não usar nome abreviado no lugar de clientName.

Para preparar a ação de WhatsApp com dados atuais:

```ts
import { prepareAppointmentWhatsApp } from '@/lib/agenda/whatsapp-actions';
import type { AppointmentWhatsAppResult } from '@/lib/agenda/whatsapp-actions';

const result = await prepareAppointmentWhatsApp(appointmentId);
// Não aceitar telefone, tenant, status, nome ou mensagem do navegador.
```

O retorno foi ampliado sem remover os campos anteriores:

```ts
type AppointmentWhatsAppResult = {
  appointment?: {
    id: string;
    clientName: string;
    phone: string | null;       // valor real cadastrado
    phoneE164: string | null;   // número internacional validado, ou null
    workspaceName: string;
    serviceName: string;
    professionalName: string;
    startsAt: string;
    timezone: string;
    status: 'scheduled' | 'confirmed';
    localDate: string;          // YYYY-MM-DD no fuso do salão
    localTime: string;          // HH:mm no fuso do salão
  };
  message?: string;
  url?: string;
  error?: string;
};
```

A resposta vem de uma única chamada à RPC `get_appointment_whatsapp` com a sessão atual. Owner/admin/recepção do salão ou profissional responsável podem ler; cliente final, outro salão e outro profissional não recebem telefone, mensagem nem dados do atendimento. Cancelado e demais estados inelegíveis são recusados. O backend não usa service_role para esse fluxo.

Quando o telefone está ausente/inválido, a resposta pode conter appointment e message autorizados, com error explicativo e sem url. Mostrar os dados existentes e a orientação; permitir cópia manual. Quando houver recusa de autorização, não há appointment, message ou url.

## Botão e envio manual

O clique final deve usar âncora nativa para `/api/appointments/whatsapp?id=UUID`, com `target="_blank"` e `rel="noopener noreferrer"`. A rota relê os dados e retorna 302 para `https://wa.me/DIGITOS?text=ENCODED`, ou 422 com orientação, sempre `private, no-store` e `Referrer-Policy: no-referrer`. Isso evita depender de snapshot antigo de horário/status/contato e de window.open depois de await. Não usar uma URL antiga do estado React para o clique definitivo.

- Rótulo solicitado: **Confirmar pelo WhatsApp** para a ação disponível. A mensagem de `scheduled` explica que a solicitação ainda aguarda confirmação; não declara confirmação.
- `confirmed` usa exatamente o modelo solicitado, incluindo `👩 Profissional`, data e hora atuais no fuso do estabelecimento.
- `cancelled`: não renderizar a ação; a rota também bloqueia se o cancelamento ocorrer depois de abrir o diálogo. Não renderizar em completed/no_show/in_progress.
- O telefone exige `+` e numeração internacional válida por libphonenumber-js; não inferir DDD/DDI. O link usa somente os dígitos validados, e o texto é codificado com encodeURIComponent.
- Para copiar, chamar novamente `prepareAppointmentWhatsApp`, usar result.message e apresentar textarea se Clipboard falhar. Não registrar telefone, mensagem ou URL completa em logs/analytics.
- Abrir/copiar não altera status, não envia mensagem, não registra como enviada e não chama API paga. O envio exige a ação manual de Enviar no aplicativo/Web do WhatsApp.
- Os helpers antigos `buildWhatsAppConfirmation`/`WhatsAppConfirm(plan)` não são uma fronteira de autorização nem substituem a chamada ao servidor. O PR #64 do Cursor trata o helper visual; a geração autorizada integrada deve usar os contratos acima.

## Integração com o PR #64 e aceite obrigatório da interface — Cursor

PR de interface identificado: https://github.com/plbr010/agende/pull/64, branch `cursor/authenticated-booking-whatsapp-36cd`, commit `dccb7b7842643bb7807f23fb640edaef75c16ed2`. Esta branch Codex não modifica os componentes desse PR. O PR #64 já propõe a exibição do telefone e o fluxo de autenticação; sua integração precisa ser validada junto deste contrato.

1. Exibir nome completo, telefone real, serviço, profissional, data/hora e status real nos detalhes, em desktop e celular.
2. Renderizar o comprovante com base em confirmation.status. **O main e a versão examinada do PR #64 ainda mostram “Agendamento confirmado!” para scheduled; corrigir para “Solicitação recebida”/“Aguardando confirmação” nesse estado.** Isso foi observado no teste real e não está sendo apresentado como concluído.
3. **O detalhe do main ainda não renderiza clientPhone**, embora o contrato já o forneça. O PR #64 adiciona esse campo; integrar e conferir a orientação para telefone inválido/ausente.
4. Confirmar o rótulo exato do botão solicitado sem mudar a semântica da mensagem pendente. Não criar um segundo fluxo de geração de link a partir de campos livres do frontend.
5. Manter escolhas após login/cadastro; nenhum agendamento antes do clique final autenticado. Horário ocupado deve exigir nova seleção, sem sucesso falso.
6. Não exibir planos SaaS para clientes. Não alterar status ao abrir/copiar. Cancelamento concorrente deve ser recusado pelo servidor.

O PR #64 também prepara `20261016235000_require_confirmed_public_booking.sql` para impedir degradação para convidado se a confirmação do e-mail for revogada durante a chamada. Ela não foi aplicada nesta rodada. Não duplicar ou editar essa migration nesta branch.

## Infraestrutura e publicação

A consulta **somente leitura** à produção em 16/10/2026 ainda mostrou: anon possui EXECUTE na reserva, guard interno de conta confirmada ausente, migration do #63 não aplicada e RPC de WhatsApp ausente. Merge do código não aplica schema automaticamente. Portanto a funcionalidade produtiva completa permanece **NO-GO** até autorização e aplicação do SQL já preparado, integração/aceite da UI e publicação autorizada.

Nesta rodada não foi criada nem executada migration remota, não houve deploy manual, alteração de secret/configuração Auth, produção, cobrança ou Stripe. Os testes reais usam fixtures sintéticas do staging existente, conta normal sem service_role e servidor Next local. Reservas de teste são canceladas pela conta cliente autenticada; não são apagados dados existentes.
