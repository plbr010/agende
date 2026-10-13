# Staging de menor custo — 11/10/2026

Preferência expressa: nenhum plano pago, contratação ou cobrança autorizados. Produção permanece isolada. Não criar recurso remoto nem alterar bindings neste passo.

## Verificação

Consulta read-only da organização `vknkolqntkxbagibgflk`: plano `free`, tier `tier_free`. Inventário: Agendê ACTIVE_HEALTHY; PetGestor INACTIVE, produto distinto, não reutilizar. Nenhuma branch disponível. Há aparente capacidade para um segundo projeto ativo; a quota final de projetos Free do usuário deve ser confirmada antes da criação, considerando outras organizações/projetos eventualmente não visíveis.

[Preço oficial Supabase](https://supabase.com/pricing): Free **US$0/mês**, até dois projetos ativos, banco500MB, RAM500MB compartilhada, 50.000 MAUs, storage1GB e egress5GB. Pausa após uma semana de inatividade; sem backups automáticos/PITR/branching. Esses limites parecem suficientes para dois salões sintéticos e homologação funcional, não carga/HA/recuperação de produção. Não foi identificada necessidade de plano pago para staging nesta etapa.

O plano é da organização, não de cada projeto: manter staging em organização Free, sem converter produção ou a organização para Pro. O MCP de cotação get_cost continua sem cotação disponível; não substituir uma confirmação de cobrança por uma suposição. A criação só poderá avançar com confirmação Free/US$0 e aprovação explícita, abortando se aparecer valor/plano pago.

Se no futuro houver justificativa objetiva para pago, apresentar nova proposta. Referência pública, **não cotação autorizada**: Pro US$25/mês, primeiro Micro coberto por US$10 de crédito; Micro adicional US$10/mês em mês completo, cobrado por hora; uma organização Pro com dois Micro resulta em referência de US$35/mês antes de impostos/excedentes/add-ons. Não há motivo demonstrado para assumir esse custo agora. Limites Pro incluem8GB de disco e250GB egress, mas não são necessários para nossas fixtures mínimas. A fatura exata depende do cenário e precisa ser verificada antes de qualquer aprovação.

Limitação específica de segurança: [proteção de senhas vazadas gerenciada pelo Supabase](https://supabase.com/docs/guides/auth/password-security) está disponível apenas em Pro ou superior. Free permite homologar Auth funcional, mas não comprovar essa feature gerenciada. Esse gate fica explicitamente pendente; não desligar requisito de segurança nem contratar Pro por conta própria. Se o responsável exigir teste dessa feature no staging hospedado, a justificativa do pago será essa disponibilidade, não tamanho de fixtures.

E-mails: [SMTP padrão](https://supabase.com/docs/guides/auth/auth-smtp) envia apenas para endereços dos membros da organização. Para contas fictícias fora dessa lista, staging hospedado precisa de SMTP controlado próprio (configuração suportada no Free, custo do provedor separado não presumido). Pro não dispensa SMTP próprio. A caixa local permite confirmar geração/links sem entregar mensagens externas; não declarar entrega real aprovada com base nela.

## Caminho local, sem cobrança Supabase

A [stack CLI local](https://supabase.com/docs/guides/local-development/cli/getting-started) oferece PostgreSQL, GoTrue, PostgREST, Storage e caixa de e-mails de teste no próprio computador. Não é necessário login/link de produção. Utiliza recursos e download de imagens do computador; não pressupor licença comercial gratuita de qualquer runtime particular.

Neste host: Docker/Podman/Supabase CLI/Stripe CLI não encontrados; WSL reporta não instalado. Não instalar WSL, runtime ou reiniciar Windows automaticamente. O PostgreSQL portátil já disponível permite SQL/concurrency, mas não substitui GoTrue/PostgREST/SMTP.

Preparação concluída: config existente PG17, API54321, banco54322, Studio54323, caixa local54324, confirmação de e-mail habilitada. Acrescentados redirects exatos `/auth/recovery` para localhost e127.0.0.1, que faltavam. Não há mudança remota.

Após disponibilizar runtime local aprovado e CLI pinada/verificada com `--help`:

1. Usar cópia local exclusiva com project_id próprio e volumes novos, contendo apenas config/migrations/seed sintéticos. Não copiar .env, vault, tokens ou link remoto.
2. Executar `supabase start` nesse diretório. Não usar `db reset`, `stop --no-backup`, `db push`, `link` ou `migration repair`. Se houver volume pré-existente, parar para inspecionar em vez de limpar/reaplicar.
3. Preencher .env.local com URL/chave pública exclusivamente locais e origem localhost; nunca imprimir segredos no relatório. Caixa SMTP local mantém mensagens no computador.
4. Verificar stack saudável e executar o roteiro STAGING-ACCEPTANCE.md com dois salões sintéticos. Registrar como integração GoTrue/PostgREST local; caixa local comprova geração/links, não entrega externa.
5. Parar serviços preservando volumes/dados. Manter produção e Vercel bindings intocados.

## Stripe

Responsável confirmou que sandbox ainda precisa ser criado. Continuam acessíveis somente ferramentas LIVE. Nenhum sandbox criado e nenhuma simulação LIVE realizada. Criar/conectar sandbox requer aprovação específica; depois usar somente produtos/preços TEST e segredo webhook do teste. A stack local pode receber eventos TEST via forwarding aprovado sem tocar endpoint produtivo. Não ativar recurso pago para solucionar falta de sandbox.

## Próxima autorização concreta

Alternativa recomendada para Preview: projeto `agende-staging`, organização Free confirmada, us-east-2, somente se criação mostrar **US$0/mês**, sem add-ons ou mudança de plano. Riscos: ocupar quota Free, pausa por inatividade, segredo/binding incorreto. Validar ref diferente da produção, preço/tier, migrations e dados sintéticos antes de trocar Preview. Recuperação: desvincular Preview, parar uso e revogar apenas credenciais TEST, sem apagar dados ou mexer em produção.

Alternativa local: disponibilizar runtime compatível, com instalação/configuração de Windows aprovada separadamente. Não foi realizado. Nenhuma opção exige contratação paga nesta fase.
