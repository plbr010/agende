# Contrato de descoberta pública — coordenação com Codex

A experiência de “Encontrar um salão” (`/descobrir` e `/cliente/descobrir`) já está no frontend.
Ela **não inventa estabelecimentos** e **não restringe** a busca à cidade de residência.

Enquanto as RPCs abaixo não existirem, a UI explica que a listagem ainda não está no ar e mantém o caminho operacional: colar o link público do salão.

Nada disto deve ser implementado com migrations em produção sem autorização. Este arquivo só descreve o contrato.

## O que o frontend envia

`searchPublicWorkspaces` em `src/lib/discovery/contract.ts`:

| Campo | Obrigatório | Notas |
| --- | --- | --- |
| `city` | sim para disparar a busca | texto livre, 2–80 caracteres, qualquer cidade cadastrada |
| `state` | recomendado | UF `^[A-Z]{2}$` |
| `query` | não | nome do estabelecimento, `ilike` |
| `coordinates` | não | `{ latitude, longitude }` só se a pessoa autorizar o GPS |

A cidade de residência da conta **não existe** no schema atual (`profiles` / `client_profiles`) e **não deve** ser injetada pelo backend.

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
- Sem `latitude`/`longitude` no schema hoje: raio geográfico **não é suportado** nesta versão. O frontend já coleta coordenadas para um passo futuro; até existir geocoding persistido em `workspace_settings`, ignore `p_latitude`/`p_longitude` ou recuse com erro explícito.

## Flags no frontend

`DISCOVERY_BACKEND_READY` em `src/lib/discovery/contract.ts` permanece `false` até as RPCs existirem e um teste de contrato passar. Não ligue a flag com dados fictícios.
