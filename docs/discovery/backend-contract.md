# Contrato de descoberta pública — coordenação com Codex

A experiência de “Encontrar um salão” (`/descobrir` e `/cliente/descobrir`) já está no frontend.
Ela **não inventa estabelecimentos** e **não restringe** a busca à cidade de residência.

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
| `p_limit` / `p_offset` | 20 / 0 | paginação v1 |

A cidade de residência da conta **não existe** no schema atual (`profiles` / `client_profiles`) e **não deve** ser injetada pelo backend.

### Modos de UI (pedido de lançamento)

1. **Perto de mim** — GPS só com consentimento. Coordenadas ficam no aparelho, arredondadas a ~100 m, e **não** vão no body v1 (evita `PGRST202` por assinatura extra). O frontend reverse-geocodifica para cidade/UF e busca essa localidade — não a cidade de residência. Se a localização for negada, cidade e busca global continuam disponíveis.
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
