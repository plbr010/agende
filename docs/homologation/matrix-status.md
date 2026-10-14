# Matriz de homologação — classificação atual

Fonte: `src/lib/usability/homologation-matrix.ts`. Atualizar o TypeScript, não este arquivo, quando o status mudar.

**PASS E2E = 0.** Nenhuma jornada autenticada ou financeira foi comprovada contra staging nesta entrega. **PASS LOCAL não é homologação comercial.**

| Status | Significado |
| --- | --- |
| PASS LOCAL | Unitário, mock, PGlite ou Playwright isolado (backend sintético) |
| PASS E2E | Fluxo completo no navegador contra staging autorizado |
| FAIL | Comportamento incorreto reproduzido |
| BLOQUEADO | Dependência ausente ou autorização pendente |
| NÃO TESTADO | Jornada ainda não executada |

## Contagens desta branch

Calculadas pelo módulo (`homologationCounts` + `homologationReadiness`):

- PASS LOCAL: 18 (UI pública, PGlite, componentes)
- PASS E2E: 0
- FAIL: 0
- BLOQUEADO: 11 (Auth/SMTP, RPCs de descoberta, reserva real, Stripe TEST, produção)
- NÃO TESTADO: 0
- Total: 29
- Superfícies Cursor com evidência local: **100%** das jornadas owned pelo frontend (`frontendOwnedReadyPercent`)
- Evidência local sobre o total: **62%** (`localEvidencePercent`)
- Homologação real (`realE2ePercent`): **0%**
- Cadastro / agenda / financeiro / assinatura prontos para cliente pagante: **0%** (`sensitiveJourneysReadyPercent`)

Reprodução: `npm run test:e2e` (isolado) e `npm run test:e2e:staging` (BLOQUEADO sem opt-in). Contrato Codex: `docs/codex/frontend-backend-contract.md`.
