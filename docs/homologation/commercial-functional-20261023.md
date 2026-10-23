# Auditoria funcional comercial — 23/10/2026

Base: origin/main a3923c4; branch codex/commercial-functional-20261023. Produção não acessada nesta auditoria; sem migrations remotas, deploys, alteração de secrets, cobranças LIVE ou reativação de reservas.

## Resultado por jornada

| Jornada | Evidência atual e limite |
| --- | --- |
| Cadastro e confirmação do salão | PASS no GoTrue staging: signup gerado para identidade sintética, verifyOtp real e login por senha. Login não confirmado rejeitado. Link gerado por admin de staging, sem envio SMTP; não é nova prova de entrega de e-mail. SMTP já possuía evidência anterior. |
| Onboarding/trial | PASS na RPC real de staging: salão novo, status trialing, intervalo persistido de exatamente sete dias. Server Action de onboarding coberta por integração local. |
| Serviços, profissionais e horários | PASS no staging: perfil de atendimento do proprietário, vínculo ao serviço, preço/duração e jornada persistidos. Convites e papéis de equipe cobertos por SQL/local, não por novo convite de e-mail. |
| Agenda | PASS: reserva aparece na consulta autenticada do salão e conflita com outra reserva concorrente; Server Actions integradas ao SQL local. Gestão visual autenticada não foi repetida no navegador nesta rodada. |
| Cadastro/login de cliente | PASS: token signup verificado no GoTrue real e login posterior. Sem simular entrega SMTP. |
| Busca | PASS: staging retorna salão recém-publicado por cidade e por nome e catálogo com profissional habilitado. Consulta adicional somente leitura confirmou busca pelo nome do profissional retornando salão sintético. Navegador isolado cobre busca, geolocalização, mobile e estados vazios; não equivale a busca remota integral pelo navegador. |
| Agendamento confirmado | PASS: cliente real de staging, reserva vinculada, rejeição anônima e concorrência com um vencedor. SQL local também cobre identidade não confirmada e isolamento. |
| Cancelamento/reagendamento | PASS nas RPCs reais: mantém ID, muda horário, cancela com status cancelled e devolve slot à disponibilidade; terceiros são rejeitados. Defeito visual corrigido neste PR, com cinco regressões. |
| Isolamento entre salões | PASS: segundo proprietário não lê serviços/reservas do primeiro nem cancela/reagenda atendimento alheio. Matriz SQL/local cobre papéis adicionais. |
| Checkout TEST/retorno/assinatura | PASS de reconciliação somente leitura em 23/10: seis Checkouts TEST existentes completos/pagos, invoices pagas, subscriptions ativas e aplicação correspondente. Retorno e modo cobertos pelos testes locais. Não houve nova conclusão interativa de Checkout nem retorno de navegador desde Stripe nesta rodada. Não comprova entrega LIVE. |

## Correção concreta

Reagendamento podia ficar em "Buscando horários..." indefinidamente sem profissional atribuído; também consultava profissional removido do catálogo do serviço. A interface agora solicita escolha explícita válida, impede a consulta inválida e mostra orientação quando não existe profissional elegível. Não escolhe outro profissional automaticamente, não muda preço, autenticação, RLS ou SQL.

Três casos falharam antes da correção. Cinco regressões passam depois, incluindo seleção explícita seguida de revisão do slot.

## Verificação

- Checkout limpo, Node 24.19.0: build e typecheck aprovados; lint sem erros, duas advertências preexistentes em geradores de rollout.
- Suíte completa: 442 testes aprovados (inclui quatro regressões iniciais); quinta regressão adicionada e conjunto de cinco executado com sucesso depois, sem nova mudança de comportamento.
- Navegador Edge isolado: 14 PASS, zero FAIL/BLOQUEADO. Frontend compilado com URL/chave fictícias, sem backend real; não anunciar esses testes como E2E externo.
- Staging fkpdudnnperufnmdwdlv: sete grupos funcionais aprovados, usando GoTrue e PostgREST reais; fixtures sintéticas mantidas somente no staging. O roteiro não modifica fixtures anteriores, permissões ou schema e não exclui dados.
- Falhas iniciais do roteiro foram corrigidas: configuração deve usar update_workspace_settings; paginação de busca aceita até 50; estado de cancelamento é cancelled. Essas foram suposições erradas do teste, não defeitos do produto. Nenhuma permissão foi relaxada.
- O checkout original contém cópias Deno operacionais congeladas em ops/, fora de Git, que interferem no typecheck/lint. Permaneceram intactas. Validação de aplicação realizada em checkout limpo para não misturar artefatos operacionais com código Next.

## Bloqueios restantes e menor sequência de piloto

1. Durante instalação limpa, npm reportou avisos novos para Next 16.3.8. O aviso de DoS em Server Actions é aplicável ao padrão usado pelo app e exige upgrade segundo fornecedor. Correção preparada no PR #83 (Next/eslint-config-next 16.4.2), com build, typecheck, 438 testes e 14 cenários de navegador aprovados; audit de dependências de produção zerado. Foi incorporada à branch funcional, sem merge em main nem deploy produtivo. O aviso de imagem tem mitigação sharp>=0.35.5 já fixada no projeto; não afirmar RCE comprovada no Agendê.
2. Revisar e integrar a correção de reagendamento e a atualização Next após CI. Publicação produtiva exige decisão separada.
3. A entrega autêntica Stripe LIVE v5 continua pendente do suporte/elegibilidade ou de alternativa aprovada; aprovação TEST não substitui essa evidência.
4. Após preview atualizado, concluir uma passagem assistida pelas telas autenticadas com confirmação por e-mail e retorno de Checkout TEST no navegador. As provas por API e reconciliação desta rodada não substituem essa passagem visual completa.
5. Somente após as evidências e aprovações anteriores, apresentar SQL exato de reativação restrita das reservas (preservando conta confirmada/RLS/isolamento) para autorização específica. Não executar nesta auditoria.
6. Iniciar um único salão piloto com responsável, critérios de interrupção e monitoramento. Contratação LIVE real, se necessária, exige aprovação delimitada e teto total previamente conferido; não simular pagamento com cartão real em produção.

Fontes dos avisos: https://github.com/advisories/GHSA-p3m5-59mp-jv5r ; https://github.com/advisories/GHSA-2464-fhr4-w9xw ; https://github.com/advisories/GHSA-673q-mjm6-r5xr .
