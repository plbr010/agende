# Homologação de autenticação — 14/10/2026

**Em execução. Lançamento comercial ainda não aprovado.** Este documento substitui a conclusão parcial anterior somente quando os cenários abaixo estiverem encerrados. Nenhuma produção, configuração SMTP, DNS ou Stripe foi alterada. Contas existentes e aliases de teste foram preservados.

## Ambiente e método

Branch própria `codex/auth-pkce-homologation-2026-10-14`, baseada em `origin/main`. Next 16.3.8 com Node 24.19.0, diretamente em `http://localhost:3000`, conectado exclusivamente a `fkpdudnnperufnmdwdlv`. Sem proxy, sem bypass de confirmação e sem substituir PKCE por OTP.

A identidade final foi acordada com o responsável; é o sexto alias da mesma caixa Gmail autorizada. Endereços pessoais, senhas, verificadores, códigos e URLs de autenticação foram omitidos das evidências publicáveis. A conta original não foi removida.

Antes do teste, o Dashboard de staging confirmou templates de confirmação e recuperação com `{{ .ConfirmationURL }}`, Site URL `http://localhost:3000` e allowlist exata dos dois callbacks, também em `127.0.0.1`. Nenhuma configuração foi modificada. A sessão não tem limite por tempo/inatividade (valores 0, nunca); o JWT expira em 3.600 segundos. Expiração de JWT não significa encerramento da sessão que ainda pode ser renovada pelo refresh token.

## Correções

O executor antigo fazia signup implícito por API, aguardava um template diferente e alterava a origem com proxy. Agora inicia Next diretamente na porta 3000, recusa build produtivo, exige opt-in de staging e usa o formulário SSR real, com senha/termos manuais. O observador registra apenas métodos, caminhos, status, presença de cookies/código e tempos do JWT. Valores de tokens ficam somente em memória para o probe de expiração real; formulários não são capturados.

Bug real de orientação corrigido: a tela aconselhava abrir o e-mail no celular, embora PKCE precise do perfil que iniciou o fluxo. Falta de verificador agora recebe instrução própria; confirmação oferece login quando o e-mail já foi confirmado; recuperação orienta reiniciar no navegador atual. A troca sem verificador continua recusada, sem fallback de PKCE para OTP.

## Resultados atuais

| Cenário | Estado | Evidência |
|---|---|---|
| Templates/callbacks inspecionados e origem direta | PASS | Dashboard de staging; redirects do executor na porta 3000. |
| Cadastro pelo formulário SSR | PASS | POST `/cadastro` com destino `/verificar-email`; conta nova de teste. |
| Entrega no Resend | PASS | Confirmação e recuperação da identidade final mostraram Delivered. |
| Confirmação PKCE completa | PASS | 16:54:20 UTC: código e cookie verificador presentes, cookie de sessão criado, redirect `/onboarding` na mesma origem. |
| Sessão e onboarding após cadastro | PASS | JWT da identidade final observado; responsável confirmou tela 2 — Salão no navegador normal. |
| Recuperação no perfil original | PASS | 16:56:16 UTC: código + verificador + sessão; redirect `/redefinir-senha`. |
| Recuperação em outro navegador | PASS da proteção | 17:00:58 UTC: código presente, verificador e sessão ausentes; recusada sem criar sessão. A mensagem foi verificada separadamente por HTTP real sem cookies; não confundir com abertura no perfil original às 16:56. |
| Salvar senha e rejeitar senha anterior | BLOQUEADO | Aguardando POST real de redefinição e as duas tentativas de login para essa identidade. A aprovação anterior da conta original não prova este cenário. |
| Expiração natural do JWT | BLOQUEADO | Primeiro JWT observado expira às 17:54:18 UTC (14:54:18 BRT); relógio e token não foram alterados. Aguardando prazo real. |
| Renovação após expiração | BLOQUEADO | Aguardando renovação real; emissão de token por login ou recuperação não conta como refresh. |
| Expiração finita da sessão por política | BLOQUEADO pela configuração | Staging Free está configurado com sessões sem prazo/inatividade. Não foi contratado plano nem alterada política para simular expiração. |
| Lint, typecheck, testes e build | PASS | 301 testes, zero falhas/skips; build Turbopack e TypeScript com Node 24. |

As tentativas integradas anteriores confirmaram os aliases no Supabase, mas não trocaram PKCE com o cookie original. Uma requisição sem cookies apareceu durante a inspeção do preview antes do clique explícito, e outra tentativa manual integrada também não preservou o verificador. A causa exata dessa pré-abertura/isolamento não foi provada. A rodada completa no Chrome/Edge normal trouxe código e verificador juntos e funcionou. Logins posteriores da conta original não foram usados como evidência dos aliases.

## Evidências e execução

`auth-pkce-observations.json` contém a rodada final e `auth-pkce-runtime-validation.json` registra os checks locais. Os JSONs das tentativas anteriores preservam o histórico de falhas de navegação. Nenhuma evidência local declara simulação como expiração real.

IDs do Resend, sem links de autenticação: confirmação `01a13b55-ea32-72cf-93ee-8677e2f0c3dc`; primeira recuperação `01a13b57-a79f-7af3-b10b-46552a029f4b`.

Para executar, gerar build com variáveis de staging e definir `AGENDE_STAGING_ACCEPTANCE=fkpdudnnperufnmdwdlv`, `AGENDE_STAGING_SMTP_READY=1` e `AGENDE_AUTH_TEST_EMAIL` com identidade nova previamente acordada. Rodar `node scripts/staging-auth-email.mjs` num terminal interativo. O operador usa o navegador conectado ou o proprietário opera seu navegador normal. Senha, termos e e-mails ficam na interface; não são passados ao processo ou ao chat. Linhas `scenario_id PASS|FAIL|BLOQUEADO` registram resultados observados; `stop` encerra o servidor. Portas ocupadas e builds produtivos são recusados.

O build Turbopack que antes falhou com Node 20 em execução restrita passou duas vezes com Node 24 no checkout isolado. Isso aponta para o ambiente/runtime; não demonstra uma causa exata do panic anterior. Não houve troca do bundler padrão ou publicação.
