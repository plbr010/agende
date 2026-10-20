# Publicação segura — candidata final de 20/10/2026

Estado: NO-GO para piloto com usuários reais e lançamento comercial na produção atual. Homologação em staging não substitui a validação pós-publicação. Não foi executada nenhuma escrita, migration, secret ou publicação em produção nesta missão.

## Antes da autorização

Revisar a PR candidata, seu SHA final e CI. Revisar o SQL completo e comparar catálogo/histórico de produção com staging; existem timestamps divergentes no histórico remoto. Não executar `db push` ou `migration repair` indiscriminados. Confirmar backup/PITR e procedimento de restauração, incluindo Storage. A restauração destrutiva exige decisão separada.

## Operações que exigem autorização explícita e específica

1. Aplicar em produção, nesta ordem de dependência e após preflight, as migrations existentes:
   - `20261015054116_workspace_media_and_settings_contract.sql`
   - `20261015054818_workspace_settings_validation.sql`
   - `20261016075244_profiles_booking_whatsapp.sql`
   - `20261016235000_require_confirmed_public_booking.sql`
   - `20261020162935_launch_discovery_eligibility.sql`
2. Validar funções, assinaturas, grants, RLS, buckets privados e elegibilidade pública. Confirmar que anon não executa criação pública, a confirmação de e-mail é obrigatória e fallback guest está ausente.
3. Confirmar ambiente Vercel do servidor: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` apontando ao projeto correto. Nunca colocar service role no cliente. `NEXT_PUBLIC_SITE_URL` não estava configurada globalmente na auditoria anterior; há fallback de origem validada. Validar origem canônica e redirects de Auth/SMTP antes do release, sem inventar valor ou rotacionar segredo.
4. Autorizar merge/publicação do SHA revisado. Main aciona deploy produtivo; não fazer merge como simples preparação. Confirmar deployment READY e SHA exato. O webhook staging já corresponde ao código; este trabalho não requer uma publicação especulativa de billing em produção.
5. Smoke pós-publicação com contas sintéticas autorizadas: bloqueio anônimo numa vaga válida, confirmação SMTP/PKCE, reserva única, busca, mídia privada e WhatsApp manual sem enviar mensagem. Nenhuma cobrança live sem autorização adicional. Observar erros de API, Storage e webhook; liberar piloto somente após esses gates.

## Reversão e liberação

Separar rollback de aplicação e de banco: publicar frontend anterior não desfaz permissões/schema. Se gates falharem, interromper divulgação e novas reservas por mecanismo previamente aprovado, preservar dados e investigar. Não restaurar banco nem remover dados automaticamente. Após piloto controlado e conciliação de faturamento, decidir o lançamento comercial. Os 90% estimados no relatório não anulam os gates de segurança produtiva.
