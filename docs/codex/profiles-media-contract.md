# Contratos: conta privada e imagens públicas

Complementa `frontend-backend-contract.md` e `client-experience-fase2.md`. Não mudar layout/identidade visual por esta integração.

## Conta e cadastro

`/cadastro?intent=client` preserva intenção explícita mesmo que exista `plan` na URL; plano isolado pré-seleciona profissional. Clientes têm `client_profiles`, sem workspace/trial/assinatura automática. Profissionais criam o workspace depois de confirmar e-mail e escolher plano; o mesmo usuário pode chamar `create_client_profile` e usar as duas áreas. PKCE, retorno seguro e permissões existentes permanecem.

`updateClientProfileAction` salva somente a linha do usuário validado em `getUser`, exige confirmação de uma linha atualizada e não aceita user_id do formulário. Nome/telefone permanecem editáveis com o schema anterior. `session.profile.residenceCityAvailable=false` faz o formulário omitir a cidade; o action não escreve a coluna se o campo não veio. Cidade não vazia não é descartada silenciosamente quando o backend falha. A flag deriva de erro de coluna específica, não de falha genérica/RLS.

## Fotos pessoais

Endpoint existente `/api/account/avatar`: PUT binário, GET privado `no-store`, DELETE, same-origin obrigatório nas mutações. Vale para cliente e profissional, sem exigir plano/salão para a conta pessoal. Bucket `account-avatars` continua privado e sem acesso direto de anon/authenticated. Servidor valida bytes JPEG/PNG/WebP, dimensão 32–4096, limite total de pixels, decodificação completa, orientação e reencode WebP sem EXIF.

Entrada HTTP limitada a **4 MiB**, saída até 2 MiB/512px. O editor pessoal recorta no navegador e o servidor valida novamente. Isso atualiza o limite anterior de 5 MiB do contrato antigo. A chave `SUPABASE_SERVICE_ROLE_KEY` existe exclusivamente no servidor; nunca publicar valores em evidência, bundle ou variável pública.

## Logo e capa

`WorkspaceImageForm` chama `saveWorkspaceImageAction(state, FormData)` com `kind=logo|cover`, File `image`, `publicConsent=true`; remoção usa `remove=true`. Workspace e usuário são obtidos da sessão, nunca de IDs ocultos aceitos do cliente. Somente dono/admin confirmado e com entitlement pode persistir imagens públicas. O tamanho é verificado no cliente antes do POST e no servidor antes de decode; Server Actions aceitam 4300 KiB para arquivo de 4 MiB + multipart, abaixo do limite [Vercel 4,5 MB](https://vercel.com/docs/functions/limitations).

Servidor normaliza logo até512px e capa até2048px, até2 MiB, MIME real raster. Armazena apenas bytes normalizados em `workspace-logos/{workspace-id}/{logo|cover}/{uuid}.webp`. Bucket é público porque o formulário exige propósito e consentimento públicos. Nenhuma foto pessoal é copiada automaticamente. Upload/update/delete diretos pelo SDK do usuário são negados por policies restritivas, inclusive para owner; todas as escritas passam pelo servidor.

RPCs autenticadas `queue_workspace_image_upload`, `swap_workspace_image`, `claim_workspace_image_cleanup`, `finish_workspace_image_cleanup` revalidam manager/entitlement. Lease de uma hora, compare-and-swap e lock de settings serializam referência/limpeza. Resposta perdida não apaga upload potencialmente já referenciado. Limpeza só via Storage API; falhas mantêm fila para retry. `get_public_workspace_cover(slug)` retorna só o caminho público de capa; perfil público não consulta avatars privados. Galeria não tinha contrato/tela/modelo no produto inspecionado e não foi criada como recurso novo nesta correção.

Não voltar ao upload antigo com filename fixo/upsert nem alterar imagens via `update_workspace_settings(p_logo_path, p_clear_logo)`. Campos de imagem desse contrato antigo são rejeitados; formulário textual usa null/false e preserva referências existentes. Se a migration ainda não existe, editor público fica indisponível explicitamente.

## Dados comerciais e erros

Nome e slug obrigatórios; telefone/e-mail comercial/endereço/cidade/UF/CEP opcionais. Normalização BR/E.164, CEP pontuado aceito, UF brasileira real, timezone permitido. Fuso inválido não vira Brasília silenciosamente. Campos omitidos seguem o contrato de formulário completo atual; os dois formulários preservam os demais valores com hidden fields. Falha de leitura interrompe a página de edição, evitando gravar defaults sobre dados desconhecidos.

Falhas de validação retornam `fieldErrors`. `subscriptionInactive=true` orienta a conferir assinatura, com link próprio; essa resposta não é sucesso de gravação nem renova trial. RPC continua aplicando entitlement e autorização. Logs novos têm operação e código fixo, sem contatos, endereço, arquivo, JWT, chave ou mensagem bruta do provedor.

Alterações de interface nesta rodada restringem-se a esses contratos: prioridade da intenção do cadastro, campo de cidade condicionado ao backend, erros de endereço/cidade/UF/fuso, editor separado de logo/capa, capa no perfil público e link de assinatura inativa. Manter os componentes e estilos existentes do Cursor. Não há mudanças em Stripe LIVE ou na identidade visual.
