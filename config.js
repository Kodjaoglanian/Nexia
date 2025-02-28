// Configuração do BotZap Financeiro

// Importar credenciais de acesso do arquivo separado
try {
    var credentials = require('./credentials');
} catch (error) {
    console.error('Erro ao carregar arquivo de credenciais. Usando credenciais padrão.');
    // Credenciais padrão caso o arquivo não exista
    var credentials = [
        {
            login: "admin",
            password: "admin123"
        }
    ];
}

module.exports = {
    // Palavra-chave para iniciar a autenticação
    authKeyword: "creatinex",
    
    // Credenciais de acesso (importadas do arquivo credentials.js)
    credentials: credentials,
    
    // Lista de números de telefone autorizados (formato: apenas números, sem '+' ou espaços)
    // Se vazio, qualquer pessoa que saiba as credenciais pode usar
    authorizedUsers: [
        // Adicione os números de telefone aqui, por exemplo:
        // "5511999999999",
        // "5521888888888"
    ],
    
    // Definir como true para permitir apenas usuários na lista acima
    restrictByPhoneNumber: false,
    
    // Mensagem de apresentação para usuários autenticados
    welcomeMessage: "🤖 *Bem-vindo ao seu Assistente Financeiro Pessoal!*\n\n" +
                   "Aqui você pode:\n\n" +
                   "💰 *Controlar Gastos e Receitas*\n" +
                   "• Registrar despesas e receitas\n" +
                   "• Criar transações recorrentes\n" +
                   "• Categorizar suas transações\n\n" +
                   "📊 *Acompanhar suas Finanças*\n" +
                   "• Ver relatórios detalhados\n" +
                   "• Gráficos de gastos\n" +
                   "• Análise por categorias\n\n" +
                   "🎯 *Planejar seu Futuro*\n" +
                   "• Definir metas financeiras\n" +
                   "• Controlar orçamentos\n" +
                   "• Receber alertas\n\n" +
                   "⏰ *Lembretes Automáticos*\n" +
                   "• Contas a pagar\n" +
                   "• Vencimentos\n" +
                   "• Cobranças\n\n" +
                   "*Como usar:*\n" +
                   "1️⃣ Fale naturalmente comigo:\n" +
                   '• "Comprei pão por 5 reais"\n' +
                   '• "Gastei 150 com conta de luz"\n' +
                   '• "Recebi 2500 de salário"\n' +
                   '• "Quanto tenho de saldo?"\n\n' +
                   "2️⃣ Ou use comandos como:\n" +
                   "• /saldo - Ver saldo atual\n" +
                   "• /relatorio - Relatório mensal\n" +
                   "• /metas - Suas metas financeiras\n\n" +
                   'Digite "ajuda" para ver todas as funções disponíveis!'
};
