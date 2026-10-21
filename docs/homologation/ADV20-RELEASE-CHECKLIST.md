# ADV20 — checklist de publicação proposto

Preparação somente. Usar junto de `docs/production-readiness/prelaunch20-runbook.md`, que contém os escopos A1–A12, incluindo A6b antes de A6. Não executar por inferência de aprovação da PR.

## Antes da janela

- [ ] Aprovar SHA, hashes dos bundles, operador, janela e escopos produtivos exatos. Registrar CI verde no head. Integrar/testar #73 se fizer parte do lançamento; não presumir que esta candidata inclui sua UX.
- [ ] Conferir projeto/ref, TLS verify-full e acesso sem imprimir credenciais; renovar preflight direcionado de catálogo/ACL e parar em drift ou aplicação parcial.
- [ ] A1: backup novo cifrado de banco/Auth/roles e bytes Storage, hashes/autenticidade e cópia independente. Backup antigo com hash correto não demonstra recuperação.
- [ ] A2: restore isolado autorizado, validar dados, catálogo, roles e objetos, medir RPO/RTO. Sem recuperação comprovada, NO-GO. Nenhum restore foi executado nesta missão.
- [ ] A3: pausar criação pública/interna com o script revisado, drenar requisições e verificar ausência de writes; atualizar snapshot final e verificar eventual delta antes de SQL.

## Aplicação autorizada

- [ ] A4/A5: Site URL/redirects e SMTP corretos, confirmação de e-mail mantida, anonymous sign-in desligado. Homologar remetente e callback em contas próprias autorizadas.
- [ ] Regenerar localmente os bundles e comparar manifests aprovados; não usar db push, migration repair ou reaplicar owner guard equivalente.
- [ ] A6b: três legadas em uma transação; conferir exit code/preflight.
- [ ] A6: cinco migrations na ordem revisada, uma transação própria, lock_timeout 5s/statement_timeout 120s; REINDEX não concorrente exige janela. Se a segunda transação falhar, a primeira permanece aplicada. Reservas continuam pausadas.
- [ ] A7: publicar exclusivamente `stripe-webhook` revisado, assinatura obrigatória e guarda LIVE/TEST; não mudar endpoint/secret ou reenviar eventos por conveniência.
- [ ] A8: publicar esta aplicação no SHA aprovado, com backend/env produtivos corretos. **Agora há correções de código ainda não publicadas.** Merge em main é deploy produtivo e exige autorização. Não promover build local de staging/placeholder.
- [ ] Conferir schema, grants, RLS, buckets, índice e definições. Nenhum guest/anon pode gravar; service role permanece server-side. Sem pós-condições, não retomar.

## Smoke e piloto

- [ ] A9: retomar apenas authenticated pelo script revisado e executar os 17 smoke tests do runbook com fixtures novas controladas. Checar signup/confirm/login/refresh/logout, busca, mídia/isolamento, reservas concorrentes, reagendamento/cancelamento, papéis e módulos.
- [ ] Incluir regressões ADV20: cadastro inválido preserva campos; e-mail existente oferece acesso/recuperação; link inválido não confirma; submit da busca antes de hidratar indisponível; perda de resposta manda ao histórico e não afirma sucesso nem repete a mutação.
- [ ] Confirmar preço/duração/status no banco, uma reserva por intenção/slot, nenhuma leitura de outro tenant, nenhuma mensagem WhatsApp automática. Contadores de proteção não devem ser removidos para fazer teste passar.
- [ ] A10: teste negativo de webhook produtivo apenas se autorizado, sem evento financeiro válido. Entrega positiva/ciclo LIVE tem autorização separada por evento/valor/efeito; não executar cobrança por aprovação genérica de QA.
- [ ] Liberar piloto produtivo somente com zero P0/P1 e todos os gates acima. Manter escopo pequeno e contatos de suporte definidos pelo operador.
- [ ] Monitorar erros HTTP/RPC, Auth/SMTP, webhook/deduplicação, reservas, fila de mídia e jobs de entitlement; logs sem PII/credenciais. Estabelecer baseline de latência/capacidade com tráfego representativo, além das três amostras por rota desta missão.
- [ ] Liberar vendas somente após piloto monitorado aprovado e contrato comercial LIVE validado sob autorização própria. Qualquer duplicação, vazamento, falha de acesso ou recuperação não demonstrada mantém NO-GO.

## Contenção e rollback

- [ ] A11: se falhar, suspender/drenar novamente; identificar deployment/fonte exatos autorizados para rollback ou fix-forward. Manter SQL aditivo e grants seguros. Não reabrir anon, não remover RLS/colunas/tabelas e não apagar histórico.
- [ ] Se rollback de app reintroduzir falhas corrigidas, manter reservas fechadas até correção. Nunca interpretar promoção de app como rollback do banco ou de eventos Stripe.
- [ ] A12: restore produtivo somente em desastre confirmado, com ponto/arquivos e nova aprovação, avaliando perda de writes e reconciliação Stripe. Não há restauração automática no plano.
