"use client";
import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PersonPhoto } from "./person-photo";
import { Button } from "@/components/ui/button";
export function ProfessionalPhotoEditor({ memberId, name }: { memberId: string; name: string }) {
  const inputId = useId();
  const router = useRouter();
  const [revision, setRevision] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [pending, start] = useTransition();
  const url = `/api/professionals/photo?memberId=${encodeURIComponent(memberId)}`;
  function save(file: File | null) {
    start(async () => {
      setFeedback("");
      try {
        if (file && (file.size > 4 * 1024 * 1024 || !/\.(jpe?g|png|webp)$/i.test(file.name) || !["image/jpeg", "image/png", "image/webp"].includes(file.type))) {
          setFeedback("Escolha uma foto JPEG, PNG ou WebP de até 4 MB."); return;
        }
        const result = await fetch(url, { method: file ? "PUT" : "DELETE", body: file,
          headers: file ? { "Content-Type": file.type, "X-Public-Photo-Consent": "true", "X-Image-Extension": file.name.split(".").pop()!.toLowerCase() } : {} });
        if (!result.ok) { setFeedback(result.status === 409 ? "A foto mudou em outra janela. Atualize e tente novamente." : "Não foi possível salvar. Verifique sua permissão e use uma foto válida de até 4 MB."); return; }
        const data = await result.json() as { cleanupPending?: boolean };
        setRevision(value => value + 1); router.refresh();
        setFeedback(data.cleanupPending ? "Foto salva. A limpeza da imagem anterior está pendente." : file ? "Foto salva." : "Foto removida.");
      } catch { setFeedback("Não foi possível salvar. Confira sua conexão e tente novamente."); }
    });
  }
  return <section className="grid gap-3 rounded-2xl border p-4" aria-label={`Foto de ${name}`} aria-busy={pending}>
    <PersonPhoto key={revision} name={name} src={`${url}&v=${revision}`} />
    <p className="text-sm">Esta foto aparece na escolha de profissional. Envie somente uma imagem autorizada para exibição pública.</p>
    <label htmlFor={inputId} className="text-sm font-medium">Adicionar ou trocar foto (JPEG, PNG ou WebP, até 4 MB)</label>
    <input id={inputId} type="file" accept="image/jpeg,image/png,image/webp" disabled={pending} onChange={event => {
      const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) save(file);
    }} />
    <Button type="button" variant="outline" disabled={pending} onClick={() => save(null)}>Remover foto</Button>
    {feedback ? <p role="status" className="text-sm">{feedback}</p> : null}
  </section>;
}
