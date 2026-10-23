import { PublicWorkspacePage } from "@/components/workspace/public-profile";
import { demoPublicProfile } from "@/lib/demo/catalog";
import { demoBookHref } from "@/lib/demo/paths";

export default function DemoClientPage() {
  return (
    <PublicWorkspacePage
      profile={demoPublicProfile()}
      bookingOpen
      links={{
        homeHref: "/demo",
        homeLabel: "Voltar à demonstração",
        bookHref: demoBookHref,
        agendaNote: "Escolha serviço, profissional, dia e horário. Nesta demonstração a confirmação fica só neste navegador. No Agendê, a conta de cliente é grátis e só é pedida para confirmar.",
      }}
    />
  );
}
