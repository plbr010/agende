# Produção — plano seguro de 15/10/2026

**Preparação somente. Nenhuma autorização para aplicar migrations, redefinir senha, modificar Auth/secrets/variáveis produtivas ou Stripe LIVE.** Este documento atualiza o estado operacional sem reescrever os relatórios históricos.

## Estado observado

Supabase `wohimauqgywshbbejjcl`: ACTIVE_HEALTHY, PostgreSQL17.6. Histórico com63 versões, terminando em `20260927005815`; repositório com70 arquivos. Há oito migrations locais ausentes e uma versão remota histórica sem arquivo local. Não executar `db push`, `migration repair` ou marcar versões aplicadas por inferência.

Consulta readonly confirmou ausentes `appointment_reviews`, `client_workspace_favorites`, `save_service_with_professionals(...)` e `search_public_workspaces(...)`. Nenhuma tabela `public`/`app` foi encontrada com RLS desligada; isso não homologa os recursos ausentes. [Inventário e hashes](./final-migration-plan-20261015.json). [Advisors](./final-security-20261015.json).

O bucket `account-avatars` está ausente. O Vault produtivo contém `stripe_webhook_secret`, mas não `stripe_api_key` (somente nomes/contagens consultados). A configuração comercial de billing ainda precisa de revisão e autorização próprias: não copiar a chave TEST para produção. Edge produtivo: webhook v3 e billing v4, este com `verify_jwt=true`; staging: webhook v4 e billing v10. Versões/configurações diferentes não comprovam equivalência de fonte. Comparar e preparar eventual atualização aprovada; não desativar validações por inferência. [Snapshot de infraestrutura](./final-infrastructure-20261015.json).

Em `https://agendeapp.online`, GET `/`, `/login`, `/cadastro`, `/recuperar-senha` retornaram200; GET `/app` e `/cliente` retornaram307 para login e `/api/account/avatar` retornou401 anônimo. São smoke tests somente leitura, sem cadastro/pagamento produtivo. Snapshot Vercel consultado mostrou Production READY em main `de15980`; reconsultar imediatamente antes de qualquer rollout porque o Cursor continua integrando mudanças visuais.

Bindings globais de Vercel Production/Preview/Development compartilham URL Supabase produtiva; somente a branch de homologação ganhou overrides Preview staging. Production não mudou. O guard continua bloqueando produção em Preview/Development; não desativá-lo para fazer deploy passar.

## Backup e ensaio antes de DDL

1. Identificar credencial **existente**, endpoint confirmado no Dashboard e CA correta. Não redefinir a senha do banco. Não colocar credenciais em argv, Git, chat ou transcript. O export anterior terminou `export_failed` na autenticação; não é backup válido.
2. Validar TLS com `verify-full` e CA oficial, sem `rejectUnauthorized:false` ou downgrade. Revisar o config privado já preparado e a documentação [FREE-BACKUP-RECOVERY](./FREE-BACKUP-RECOVERY.md).
3. Depois de autorização específica para export produtivo, usar `scripts/backup-recovery.ps1 -Mode export -ConfigPath <config-privado> -AuthorizedProject wohimauqgywshbbejjcl`. O wrapper solicita senha existente e frase de cifragem em `SecureString`, transmite em memória e grava arquivos cifrados fora do repositório, com ACL privada. Guardar frase separadamente.
4. Verificar autenticação de todos os arquivos/manifesto e manter segunda cópia **cifrada** em mídia aprovada. Registrar horário de corte, tamanho, checksums, cobertura e responsável. Sem cópia independente, perda desta máquina não é recuperável.
5. Depois de autorização específica para restauração local, executar wrapper `-Mode restore -RunPath <execução-privada> -AuthorizedLocalRestore` em destino próprio isolado. Nunca restaurar sobre produção ou staging existente. Comparar fingerprints/tabelas, catálogo, grants/RLS, roles/memberships, sequências, funções e Auth SQL. Registrar RPO/RTO medidos; não extrapolar o selftest sintético de11,396s.
6. Cobrir separadamente bytes dos buckets privados, configuração Auth/SMTP/redirects/signing, Edge sources/secrets e bindings Vercel; `pg_dump` cobre metadados SQL, não essa plataforma inteira. Não publicar Vault ou JWTs em evidências. A máquina de ensaio não dispõe de todas as extensões do Supabase; limitações precisam de validação em ambiente isolado compatível, sem mascarar erros de restore.

O [selftest desta rodada](./final-synthetic-restore-20261015.json) verificou criptografia, adulteração, roles e dados sintéticos; `full_platform_restore_verified=false`. Ele não desbloqueia DDL produtivo.

## Ordem e dependências das migrations

| Ordem | Versão | Dependências e verificação |
|---|---|---|
|1|20260927014947 — launch_readiness_reviews|Base/histórico observado; criar reviews e RPCs, preservar agendamentos e provas de avaliação/conclusão; grants mínimos|
|2|20261008131859 — launch_hardening_reviews_force_rls|1; FORCE RLS, search_path e negativas de escrita direta|
|3|20261009172028 — launch_observed_owner_guard|Snapshot remoto exato de funções/triggers e versão histórica remote-only; recusar definições desconhecidas e preservar último owner|
|4|20261009173042 — billing_reconcile_excess_seats|3 e fundação billing; não excluir membros; downgrade com excesso não pode manter entitlement indevido|
|5|20261010232248 — atomic_service_professional_links|Guards manager/entitlement, locks e índice de vínculos; criação/edição atômica. Rever [preflight da RPC](./SERVICE-RPC-PREFLIGHT.md)|
|6|20261014030220 — public_workspace_discovery|Settings/entitlement existentes; consentimento desligado por padrão, privacidade e busca cidade/nome|
|7|20261014172158 — client_phase2_profiles_favorites|6 e perfis/client_profiles; cidade opcional, favoritos elegíveis, bucket privado, RPCs avatar só service_role, fila de limpeza|
|8|20261014173903 — client_phase2_avatar_upload_cleanup|7; coluna not_before, lease de upload de1h, trigger cancela lease de referência confirmada e limpeza nunca remove foto ativa|

Conferir hashes do artefato aprovado, encoding e finais de linha antes de aplicar. Não editar migrations históricas para forçar concordância. A presença da versão remota `20260919201138_hardening_snapshot_owner_timezone` precisa ser conciliada pelo preflight observado; não inserir/apagar histórico retroativamente.

Preparar transações curtas, timeouts de lock/statement e verificações explícitas por etapa. A ordem acima não autoriza execução de arquivo SQL em branco nem encadeamento cego: parar no primeiro drift, assinatura diferente, dependência ausente ou falha. Registrar histórico de cada migration somente na mesma transação da aplicação aprovada. Revisar conteúdo existente e consequências de reconciliação de billing antes do COMMIT. Não usar bypass RLS.

## Rollout após autorização e recuperação comprovada

1. Fixar commit, artefatos e origens. Reconciliar main/PR do Cursor e rodar checks no resultado final. Conferir mudanças simultâneas de schema/config e suspender operações conflitantes na janela aprovada.
2. Aplicar somente o conjunto autorizado com credencial segura; confirmar objetos, assinaturas, grants, RLS/FORCE, bucket privado, triggers e schema cache. Não considerar COMMIT prova de API funcional.
3. Gerar build **Production** próprio com Supabase produtivo e variáveis aprovadas. Nunca promover artefato Preview compilado com staging. Deploy Edge é separado do deploy Next; comparar versões/código/config existentes antes de eventual publicação explicitamente aprovada.
4. Em janela e identidades aprovadas, provar Auth/email/callback, trial, criação de serviço, equipe, disponibilidade, reserva/agenda, busca/consentimento e fotos privadas. Stripe LIVE exige aprovação separada; testar integração em TEST não autoriza cobrança real.
5. Monitorar erros HTTP/RPC, logs sem segredos, delivery/retries de webhook, assinaturas/entitlements divergentes, filas de limpeza de avatar e latência. Checklist final deve ter responsáveis e critérios de parada/GO objetivos.

Antes do COMMIT, falha implica rollback da transação. Depois, preferir correção aditiva revisada e app compatível; rollback de aplicação não reverte dados nem contratos externos. Restore/PITR produtivo exige nova autorização específica, destino/corte confirmados e plano para conservar gravações após backup. Nunca apagar dados ou restaurar indiscriminadamente para voltar a um estado antigo.

**GO somente após** backup real recuperável, migrations/configuração aprovadas aplicadas e verificadas, jornada produtiva autorizada e critérios operacionais aceitos. Até lá: **NO-GO comercial**.
