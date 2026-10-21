# Missão final P0 — 21/10, preparação de 22/10

**Piloto: NO-GO. Vendas: NO-GO.** Main `67848db03544d6675c3593260d08711178183df5`, PRs #75/#76 integradas, CI [PASS](https://github.com/plbr010/agende/actions/runs/39551405792). Domínio produtivo confirmado nesse SHA, Vercel READY `dpl_HAFcxDMiDtDDDTqteidiyFbyPSkm`. Não foi executada publicação nesta missão.

## 1. O que foi resolvido

- Confirmados deploy/CI da integração, sem repetir auditoria geral de todo o produto.
- Senha do backup recebida apenas em janela local oculta; manifest HMAC e todos os componentes AES-GCM do backup mais recente autenticados/descriptografados. Antes havia somente checksum do ciphertext.
- Executado ensaio real isolado: localizada falha de grants de roles gerenciadas (ADMIN OPTION). Probe local com grantor remapeado recuperou os dados e passou fingerprints, mas **falhou no catálogo**. Não foi promovido a PASS e o caminho final continua estrito, sem remapeamento/erros ignorados. Clusters temporários parados/removidos e arquivo original preservado.
- Pipeline de recuperação agora registra fase, categoria sanitizada e falhas por tentativa, sem expor stderr/linhas/credenciais nem mascarar a falha original por arquivo de erro já existente.
- Confirmados no Resend domínio verificado e remetente existente com entrega; configuração SMTP concreta preparada, sem inventar endereço.
- Bundles 3+5 regenerados offline e hashes inalterados; novo ensaio nativo PG17 aprovado, sem DDL produtivo.
- Fixtures QA podem ser selecionadas explicitamente sem sobrescrever contas anteriores; readback verifica também tentativa bloqueada com zero reservas. Classificação futura distingue rate-limit observado de erro inesperado.
- Branch `codex/production-unblock-20261022` com deploy automático desabilitado. Sem alteração de produto do Cursor.

## 2. Bloqueios restantes

1. Recuperação completa e recente de PostgreSQL/roles/Auth/Storage em destino compatível, mais cópia independente. A tentativa real não passou; não há RPO/RTO produtivos aprovados.
2. Auth produtivo ainda em localhost/sem redirects/sem SMTP próprio; Resend pronto para envio, mas conexão produtiva e entrega PKCE/recovery precisam ser autorizadas e testadas.
3. Oito migrations produtivas pendentes; RPC ainda executável por anon e gate confirmado/sem guest ausente. Nenhum agendamento produtivo foi criado para testar isso.
4. Edge webhook produtiva v4 ainda anterior aos guards de modo/logging da main; exige publicação específica autorizada, além do Next.
5. Aceite Stripe LIVE positivo e decisão comercial pendentes. TEST e chave/endpoint configurados não substituem esse aceite.
6. Jornada UI cloud completa desta rodada ficou bloqueada por quota de rate-limit do ambiente local compartilhado; não desativamos proteção nem apagamos contadores. Repetir após recuperação natural da quota; prova anterior completa permanece datada, não reclassificada como teste novo.

## 3. Backup

Arquivos de 16/10 em raiz privada `AgendePrivateRecovery`: dois conjuntos, quatro componentes cada, todos com tamanho/SHA-256 válidos. O mais recente foi autenticado com a senha correta. Strict restore falhou em roles; diagnóstico parcial avançou até dados recuperados/fingerprints iguais, mas catálogo divergente. Não há prova de grants/grantors/catálogo integralmente iguais. Essa diferença não foi escondida por filtragem de metadados.

O dump completo contém PostgreSQL; core ensaiável cobre app/public/auth/extensions/migrations, com dados de usuários, estabelecimentos, clientes, reservas, assinaturas e histórico nas tabelas exportadas. Bytes Storage, serviços Auth/SMTP/Edge e credenciais externas não são restaurados por esse core. `restore_verified=false`/`full_platform_restore_verified=false` permanecem nos manifests originais. Selftest sintético passou, incluindo senha errada e manifest/arquivo adulterados rejeitados; seu tempo de 10,253s não é RTO de produção. Evidência: `p0-final-backup.json`.

Procedimento novo SQL + Storage + cópia/restore compatível preparado em `P0-FINAL-OPERATIONS.md`. Nenhum novo export produtivo, upload a terceiro, restauração produtiva ou contratação ocorreu.

## 4. Auth/SMTP

Painel reinspecionado em leitura: Site URL localhost, redirects vazios, SMTP off, confirmação ligada, anonymous sign-in off e provider e-mail ligado. Resend: domínio `agendeapp.online` Verified, envio ligado, DKIM/SPF verificados; DMARC DNS presente p=none. Remetente existente observado: `no-reply@agendeapp.online`, nome Staging no histórico. Proposta produtiva: endereço existente, display name Agendê, host smtp.resend.com/465 TLS, usuário resend e API key autorizada via campo seguro. Nada salvo. Valores, fontes e o que falta: `P0-FINAL-SMTP.md`.

PKCE, sanitizer de next, recuperação e sessões foram revistos no código; 16 testes focados PASS. Não houve envio Auth produtivo de teste nesta missão. Domínio verificado não prova caixa postal para receber respostas ou credencial produtiva disponível.

## 5. Migrations

Produção reconfirmada com 67 entradas; staging 22 de provisionamento, incluindo timestamps diferentes. Ordem de execução: três legadas (`launch_readiness_reviews`, `launch_hardening_reviews_force_rls`, `billing_reconcile_excess_seats`), depois cinco principais (`workspace_media_and_settings_contract`, `workspace_settings_validation`, `profiles_booking_whatsapp`, `require_confirmed_public_booking`, `launch_discovery_eligibility`).

Manifests/bundles continuam idênticos: SHA-256 legado `89c60bad3dfac048ac962dda2f9cf8bc3e75fac58791296d85d5a520f6010bc8`; principais `06fbff8c01f37211019aa0b29276b87065930173d27fee21925363d4a904be6b`. Teste modela o schema observado com dados sintéticos existentes, recusa falta de autorização/dependências/replay e confirma 3+5 com preservação de dados, pausa e retomada authenticated. Não é restauração de produção. Locks/REINDEX/duas transações e rollback descritos no plano. Não executar owner guard equivalente/repair/db push para igualar histórico.

## 6. Segurança e Stripe

Staging passa catálogo de ACL/gate confirmado/ausência de guest. Nativo verifica RLS, limites e fotos/WhatsApp; concorrência cloud atual: exatamente um commit e um 23P01 entre dois usuários. Evidência de fotos privadas/isolamento/permissões e WhatsApp manual da jornada anterior continua válida para os contratos backend preservados; não foi repetida como nova homologação integral nesta rodada.

Stripe TEST: leitura atual dos seis checkouts mensais/anuais, invoices, subscriptions e endpoint PASS. Quatro negativos atuais de webhook PASS, zero alteração nas seis assinaturas e zero evento indevido. Trial/portal/cancelamento/idempotência já possuem provas anteriores e testes da suíte; não criamos novas cobranças TEST nesta rodada. LIVE: fonte produtiva v4 ACTIVE/verify_jwt=false reinspecionada; faltam guard event.livemode e guarda de chave/mode, e há logging bruto de erro na fonte antiga. Nenhuma chave revelada/alterada; nenhum replay financeiro/cobrança LIVE.

## 7. PASS / FAIL / BLOCKED

| Estado | Resultado |
|---|---|
| PASS | 26 testes PG17: 16 SQL, 10 concorrência, cluster encerrado; `../homologation/p0-final-native-tests.json` |
| PASS | 16 testes Auth/recovery focados; lint zero erros/dois warnings antigos; typecheck; build staging |
| PASS | Concorrência real GoTrue/PostgREST (1 vencedor/1 conflito), auditoria Stripe TEST, quatro negativos webhook |
| PASS | Readback: zero reservas na última tentativa bloqueada, serviços novos arquivados, horários novos ausentes e settings restaurados |
| PASS | Selftest sintético criptografado export/restore; autenticação/descriptografia do backup real; hashes/tamanhos dos oito componentes |
| FAIL | Restore real estrito de roles; probe de compatibilidade falhou na comparação de catálogo; não resolvido |
| FAIL preservado / causa BLOCKED | Dois runners de jornada terminaram em timeout na confirmação; screenshot mostrou `booking_rate_limited`. Quatro grupos prévios passaram em cada tentativa. Full journey não aprovado nesta rodada |
| BLOCKED | Recovery completo/Storage/cópia independente; configuração e operações produtivas não autorizadas; aceite financeiro LIVE |

A CI da main já passou instalação limpa, audit, 422 testes, build/smoke e E2E isolado após #75/#76. CI da nova PR deve validar o SHA final; não misturar a aprovação da main com o novo head. Falhas históricas e limites dos testes são mantidos nos artefatos, sem PII/tokens.

## 8–11. PR, execução, autorizações e decisão

SHA/PR finais constam da descrição da PR e da entrega ao usuário. Plano operacional revisável: `P0-FINAL-OPERATIONS.md`, com ambiente, operação, risco, backup/recuperação e verificação de cada autorização A1–A9. A1/A2 são os próximos gates; não há autorização implícita de SQL, secrets ou deploy. Fonte Next necessária já está publicada; nova PR de tooling não exige merge imediato.

**Piloto NO-GO:** recuperação, Auth/SMTP, schema e webhook produtivos ainda não aprovados. **Vendas NO-GO:** os mesmos gates e aceite LIVE. Urgência de 22/10 não autoriza remover gates. Nenhuma alteração produtiva, merge, deploy, cobrança real, enfraquecimento de RLS ou exclusão de dados reais foi executada.
