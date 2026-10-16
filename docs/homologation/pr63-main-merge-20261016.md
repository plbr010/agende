# PR #63 — integração do main e resolução de conflitos

16/10/2026. Integrado `origin/main` em `fa8240c68d9a53ebe411def17d2245c1793adfad` (PR #62) na branch do PR #63, sem reescrever histórico.

- Agenda: preservados o novo resumo, layout de detalhes e separação de ações do main; fotos usam os proxies autorizados e o WhatsApp continua consultando o servidor no clique, distinguindo pendente/confirmado. Mantida a atualização do diálogo pelo ID após mudanças de status/horário.
- Reserva pública: preservados os novos textos, acessibilidade e apresentação de profissionais; imagens continuam passando pela autorização do catálogo público.
- Equipe: mantido o editor de foto pessoal do main, separado do editor da foto pública de atendimento. Corrigida a orientação que dizia que fotos públicas de profissionais ainda não existiam.
- Teste do botão de WhatsApp atualizado para verificar o componente seguro efetivamente usado pela agenda. Evidência de testes regenerada após a integração.

Validação local do código integrado: 393 testes aprovados, zero falhas/skip; lint, typecheck e build aprovados. Nenhuma migration, secret, operação de banco, cobrança ou deploy produtivo nesta resolução.
