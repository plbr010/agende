# Descoberta por cidade/proximidade — proposta para combinar com Cursor

**Projeto de backend, não implementado nem integrado.** Nenhuma migration, backfill ou alteração visual. Integração espera aceite do Cursor e do proprietário; P0 de lançamento tem prioridade. Deve funcionar com permissão negada, por qualquer cidade do cadastro e por busca global, sem geolocalizar pelo IP automaticamente.

## Compatibilidade com o contrato já proposto pelo Cursor no PR33

O PR33 novo foi lido nesta rodada: docs/discovery/backend-contract.md, src/lib/discovery/contract.ts e LocationDiscovery. Preservar os nomes list_public_localities e search_public_workspaces e o DTO name/slug/description/city/state/logo_path/booking_open. O adaptador do Cursor usa camelCase logoPath/bookingOpen; conversão deve ser explícita. Não substituir isso por uma API paralela sem acordo. O HTTP abaixo é uma evolução opcional/gateway; Supabase rpc já faz POST e pode atender ao requisito de não colocar GPS na URL.

Base v1 do Cursor: list_public_localities(p_state,p_query,p_limit) → {localities:[{city,state,workspace_count}]}; search_public_workspaces(p_city,p_state,p_query,p_postal_code,p_limit,p_offset) → {items,total}. Dados partem de workspace_settings.city/state, não cidade de residência de cliente. Manter apenas perfis opt-in/publicados/entitled e projeção mínima. Offset legado deve ser limitado e cursor keyset adicionado em contrato revisado, com next_cursor compatível, sem sobrecargas ambíguas no PostgREST.

Pontos que precisam de aceite antes de qualquer integração: city hoje é obrigatória no helper; mode global/nearby precisa permitir ausência de cidade quando apropriado. Coordenadas estão apenas em useState no código lido, sem persistência; manter isso e limpar/ignorar GPS quando a pessoa escolher city/global. Raio/distance são fase posterior a ponto coarse/PostGIS e aprovação de schema. O helper atual devolve unavailable mesmo se somente a flag mudar para true: é necessário implementar o adaptador real e teste de contrato, não apenas ligar DISCOVERY_BACKEND_READY. A flag permanece false; nenhum salão fictício ou coordenada real foi usado.

## Contrato HTTP proposto

POST /api/discovery/search (JSON, mesmo site). POST evita colocar localização do visitante em URLs/logs de acesso. Body estrito, maximum2KB:

```json
{"mode":"nearby","location":{"latitude":-19.92,"longitude":-43.94},"radiusKm":10,"q":"cabelo","cityId":null,"countryCode":"BR","pageSize":20,"cursor":null}
```

Coordenadas de exemplo são centro urbano ilustrativo, não localização do usuário. mode nearby exige latitude/longitude finitas nos intervalos WGS84 e permissão obtida pelo frontend; radiusKm1–50, padrão10. Arredondar coordenadas do visitante a ~100m antes de transmitir; não guardar em perfil/cookie/banco. city exige cityId canônico, sem coordenadas; global permite q e countryCode opcional, sem localização. Não deixar coordenadas de uma busca anterior no body quando a pessoa mudar para city/global. Geolocalização é exclusivamente ação opt-in do browser, responsabilidade coordenada com Cursor.

q0–80 caracteres; pageSize1–50, padrão20; cursor opaco limitado2KB. Backend rejeita campos desconhecidos, valores não finitos, combinações inconsistentes e LIKE wildcards não escapados. Não concatenar SQL a partir de input. Erros JSON: 400 invalid_query/invalid_cursor, 429 rate_limited (Retry-After); indisponibilidade503. Consentimento negado oferece city/global, não bloqueia busca.

```json
{"items":[{"slug":"salao-exemplo","name":"Salão Exemplo","city":{"id":"BR:IBGE:3106200","name":"Belo Horizonte","state":"MG","countryCode":"BR"},"logoUrl":null,"profileUrl":"/p/salao-exemplo","bookingUrl":"/p/salao-exemplo/agendar","bookable":true,"distanceKm":1.5,"distanceApproximate":true}],"nextCursor":"opaque-token","hasMore":true}
```

Resultado não inclui clientes, owner email/userID, receita, agenda privada ou localização do visitante. distanceKm somente nearby, aproximada/arredondada; city/global retornam null. Não publicar endereço residencial ou ponto exato sem consentimento do proprietário. Bookable combina publicação, booking_enabled e entitlement atual; não apresentar trial vencido como agenda disponível.

GET /api/discovery/cities?q=&countryCode=BR&pageSize=20&cursor=... retorna lugares canônicos públicos, sem depender dos tenants cadastrados. Registry admite qualquer cidade, sem lista fixa de capitais. IDs podem ser BR:IBGE:<codigo> no Brasil e IDs próprios/country ISO em outros países. Busca global atravessa apenas **perfis de estabelecimentos publicados**, nunca dados privados de outros tenants. Compatibilidade mundial depende de dados de registry/curadoria disponíveis; não afirmar cobertura global de geocoding já instalada.

## Dados, isolamento e índices

Propor registry cities/countries e projeção mínima de discovery, com opt-in directory_visible false por padrão. Não transformar toda a tabela workspaces em SELECT público. city/state existentes são texto livre: mapping/backfill só depois de revisão/aprovação, sem inferir geocoordenadas de residências. Owner/admin atualiza publicação por RPC com require_workspace_manager; não aceitar papel em user_metadata. Origem das coordenadas do estabelecimento precisa ser confirmada pelo proprietário; opção domiciliar usa ponto público coarse/centro da cidade.

Posição pública coarse pode ficar em schema app privado, sem GRANT direto anon/authenticated. Wrapper anônimo de busca, se SECURITY DEFINER for necessário, deve ter search_path vazio, SELECT de projeção allowlist e predicates de publicação/entitlement, timeout baixo e limit+1. Nunca usar service_role no browser. Policies/RLS de serviços/clientes/membros não mudam; relatório de outro tenant não participa da projeção. Implementação SECURITY INVOKER com grants limitados também pode ser escolhida na revisão, sem abrir tabela base.

PostGIS geography(Point,4326), índice GiST parcial para perfis publicados, ST_DWithin antes de ordenar distância. PostGIS ainda não está instalado em produção; habilitação/schema são migration separada aprovada, sem serviço de geocoding pago. BTree parcial(country_code,city_id,normalized_name,slug) para cidade e keyset; pg_trgm/GIN em search_text materializado pelo fluxo de escrita para q global. Não indexar chamada unaccent STABLE diretamente como expressão supostamente imutável sem revisão. Usar EXPLAIN(ANALYZE,BUFFERS) só em fixtures locais; validar seletividade/planos com100/1k/10k perfis.

Paginação keyset estável: city/global (normalized_name,slug); nearby (distance_bucket,slug), limite máximo50 e sem OFFSET crescente. Cursor firmado com HMAC server-only, versão/expiração10min e fingerprint **keyed** dos filtros/body normalizados, sem latitude/longitude no token. Alterar filtros invalida cursor. Não reutilizar cache próximo por cookies/userID; não registrar body/localização. Cache permitido somente para projeções públicas de cidade/global, com invalidação imediata de retirada de consentimento/publicação; resposta nearby private/no-store. Rate limit por chave IP com salt rotativo, retenção curta e sem IP cru no banco.

## Aceite antes de integrar

Cursor confirma nomes de campos, fallback sem permissão, POST para proximidade, tratamento429/503, paginação e distâncias aproximadas. Backend implementa somente após isso, em PR exclusivo. Testar: dois tenants com projeção pública e clientes privados; slug de tenant não publicado ausente; atualização/remoção de consentimento invalida cache; perímetro/radius correto; city/global não exigem GPS; cursor de outro filtro não serve; inputs SQL maliciosos/NaN/wildcards/limites; planos SQL/indexes; localização não aparece em logs. Nenhum teste lê ou grava localização real de pessoas nesta proposta.

Rollback futuro: desligar discovery por configuração revisada, conservar dados privados e índice/schema aditivos; não desfazer consentimento, apagar dados ou alterar rotas existentes de booking. Não implementar frontend paralelo ao Cursor.

Referências: [PostGIS Supabase](https://supabase.com/docs/guides/database/extensions/postgis), [municípios IBGE](https://servicodados.ibge.gov.br/api/v1/localidades/municipios).
