# Entrega da Fase 2 — 14/10/2026

Branch: `codex/client-phase2-2026-10-14`. Base: main `537fc99`. Produção não alterada; PR separado, sem merge automático.

Backend implementado: favoritos PostgreSQL por cliente, cidade residencial opcional, referência de foto privada em profiles, upload/consulta/substituição/remoção de fotos com Storage privado e validação de imagem, limpeza transacional/leases, rascunho HttpOnly de reserva com retorno após login e revalidação, correção do vínculo de identidade por telefone. Histórico e avaliações existentes reutilizados e homologados entre dois salões.

Contrato completo, parâmetros, autorização, erros e tarefas do Cursor: [client-experience-fase2.md](../codex/client-experience-fase2.md).

## Resultado de testes

| Verificação | Estado | Evidência |
| --- | --- | --- |
| npm run lint | PASS | [log](../homologation/client-phase2-lint.log) |
| npm run typecheck | PASS | [log](../homologation/client-phase2-typecheck.log) |
| npm test: 318 testes | PASS | [resultado categorizado](../homologation/standard-tests.json), [log](../homologation/client-phase2-tests.log) |
| npm run build | PASS | [log](../homologation/client-phase2-build.log) |
| PostgreSQL 17: 19 testes SQL/concorrência + cinco suítes SQL completas | PASS | [resultado](../homologation/native-tests.json), [log](../homologation/client-phase2-pg17.log) |
| Staging Auth/PostgREST: favoritos, duplicação, remoção, persistência, isolamento, perfil e Storage | PASS | [7 casos reais](client-phase2-real-tests.json) |
| Staging: reserva concorrente, histórico em dois salões, snapshots e avaliações | PASS | [4 casos reais](client-phase2-booking-history-reviews.json) |
| HTTP local → staging: foto cliente/profissional, arquivos inválidos, tamanho, troca, exclusão, persistência, leitura privada e CSRF | PASS | [6 casos reais](client-phase2-avatar-http.json) |
| Navegador mobile → staging: login, cookie privado, retorno ao fluxo, horário ocupado durante login | PASS | [3 casos reais](client-phase2-booking-browser.json) |
| Cadastro novo + confirmação por e-mail + retorno ao rascunho na mesma jornada | BLOQUEADO | Contrato next/callback reutilizado; esta entrega não executou uma nova confirmação SMTP nessa jornada |
| Fotos/favoritos/cidade completos na interface do Cursor | BLOQUEADO | APIs prontas; ainda falta conectar/acabar os componentes existentes conforme contrato, sem criar componentes duplicados |
| Upload no Preview Vercel da PR | BLOQUEADO | Binding de SUPABASE_SERVICE_ROLE_KEY exclusivo do servidor precisa ser conferido; secrets não foram alterados |

Os testes locais SQL usam Auth/Storage/Cron sintéticos; mocks de Stripe permanecem identificados. Os 20 casos de staging usam serviços reais; contas/serviços/atendimentos são fixtures. A nova conta de teste foi criada e confirmada pela API administrativa de staging, portanto esse teste não representa confirmação de e-mail/SMTP. Nenhuma cobrança real foi executada.

Falhas intermediárias foram corrigidas e reexecutadas: origem interna do Next no upload; cache de download confundido com catálogo Storage; fixture antiga que unificava identidades pelo telefone; tempo de transição do passo profissional e encoding do cookie no teste do navegador. Os arquivos acima registram os resultados finais. A barreira de rate limit encontrada foi preservada; usou-se nova conta fictícia, sem apagar eventos nem desabilitar limites.

## Estado real do staging após testes

- 11 workspaces originais preservados. Configurações dos dois estúdios fictícios usadas nos testes de publicação/cidade foram restauradas.
- Favoritos dos testes removidos pelas RPCs do próprio usuário. Fotos dos testes removidas pela API. Nenhuma foto preexistente foi substituída.
- Verificação posterior: zero referências de avatar, zero objetos no bucket de avatars, zero itens na fila e zero favoritos de teste remanescentes.
- Novas contas, serviços, atendimentos concluídos e avaliações fictícias ficam em staging. Agendamento temporário de concorrência no navegador foi cancelado, não apagado.
- Migrations efetivas: `20261014173144/client_phase2_profiles_favorites` e `20261014173933/client_phase2_avatar_upload_cleanup`. Correspondem aos arquivos locais `20261014172158_*` e `20261014173903_*`; a ferramenta MCP atribui timestamps próprios.

## Prontidão objetiva

Backend da Fase 2 homologado no staging para os recursos testados. Histórico, reservas concorrentes, avaliações e foto privada têm evidência de persistência/autorização real. **A Fase 2 completa ainda não está pronta para uso comercial** enquanto faltarem integração das telas pelo Cursor, aceite de cadastro/confirm-email com rascunho e configuração/verificação do servidor do Preview.

Próximas tarefas são de integração/aceite, não migrations produtivas: conectar FavoritesPanel/ClientHome, campo de cidade e AvatarImage ao contrato; finalizar galeria/câmera/recorte; conferir credencial exclusiva do servidor no ambiente staging; homologar cadastro com callback de e-mail. Publicação de fotos profissionais/avaliações permanece separada da conta privada e requer consentimento explícito antes de implementação.
