# Backend — requisitos obrigatórios de autenticação e WhatsApp

16/10/2026, America/Sao_Paulo. Base `5ceea68` de main. Branch `codex/auth-whatsapp-contract-20261016`. Escopo Codex: backend, autorização, link e testes; componentes TSX do Cursor preservados.

## Entrega

- Server Action de reserva falha fechada para sessão ausente, usuário anônimo, e-mail ausente/não confirmado e erro de Auth, antes de ler payload ou calcular IP. Validação completa de slug/UUIDs/instante e recusa de preço/clientId/campos extras. A identidade e o e-mail vêm do Auth, nunca do formulário. Preço, tenant, serviço, profissional e conflitos seguem calculados atomicamente na RPC existente.
- Contrato aditivo de `prepareAppointmentWhatsApp`: dados atuais autorizados do cliente/contato, serviço, profissional, fuso, data/hora locais, status, telefone E.164 validado, mensagem e link. Recusa de acesso não retorna dados pessoais. Telefone inválido mantém os dados autorizados e a alternativa de cópia, mas não fornece URL.
- Modelo confirmado com `👩` conforme solicitado. Pendentes continuam usando solicitação recebida, sem afirmar confirmação; cancelados e estados terminais são bloqueados no servidor. Normalização internacional sem inferir país/DDD; mensagem codificada por encodeURIComponent.
- A rota existente de clique relê o banco antes do 302 para wa.me, sem enviar mensagem nem alterar o agendamento. Cópia passa pela mesma autorização. O fluxo não precisa de service_role ou plano SaaS do cliente.

Contrato completo para o Cursor: `docs/codex/auth-whatsapp-required-contract-20261016.md`.

## Testes

- 399 testes locais aprovados, incluindo SQL real isolado com identidade de teste e testes novos de Server Actions, payload malformado, sessão expirada/anônima, e-mail verificado, conflitos e ausência de efeitos laterais. Evidência em `auth-whatsapp-required-unit-20261016.json`. Esse arquivo é próprio da branch para não colidir com o snapshot de testes do Cursor.
- Typecheck e build local aprovados; build adicional com variáveis públicas exclusivamente de staging.
- Sete verificações reais de staging com GoTrue, PostgREST, Next local e Edge móvel: bloqueio de REST/RPC anônimos sem gravação; seleção preservada através de login real; confirmação pela Server Action e leitura na área gratuita; negação do contato a outro salão/cliente; retorno real do contrato pela Server Action da equipe e cópia manual; mensagens pendente/confirmada sem mutar status; bloqueio de cancelado.
- Nenhum request externo ao WhatsApp foi efetuado. O teste inspeciona o 302 sem segui-lo; o envio permanece manual.
- Somente fixtures sintéticas já existentes em staging foram usadas. Reservas novas foram canceladas pela própria conta autenticada, sem apagar registros. Uma tentativa inicial que terminou após iniciar a requisição foi conferida e cancelada pelo mesmo fluxo; marcadores exclusivos permitem limpar apenas reservas deste runner.
- O rate limit real de cinco pedidos por identidade/IP/hora foi observado nos testes. Seus eventos e limites foram preservados. A rodada final usou o estabelecimento sintético B e uma fixture cliente confirmada já existente; nenhuma policy, quota, secret ou configuração Auth foi alterada para passar os testes.

Runner reproduzível: `scripts/staging-auth-whatsapp-required.mjs`, com opt-in do projeto staging, arquivo privado de fixture e slug sintético explícito. O arquivo não carrega service_role. Build é local, não deploy. Não executar esse runner apontando para produção.

## Integração com o Cursor

PR de interface: https://github.com/plbr010/agende/pull/64, commit examinado `dccb7b7842643bb7807f23fb640edaef75c16ed2`. Não foi modificado. Esta branch evita componentes e helpers de apresentação que o Cursor está editando. A alteração de uma linha do emoji do template é idêntica à proposta no #64.

O #64 já propõe telefone visível e botões/status próprios. Ainda há um problema de aceite na versão examinada: o comprovante de `scheduled` continua dizendo “Agendamento confirmado!”. O contrato aponta a correção necessária para `Solicitação recebida`/`Aguardando confirmação`. O campo de telefone é uma lacuna do main atual já tratada no candidato #64; validar depois da integração. Não declarar ponta a ponta concluído antes disso.

O #64 também prepara `20261016235000_require_confirmed_public_booking.sql`, sem execução: reforça que a reserva não pode degradar para convidado se a confirmação de e-mail desaparecer durante a operação. Essa migration deve ter revisão e autorização próprias; não foi duplicada nesta branch.

## Produção e autorização

Consulta somente leitura ao schema/grants produtivos: anon ainda tem EXECUTE da reserva; guard interno confirmado ausente; migration `profiles_booking_whatsapp` e RPC de WhatsApp ausentes. Evidência: `auth-whatsapp-required-production-readonly-20261016.json`. Nenhum dado pessoal ou secret produtivo foi lido.

Nenhuma migration remota, deploy manual, mudança produtiva, secret, cobrança ou Stripe nesta rodada. Há código e SQL preparados, mas merge não aplica banco. **GO para revisão dos contratos e testes; NO-GO para publicação/aceite ponta a ponta**, até a correção da interface, autorização das migrations/deploy e homologação integrada.

`vercel.json` desativa o deploy Git exclusivamente desta branch, conforme https://vercel.com/docs/project-configuration/git-configuration#git.deploymentenabled, para publicar o PR sem deploy automático. As outras branches mantêm o comportamento padrão. A CI GitHub executa verificações locais e não contém etapas de deploy.
