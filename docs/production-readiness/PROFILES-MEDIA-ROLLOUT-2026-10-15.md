# Perfis e imagens: rollout preparado, não autorizado

Nenhuma migration, configuração de Auth, secret, cobrança, DNS, merge ou deploy produtivo foi executado nesta rodada. O snapshot produtivo é somente leitura. Não redefinir senha de banco.

## Estado e dependências

[Snapshot consultado](../staging/profiles-infrastructure-20261015.json): produção continua com 63 versões registradas, até `20260927005815`; não tem `profiles.residence_city`, `profiles.avatar_path`, `workspace_settings.cover_path` nem bucket `account-avatars`. O bucket público `workspace-logos` existe. A listagem de variáveis Vercel não contém binding Production de `SUPABASE_SERVICE_ROLE_KEY`; valores produtivos não foram solicitados.

O [plano por arquivo/hash](./profiles-migration-plan-20261015.json) lista **dez arquivos pendentes**: os oito anteriores, mais as duas migrations desta rodada. Há uma versão remota histórica sem arquivo local (`hardening_snapshot_owner_timezone`); não executar `db push`, renumerar histórico nem `migration repair` por inferência. Revisar definições e o [procedimento anterior](./FINAL-ROLLOUT-2026-10-15.md).

1. `20260927014947_launch_readiness_reviews.sql`.
2. `20261008131859_launch_hardening_reviews_force_rls.sql` depende de 1.
3. `20261009172028_launch_observed_owner_guard.sql`.
4. `20261009173042_billing_reconcile_excess_seats.sql`: revisão/autorização próprias; não executar rotinas de reconciliação nem alterar Stripe LIVE nesta rodada.
5. `20261010232248_atomic_service_professional_links.sql`.
6. `20261014030220_public_workspace_discovery.sql`.
7. `20261014172158_client_phase2_profiles_favorites.sql` depende de descoberta; cria campos, favoritos, bucket privado e fila de avatar.
8. `20261014173903_client_phase2_avatar_upload_cleanup.sql` depende de 7; leases de upload.
9. `20261015054116_workspace_media_and_settings_contract.sql`: capa opcional, fila privada, ciclo de arquivos e restrição de gravação direta do bucket público. Depende de settings/Storage/RPCs de autorização existentes.
10. `20261015054818_workspace_settings_validation.sql`: mantém assinatura da RPC comercial, valida opcionais e impede alteração de imagem pela RPC antiga. Aplicar depois de 9.

As duas novas migrations são reaplicáveis sem remover imagens, referências ou filas; isso foi testado em banco isolado. Não presumir que as oito antigas sejam replay-safe: comparar objetos existentes e aplicar cada versão ausente apenas uma vez. Nenhuma migration histórica foi editada. Em staging, o MCP registrou as novas por nome nas versões `20261015054655` e `20261015054832`; o nome/conteúdo define a correspondência, sem renumerar versões aplicadas.

## Backup recuperável antes de qualquer DDL

1. Aprovar janela, escopo dos arquivos e responsável pela recuperação. Usar credencial **existente** via canal seguro local, não pelo chat; confirmar endpoint/CA, TLS `verify-full` e projeto produtivo.
2. Seguir [FREE-BACKUP-RECOVERY](./FREE-BACKUP-RECOVERY.md) e o wrapper já preparado. Somente após autorização específica, exportar schema, grants/roles, dados e Auth com manifesto/checksums, criptografia e ACL privada fora do Git. Não publicar Vault, JWTs ou arquivos de clientes.
3. Fazer segunda cópia cifrada independente; guardar a frase separadamente. Export anterior que terminou com falha de autenticação não é backup válido.
4. Restaurar em destino **isolado e vazio**, autorizado separadamente. Comparar contagens, FKs, sequências, funções, grants/RLS, ownership e Auth, e medir RPO/RTO. Testes sintéticos e staging não comprovam restauração do backup produtivo.
5. Copiar separadamente os bytes de Storage e inventário de buckets/policies, configuração Auth/SMTP/redirects, fontes e configurações externas. Dump SQL não cobre esses bytes nem a plataforma completa.
6. Sem export recuperável, cópia independente e restauração comprovada, manter DDL produtivo BLOQUEADO.

## Publicação autorizada e verificações

1. Revisar PR e liberar explicitamente DDL/variável/deploy necessários. Não promover build Preview staging para Production.
2. Aplicar a sequência aprovada de migrations transacionais em janela controlada, com limites de lock/statement apropriados. Validar grants e policies depois de cada bloco. Manter referências e histórico existentes; não backfillar identidades por telefone.
3. Autorizar separadamente o binding `SUPABASE_SERVICE_ROLE_KEY`, restrito ao servidor e ao projeto Supabase correspondente. Nunca usar `NEXT_PUBLIC_`; o código rejeita JWT de outro projeto ou papel. Não copiar chave staging para produção.
4. Coordenar migration 9/10 e código novo: o editor antigo de logo não deve continuar ativo durante a troca, porque os uploads diretos ficam negados. Pausar envio de imagens na janela; depois gerar build Production com URL/chave produtivas existentes.
5. Validar cliente sem negócio/assinatura, profissional com trial real elegível, edição e reload, imagens privadas, logo/capa explícitas públicas, troca/remoção e tentativa entre usuários. Cadastros e gravações produtivos precisam de contas/janela autorizadas; não simular sucesso.
6. A assinatura inativa continua bloqueando alterações comerciais. Não renovar trial, forjar status, desabilitar entitlement, alterar LIVE ou cobrar para fazer a homologação passar. Verificar a assinatura da sessão do proprietário antes de atribuir a mensagem capturada a um dos registros expirados.
7. Conferir limpeza: objetos antigos removidos via **API Storage**, nenhuma referência quebrada e filas sem referências ativas. Upload abandonado só é elegível após uma hora; tentativas seguintes de imagem do mesmo estabelecimento processam a fila, com lock e claim que impedem reanexar arquivo em remoção. Monitorar pendências de estabelecimentos sem novas operações e executar manutenção autenticada autorizada; não apagar `storage.objects` por SQL.
8. Inspecionar logs por código fixo de operação, sem payloads/segredos, e respostas HTTP privadas `no-store`. Bytes públicos podem permanecer no cache CDN por um intervalo após remoção; não prometer revogação instantânea de imagens deliberadamente públicas ([Storage CDN](https://supabase.com/docs/guides/storage/cdn/smart-cdn)).

Rollback preferencial: correção aditiva ou reversão de código, preservando schema/objetos e RLS. Não remover colunas/filas/buckets para desfazer o PR. Código antigo não recupera o editor de logo enquanto as policies de normalização estiverem ativas; manter editor indisponível até correção, sem enfraquecer policies automaticamente. Restaurar backup produtivo somente em incidente e com autorização própria.

Parecer: **NO-GO comercial** até as ações autorizadas, backup/restauração e aceite produtivo. O PR entrega código e provas de staging; não desbloqueia sozinho a infraestrutura produtiva ausente.
