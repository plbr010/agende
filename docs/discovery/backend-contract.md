# Contrato de descoberta pública — coordenação com Codex

A experiência de “Encontrar um salão” (`/descobrir` e `/cliente/descobrir`) já está no frontend.
Ela **não inventa estabelecimentos** e **não restringe** a busca à cidade de residência.

## Implementação de 14/10/2026

Migration local `20261014030220_public_workspace_discovery.sql` implementa este contrato v1 e foi homologada somente em `fkpdudnnperufnmdwdlv`. Produção não foi alterada. O campo `discovery_enabled` inicia false; dono/admin publica voluntariamente nas configurações do perfil e pode retirar a publicação mesmo após expirar a assinatura. Sem backfill automático. Apenas estabelecimentos publicados e com entitlement vigente entram em busca/sugestões. Nome global remove cidade/UF anteriores. A busca inclui nomes de profissionais ativos que já constam do perfil público, sem devolver dados internos.

Limites SQL: cidade 2–80 caracteres, nome 2–100, UF brasileira, limite 1–50, offset 0–10.000. O frontend usa páginas de 20 e botão Mostrar mais. Ordenação determinística por nome/slug; alteração do catálogo entre páginas pode mover resultados, pois v1 usa offset, não snapshot/keyset. Busca por cidade tem índice parcial; substring global e contagem ainda requerem varredura. Não há certificação de capacidade cloud nem proteção de abuso volumétrico demonstrada; dimensionar/rate-limit no gateway antes de exposição ampla. A proposta HTTP/PostGIS/keyset do PR35 continua evolução posterior, sem fazer parte deste aceite v1.

Evidências: `docs/staging/discovery-real-api.json` (sete checks reais), `browser-functional.json` (sete jornadas, inclusive busca móvel), `scripts/discovery-sql.test.mjs` (PostgreSQL17 e PGlite). Contatos, endereço detalhado, IDs, assinatura e GPS ficam fora do DTO público.

O adaptador (`searchPublicWorkspacesWithRpc`) chama as RPCs abaixo em runtime. Se PostgREST responder `PGRST202`/`42883`, a UI explica que a listagem ainda não está no ar e mantém o caminho operacional: colar o link público do salão. `DISCOVERY_BACKEND_READY` permanece `false` até as RPCs existirem e um teste de contrato passar — a flag **não** impede o probe.

Nada disto deve ser implementado com migrations em produção sem autorização. Este arquivo só descreve o contrato.

## O que o frontend envia

`searchPublicWorkspacesAction` → `search_public_workspaces` (somente estes argumentos v1):

| Campo RPC | Quando | Notas |
| --- | --- | --- |
| `p_city` | modo cidade (obrigatório); modo perto (cidade reverse-geocodificada); modo global (null) | texto livre, ≥2 caracteres; **nunca** cidade de residência da conta |
| `p_state` | se a pessoa escolheu UF | `^[A-Z]{2}$` |
| `p_query` | modo global (obrigatório); outros modos opcional | nome do estabelecimento ou profissional |
| `p_postal_code` | sempre null nesta versão | reservado |
| `p_limit` / `p_offset` | 20 / página solicitada | paginação v1 |

A cidade de residência da conta **não existe** no schema atual (`profiles` / `client_profiles`) e **não deve** ser injetada pelo backend.

### Modos de UI (pedido de lançamento)

1. **Perto de mim** — GPS só com consentimento. O browser envia coordenadas arredondadas a ~100 m ao BigDataCloud, conforme aviso anterior ao botão; o provedor também recebe o IP. Coordenadas **não** vão ao Agendê nem ao body RPC v1. O frontend reverse-geocodifica para cidade/UF e busca essa localidade — não a cidade de residência. Timeout de oito segundos e rejeição de país estrangeiro; negada a localização, cidade e busca global continuam disponíveis. O ensaio E2E não acessou GPS real nem homologou o provedor geográfico externo.
2. **Uma cidade** — qualquer município cadastrado, sem GPS.
3. **Nome do salão** — busca global; `p_city` pode ser null.

Pedido ao Codex (compatível com a proposta HTTP de `docs/commercial-readiness/DISCOVERY-CONTRACT.md`):

- Aceitar `p_city` null quando `p_query` tiver ≥2 caracteres (modo global).
- Não exigir GPS. Recusar coordenadas na URL.
- Raio/`p_latitude`/`p_longitude` só depois de ponto coarse/PostGIS aprovado. Até lá, ignore ou recuse com erro explícito — o frontend **não envia** esses campos no v1.

## RPCs necessárias (anon + authenticated, SECURITY DEFINER, mesmo padrão de `get_public_workspace_profile`)

### `list_public_localities`

```
Args: p_state text, p_query text, p_limit int
Returns Json: { localities: [{ city, state, workspace_count }] }
```

Agrupar `workspace_settings.city` + `state` onde `city` não é nulo. Contar somente workspaces com entitlement ativo (espelhar `app.workspace_has_entitlement`).

### `search_public_workspaces`

```
Args: p_city text, p_state text, p_query text, p_postal_code text, p_limit int, p_offset int
Returns Json: {
  items: [{ name, slug, description, city, state, logo_path, booking_open }],
  total: number
}
```

- Filtrar pela cidade/UF **informadas na busca**, nunca por um campo de residência.
- `booking_open` deve seguir a mesma regra de `list_public_booking_catalog` / entitlement.
- Não expor telefone, e-mail interno ou IDs internos.
- Sem `latitude`/`longitude` no schema hoje: raio geográfico **não é suportado** nesta versão.

O frontend converte `logo_path`/`booking_open` para `logoPath`/`bookingOpen`. Itens sem `name`+`slug` válido são descartados; nenhum estabelecimento é inventado.

## Flags no frontend

`DISCOVERY_BACKEND_READY` em `src/lib/discovery/contract.ts` permanece `false` até as RPCs existirem e um teste de contrato passar. Não ligue a flag com dados fictícios. O adaptador já está pronto para ligar sozinho quando as funções existirem no PostgREST.
