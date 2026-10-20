import { STATUS_LABEL, isAppointmentStatus } from "@/lib/agenda/status";

export type BookingReceiptCopy = {
  title: string;
  lead: string;
  statusLabel: string;
};

/** Success copy follows the status the server actually stored. */
export function bookingReceiptCopy(status: string): BookingReceiptCopy {
  if (status === "confirmed") {
    return {
      title: "Agendamento confirmado!",
      lead: "O salão confirmou seu horário. Confira os detalhes abaixo.",
      statusLabel: STATUS_LABEL.confirmed,
    };
  }
  if (status === "scheduled") {
    return {
      title: "Solicitação recebida",
      lead: "Aguardando confirmação do salão. O horário foi registrado e ainda não está confirmado.",
      statusLabel: "Aguardando confirmação",
    };
  }
  return {
    title: "Agendamento registrado",
    lead: "O servidor registrou o horário. Confira o status real abaixo.",
    statusLabel: isAppointmentStatus(status) ? STATUS_LABEL[status] : "Registrado",
  };
}
