# Cadastro de serviços — diagnóstico e correção preparada

Consulta em 12/10/2026 (horário local). Produção não foi alterada.

## Causa comprovada

O domínio agendeapp.online está associado ao projeto Vercel agende, deployment production READY dpl_ES3wnrVX5HS2q7tv1ZNHS8422wSu, commit f0ad7ec21d7f5f8bbab97ee7378879c547b78232 (merge PR30).

A variável NEXT_PUBLIC_SUPABASE_URL aponta para https://wohimauqgywshbbejjcl.supabase.co. A chave pública está configurada; nenhum valor de chave foi publicado. As duas variáveis continuam compartilhadas com Preview/Development, um problema separado de isolamento. NEXT_PUBLIC_SITE_URL não apareceu no inventário consultado; existe fallback para host Vercel. Não alterar essas configurações para corrigir a RPC.

saveServiceAction em src/lib/catalog/actions.ts valida campos, sessão confirmada, membership e papel owner/admin; chama somente save_service_with_professionals com tenant derivado da sessão. A mensagem relatada é retornada exclusivamente para PGRST202 (contrato não encontrado no cache PostgREST) ou 42883 (função inexistente). Erros de RLS/permissão seguem outra mensagem.

Consulta pg_proc em produção: **zero** funções save_service_with_professionals em public/app. Histórico: migration 20261010232248 ausente. Portanto não é apenas cache desatualizado: o objeto não existe no banco. app.lock_workspace_membership(uuid), dependência declarada, existe e usa advisory lock + lock da linha do workspace. services e professional_services mantêm RLS e FORCE RLS. O schema não acompanhou o deploy da aplicação.

Staging possui a RPC pública, com SECURITY DEFINER/search_path vazio, EXECUTE para authenticated e sem EXECUTE anon. A implementação app não é executável diretamente por authenticated/anon. A autorização é interna; SECURITY DEFINER não significa acesso irrestrito.

Não submetemos formulário nem chamada de escrita em produção. O diagnóstico combina o ramo exato da mensagem no código, deployment/binding atual e catálogo SQL real. Sem sessão do usuário, não alegamos reprodução de sua requisição HTTP nem ausência de outros problemas após corrigir o contrato.

## Correção segura existente

Aplicar a fonte exata supabase/migrations/20261010232248_atomic_service_professional_links.sql (SHA256 d13be7931bf92be45ef754858d4642881186f5bd8f9ce8a0d5f919419e5c0b37), sem alterar migrations publicadas ou criar fallback de INSERTs separados. A função valida gestor, profissionais ativos do mesmo tenant, inputs e entitlement pelos guards; serviço/vínculos são transacionais; mantém overrides e não exclui registros. NOTIFY pgrst recarrega schema ao concluir a transação.

Antes de aplicar: comprovar backup/restauração; comparar definições atuais das dependências/guards; conferir hash do commit aprovado; revisar migration/history e obter aprovação específica para produção. As outras quatro migrations pendentes continuam no plano geral; não executar todas implicitamente para resolver esta falha.

Execução proposta somente após autorização: transaction com lock_timeout=5s, statement_timeout=60s, SQL exato via mecanismo que registre fielmente a migration, verificação de catálogo/grants, commit. Se função já existir ou schema divergir, parar e comparar; não usar db push/repair genérico nem DROP em produção. Após commit verificar exposição PostgREST e efetuar criação/edição sintética apenas se explicitamente autorizadas. Falha antes do commit: rollback. Após commit: correção aditiva revisada; não apagar serviços/vínculos.

## Testes isolados

Regressão acrescentada: no banco sintético retirar somente as duas funções, reproduzir função inexistente sem gravar serviço, aplicar arquivo exato, criar serviço/vínculo e manter bloqueio anônimo. DROP existe somente no teste, nunca no roteiro produtivo. Testes já existentes verificam owner/admin, profissionais/receptionist, outros tenants, preservação de overrides e rollback após falha do vínculo.

Teste da server action ampliado para PGRST202 e 42883, garantindo que ambos retornam indisponibilidade sem fallback parcial. **14 testes PostgreSQL17.6 PASS** (três de catálogo e 11 de integração com Auth simulado), cinco suítes SQL PASS; **três testes da server action PASS**. Cluster local parado. A migration exata restabeleceu serviço/vínculo no ensaio; isolamento, autorização e rollback passaram. Backend da aplicação não precisa mudar para resolver a ausência do contrato; não foi alterado frontend. Testes locais não constituem aceite pós-aplicação produtiva.

Lint dos arquivos alterados e TypeScript --noEmit: PASS. Evidências específicas em service-native-results.json e service-native-runtime.json; evidências da rodada anterior preservadas.
