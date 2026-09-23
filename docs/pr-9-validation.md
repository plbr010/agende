# Validação do PR #9

Em 2026-09-23, a autorização das quatro páginas operacionais passou a usar
`src/lib/auth/permissions.ts` tanto no menu desktop/mobile quanto no guard
de sessão do servidor. O role vem da membership ativa consultada pelo servidor,
usando o mesmo workspace das páginas. Owner/admin têm acesso; professional e
receptionist são redirecionados para `/app` antes das RPCs.

Os 23 testes novos executam também a lógica das páginas reais, isolando as
dependências de sessão, backend e UI. Verificam as 16 combinações de role/rota,
menu, subcaminhos, role ausente, múltiplos workspaces e redirects preexistentes.
Não são testes E2E de navegador nem chamadas autenticadas ao banco remoto.

Resultados do código no commit `81930a85738202af11e27f290dc09d32fff1d8c0`:

- `npm test`: 93 aprovados (Node 20 local; Node 22 no CI).
- `npm run lint`: aprovado.
- `npm run typecheck`: aprovado.
- `npm run build`: aprovado.
- [CI 23](https://github.com/plbr010/agende/actions/runs/35926828825): aprovado,
  usando Node 22 e executando os quatro comandos acima.

Limites do ambiente local: lint, typecheck e build usaram Node 24.19.0.
O runner tsx nesse runtime falhou antes dos testes com `uv_os_get_passwd ENOMEM`
no Windows; a suíte passou no Node do sistema e depois no Node 22 do CI.
O primeiro build não conseguiu baixar Google Fonts com rede restrita; o build
normal passou depois da liberação de rede, sem substituição das fontes.

Loaders, adapters, payloads e componentes de Estoque, Pacotes, Financeiro e
Relatórios foram preservados. Nenhuma autorização do Supabase foi alterada.
O histórico recuperado e a única lacuna estão documentados em
[migrations/recovery-2026-09-23.md](./migrations/recovery-2026-09-23.md).
