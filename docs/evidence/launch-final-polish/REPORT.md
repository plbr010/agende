# Agendê — polimento final (Cursor) — 09/10/2026

Branch: `cursor/launch-final-polish`  
PR: https://github.com/plbr010/agende/pull/18  
Base: `main` @ `8cfadec` (PRs #15, #16, #17)

## Bugs / UX corrigidos

1. Pós-criação do salão sem foco de setup → `/app?setup=1` + checklist destacado + hero com CTA de configuração
2. Highlight estático de plano no onboarding → estado controlado
3. Plano do cadastro persistia no intent cliente → só envia com intent profissional + aviso
4. Verificar e-mail sem próximo passo → progresso + spam tip + “Já confirmei — entrar”
5. Slots stale ao trocar data no booking → limpa seleção e loading coerente + “Trocar data”
6. Reagendar silencioso sem `professionalMemberId` → mensagem explícita
7. Focus rings ausentes nos pickers de booking
8. Labels a11y (`aria-describedby`, Fechar em sheet/dialog)
9. Área profissional oculta no mobile do cliente → botão ícone

## Telas testadas (Playwright 21/21)

Desktop 1366, iPhone 13, Android 360: landing, cadastro+plano, verificar-email, perfil público, booking unavailable, guards `/app` e `/onboarding`.

## Pendências (bloqueiam uso real autenticado)

- Inbox/Auth isolado para cadastro+confirmação+trial
- Workspace com entitlement ativo para booking E2E
- Módulos `/app/*` com sessão real
- Reviews/reagendamento remoto (migrations Codex)
- Stripe sandbox

## O que ainda impede uma profissional de começar

Sem conta de teste / Auth isolado nesta VM, a jornada autenticada (e-mail → workspace → serviços → jornada → link) não pode ser validada ponta a ponta. A UI e os guards públicos estão prontos; o gargalo é ambiente + entitlement vivo.
