const db = require('./database');
const charts = require('./charts');
const commands = require('./commands');
const responses = require('./responses');
const moment = require('moment');
moment.locale('pt-br');

// Expressões regulares para identificar padrões
const patterns = {
    // Padrões para despesas - Corrigido para melhor captura de valores e descrições
    expense: [
        // "[valor] reais/pila de [algo]" - Este padrão precisa vir primeiro
        /^(\d+[.,]?\d*)\s+(?:reais?|pila|conto|dinheiros?)\s+(?:de|em|no|na)\s+(.+)$/i,
        
        // "comprei [algo] por [valor]"
        /^comprei\s+(.+?)\s+(?:por|no valor de|:)\s+(?:R\$\s*)?(\d+[.,]?\d*)/i,
        
        // "gastei [valor] com/em [algo]"
        /^gastei\s+(?:R\$\s*)?(\d+[.,]?\d*)\s+(?:com|em|no|na|de)\s+(.+)$/i,
        
        // "paguei [valor] de/em [algo]"
        /^paguei\s+(?:R\$\s*)?(\d+[.,]?\d*)\s+(?:de|em|por|para|no|na|pelo|pela)\s+(.+)$/i,
        
        // "[algo] custou [valor]"
        /^(.+?)\s+(?:custou|ficou|saiu por|deu)\s+(?:R\$\s*)?(\d+[.,]?\d*)$/i
    ],
    
    // Padrões para receitas - Melhorados para capturar "recebi X reais de Y" mais precisamente
    income: [
        // Padrão para "recebi X reais de Y" - Forçar captura correta do valor
        /recebi\s+(\d+[.,]?\d*)\s+(?:reais?|pila|conto|dinheiros?)\s+(?:de|do|da|como)\s+(.+)/i,
        
        // Padrões existentes com prioridade secundária
        /recebi\s+(?:R\$\s*)?(\d+[.,]?\d*)\s+(?:de|em|como|por|pela)?\s*(.+)?/i,
        /ganhei\s+(?:R\$\s*)?(\d+[.,]?\d*)\s+(?:de|em|como|por|pela)?\s*(.+)?/i,
        /entrou\s+(?:R\$\s*)?(\d+[.,]?\d*)\s+(?:de|em|como|por|pela)?\s*(.+)?/i,
        /caiu\s+(?:R\$\s*)?(\d+[.,]?\d*)\s+(?:de|em|como|do|da|na|no)?\s*(.+)?/i,
        /(?:pagamento|salário|dinheiro) (?:de|no valor de) (?:R\$\s*)?(\d+[.,]?\d*)\s+(?:de|por|referente a)?\s*(.+)?/i
    ],
    
    // Padrões para saldo - Melhorados e mais abrangentes
    balance: [
        /quanto\s+(?:eu)?\s+(?:tenho|resta|sobrou|ficou|possuo|disponível)/i,
        /(?:ver|mostrar|consultar|qual|quanto|como está|cadê|onde está)\s+(?:meu|o)?\s+(?:saldo|dinheiro|grana|valor|montante|disponível)/i,
        /(?:como|qual|quanto)\s+(?:está|é|anda|sobrou)\s+(?:meu|o)?\s+(?:saldo|dinheiro|grana|valor|montante)/i,
        /(?:meu|me|qual|quanto é)\s+(?:saldo|balanço|dinheiro|grana)/i,
        /(?:quero|posso|poderia|dá para)\s+(?:ver|saber|consultar|conhecer|descobrir)\s+(?:meu|o)?\s+(?:saldo|dinheiro|grana)/i,
        /saldo.{0,20}(?:favor|por favor|pfv|pfvr)/i,
        /estou\s+(?:com quanto|com qual valor)/i,
        /quanto\s+(?:dinheiro|grana|valor)/i
    ],
    
    // Padrões para relatório - Mais variações
    report: [
        /(?:ver|mostrar|gerar|fazer|exibir|apresentar|criar|preciso de|quero|me dá)\s+(?:um)?\s+(?:relatório|report|resumo|balanço|extrato)/i,
        /como\s+(?:estão|foram|andam|andaram|vão|ficaram)\s+(?:minhas|meus|nossas)?\s+(?:finanças|gastos|despesas|contas|receitas|dinheiro|entradas e saídas)/i,
        /(?:resumo|resumir|balanço|relatório)\s+(?:do|no|desse|deste|atual)?\s+(?:mês|mensal|meu dinheiro|das contas|financeiro)/i,
        /como\s+(?:estou|ando|fui|está)\s+(?:de|com as|com os|nas|nos)\s+(?:finanças|gastos|despesas|contas)/i,
        /(?:mostrar|ver)\s+(?:minhas|meus)\s+(?:receitas|despesas|gastos|transações)/i
    ],
    
    // Padrões para ajuda - Expandidos
    help: [
        /(?:como|o que)\s+(?:funciona|você faz|posso fazer|dá para fazer)/i,
        /(?:me)?\s+(?:ajuda|ajude|socorre|orienta|explica)/i,
        /(?:quais|que|como usar)\s+(?:são)?\s+(?:os)?\s+(?:comandos|funções|recursos|possibilidades)/i,
        /o que você pode fazer/i,
        /(?:como|não sei)\s+(?:usar|utilizar|falar)/i,
        /(?:está|estou) (?:perdido|confuso|com dúvidas)/i,
        /(?:instruções|manual)/i
    ],

    // Padrões para analisar gastos - Mais naturais
    analysis: [
        /como\s+(?:estão|andam|estou\s+(?:com|de|nos|indo com)|foram|andaram)\s+(?:os\s+)?(?:meus|minhas)?\s*(?:gastos|despesas|contas|finanças)/i,
        /(?:me)?\s+(?:mostre|mostra|exibe|apresenta|fala sobre)\s+(?:os\s+)?(?:meus\s+)?(?:gastos|despesas|contas)/i,
        /quanto\s+(?:eu\s+)?(?:gastei|investi|paguei|torrei|usei|consumi)/i,
        /(?:ver|mostrar)\s+(?:meus\s+)?(?:gastos|despesas|saídas)/i,
        /(?:onde|em que|com o que|no que)\s+(?:estou|ando|venho|tenho)\s+(?:gastando|investindo)/i,
        /(?:onde|para onde)\s+(?:vai|está indo|foi)\s+(?:meu dinheiro|minha grana)/i
    ],

    // Padrões para metas - Mais coloquiais
    goals: [
        /(?:minhas|ver|mostrar|listar|quais|quero ver|como estão)\s+(?:as\s+)?metas/i,
        /(?:me)?\s+(?:mostre|mostra|exibe|apresenta|fala sobre)\s+(?:as\s+)?metas/i,
        /(?:quais|como estão|quero ver)\s+(?:minhas|as)\s+(?:metas|objetivos)/i,
        /(?:metas|objetivos)\s+(?:do|para|deste|desse|meu|minhas)/i
    ],

    // Padrões para orçamentos - Mais variações
    budget: [
        /(?:meu|ver|mostrar|listar|quero ver|como está)\s+(?:o\s+)?orçamento/i,
        /(?:como\s+)?(?:está|anda|vai|ficou)\s+(?:meu|o)?\s+(?:orçamento|budget)/i,
        /(?:me)?\s+(?:mostre|mostra|exibe|apresenta|fala sobre)\s+(?:meu|o)?\s+(?:orçamento|budget)/i,
        /(?:orçamento|budget)\s+(?:do|para|deste|desse|meu|minhas)/i
    ],

    // Padrões para lembretes - Mais variações
    reminders: [
        /(?:meus|ver|mostrar|listar|quero ver|como estão)\s+(?:os\s+)?lembretes/i,
        /(?:me)?\s+(?:mostre|mostra|exibe|apresenta|fala sobre)\s+(?:os\s+)?lembretes/i,
        /(?:tenho|há|existem)\s+(?:algum\s+)?lembrete/i,
        /(?:lembretes|avisos|notificações)\s+(?:do|para|deste|desse|meu|minhas)/i
    ],

    // Padrões para gráficos
    chart: [
        /(?:ver|mostrar|gerar|fazer)\s+(?:um\s+)?gráfico\s+(?:de\s+)?(pizza|linha|barra)/i,
        /gráfico\s+(?:de\s+)?(pizza|linha|barra)/i,
        /(?:pizza|linha|barra)\s+(?:de\s+)?(?:gastos|despesas|receitas)/i
    ]
};

// Processamento da mensagem de linguagem natural
async function processMessage(client, message, userPhone) {
    const text = message.body.toLowerCase().trim();
    console.log(`Processando mensagem: "${text}"`);

    // Garantir que o usuário existe no banco
    await db.registerUser(userPhone, message._data.notifyName || 'Usuário');
    
    // Verificar se quer ver o saldo (colocado mais no início para prioridade maior)
    if (matchesAnyPattern(text, patterns.balance)) {
        console.log("Padrão de saldo detectado");
        await commands.saldo(client, message);
        return;
    }

    // Verificar análise de gastos
    if (matchesAnyPattern(text, patterns.analysis)) {
        await commands.relatorio(client, message, '');
        return;
    }

    // Verificar solicitação de metas
    if (matchesAnyPattern(text, patterns.goals)) {
        await commands.meta(client, message, '');
        return;
    }

    // Verificar solicitação de orçamento
    if (matchesAnyPattern(text, patterns.budget)) {
        await commands.orcamento(client, message, '');
        return;
    }

    // Verificar solicitação de lembretes
    if (matchesAnyPattern(text, patterns.reminders)) {
        await commands.lembrete(client, message, '');
        return;
    }

    // Verificar se quer ver um gráfico
    const chartMatch = findFirstMatch(text, patterns.chart);
    if (chartMatch) {
        const tipo = chartMatch[1].toLowerCase();
        const currentDate = new Date();
        const currentMonth = String(currentDate.getMonth() + 1);
        const currentYear = String(currentDate.getFullYear());
        
        await commands.grafico(client, message, `${tipo} ${currentMonth} ${currentYear}`);
        return;
    }

    // Verificar se é uma despesa
    const expenseMatch = findFirstMatch(text, patterns.expense);
    if (expenseMatch) {
        console.log('Padrão de despesa encontrado:', expenseMatch);
        let description, amount;

        // Verificar se é um dos padrões onde o valor vem primeiro
        if (text.match(/^\d+/)) {
            [, amount, description] = expenseMatch;
        } else if (text.startsWith('gastei') || text.startsWith('paguei')) {
            [, amount, description] = expenseMatch;
        } else {
            [, description, amount] = expenseMatch;
        }

        // Limpar e validar os dados
        description = description?.trim();
        amount = parseFloat((amount || '').replace(',', '.'));

        console.log('Dados extraídos:', { description, amount });

        if (!description || isNaN(amount) || amount <= 0) {
            await client.sendMessage(message.from,
                '❌ Desculpe, não consegui entender corretamente.\n\n' +
                'Por favor, use um destes formatos:\n' +
                '• "Comprei [algo] por [valor]"\n' +
                '• "[valor] reais de [algo]"\n' +
                '• "Gastei [valor] com [algo]"\n\n' +
                'Exemplos:\n' +
                '• "Comprei pão por 5 reais"\n' +
                '• "10 reais de pão"\n' +
                '• "Gastei 15 com almoço"'
            );
            return;
        }

        // Registrar a despesa
        try {
            await db.addTransaction(userPhone, 'despesa', amount, description);
            
            const response = `✅ Despesa registrada com sucesso!\n\n` +
                           `📝 Descrição: ${description}\n` +
                           `💰 Valor: R$ ${amount.toFixed(2)}\n\n` +
                           `Quer ver seu saldo atual? Digite "saldo" ou "/saldo"`;
            
            await client.sendMessage(message.from, response);
        } catch (error) {
            console.error('Erro ao registrar despesa:', error);
            await client.sendMessage(message.from, 
                '❌ Ocorreu um erro ao registrar sua despesa.\n' +
                'Por favor, tente novamente.'
            );
        }
        return;
    }
    
    // Verificar se é uma receita com melhor tratamento de padrões
    const incomeMatch = findFirstMatch(text, patterns.income);
    if (incomeMatch) {
        console.log('Padrão de receita encontrado:', incomeMatch);
        const amount = parseFloat(incomeMatch[1].replace(',', '.'));
        let description = incomeMatch[2] || "Receita não especificada";
        
        // Se for o padrão "recebi X reais de Y", usar Y como descrição
        if (text.match(/recebi\s+\d+\s+reais\s+de/i)) {
            description = incomeMatch[2];
        }
        
        // Validação básica
        if (isNaN(amount) || amount <= 0) {
            await client.sendMessage(message.from,
                '❌ Desculpe, não consegui entender o valor corretamente.\n\n' +
                'Por favor, use formatos como:\n' +
                '• "Recebi 1000 de salário"\n' +
                '• "Recebi 500 reais de pensão"'
            );
            return;
        }
        
        try {
            // Registrar a receita
            await db.addTransaction(userPhone, 'receita', amount, description);
            
            const response = `✅ Receita registrada com sucesso!\n\n` +
                           `💰 Valor: R$ ${amount.toFixed(2)}\n` +
                           `📝 Descrição: ${description}`;
            
            await client.sendMessage(message.from, response);
        } catch (error) {
            console.error('Erro ao registrar receita:', error);
            await client.sendMessage(message.from, 
                '❌ Ocorreu um erro ao registrar sua receita.\n' +
                'Por favor, tente novamente.'
            );
        }
        return;
    }
    
    // Verificar se quer ver um relatório
    if (matchesAnyPattern(text, patterns.report)) {
        // Para relatório, usar o mês atual
        const currentDate = new Date();
        const currentMonth = String(currentDate.getMonth() + 1);
        const currentYear = String(currentDate.getFullYear());
        
        await commands.relatorio(client, message, `${currentMonth} ${currentYear}`);
        return;
    }
    
    // Verificar se é pedido de ajuda
    if (matchesAnyPattern(text, patterns.help)) {
        await client.sendMessage(message.from, 
            "🤖 *Assistente Financeiro* 🤖\n\n" +
            "Olá! Sou seu assistente financeiro pessoal. Você pode falar comigo naturalmente!\n\n" +
            "*Exemplos do que você pode dizer:*\n\n" +
            "• \"Comprei pão na padaria por R$ 5,50\"\n" +
            "• \"Gastei 120 reais com conta de luz\"\n" +
            "• \"Recebi 2500 de salário\"\n" +
            "• \"Quanto tenho de saldo?\"\n" +
            "• \"Me mostre um relatório deste mês\"\n\n" +
            "Também aceito comandos começando com /:\n" +
            "/receita, /despesa, /saldo, /relatorio, /grafico"
        );
        return;
    }
    
    // Se nenhum padrão foi identificado
    await client.sendMessage(message.from, 
        "🤔 *Não entendi.* Vou te ajudar:\n\n" +
        "*📝 Para registrar:*\n" +
        '• "Comprei pão por 5 reais"\n' +
        '• "Gastei 150 na conta de luz"\n' +
        '• "Recebi 2500 de salário"\n\n' +
        "*📊 Para consultar:*\n" +
        '• "Como está meu saldo?"\n' + 
        '• "Como estão meus gastos?"\n' +
        '• "Mostre minhas metas"\n' +
        '• "Ver meu orçamento"\n' +
        '• "Meus lembretes"\n\n' +
        "*💡 Ou use comandos:*\n" +
        "Digite /ajuda para ver todos os comandos disponíveis."
    );
}

// Auxiliar para verificar padrões múltiplos
function findFirstMatch(text, patternArray) {
    for (const pattern of patternArray) {
        const match = text.match(pattern);
        if (match) return match;
    }
    return null;
}

// Auxiliar para verificar se o texto corresponde a algum padrão do array
function matchesAnyPattern(text, patternArray) {
    return patternArray.some(pattern => text.match(pattern));
}

module.exports = {
    processMessage
};
