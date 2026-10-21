# Finalização autorizada — 21/10/2026

**Cadastro/Auth produtivo validado. Cópia recuperável dos dados/arquivos comprovada no escopo abaixo. Reservas e vendas ainda NO-GO.**

Main/produção observadas: `947cd17af51e6d602accf27b9978379b12144949`, CI verde, Vercel READY `dpl_27DQ2ZKvf4PhwJRGKkGLhAQg8Vrf`. Esta missão **alterou Auth/SMTP com autorização**, criou contas QA e executou backup somente leitura. Não aplicou migrations, mudou permissões críticas, publicou Edge/app ou realizou operações financeiras. O proprietário informa que as contas anteriores são de teste; todas foram preservadas.

## Concluído

- Supabase Auth produtivo salvo: Site URL `https://agendeapp.online`; redirects exatos `/auth/callback` e `/auth/recovery`; sem wildcard. Confirmação obrigatória mantida.
- SMTP Resend habilitado com host `smtp.resend.com`, porta 465, usuário `resend`, remetente **Agendê <no-reply@agendeapp.online>**. O proprietário criou a chave `agende-production-smtp` em formulário preparado com Sending access restrito ao domínio, inseriu-a diretamente no Supabase e salvou. O agente não leu nem armazenou a chave completa. Persistência e entrega real confirmadas.
- Produção: signup recusa login antes da confirmação; e-mail recebido no Gmail QA, PKCE no navegador original chega a `/cliente/perfil?inicio=1`, sessão sobrevive reload; token usado é recusado; recovery entregue altera apenas a senha da nova fixture, senha antiga é recusada; novo login/reload e logout reais passaram. São seis verificações agregadas na mesma fixture final, com continuação do teste de sessão em execução separada (`auth21-production-auth-summary.json`).
- Backup novo SQL + Storage privado cifrado com AES-256-GCM, manifest autenticado, snapshot **21/10 às 03:47:21 BRT**. Exportação concluída às 03:52:06 BRT. Arquivos em raiz privada C: e cópia verificada em **outro disco físico D:**, com ACL exclusiva do proprietário. Dez arquivos copiados/hash conferidos; nenhum envio a terceiro.
- Ensaio de recuperação de dados em PG17 isolado: **62 tabelas**, todos os fingerprints de conteúdo iguais; estrutura lógica, constraints, triggers, funções, RLS/políticas e sequência comparados. **3 objetos dos 2 buckets** descriptografados, materializados no destino privado e bytes/hash conferidos. Cluster parado e dados temporários removidos. Evidências `auth21-data-restore-evidence.json` e `auth21-independent-copy.json`.
- Corrigida checagem TLS do exporter: verifica o socket TLS real do cliente com CA/hostname, em vez de confundir a conexão interna do pooler em `pg_stat_ssl` com o cliente. Mantém `verify-full` no pg_dump e fecha conexões em erro.
- Corrigida comparação de recuperação: pg_dump remove lacunas de números físicos de colunas antigas. Compara ordem **lógica**, nomes/tipos/defaults e demais contratos; ordena roles de policies sem alterar expressão ou escopo. Testes recusam troca de coluna/tipo ou política permissiva. Nenhuma tabela/grant de produção alterada.
- Preparada correção de código para um 500 transitório observado após troca PKCE bem-sucedida: falha no carregamento de sessão leva a tela neutra de retomada/login, sem expor erro, afirmar confirmação por query string, reusar link consumido ou abrir acesso protegido. Cookies/jornada são mantidos. **Correção ainda não publicada**; depende do SHA/CI e aprovação de deploy.

## Limites do backup e falhas preservadas

O modo de ensaio é **data_recovery_only**, separado do modo estrito anterior. Recria apenas nomes de roles locais NOLOGIN, restaura core sem owners/ACL e compara dados/estrutura. O arquivo cifrado completo e o dump original de roles/grants continuam preservados. **Não comprova restauração exata de permissões/owners/grantors gerenciados, login no serviço GoTrue, serviços Storage/Edge nem disaster recovery completo da plataforma.** Os campos `source_security_metadata_restored` e `full_platform_restore_verified` são false; não foram convertidos em PASS.

O escopo proporcional comprovado é recuperação dos dados e bytes necessários a um incidente, com reconstrução/reconciliação de configuração/permissões em destino compatível conforme plano próprio. Restauração produtiva segue proibida sem autorização específica. A cópia D: protege contra falha de um disco; ambas estão no mesmo computador, **não são offsite**. O tempo de 13,826s mede somente o ensaio local de dados, não RTO integral de produção.

O snapshot é pontual: testes Auth posteriores criaram/alteraram apenas fixtures próprias. Antes do SQL, drenar writes, conferir inventário/deltas e renovar backup se houver dados relevantes posteriores. Não alegar RPO zero ou que a cópia inclui writes futuros. Senha de cifragem fica com o proprietário, separada dos arquivos.

Houve um callback 500 real por leitura transitória de sessão e erros do harness ao esperar `/cliente` em vez do perfil inicial, e `Sair` global em vez de `Sair da conta` no perfil. Logs/evidências anteriores permanecem identificados; não são reclassificados como PASS. A jornada SMTP/PKCE/recovery e a continuação login/logout finais passaram. Foram criadas **três contas QA**, nenhuma apagada e nenhuma conta que já existia antes da missão teve senha alterada. A nova proteção de callback tem quatro testes comportamentais e um E2E local; não foi simulada como se já estivesse publicada.

## Testado

- **431 testes padrão PASS**, zero falhas/skips: unidade/contratos, PGlite/integração com identidade simulada, 16 Stripe mocks e mocks de plataforma. Inclui criptografia/adulteração/chave errada/Storage e comparação estrutural, além de recuperação do callback/PKCE.
- **14 E2E isolados PASS**, incluindo a nova tela pública de retomada sem falso sucesso. Backend sintético; não equivale a produção.
- Lint zero erros (dois warnings preexistentes), typecheck, build e smoke locais PASS; CI final da PR deve aprovar instalação limpa e execução Linux no SHA entregue.
- Concorrência cloud de staging atual PASS: dois usuários confirmados disputam um slot, um commit e um conflito 23P01; histórico preservado e recursos temporários tratados.
- Bundles 3+5 regenerados offline, hashes mantidos; ensaio PostgreSQL 17 isolado do upgrade revisado executado novamente. Nenhum SQL produtivo de alteração.
- Produção Auth: seis verificações finais PASS, zero reservas, cobranças ou exclusões de conta. Sem SMTP fictício/confirmar administrativamente o e-mail para passar.
- Stripe TEST e contratos continuam nas evidências anteriores. Código do webhook não foi alterado nesta missão; seus guards revisados ainda precisam ser publicados em produção. Não houve nova transação Stripe nem teste financeiro LIVE.

## Falta / decisão

Produção permanece com **67 migrations** e RPC de reserva executável por anon. Portanto, Auth corrigido **não resolve o bypass no banco**. Faltam pausa aprovada, três legadas e cinco principais, pós-checks de RLS/grants, publicação da Edge revisada, aprovação de deploy da candidata, smoke controlado e retomada authenticated. Stripe LIVE ainda precisa de aceite positivo de cobrança/assinatura com autorização financeira específica; TEST não basta para vendas.

Plano exato e hashes: `AUTH21-APPROVALS.md` e `auth21-operation-hashes.json`. A1/A2 já foram autorizados e executados no escopo descrito, sem pedir nova autorização para o mesmo trabalho. As próximas operações críticas são independentes; não executá-las por inferência.

**Piloto: NO-GO até SQL, segurança, smoke e retomada aprovados. Vendas: NO-GO até os mesmos gates e pagamento LIVE validado.** Não há liberação comercial nesta missão.
