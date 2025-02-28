const moment = require('moment');

// Caracteres para construir gráficos
const chars = {
    bar: '█',
    halfBar: '▄',
    dot: '•',
    line: '─',
    vline: '│',
    corner: {
        tl: '┌',
        tr: '┐',
        bl: '└',
        br: '┘'
    }
};

// Gerar gráfico de barras horizontais
function generateBarChart(data, maxWidth = 20) {
    const maxValue = Math.max(...Object.values(data));
    let chart = '';

    Object.entries(data)
        .sort(([,a], [,b]) => b - a)
        .forEach(([label, value]) => {
            const percent = (value / maxValue) * 100;
            const barLength = Math.round((percent / 100) * maxWidth);
            const bar = chars.bar.repeat(barLength);
            chart += `${label.padEnd(15)}: ${bar} ${value.toFixed(2)}\n`;
        });

    return chart;
}

// Gerar gráfico de pizza usando caracteres unicode - IMPROVED VERSION
function generatePieChart(data) {
    const symbols = ['🔵', '🟢', '🟡', '🟣', '🟠', '🟤', '⚫', '⚪'];
    const bars = ['▰▰▰▰▰▰▰▰▰▰', '▰▰▰▰▰▰▰▰▰░', '▰▰▰▰▰▰▰▰░░', '▰▰▰▰▰▰▰░░░', '▰▰▰▰▰▰░░░░', '▰▰▰▰▰░░░░░', '▰▰▰▰░░░░░░', '▰▰▰░░░░░░░', '▰▰░░░░░░░░', '▰░░░░░░░░░'];
    const total = Object.values(data).reduce((a, b) => a + b, 0);
    let chart = '';

    // Sort entries by highest value
    const entries = Object.entries(data)
        .sort(([,a], [,b]) => b - a);
    
    // Add header with total
    chart += `💰 *Total de Gastos: R$ ${total.toFixed(2)}*\n\n`;
    
    // Generate chart
    entries.forEach(([label, value], index) => {
        const percent = ((value / total) * 100);
        const barIndex = Math.min(Math.floor(percent / 10), 9); // Map to 0-9 range
        const symbol = symbols[index % symbols.length];
        const bar = bars[barIndex];
        
        chart += `${symbol} *${label}:* ${bar} ${percent.toFixed(1)}%\n`;
        chart += `   R$ ${value.toFixed(2)}\n\n`;
    });

    return chart;
}

// Gerar gráfico de linha/evolução - COMPLETELY REDESIGNED
function generateLineChart(data, width = 30, height = 12) {
    if (!data || data.length === 0) return '*Não há dados para gerar o gráfico*';
    
    const days = data.map(d => parseInt(d.day));
    const expenses = data.map(d => parseFloat(d.expenses) || 0);
    const incomes = data.map(d => parseFloat(d.income) || 0);
    
    // Calculate maximums and ranges
    const maxValue = Math.max(...expenses, ...incomes) * 1.1; // Add 10% margin
    const minValue = 0;
    const range = maxValue - minValue;
    
    // Improved characters
    const gridLine = '┄';
    const axisLine = '│';
    const horizontalLine = '─';
    const incomeSymbol = '📈';
    const expenseSymbol = '💸';
    
    let chart = '*Evolução Financeira do Mês*\n\n';
    
    // Generate chart grid
    for (let i = height - 1; i >= 0; i--) {
        const lineValue = maxValue - (range * (i / (height - 1)));
        const valueLabel = `R$ ${lineValue.toFixed(0)}`.padStart(8);
        
        // Add y-axis label and line
        chart += `${valueLabel} ${axisLine}`;
        
        // For each day, determine what to display
        for (let dayIdx = 0; dayIdx < days.length; dayIdx++) {
            const dayIncome = incomes[dayIdx];
            const dayExpense = expenses[dayIdx];
            
            // Normalize heights to our chart space
            const incomeHeight = ((dayIncome - minValue) / range) * (height - 1);
            const expenseHeight = ((dayExpense - minValue) / range) * (height - 1);
            
            // Determine what character to show
            if (Math.abs(i - incomeHeight) < 0.5 && Math.abs(i - expenseHeight) < 0.5) {
                // Both income and expense are at this height
                chart += '⚡'; // Collision point
            } else if (Math.abs(i - incomeHeight) < 0.5) {
                chart += incomeSymbol;
            } else if (Math.abs(i - expenseHeight) < 0.5) {
                chart += expenseSymbol;
            } else if (i === 0) {
                chart += horizontalLine; // Base line
            } else {
                chart += gridLine; // Grid line
            }
        }
        
        chart += '\n';
    }
    
    // Add x-axis
    chart += '        ├';
    for (let i = 0; i < days.length; i++) {
        chart += '─';
    }
    chart += '┤\n';
    
    // Add day labels
    chart += '        ';
    days.forEach(day => {
        chart += day;
    });
    
    // Add legend
    chart += '\n\n📊 *Legenda:*\n';
    chart += `${incomeSymbol} Receita   ${expenseSymbol} Despesa   ⚡ Ambos\n\n`;
    
    // Add summary with progress bars
    const totalIncome = incomes.reduce((sum, val) => sum + val, 0);
    const totalExpense = expenses.reduce((sum, val) => sum + val, 0);
    const balance = totalIncome - totalExpense;
    
    // Create visual bars
    const maxBarWidth = 10;
    const ratio = totalIncome > 0 ? Math.min(totalExpense / totalIncome, 1) : 0;
    const expenseBar = '🟥'.repeat(Math.round(ratio * maxBarWidth));
    const incomeBar = '🟩'.repeat(maxBarWidth);
    
    chart += `📥 *Receitas:* ${incomeBar} R$ ${totalIncome.toFixed(2)}\n`;
    chart += `📤 *Despesas:* ${expenseBar} R$ ${totalExpense.toFixed(2)}\n`;
    chart += `${balance >= 0 ? '✅' : '⚠️'} *Saldo:* R$ ${balance.toFixed(2)} (${balance >= 0 ? '+' : ''}${((balance/totalIncome)*100).toFixed(1)}%)\n`;
    
    return chart;
}

function generateTextChart(type, data, month, year) {
    const monthName = moment(`${year}-${month}-01`).format('MMMM');
    let chartText = `📊 *Análise Financeira - ${monthName.charAt(0).toUpperCase() + monthName.slice(1)} de ${year}*\n\n`;

    if (type === 'pizza' && data.length > 0) {
        chartText += '*Distribuição de Despesas:*\n\n';
        const pieData = {};
        data.forEach(item => {
            pieData[item.description] = item.total;
        });
        chartText += generatePieChart(pieData);
    } 
    else if (type === 'barra') {
        chartText += '*Comparativo de Gastos por Categoria:*\n\n';
        const barData = {};
        data.forEach(item => {
            barData[item.description] = item.total;
        });
        chartText += generateBarChart(barData);
    }
    else if (type === 'linha' && data.length > 0) {
        chartText += '*Evolução Diária de Receitas e Despesas:*\n\n';
        chartText += generateLineChart(data);
    }
    else {
        chartText += '*Não há dados suficientes para gerar o gráfico.*';
    }

    return chartText;
}

// Improved version of budget chart
function generateBudgetChart(budgets) {
    if (!budgets || budgets.length === 0) {
        return null;
    }
    
    let chart = '*📊 Status dos Orçamentos*\n\n';
    
    // Sort by percentage used (highest first)
    budgets.sort((a, b) => b.percent_used - a.percent_used);
    
    budgets.forEach(budget => {
        // Determine status with emoji
        const status = budget.status === 'exceeded' ? '🚨 EXCEDIDO!' :
                     budget.status === 'warning' ? '⚠️ ATENÇÃO!' : '✅ OK';
                      
        // Create progress bar
        const percentUsed = budget.percent_used;
        const progressWidth = 10;
        const filledBlocks = Math.min(Math.round((percentUsed / 100) * progressWidth), progressWidth);
        
        // Use different colors based on status
        let progressBar = '';
        for (let i = 0; i < progressWidth; i++) {
            if (i < filledBlocks) {
                progressBar += budget.status === 'exceeded' ? '🟥' : 
                              budget.status === 'warning' ? '🟨' : '🟩';
            } else {
                progressBar += '⬜';
            }
        }
        
        // Add item to chart with more detailed formatting
        chart += `*${budget.category_name}* - ${status}\n`;
        chart += `${progressBar} *${percentUsed.toFixed(1)}%*\n`;
        chart += `📋 Orçado: R$ ${budget.budget_amount.toFixed(2)}\n`;
        chart += `💸 Gasto: R$ ${budget.spent_amount.toFixed(2)}\n`;
        chart += `💰 Restante: R$ ${(budget.budget_amount - budget.spent_amount).toFixed(2)}\n\n`;
    });
    
    chart += '_Use /orcamento [categoria] [valor] para definir orçamentos_';
    
    return chart;
}

module.exports = {
    generateTextChart,
    generateBudgetChart
};
