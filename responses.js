/**
 * Sistema de respostas dinâmicas e personalizadas
 * Adiciona variação e contexto às mensagens do bot
 */

// Função para escolher aleatoriamente uma resposta de um array
function pickRandom(array) {
    return array[Math.floor(Math.random() * array.length)];
}

// Variações para saudações baseadas no horário
function getGreeting(userName = '') {
    const now = new Date();
    const hour = now.getHours();
    
    let timeGreeting;
    if (hour >= 5 && hour < 12) {
        timeGreeting = pickRandom([
            "Bom dia",
            "Olá, bom dia",
            "Oi! Bom dia"
        ]);
    } else if (hour >= 12 && hour < 18) {
        timeGreeting = pickRandom([
            "Boa tarde",
            "Olá, boa tarde",
            "Oi! Boa tarde"
        ]);
    } else {
        timeGreeting = pickRandom([
            "Boa noite",
            "Olá, boa noite",
            "Oi! Boa noite"
        ]);
    }
    
    return userName ? `${timeGreeting}, ${userName}! ` : `${timeGreeting}! `;
}

// Emojis por categoria
const categoryEmojis = {
    // Despesas
    "Alimentação": "🍔",
    "Moradia": "🏠",
    "Transporte": "🚗",
    "Saúde": "💊",
    "Educação": "📚",
    "Lazer": "🎮",
    "Vestuário": "👕",
    "Serviços": "🔧",
    "Impostos": "📝",
    "Outros": "📦",
    
    // Receitas
    "Salário": "💼",
    "Freelance": "💻",
    "Investimentos": "📈",
    "Presente": "🎁",
    "Bônus": "🏆",
    "Reembolso": "↩️",
    "Aluguel": "🔑",
    "Vendas": "🏷️"
};

// Obter emoji para uma categoria
function getCategoryEmoji(category) {
    return categoryEmojis[category] || "💰";
}

// Respostas para confirmação de despesa registrada
const expenseResponses = [
    "Anotei sua despesa! {}",
    "Despesa registrada com sucesso! {}",
    "Registrei esse gasto para você. {}",
    "Ok, adicionei essa despesa! {}"
];

// Respostas para confirmação de receita registrada
const incomeResponses = [
    "Receita registrada! {}",
    "Registrei essa entrada de dinheiro! {}",
    "Ótimo! Adicionei essa receita. {}",
    "Anotei sua receita! {}"
];

// Sugestões após registrar transações
const afterTransactionSuggestions = [
    "Quer ver seu saldo atual?",
    "Quer conferir como estão seus gastos do mês?",
    "Digite /relatorio para ver um resumo das suas finanças.",
    "Deseja adicionar outra transação?"
];

// Respostas para consulta de saldo
function getBalanceResponse(balance, userName = '') {
    const greeting = getGreeting(userName);
    const balanceValue = parseFloat(balance);
    
    if (balanceValue > 1000) {
        return pickRandom([
            `${greeting}Seu saldo atual é de *R$ ${balance}* 🤑`,
            `${greeting}Você tem *R$ ${balance}* disponível. Muito bom! 👏`,
            `Seu saldo é de *R$ ${balance}*. Parece que as finanças vão bem! 📈`
        ]);
    } else if (balanceValue > 0) {
        return pickRandom([
            `${greeting}Seu saldo atual é de *R$ ${balance}* 💰`,
            `${greeting}Você tem *R$ ${balance}* disponível.`,
            `Seu saldo é de *R$ ${balance}*. ✅`
        ]);
    } else if (balanceValue === 0) {
        return pickRandom([
            `${greeting}Seu saldo atual é *R$ ${balance}* 😐`,
            `${greeting}Você está com *R$ ${balance}* na conta. Está equilibrado.`,
            `Seu saldo é *R$ ${balance}*. Hora de planejar os próximos passos! 🤔`
        ]);
    } else {
        return pickRandom([
            `${greeting}Seu saldo atual é de *R$ ${balance}* ⚠️`,
            `${greeting}Você está com saldo negativo: *R$ ${balance}* 😟`,
            `Seu saldo é de *R$ ${balance}*. Vamos analisar como melhorar isso! 📊`
        ]);
    }
}

// Respostas de não entendimento com sugestões contextuais
function getNotUnderstoodResponse(context = 'general') {
    let baseResponse = pickRandom([
        "Hmm, não consegui entender exatamente o que você quer. ",
        "Desculpe, não entendi completamente. ",
        "Não captei o que você precisa. ",
        "Não compreendi o que você gostaria. "
    ]);
    
    let suggestion;
    
    switch (context) {
        case 'expense':
            suggestion = "Tente algo como \"Gastei 50 com comida\" ou use /despesa [valor] [descrição].";
            break;
        case 'income':
            suggestion = "Tente algo como \"Recebi 1000 de salário\" ou use /receita [valor] [descrição].";
            break;
        case 'balance':
            suggestion = "Para ver seu saldo, digite \"Qual meu saldo?\" ou simplesmente /saldo.";
            break;
        case 'report':
            suggestion = "Para um relatório, peça \"Como estão minhas finanças?\" ou use /relatorio.";
            break;
        default:
            suggestion = "Você pode registrar despesas, receitas, verificar saldo ou gerar relatórios. Digite /ajuda para ver todas as opções.";
    }
    
    return baseResponse + suggestion;
}

// Elogios por boa gestão financeira
const financialCompliments = [
    "Você está indo muito bem com suas finanças! 👍",
    "Continue assim! Sua organização financeira está excelente. 🌟",
    "Ótimo trabalho gerenciando seu dinheiro! 💯",
    "Suas finanças parecem estar bem organizadas! 👏"
];

module.exports = {
    pickRandom,
    getGreeting,
    getCategoryEmoji,
    expenseResponses,
    incomeResponses,
    afterTransactionSuggestions,
    getBalanceResponse,
    getNotUnderstoodResponse,
    financialCompliments
};
