# Contrato opcional: profissional encontrado na busca

A busca pública já considera o nome de quem atende dentro de `search_public_workspaces`. A interface mostra esse nome somente quando a resposta trouxer o campo. Sem o campo, o card continua com nome, cidade, logo e descrição do estabelecimento. Nenhum nome é inventado.

Campo opcional em cada item:

```json
{ "matched_professionals": [{ "display_name": "Maria Clara" }] }
```

Também são aceitos `matchedProfessionals`, `matched_names` ou `matchedNames`. No máximo três nomes públicos, com até 80 caracteres. A autorização continua no RPC: só profissionais com agenda ligada e serviço público ativo.

Não é necessária migration nesta entrega de interface. Quando o Codex incluir o campo na função já existente, a página `/descobrir` passa a exibir “Quem atende”.
