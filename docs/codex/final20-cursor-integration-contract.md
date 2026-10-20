# Integração final de 20/10/2026

Base: main `f8d02125f8c8edc7d67891e3c8a50a520d0bfacc`, incluindo PR #66. A produção observada estava nesse commit, deployment Vercel `dpl_79fqsAy7uRRkRQ5crYQYm19j2inL`.

Integrado por merge na branch própria `codex/final-launch-integration-20261020`: head da PR Cursor #67 `3c25bb02dde44b1859be9e46e37474e3a3565f6a`. Commit de integração `64c1c92`. A branch Cursor e main não foram alteradas. A PR #67 continuava aberta, com conflitos contra main; esta candidata resolve a integração sem sobrescrever seu histórico.

Dois conflitos resolvidos: recibo público passa a usar `bookingReceiptCopy`, preservando a distinção entre solicitação pendente e confirmação; runner de autenticação acompanha o título resultante. Busca mantém estado na URL e ligação direta com reserva. Telefone/WhatsApp continuam autorizados no servidor, sem envio automático nem alteração de status ao abrir conversa.

Correção adicional: PersonMark guardava falha de imagem como booleano e escondia a foto válida de outra pessoa após mudar `photoUrl`. Agora a falha pertence à URL específica e a imagem recebe chave por URL. Dois testes de regressão falharam antes e passaram depois; são testes de componente com estado simulado, separados das provas reais de Storage/navegador.

O runner antigo de lançamento aceita as duas grafias do título de solicitação. Runners novos usam opt-in e projeto staging fixo, credenciais locais ignoradas e fixtures controladas. Nenhuma migration nova. O deploy automático desta branch está desabilitado em `vercel.json`; merge em main permanece uma operação produtiva e não foi executado.
