import type { Metadata } from "next";
import { MarketingLegalLayout } from "@/components/marketing/legal-layout";
import { MarketingShell } from "@/components/marketing/shell";

export const metadata: Metadata = {
  title: "Política de Privacidade",
  description: "Como o Agendê trata dados pessoais de profissionais e clientes.",
};

export default function PrivacidadePage() {
  return (
    <MarketingShell>
      <MarketingLegalLayout title="Política de Privacidade">
        <p>
          O Agendê trata nome, e-mail, telefone e dados do negócio para autenticar
          usuários, criar workspaces e operar o produto.
        </p>
        <p>
          O e-mail é confirmado via Supabase Auth. O telefone é armazenado de forma
          normalizada e, nesta versão, não exige verificação por SMS.
        </p>
        <p>
          Nas páginas públicas do site usamos o Meta Pixel, da Meta Platforms, para
          medir o resultado dos nossos anúncios: visitas, cadastro de profissionais,
          início do teste e assinatura. O Pixel não é usado no painel do salão, na
          área da cliente nem nas páginas de agendamento dos salões. Também
          guardamos por até 30 dias a campanha de origem da sua visita (parâmetros
          utm), associada ao seu cadastro, para saber qual anúncio trouxe cada conta.
        </p>
        <p>
          Não vendemos dados pessoais. Regras críticas de acesso ficam no banco, com
          Row Level Security, e não apenas na interface.
        </p>
      </MarketingLegalLayout>
    </MarketingShell>
  );
}
