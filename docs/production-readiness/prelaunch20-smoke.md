# Roteiro da janela produtiva — preparado, NÃO executado

Só executar após autorizações do runbook. Responsável identifica o SHA/deployment READY e projeto `wohimauqgywshbbejjcl`, registra hora em America/Sao_Paulo e abre um manifesto privado de IDs de fixtures. Usar dois estabelecimentos sintéticos identificados como QA, contas controladas de proprietário, profissional convidado e cliente, e caixa de e-mail sob controle do responsável. Nenhuma conta real é reaproveitada sem consentimento. Não iniciar Checkout LIVE nem fornecer cartão.

Estado inicial de todos os passos abaixo: **NOT RUN em produção**. O GET público de cidades em `prelaunch20-http.json` é um smoke limitado de leitura e não transforma estas jornadas em PASS. Credenciais, cookies, links de e-mail, telefones e capturas com PII permanecem privados. Relatório público guarda apenas IDs opacos ou nomes sintéticos, status/contagens, horário e SHA; redactar PII em imagens.

## Gates e comandos

1. Responsável aprova banco/Storage/backup/autenticação/webhook e a aplicação do SQL conforme runbook.
2. Depois de restaurar os grants autenticados por autorização própria, executar `prelaunch20-postchecks.sql`: todos os gates devem retornar true e os grants seguir os comentários da consulta. Se ainda estiver em manutenção, os dois gates authenticated false são esperados; isso **não** autoriza liberar reservas.
3. Executar `node scripts/prelaunch-readonly-http.mjs`: PASS de HTTPS, páginas públicas e amostra JS. Não chama Auth, POST de reserva ou webhook.
4. Só então executar os passos browser/API abaixo. Antes do POST anônimo, comprovar grant anon revogado; nunca tentar criar uma reserva anônima na produção atual vulnerável.

| # | Execução na janela autorizada | PASS e evidência objetiva |
|---|---|---|
| 1 | Em navegador limpo, cadastrar cliente com alias controlado pelo formulário após selecionar uma reserva | Perfil cliente criado, zero workspace/membership/trial. Guardar seleção e contagem anterior/posterior de reservas, ainda inalterada |
| 2 | Ler e-mail entregue; consumir confirmação no navegador original; tentar callback em outro navegador sem PKCE e reutilização | Original confirma e retorna à escolha; outro navegador/consumo repetido recusados. Link/token privado. Registrar entrega/horário/resultado, sem confirmar administrativamente |
| 3 | Publicar, com aprovação explícita do proprietário QA, fixture em Muriaé/MG; abrir `/descobrir?cidade=Muria%C3%A9&uf=MG` | Fixture correta visível, sem depender de localização. Fixtures de outra cidade não entram no filtro |
| 4 | Fixture QA em Juiz de Fora/MG; abrir `/descobrir?cidade=Juiz+de+Fora&uf=MG` | Fixture correta; negativo cruzado com Muriaé. Se não houver fixtures aprovadas nessas cidades, BLOCKED, não inventar negócios reais |
| 5 | Buscar estabelecimento e profissional QA, com/sem acento, caixa/espaços e cidade combinada | Resultado só quando profissional ativo está ligado a serviço ativo e publicação consentida; erro/privacidade não interpretados como zero resultados |
| 6 | Selecionar serviço, profissional, data e vaga efetivamente disponível; reload e login | Preço/duração vêm do servidor, seleção permanece; autenticação não cria reserva |
| 7 | API com chave pública, sem sessão, tenta RPC numa vaga válida; repetir com conta não confirmada | 401/403/42501 conforme camada e nenhuma linha de appointment/client/rate-event nova. Não basta usar UUID inválido ou horário já ocupado |
| 8 | Conta confirmada confirma a escolha; duplo clique; duas contas disputam outra vaga controlada | Uma reserva vinculada à identidade, e-mail autoritativo; uma por vaga. Perdedor recebe conflito, sem duplicação. Registrar baseline/delta e IDs privados |
| 9 | Proprietário/equipe e profissional atribuído abrem agenda e detalhe; outro estabelecimento tenta o mesmo ID | Reserva e status corretos para autorizados; tenant alheio não lê nome, telefone ou notas. Criar uma reserva interna autorizada também deve funcionar |
| 10 | Formulário de logo/capa em fixture autorizada: upload, reload, substituição, remoção | WebP normalizado, bytes novos exibidos, referência antiga tratada sem apagar arquivos preexistentes; nenhum upload direto com chave pública |
| 11 | Proprietário edita foto do profissional; profissional permitido edita a própria; colega/recepção/tenant alheio tenta | Persistência/reload; substituição e remoção; bytes privados sem leitura direta do bucket e edição alheia negada. Público só recebe foto de profissional elegível no catálogo |
| 12 | Cliente define avatar opcional, cria vínculo legítimo com os dois tenants, substitui/remove | Mesmos bytes nos dois vínculos; terceiro tenant/usuário e profissional sem permissão negados; ausência de foto não bloqueia conta |
| 13 | Detalhe da reserva: clicar WhatsApp manual; capturar 302/Location antes da navegação externa | Número E.164, primeiro nome/serviço/profissional/data/hora/status corretos, encodeURIComponent e mensagem pendente coerente; nenhuma mensagem enviada e status intacto. Cancelado sem confirmação; telefone ausente/inválido com aviso |
| 14 | Cliente reagenda para vaga válida, repete tentativa em conflito e cancela | Novo horário persistido, conflito não sobrescreve outro, cancelamento mantém histórico; cliente/tenant alheio negados |
| 15 | Repetir leituras/mutações de reserva, financeiro, cliente e mídia com IDs do outro tenant e perfil profissional limitado | Sem dados privados nem writes cruzados; RLS continua habilitada/forçada onde requerido, nenhuma credencial administrativa no browser |
| 16 | Proprietário QA escolhe plano e cria primeiro workspace; convida equipe via fluxo aprovado; cliente gratuito permanece separado | Trial exatamente 7 dias, segundo workspace não ganha novo trial, convite ligado à identidade e função; profissional sem assinatura individual e sem financeiro indevido. Sem Checkout/pagamento LIVE |
| 17 | Conferir destino LIVE e fonte revisada; com autorização HTTP própria, enviar somente assinatura inválida e/ou evento TEST para destino LIVE | 400/assinatura inválida ou modo incompatível, sem alteração em billing_events/subscriptions. Capturar status e delta, nunca segredo. Isso prova negação, não entrega positiva LIVE; matriz TEST de staging e configuração LIVE são evidências separadas |

## Limites de faturamento e conclusão

LIVE tem destino ativo e zero entregas na janela mostrada no dashboard; zero erros com zero entregas não é PASS de entrega. Não reenviar eventos financeiros reais, fabricar `invoice.paid` LIVE ou usar cartão real para completar este roteiro. Uma entrega positiva de negócio LIVE sem cobrança precisará de evento legítimo não financeiro e aprovação separada com tipo/ID/efeitos definidos; se indisponível, manter **NOT VERIFIED**. Replays runner-signed devem ser identificados como tal e não confundidos com entrega do provedor.

Registrar por passo `PASS`, `FAIL` ou `BLOCKED`, SHA, horário, ator sintético e evidência privada/redigida. Qualquer falha de isolamento, reserva anônima, preço/duplicação, segredo no cliente ou perda de dados interrompe a janela: executar somente a suspensão previamente autorizada, preservar evidências e manter NO-GO. Reabertura exige autorização própria. Encerrar novas fixtures por cancelamento/arquivamento especificamente autorizado; não hard-delete de usuários/dados existentes. Antes de remover mídia nova, conferir manifesto de propriedade. Observar logs sanitizados e invariantes por pelo menos 30 minutos antes do GO para piloto. Comercial requer ainda aceite de faturamento LIVE e plano de recuperação demonstrado.
