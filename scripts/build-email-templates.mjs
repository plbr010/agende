// Generates the branded Supabase Auth e-mail templates in supabase/templates.
// Links stay {{ .ConfirmationURL }} (the flow already validated in production:
// PKCE code -> /auth/callback, recovery -> /auth/recovery).
// Run: node scripts/build-email-templates.mjs
import { mkdirSync, writeFileSync } from "node:fs";

const LOGO = "https://agendeapp.online/brand/logo-horizontal.png";

export const EMAIL_TEMPLATES = {
  confirmation: {
    subject: "Confirme seu e-mail no Agendê",
    preheader: "Falta só um passo para ativar sua conta.",
    title: "Confirme seu e-mail",
    body: "Que bom ter você no Agendê! Para ativar sua conta e começar a usar, confirme que este e-mail é seu.",
    button: "Confirmar meu e-mail",
    footnote: "Se você não criou uma conta no Agendê, pode ignorar esta mensagem.",
  },
  recovery: {
    subject: "Redefina sua senha do Agendê",
    preheader: "Recebemos um pedido para trocar a sua senha.",
    title: "Vamos criar uma nova senha",
    body: "Recebemos um pedido para redefinir a senha da sua conta. Toque no botão abaixo para escolher uma nova senha.",
    button: "Criar nova senha",
    footnote: "Se não foi você que pediu, ignore este e-mail: sua senha atual continua valendo.",
  },
  magic_link: {
    subject: "Seu link de acesso ao Agendê",
    preheader: "Entre na sua conta com um toque.",
    title: "Seu link de acesso",
    body: "Use o botão abaixo para entrar na sua conta do Agendê. O link vale por pouco tempo e só pode ser usado uma vez.",
    button: "Entrar no Agendê",
    footnote: "Se você não pediu este link, pode ignorar esta mensagem.",
  },
  email_change: {
    subject: "Confirme seu novo e-mail no Agendê",
    preheader: "Confirme a troca do e-mail da sua conta.",
    title: "Confirme seu novo e-mail",
    body: "Recebemos um pedido para trocar o e-mail da sua conta de {{ .Email }} para {{ .NewEmail }}. Confirme para concluir a troca.",
    button: "Confirmar novo e-mail",
    footnote: "Se você não pediu essa troca, não clique no botão e altere sua senha.",
  },
};

export function renderEmail({ preheader, title, body, button, footnote }) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#fbf4ee;">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fbf4ee;">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
      <tr><td align="center" style="padding-bottom:24px;">
        <img src="${LOGO}" alt="Agendê" width="160" style="display:block;border:0;height:auto;">
      </td></tr>
      <tr><td style="background:#ffffff;border-radius:24px;padding:36px 32px;font-family:Arial,Helvetica,sans-serif;color:#4a3140;">
        <h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:26px;line-height:1.25;color:#5c1a2e;font-weight:normal;">${title}</h1>
        <p style="margin:0 0 28px;font-size:16px;line-height:1.6;">${body}</p>
        <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:999px;background:#6b2d42;">
          <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:bold;color:#fffaf8;text-decoration:none;border-radius:999px;">${button}</a>
        </td></tr></table>
        <p style="margin:28px 0 0;font-size:13px;line-height:1.6;color:#7a6070;">Se o botão não funcionar, copie e cole este link no navegador:<br><a href="{{ .ConfirmationURL }}" style="color:#9a3d58;word-break:break-all;">{{ .ConfirmationURL }}</a></p>
        <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#7a6070;">${footnote}</p>
      </td></tr>
      <tr><td align="center" style="padding:24px 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#7a6070;">
        Agendê · agenda online para profissionais da beleza<br>
        <a href="https://agendeapp.online" style="color:#9a3d58;text-decoration:none;">agendeapp.online</a>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>
`;
}

if (process.argv[1]?.endsWith("build-email-templates.mjs")) {
  mkdirSync("supabase/templates", { recursive: true });
  for (const [name, template] of Object.entries(EMAIL_TEMPLATES)) {
    writeFileSync(`supabase/templates/${name}.html`, renderEmail(template));
    console.log(`supabase/templates/${name}.html  "${template.subject}"`);
  }
}
