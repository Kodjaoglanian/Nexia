/**
 * Credenciais de usuários para o BotZap Financeiro
 * Este arquivo deve ser mantido seguro e não deve ser compartilhado ou versionado
 */

module.exports = [
    {
        login: "admin",
        password: "admin123",
        name: "Administrador",
        role: "admin"
    },
    {
        login: "user",
        password: "finance123",
        name: "Usuário Padrão",
        role: "user"
    },
    {
        login: "guest",
        password : "guest123 ",
        name: "Convidado",
        role: "guest"
    }
    // Você pode adicionar mais usuários aqui conforme necessário
];
