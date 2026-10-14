# Homologação de autenticação — 14/10/2026

**Rodada encerrada com pendências explícitas. Lançamento comercial ainda não aprovado.** Este documento consolida as evidências desta rodada e preserva os limites das conclusões anteriores. Nenhuma produção, configuração SMTP, DNS ou Stripe foi alterada. Contas existentes e aliases de teste foram preservados.

## Ambiente e método

Branch própria `codex/auth-pkce-homologation-2026-10-14`, baseada em `origin/main`. Next 16.3.8 com Node 24.19.0, diretamente em `http://localhost:3000`, conectado exclusivamente a `fkpdudnnperufnmdwdlv`. Sem proxy, sem bypass de confirmação e sem substituir PKCE por OTP.

A identidade final foi acordada com o responsável; é o sexto alias da mesma caixa Gmail autorizada. Endereços pessoais, senhas, verificadores, códigos e URLs de autenticação foram omitidos das evidências publicáveis. A conta original não foi removida.

Antes do teste, o Dashboard de staging confirmou templates de confirmação e recuperação com `{{ .ConfirmationURL }}`, Site URL `http://localhost:3000` e allowlist exata dos dois callbacks, também em `127.0.0.1`. Templates, URLs, confirmação e PKCE não foram modificados. Para o teste de prazo real, somente o TTL de JWT de staging foi temporariamente reduzido de 3.600 para 300 segundos e restaurado para 3.600; a restauração foi confirmada após recarregar o Dashboard. A sessão não tem limite por tempo/inatividade (valores 0, nunca); o JWT expira em 3.600 segundos. Expiração de JWT não significa encerramento da sessão que ainda pode ser renovada pelo refresh token.

## Correções

O executor antigo fazia signup implícito por API, aguardava um template diferente e alterava a origem com proxy. Agora inicia Next diretamente na porta 3000, recusa build produtivo, exige opt-in de staging e usa o formulário SSR real, com senha/termos manuais. O observador registra apenas métodos, caminhos, status, presença de cookies/código e tempos do JWT. Valores de tokens ficam somente em memória para o probe de expiração real; formulários não são capturados.

Bug real de orientação corrigido: a tela aconselhava abrir o e-mail no celular, embora PKCE precise do perfil que iniciou o fluxo. Falta de verificador agora recebe instrução própria; confirmação oferece login quando o e-mail já foi confirmado; recuperação orienta reiniciar no navegador atual. A troca sem verificador continua recusada, sem fallback de PKCE para OTP.

## Resultados finais

| Cenário | Estado | Evidência |
|---|---|---|
| Templates/callbacks inspecionados e origem direta | PASS | Dashboard de staging; redirects do executor na porta 3000. |
| Cadastro pelo formulário SSR | PASS | POST `/cadastro` com destino `/verificar-email`; conta nova de teste. |
| Entrega no Resend | PASS | Confirmação e recuperação da identidade final mostraram Delivered. |
| Confirmação PKCE completa | PASS | 16:54:20 UTC: código e cookie verificador presentes, cookie de sessão criado, redirect `/onboarding` na mesma origem. |
| Sessão e onboarding após cadastro | PASS | JWT da identidade final observado; responsável confirmou tela 2 — Salão no navegador normal. |
| Recuperação no perfil original | PASS | 16:56:16 UTC: código + verificador + sessão; redirect `/redefinir-senha`. |
| Recuperação em outro navegador | PASS da proteção | 17:00:58 UTC: código presente, verificador e sessão ausentes; recusada sem criar sessão. A mensagem foi verificada separadamente por HTTP real sem cookies; não confundir com abertura no perfil original às 16:56. |
| Salvar senha e rejeitar senha anterior | PASS | POST de redefinição às 17:02:23 UTC; senha antiga recusada (grant 400 às 17:02:39), nova aceita (grant 200 às 17:02:48), cookie autenticado e onboarding. |
| Expiração natural do JWT | PASS | JWT real de 300 segundos: emitido 17:15:10 UTC, expiração 17:20:10 UTC. Às 17:20:15 o Supabase respondeu 403 com erro de JWT expirado. Relógio e token não foram alterados. O prazo padrão de uma hora não foi aguardado integralmente. |
| Renovação após expiração | BLOQUEADO por falta de evidência | Responsável relatou funcionamento e pediu encerramento. Não houve nova requisição observada após o prazo nem grant de refresh nos logs consultados de 17:15–17:23:30 UTC. Não considerar novo login, recuperação ou relato genérico como prova de refresh. |
| Expiração finita da sessão por política | BLOQUEADO pela configuração | Staging Free está configurado com sessões sem prazo/inatividade. Não foi contratado plano nem alterada política para simular expiração. |
| Logout | PASS | Aprovado na rodada anterior; login novo às 17:15 confirmou ausência do cookie da sessão antes de entrar. |
| Links inválidos/reutilizados | PASS | Recuperações reutilizadas às 17:00:14, 17:01:28 e 17:01:44 recusadas; callback sem verificador testado também por HTTP. A reutilização da confirmação após expiração não recebeu nova evidência nesta última etapa. |
| Lint, typecheck, testes e build | PASS | 301 testes, zero falhas/skips; build Turbopack e TypeScript com Node 24. |

As tentativas integradas anteriores confirmaram os aliases no Supabase, mas não trocaram PKCE com o cookie original. Uma requisição sem cookies apareceu durante a inspeção do preview antes do clique explícito, e outra tentativa manual integrada também não preservou o verificador. A causa exata dessa pré-abertura/isolamento não foi provada. A rodada completa no Chrome/Edge normal trouxe código e verificador juntos e funcionou. Logins posteriores da conta original não foram usados como evidência dos aliases.

## Evidências e execução

`auth-pkce-ssr-flow-final.json` contém o cadastro/recuperação final; `auth-pkce-observations.json` contém o teste real de prazo e `auth-pkce-runtime-validation.json` registra os checks locais. Os JSONs das tentativas anteriores preservam o histórico de falhas de navegação. Nenhuma evidência local declara simulação como expiração real.

IDs do Resend, sem links de autenticação: confirmação `01a13b55-ea32-72cf-93ee-8677e2f0c3dc`; primeira recuperação `01a13b57-a79f-7af3-b10b-46552a029f4b`.

Para executar, gerar build com variáveis de staging e definir `AGENDE_STAGING_ACCEPTANCE=fkpdudnnperufnmdwdlv`, `AGENDE_STAGING_SMTP_READY=1` e `AGENDE_AUTH_TEST_EMAIL` com identidade nova previamente acordada. Rodar `node scripts/staging-auth-email.mjs` num terminal interativo. O operador usa o navegador conectado ou o proprietário opera seu navegador normal. Senha, termos e e-mails ficam na interface; não são passados ao processo ou ao chat. Linhas `scenario_id PASS|FAIL|BLOQUEADO` registram resultados observados; `stop` encerra o servidor. Portas ocupadas e builds produtivos são recusados.

O build Turbopack que antes falhou com Node 20 em execução restrita passou duas vezes com Node 24 no checkout isolado. Isso aponta para o ambiente/runtime; não demonstra uma causa exata do panic anterior. Não houve troca do bundler padrão ou publicação.



## Pendências e decisão de lançamento

Cadastro, confirmação e recuperação estão aprovados funcionalmente em staging, com a identidade final no mesmo perfil Chrome/Edge e com a rejeição segura no navegador sem verificador. Isso não constitui aprovação de produção ou liberação comercial completa. As correções ainda precisam de revisão/merge e validação no ambiente de lançamento autorizado. Não houve deploy ou merge automático.

A renovação automática após prazo real ficou BLOQUEADA por falta de evidência, encerrada a pedido do responsável. Para concluir: manter a sessão real do alias final sem logout/login; provocar navegação após o JWT expirar; observar novo JWT da mesma identidade, cookie persistido e grant `refresh_token` 200. Um login novo não satisfaz o cenário.

Expiração finita da sessão ficou BLOQUEADA pela política atual (prazo/inatividade 0 e campos indisponíveis no plano Free). O teste de JWT de cinco minutos PASS não equivale a logout por prazo da sessão. É necessário decidir a política desejada e autorizar eventual configuração/plano antes de testar essa exigência. O TTL padrão de uma hora foi restaurado; PKCE, confirmação, rotação de refresh e SMTP foram preservados.

Não há FAIL funcional pendente reproduzido na rodada normal. As falhas anteriores do navegador integrado permanecem registradas, com causa de pré-abertura/isolamento não determinada. PR de revisão: https://github.com/plbr010/agende/pull/48 (sem merge).
