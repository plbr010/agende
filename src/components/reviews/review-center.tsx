"use client";

import { useState, useTransition } from "react";
import { CalendarCheck2, LockKeyhole, MessageCircleHeart, Star } from "lucide-react";
import { submitReview } from "@/lib/reviews/actions";
import type { AppointmentReview } from "@/lib/reviews/queries";
import type { MyAppointment } from "@/lib/booking/queries";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTimeInTimeZone } from "@/lib/time/timezone";
import { cn } from "@/lib/utils";

export function ReviewCenter({ appointments, initialReviews }: { appointments: MyAppointment[]; initialReviews: AppointmentReview[] }) {
  const [reviews, setReviews] = useState(initialReviews);
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  function send() { if (!selected) return; start(async () => { try { const result = await submitReview({ appointmentId: selected.id, rating, comment }); if (result.error) setMessage(result.error); else if (result.reviews) { setReviews(result.reviews); setSelected(null); setMessage("Avaliação enviada com sucesso."); } } catch { setMessage("Não foi possível confirmar o envio. Atualize a página antes de tentar novamente."); } }); }
  const [selected, setSelected] = useState<MyAppointment | null>(null);
  const [rating, setRating] = useState(0);

  return (
    <>
      {!selected && message && <p role="status">{message}</p>}
      <section className="grid gap-4">
        {appointments.length === 0 ? (
          <Card className="rounded-3xl border-border/70 bg-card/85">
            <CardContent className="grid place-items-center gap-3 py-12 text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><MessageCircleHeart className="size-6" /></div>
              <div>
                <p className="font-serif text-2xl">Sua opinião vai aparecer aqui</p>
                <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">Depois de concluir um atendimento, você poderá preparar uma avaliação para o estabelecimento.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          appointments.map((appointment) => (
            <Card key={appointment.id} className="rounded-3xl border-border/70 bg-card/85 shadow-sm">
              <CardHeader>
                <div className="mb-2 flex size-10 items-center justify-center rounded-2xl bg-secondary text-primary"><CalendarCheck2 className="size-4" /></div>
                <CardTitle className="text-xl">{appointment.serviceName}</CardTitle>
                <CardDescription>{appointment.workspaceName} · {appointment.professionalName}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">{formatDateTimeInTimeZone(appointment.startsAt, appointment.timezone)}</p>
                {reviews.some((review) => review.appointment_id === appointment.id) ? (
                  <div className="rounded-2xl bg-secondary/60 p-4">
                    <p className="font-medium">
                      Nota: {reviews.find((review) => review.appointment_id === appointment.id)?.rating}/5
                    </p>
                    <p className="mt-1 text-sm leading-6">
                      {reviews.find((review) => review.appointment_id === appointment.id)?.comment || "Sem comentário."}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">Avaliação enviada. Não permite edição.</p>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="h-11 rounded-full"
                    onClick={() => {
                      setRating(0);
                      setComment("");
                      setMessage("");
                      setSelected(appointment);
                    }}
                  >
                    <Star className="size-4" /> Avaliar atendimento
                  </Button>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </section>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && !pending && setSelected(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Como foi sua experiência?</DialogTitle>
            <DialogDescription>{selected ? `${selected.serviceName} com ${selected.professionalName}` : "Conte como foi."}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-5">
            <fieldset className="grid gap-2">
              <legend className="text-sm font-medium">Sua nota</legend>
              <div className="flex gap-1" role="radiogroup" aria-label="Nota da avaliação">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button key={value} type="button" role="radio" aria-checked={rating === value} onClick={() => setRating(value)} className="rounded-xl p-2 transition-colors hover:bg-secondary" aria-label={`${value} estrela${value > 1 ? "s" : ""}`}>
                    <Star className={cn("size-7", value <= rating ? "fill-primary text-primary" : "text-border")} />
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="grid gap-2">
              <Label htmlFor="review-comment">Comentário opcional</Label>
              <Textarea value={comment} onChange={e => setComment(e.target.value)} disabled={pending} id="review-comment" maxLength={500} placeholder="O que tornou esse atendimento especial?" rows={5} />
            </div>
            <div className="flex items-start gap-2 rounded-2xl bg-secondary/60 p-4 text-xs leading-5 text-muted-foreground">
              <LockKeyhole className="mt-0.5 size-3.5 shrink-0 text-primary" />
              Após enviar, sua avaliação não poderá ser editada ou excluída por aqui. Ela será visível à equipe do estabelecimento.
            </div>
          </div>
          <DialogFooter>
            {message && <p role="alert">{message}</p>}
            <Button disabled={pending || rating < 1} onClick={send} className="h-11 w-full sm:w-auto">{pending ? "Enviando..." : "Enviar avaliação"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
