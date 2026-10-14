export const CLIENT_FAVORITES_STATUS = {
  available: false,
  reason: "backend_missing",
  title: "Favoritos ainda não estão disponíveis",
  description:
    "Guardar um salão para voltar depois precisa ser salvo na sua conta, com segurança. Essa persistência ainda não existe no servidor — por isso o botão não aparece como se já funcionasse.",
  fields: [
    "Salvar estabelecimento na conta autenticada",
    "Remover dos favoritos",
    "Listar somente os seus",
    "Abrir o perfil e agendar de novo",
  ],
} as const;
