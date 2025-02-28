const db = require('./database');
const charts = require('./charts');
const moment = require('moment');
const features = require('./features');

moment.locale('pt-br');

// Helper function for calculating totals - moved outside the commands object
function calculateTotals(transactions) {
    const categorias = {};
    let receitas = 0;
    let despesas = 0;
    
    transactions.forEach(t => {
        const categoryName = t.category_name || 'Sem categoria';
        
        if (t.type === 'receita') {
            receitas += t.amount;
        } else if (t.type === 'despesa') {
            despesas += t.amount;
            categorias[categoryName] = (categorias[categoryName] || 0) + t.amount;
        }
    });
    
    return { receitas, despesas, categorias };
}

const commands = {
    // Mapeamento de aliases para comandos reais
    aliases: {
        'relatorios': 'relatorio',
        'relatório': 'relatorio',
        'relatórios': 'relatorio',
        'report': 'relatorio',
        'meta': 'metas',
        'objetivo': 'metas',
        'objetivos': 'metas',
        'goals': 'metas',
        'orcamentos': 'orcamento',
        'orçamento': 'orcamento',
        'orçamentos': 'orcamento',
        'budget': 'orcamento',
        'lembrete': 'lembretes',
        'alarme': 'lembretes',
        'alarmes': 'lembretes',
        'reminders': 'lembretes'
    },

    // Função auxiliar para processar comandos
    async processCommand(client, message, command, params = '') {
        // Remover a barra inicial se existir
        command = command.replace('/', '').toLowerCase();

        // Verificar se é um alias e obter o comando real
        const realCommand = this.aliases[command] || command;

        // Verificar se o comando existe
        if (typeof this[realCommand] === 'function') {
            await this[realCommand](client, message, params);
        } else {
            await client.sendMessage(message.from,
                '❌ Comando não encontrado!\n\n' +
                '*Comandos disponíveis:*\n' +
                '• /ajuda - Ver todos os comandos\n' +
                '• /saldo - Ver saldo atual\n' +
                '• /relatorio - Ver relatório mensal\n' +
                '• /metas - Ver suas metas\n' +
                '• /orcamento - Ver seus orçamentos\n' +
                '• /lembretes - Ver seus lembretes\n\n' +
                'Digite /ajuda para ver todos os comandos e suas opções.'
            );
        }
    },

    // Comando de ajuda
    async ajuda(client, message) {
        await client.sendMessage(message.from, 
            '🤖 *Assistente Financeiro* 🤖\n\n' +
            '*COMO USAR*\n' +
            'Você pode falar naturalmente comigo ou usar comandos.\n\n' +
            '*Exemplos de fala natural:*\n' +
            '• "Comprei pão por 5 reais"\n' +
            '• "Gastei 150 com conta de luz"\n' +
            '• "Recebi 2500 de salário"\n' +
            '• "Quanto tenho de saldo?"\n' +
            '• "Como estão meus gastos este mês?"\n\n' +
            '*COMANDOS DISPONÍVEIS*\n\n' +
            '📝 *Básicos*\n' +
            '• /ajuda - Ver esta mensagem\n' +
            '• /saldo - Consultar saldo atual\n\n' +
            '💰 *Transações*\n' +
            '• /receita [valor] [descrição] - Registrar receita\n' +
            '• /despesa [valor] [descrição] - Registrar despesa\n' +
            '• /recorrente [tipo] [valor] [descrição] [dia] - Criar transação recorrente\n\n' +
            '📊 *Relatórios e Análises*\n' +
            '• /relatorio [mes] [ano] - Ver relatório completo\n' +
            '• /grafico pizza [mes] [ano] - Gráfico de despesas\n' +
            '• /grafico linha [mes] [ano] - Evolução no mês\n' +
            '• /grafico barra [mes] [ano] - Comparativo diário\n\n' +
            '📋 *Categorias*\n' +
            '• /categorias - Listar todas categorias\n' +
            '• /categoria_add [nome] [tipo] - Criar categoria\n' +
            '• /categoria_del [nome] - Remover categoria\n\n' +
            '💵 *Orçamentos*\n' +
            '• /orcamento - Ver todos orçamentos\n' +
            '• /orcamento [categoria] [valor] - Definir orçamento\n' +
            '• /orcamento_del [categoria] - Remover orçamento\n\n' +
            '🎯 *Metas*\n' +
            '• /metas - Listar metas financeiras\n' +
            '• /meta [valor] [descrição] [data] - Criar meta\n' +
            '• /meta_update [id] [valor] - Atualizar progresso\n' +
            '• /meta_del [id] - Remover meta\n\n' +
            '⏰ *Lembretes*\n' +
            '• /lembretes - Ver lembretes pendentes\n' +
            '• /lembrete [descrição] [data] [valor] - Criar lembrete\n' +
            '• /lembrete_rec [descrição] [valor] [dia] [freq] - Criar lembrete recorrente\n' +
            '• /concluir [número] - Marcar lembrete como concluído\n\n' +
            '⚙️ *Configurações*\n' +
            '• /config notif [on/off] - Ativar/desativar notificações\n' +
            '• /config timezone [fuso] - Definir fuso horário\n' +
            '• /logout - Desconectar do bot\n\n' +
            '❓ *Dicas*\n' +
            '• Use _ para espaços em nomes (ex: conta_de_luz)\n' +
            '• Datas no formato YYYY-MM-DD\n' +
            '• Valores podem usar , ou . (ex: 1500.50 ou 1500,50)\n'
        );
    },

    // Verificar saldo
    async saldo(client, message) {
        try {
            const userPhone = message.from.split('@')[0];
            const saldo = await db.getBalance(userPhone);
            
            await client.sendMessage(message.from, 
                `💰 *Seu saldo atual*\n\n` +
                `R$ ${saldo.toFixed(2)}`
            );
        } catch (error) {
            console.error('Erro ao obter saldo:', error);
            await client.sendMessage(message.from, 'Ocorreu um erro ao consultar seu saldo.');
        }
    },

    // Enhanced relatorio command with more options
    async relatorio(client, message, params = '') {
        try {
            const parts = params.split(' ');
            let mes, ano, filter, category;
            
            // Parse parameters based on different formats
            if (parts.length >= 2) {
                mes = parts[0].padStart(2, '0');
                ano = parts[1];
                
                // Check for additional filters
                if (parts.length > 2) {
                    filter = parts[2].toLowerCase();
                    if (['receita', 'despesa', 'categoria'].includes(filter)) {
                        if (filter === 'categoria' && parts.length > 3) {
                            category = parts[3];
                        }
                    }
                }
            } else {
                const dataAtual = new Date();
                mes = String(dataAtual.getMonth() + 1).padStart(2, '0');
                ano = String(dataAtual.getFullYear());
            }
            
            if (isNaN(parseInt(mes)) || isNaN(parseInt(ano))) {
                await client.sendMessage(message.from, 
                    'Por favor, forneça mês e ano válidos.\n' +
                    'Formato: /relatorio [mes] [ano] [opcional: receita/despesa/categoria [nome_categoria]]'
                );
                return;
            }

            const userPhone = message.from.split('@')[0];
            console.log(`Generating report for user: ${userPhone}, month: ${mes}, year: ${ano}`);
            
            // Get all transactions for the period
            const transactions = await db.getTransactions(userPhone, mes, ano);
            const saldo = await db.getBalance(userPhone);
            
            // Filter transactions if necessary
            const filteredTransactions = filter === 'receita' ? transactions.filter(t => t.type === 'receita') :
                                        filter === 'despesa' ? transactions.filter(t => t.type === 'despesa') :
                                        filter === 'categoria' && category ? transactions.filter(t => 
                                            t.category_name && t.category_name.toLowerCase() === category.toLowerCase()
                                        ) : transactions;
            
            // Calculate totals by category with proper grouping
            const categoriasDespesa = {};
            const categoriasReceita = {};
            let totalReceitas = 0;
            let totalDespesas = 0;
            
            filteredTransactions.forEach(t => {
                const categoryName = t.category_name || 'Sem categoria';
                
                if (t.type === 'receita') {
                    totalReceitas += t.amount;
                    categoriasReceita[categoryName] = (categoriasReceita[categoryName] || 0) + t.amount;
                } else if (t.type === 'despesa') {
                    totalDespesas += t.amount;
                    categoriasDespesa[categoryName] = (categoriasDespesa[categoryName] || 0) + t.amount;
                }
            });
            
            // Format the month name
            const nomeMes = moment(`${ano}-${mes}-01`, 'YYYY-MM-DD').format('MMMM');
            
            // Build the report header with filter information
            let relatorio = `📊 *Relatório Financeiro - ${nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1)} de ${ano}*\n`;
            
            if (filter === 'receita') {
                relatorio += `*Filtro: Apenas receitas*\n\n`;
            } else if (filter === 'despesa') {
                relatorio += `*Filtro: Apenas despesas*\n\n`;
            } else if (filter === 'categoria' && category) {
                relatorio += `*Filtro: Categoria "${category}"*\n\n`;
            } else {
                relatorio += '\n';
            }
            
            // General summary section
            relatorio += `*Resumo Geral:*\n`;
            if (!filter || filter === 'receita') {
                relatorio += `➕ Total de receitas: R$ ${totalReceitas.toFixed(2)}\n`;
            }
            if (!filter || filter === 'despesa') {
                relatorio += `➖ Total de despesas: R$ ${totalDespesas.toFixed(2)}\n`;
            }
            if (!filter) {
                relatorio += `📈 Saldo do período: R$ ${(totalReceitas - totalDespesas).toFixed(2)}\n`;
                relatorio += `💰 Saldo atual: R$ ${saldo.toFixed(2)}\n`;
            }
            relatorio += '\n';
            
            // Income by category, if applicable
            if (Object.keys(categoriasReceita).length > 0 && (!filter || filter === 'receita')) {
                relatorio += `*Receitas por categoria:*\n`;
                Object.entries(categoriasReceita)
                    .sort(([,a], [,b]) => b - a)
                    .forEach(([categoria, valor]) => {
                        const porcentagem = ((valor / totalReceitas) * 100).toFixed(1);
                        relatorio += `• ${categoria}: R$ ${valor.toFixed(2)} (${porcentagem}%)\n`;
                    });
                relatorio += '\n';
            }
            
            // Expenses by category, if applicable
            if (Object.keys(categoriasDespesa).length > 0 && (!filter || filter === 'despesa')) {
                relatorio += `*Despesas por categoria:*\n`;
                Object.entries(categoriasDespesa)
                    .sort(([,a], [,b]) => b - a)
                    .forEach(([categoria, valor]) => {
                        const porcentagem = totalDespesas > 0 ? ((valor / totalDespesas) * 100).toFixed(1) : '0.0';
                        relatorio += `• ${categoria}: R$ ${valor.toFixed(2)} (${porcentagem}%)\n`;
                    });
                relatorio += '\n';
            }
            
            // Recent transactions (showing more if filtering is applied)
            if (filteredTransactions.length > 0) {
                relatorio += `*${filter ? 'Todas as transações' : 'Últimas transações'}:*\n`;
                
                // Show all filtered transactions or just the last 5
                const transactionsToShow = filter ? filteredTransactions : filteredTransactions.slice(0, 5);
                
                transactionsToShow.forEach(t => {
                    const data = moment(t.date).format('DD/MM');
                    const tipo = t.type === 'receita' ? '➕' : '➖';
                    const categoria = t.category_name ? ` [${t.category_name}]` : '';
                    relatorio += `${tipo} ${data}${categoria} - ${t.description} - R$ ${t.amount.toFixed(2)}\n`;
                });
                
                if (!filter && filteredTransactions.length > 5) {
                    relatorio += '\n... e mais transações. Use filtros para ver todas.';
                }
            }
            
            // Add help section explaining filter options
            relatorio += '\n\n*Dica:* Use filtros para ver relatórios específicos:';
            relatorio += '\n• /relatorio [mes] [ano] receita - Apenas receitas';
            relatorio += '\n• /relatorio [mes] [ano] despesa - Apenas despesas';
            relatorio += '\n• /relatorio [mes] [ano] categoria [nome] - Por categoria';
            
            // Send the report
            await client.sendMessage(message.from, relatorio);

            // Only generate charts and budget summary if no filter is applied
            if (!filter) {
                try {
                    // Generate pie chart for expense distribution
                    const pizzaChartData = await db.getChartData(userPhone, mes, ano, 'pizza');
                    if (pizzaChartData && pizzaChartData.length > 0) {
                        const pizzaChart = charts.generateTextChart('pizza', pizzaChartData, mes, ano);
                        await client.sendMessage(message.from, pizzaChart);
                    }
                    
                    // Generate line chart for daily evolution
                    const lineChartData = await db.getChartData(userPhone, mes, ano, 'linha');
                    if (lineChartData && lineChartData.length > 0) {
                        const lineChart = charts.generateTextChart('linha', lineChartData, mes, ano);
                         await client.sendMessage(message.from, lineChart);
                    }

                    // Check budget status
                    const budgetProgress = await features.budget.checkBudgetProgress(userPhone);
                    if (budgetProgress && budgetProgress.length > 0) {
                        const budgetChart = charts.generateBudgetChart(budgetProgress);
                        if (budgetChart) {
                            await client.sendMessage(message.from, budgetChart);
                        }
                    }
                } catch (chartError) {
                    console.error('Error generating charts:', chartError);
                }
            }
        } catch (error) {
            console.error('Error generating report:', error);
            await client.sendMessage(message.from, 'Ocorreu um erro ao gerar seu relatório.');
        }
    },

    // New command to compare months
    async comparar(client, message, params = '') {
        try {
            const parts = params.split(' ');
            if (parts.length < 4) {
                await client.sendMessage(message.from,
                    'Formato correto: /comparar [mes1] [ano1] [mes2] [ano2]\n' +
                    'Exemplo: /comparar 01 2024 02 2024'
                );
                return;
            }
            
            const mes1 = parts[0].padStart(2, '0');
            const ano1 = parts[1];
            const mes2 = parts[2].padStart(2, '0');
            const ano2 = parts[3];
            
            if (isNaN(parseInt(mes1)) || isNaN(parseInt(ano1)) || 
                isNaN(parseInt(mes2)) || isNaN(parseInt(ano2))) {
                await client.sendMessage(message.from, 'Por favor, forneça meses e anos válidos.');
                return;
            }
            
            const userPhone = message.from.split('@')[0];
            
            // Get transactions for both periods
            const transactions1 = await db.getTransactions(userPhone, mes1, ano1);
            const transactions2 = await db.getTransactions(userPhone, mes2, ano2);
            
            // Calculate totals
            const totals1 = calculateTotals(transactions1);
            const totals2 = calculateTotals(transactions2);
            
            // Format month names
            const nomeMes1 = moment(`${ano1}-${mes1}-01`).format('MMMM');
            const nomeMes2 = moment(`${ano2}-${mes2}-01`).format('MMMM');
            
            // Build the comparison report
            let comparison = `📊 *Comparativo: ${nomeMes1.charAt(0).toUpperCase() + nomeMes1.slice(1)}/${ano1} x ${nomeMes2.charAt(0).toUpperCase() + nomeMes2.slice(1)}/${ano2}*\n\n`;
            
            // Receitas comparison
            const receitasDiff = totals2.receitas - totals1.receitas;
            const receitasPercent = totals1.receitas > 0 ? (receitasDiff / totals1.receitas) * 100 : 0;
            
            comparison += `*Receitas:*\n`;
            comparison += `${nomeMes1}/${ano1}: R$ ${totals1.receitas.toFixed(2)}\n`;
            comparison += `${nomeMes2}/${ano2}: R$ ${totals2.receitas.toFixed(2)}\n`;
            comparison += `Diferença: ${receitasDiff >= 0 ? '+' : ''}R$ ${receitasDiff.toFixed(2)} (${receitasPercent >= 0 ? '+' : ''}${receitasPercent.toFixed(1)}%)\n\n`;
            
            // Despesas comparison
            const despesasDiff = totals2.despesas - totals1.despesas;
            const despesasPercent = totals1.despesas > 0 ? (despesasDiff / totals1.despesas) * 100 : 0;
            
            comparison += `*Despesas:*\n`;
            comparison += `${nomeMes1}/${ano1}: R$ ${totals1.despesas.toFixed(2)}\n`;
            comparison += `${nomeMes2}/${ano2}: R$ ${totals2.despesas.toFixed(2)}\n`;
            comparison += `Diferença: ${despesasDiff >= 0 ? '+' : ''}R$ ${despesasDiff.toFixed(2)} (${despesasPercent >= 0 ? '+' : ''}${despesasPercent.toFixed(1)}%)\n\n`;
            
            // Saldo comparison
            const saldo1 = totals1.receitas - totals1.despesas;
            const saldo2 = totals2.receitas - totals2.despesas;
            const saldoDiff = saldo2 - saldo1;
            
            comparison += `*Saldo do Período:*\n`;
            comparison += `${nomeMes1}/${ano1}: R$ ${saldo1.toFixed(2)}\n`;
            comparison += `${nomeMes2}/${ano2}: R$ ${saldo2.toFixed(2)}\n`;
            comparison += `Diferença: ${saldoDiff >= 0 ? '+' : ''}R$ ${saldoDiff.toFixed(2)}\n\n`;
            
            // Category comparison
            comparison += `*Maiores variações por categoria:*\n`;
            
            // Get combined categories from both months
            const allCategories = new Set();
            [...transactions1, ...transactions2].forEach(t => {
                if (t.category_name) allCategories.add(t.category_name);
            });
            
            // Compare spending by category
            const categoryComparison = [];
            
            allCategories.forEach(category => {
                const cat1 = totals1.categorias[category] || 0;
                const cat2 = totals2.categorias[category] || 0;
                const catDiff = cat2 - cat1;
                const catPercent = cat1 > 0 ? (catDiff / cat1) * 100 : 0;
                
                categoryComparison.push({
                    category,
                    value1: cat1,
                    value2: cat2,
                    diff: catDiff,
                    percent: catPercent
                });
            });
            
            // Sort by absolute difference
            categoryComparison.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
            
            // Show top 5 categories with biggest changes
            categoryComparison.slice(0, 5).forEach(cat => {
                comparison += `• ${cat.category}: ${cat.diff >= 0 ? '+' : ''}R$ ${cat.diff.toFixed(2)} (${cat.percent >= 0 ? '+' : ''}${cat.percent.toFixed(1)}%)\n`;
            });
            
            await client.sendMessage(message.from, comparison);
            
        } catch (error) {
            console.error('Error comparing periods:', error);
            await client.sendMessage(message.from, 'Ocorreu um erro ao comparar os períodos.');
        }
    },

    // New command for monthly average stats
    async media(client, message, params = '') {
        try {
            const parts = params.split(' ');
            if (parts.length < 1) {
                await client.sendMessage(message.from,
                    'Formato correto: /media [meses]\n' +
                    'Exemplo: /media 3 (para média dos últimos 3 meses)'
                );
                return;
            }
            
            const numMeses = parseInt(parts[0]);
            if (isNaN(numMeses) || numMeses < 1 || numMeses > 12) {
                await client.sendMessage(message.from, 'Por favor, forneça um número de meses válido (1-12).');
                return;
            }
            
            const userPhone = message.from.split('@')[0];
            const today = moment();
            
            let totalReceitas = 0;
            let totalDespesas = 0;
            const categoriasDespesa = {};
            const transactionsByMonth = {};
            
            // Get data for each month
            for (let i = 0; i < numMeses; i++) {
                const currDate = moment().subtract(i, 'months');
                const mes = currDate.format('MM');
                const ano = currDate.format('YYYY');
                
                transactionsByMonth[`${mes}/${ano}`] = await db.getTransactions(userPhone, mes, ano);
            }
            
            // Process all transactions
            Object.entries(transactionsByMonth).forEach(([monthKey, monthTransactions]) => {
                let monthReceitas = 0;
                let monthDespesas = 0;
                
                monthTransactions.forEach(t => {
                    if (t.type === 'receita') {
                        monthReceitas += t.amount;
                    } else if (t.type === 'despesa') {
                        monthDespesas += t.amount;
                        
                        // Accumulate by category
                        const category = t.category_name || 'Sem categoria';
                        if (!categoriasDespesa[category]) {
                            categoriasDespesa[category] = { total: 0, count: 0 };
                        }
                        categoriasDespesa[category].total += t.amount;
                        categoriasDespesa[category].count++;
                    }
                });
                
                totalReceitas += monthReceitas;
                totalDespesas += monthDespesas;
            });
            
            // Calculate averages
            const mediaReceitas = totalReceitas / numMeses;
            const mediaDespesas = totalDespesas / numMeses;
            
            // Build the report
            let report = `📊 *Média Mensal (últimos ${numMeses} meses)*\n\n`;
            
            report += `*Resumo:*\n`;
            report += `➕ Receitas: R$ ${mediaReceitas.toFixed(2)}/mês\n`;
            report += `➖ Despesas: R$ ${mediaDespesas.toFixed(2)}/mês\n`;
            report += `📈 Saldo médio: R$ ${(mediaReceitas - mediaDespesas).toFixed(2)}/mês\n\n`;
            
            report += `*Despesas por categoria (média mensal):*\n`;
            
            // Sort categories by average amount
            const sortedCategories = Object.entries(categoriasDespesa)
                .map(([name, data]) => ({
                    name,
                    average: data.total / numMeses
                }))
                .sort((a, b) => b.average - a.average);
            
            sortedCategories.forEach(cat => {
                const percent = (cat.average / mediaDespesas) * 100;
                report += `• ${cat.name}: R$ ${cat.average.toFixed(2)} (${percent.toFixed(1)}%)\n`;
            });
            
            await client.sendMessage(message.from, report);
            
        } catch (error) {
            console.error('Error calculating averages:', error);
            await client.sendMessage(message.from, 'Ocorreu um erro ao calcular as médias mensais.');
        }
    },

    // Gerar gráfico
    async grafico(client, message, params) {
        try {
            const parts = params.split(' ');
            
            if (parts.length < 3) {
                await client.sendMessage(message.from, 'Formato correto: /grafico [tipo: pizza/linha/barra] [mes] [ano]');
                return;
            }
            
            const tipo = parts[0].toLowerCase();
            const mes = parts[1];
            const ano = parts[2];
            
            if (tipo !== 'pizza' && tipo !== 'linha' && tipo !== 'barra') {
                await client.sendMessage(message.from, 'Tipo de gráfico inválido. Use: pizza, linha ou barra');
                return;
            }
            
            if (isNaN(parseInt(mes)) || isNaN(parseInt(ano))) {
                await client.sendMessage(message.from, 'Por favor, forneça mês e ano válidos.');
                return;
            }
            
            const userPhone = message.from.split('@')[0];
            const chartData = await db.getChartData(userPhone, mes, ano, tipo);
            
            if (chartData.length === 0) {
                await client.sendMessage(message.from, 'Não há dados suficientes para gerar um gráfico neste período.');
                return;
            }
            
            // Gerar o gráfico em formato de texto
            const chartText = charts.generateTextChart(tipo, chartData, mes, ano);
            
            // Enviar o resultado
            await client.sendMessage(message.from, chartText);
        } catch (error) {
            console.error('Erro ao gerar gráfico:', error);
            await client.sendMessage(message.from, 'Ocorreu um erro ao gerar seu gráfico.');
        }
    },

    // Gerenciar categorias
    async categorias(client, message, params = '') {
        try {
            const userPhone = message.from.split('@')[0];
            const allCategories = await features.categories.listCategories(userPhone);
            
            let response = '*📋 Suas Categorias:*\n\n';
            
            // Separar por tipo
            const despesas = allCategories.filter(c => c.type === 'despesa');
            const receitas = allCategories.filter(c => c.type === 'receita');
            
            if (receitas.length > 0) {
                response += '*Receitas:*\n';
                receitas.forEach(c => {
                    response += `• ${c.name}\n`;
                });
                response += '\n';
            }
            
            if (despesas.length > 0) {
                response += '*Despesas:*\n';
                despesas.forEach(c => {
                    response += `• ${c.name}\n`;
                });
            }
            
            response += '\nPara adicionar: /categoria_add [nome] [tipo]';
            response += '\nPara remover: /categoria_del [nome]';
            
            await client.sendMessage(message.from, response);
        } catch (error) {
            console.error('Erro ao listar categorias:', error);
            await client.sendMessage(message.from, 'Ocorreu um erro ao listar suas categorias.');
        }
    },

    // Gerenciar orçamentos
    async orcamento(client, message, params = '') {
        const parts = params.split(' ');
        const userPhone = message.from.split('@')[0];
        
        if (parts.length < 2) {
            // Mostrar orçamentos atuais
            const budgets = await features.budget.checkBudgetProgress(userPhone);
            
            if (budgets.length === 0) {
                await client.sendMessage(message.from, 
                    'Você ainda não definiu nenhum orçamento.\n\n' +
                    'Para definir: /orcamento [categoria] [valor]'
                );
                return;
            }
            
            let response = '*💰 Seus Orçamentos:*\n\n';
            budgets.forEach(b => {
                const status = b.status === 'exceeded' ? '⚠️ EXCEDIDO' :
                             b.status === 'warning' ? '⚡ ATENÇÃO' : '✅ OK';
                response += `${status} ${b.category_name}\n`;
                response += `Orçado: R$ ${b.budget_amount.toFixed(2)}\n`;
                response += `Gasto: R$ ${b.spent_amount.toFixed(2)} (${b.percent_used.toFixed(1)}%)\n\n`;
            });
            
            await client.sendMessage(message.from, response);
            return;
        }
        
        try {
            const categoryName = parts[0];
            const amount = parseFloat(parts[1].replace(',', '.'));
            
            if (isNaN(amount)) {
                await client.sendMessage(message.from, 'Por favor, forneça um valor válido.');
                return;
            }
            
            // Buscar categoria
            const userCategories = await features.categories.listCategories(userPhone);
            const category = userCategories.find(c => 
                c.name.toLowerCase() === categoryName.toLowerCase()
            );
            
            if (!category) {
                await client.sendMessage(message.from, 
                    'Categoria não encontrada.\n' +
                    'Use /categorias para ver as categorias disponíveis.'
                );
                return;
            }
            
            // Definir orçamento
            await features.budget.setBudget(userPhone, category.id, amount);
            
            await client.sendMessage(message.from,
                `✅ Orçamento definido!\n\n` +
                `Categoria: ${category.name}\n` +
                `Valor: R$ ${amount.toFixed(2)}`
            );
            
        } catch (error) {
            console.error('Erro ao definir orçamento:', error);
            await client.sendMessage(message.from, 'Ocorreu um erro ao definir o orçamento.');
        }
    },

    // Gerenciar metas
    async meta(client, message, params = '') {
        const parts = params.split(' ');
        const userPhone = message.from.split('@')[0];
        
        if (parts.length < 3) {
            // Mostrar metas atuais
            const userGoals = await features.goals.listGoals(userPhone);
            
            if (userGoals.length === 0) {
                await client.sendMessage(message.from,
                    'Você não tem metas definidas.\n\n' +
                    'Para criar: /meta [valor] [descrição] [data]\n' +
                    'Exemplo: /meta 1000 Reserva_de_emergência 2024-12-31'
                );
                return;
            }
            
            let response = '*🎯 Suas Metas:*\n\n';
            userGoals.forEach(g => {
                const progress = (g.current_amount / g.target_amount) * 100;
                response += `*${g.name}*\n`;
                response += `Meta: R$ ${g.target_amount.toFixed(2)}\n`;
                response += `Atual: R$ ${g.current_amount.toFixed(2)}\n`;
                response += `Progresso: ${progress.toFixed(1)}%\n`;
                response += `Faltam ${g.days_left} dias\n\n`;
            });
            
            await client.sendMessage(message.from, response);
            return;
        }
        
        try {
            const amount = parseFloat(parts[0].replace(',', '.'));
            const date = parts[parts.length - 1];
            const description = parts.slice(1, -1).join('_');
            
            if (isNaN(amount)) {
                await client.sendMessage(message.from, 'Por favor, forneça um valor válido.');
                return;
            }
            
            // Validar data
            if (!moment(date, 'YYYY-MM-DD').isValid()) {
                await client.sendMessage(message.from,
                    'Data inválida. Use o formato YYYY-MM-DD\n' +
                    'Exemplo: 2024-12-31'
                );
                return;
            }
            
            // Criar meta
            await features.goals.createGoal(userPhone, description, amount, date);
            
            await client.sendMessage(message.from,
                `✅ Meta criada com sucesso!\n\n` +
                `Descrição: ${description.replace(/_/g, ' ')}\n` +
                `Valor: R$ ${amount.toFixed(2)}\n` +
                `Data: ${moment(date).format('DD/MM/YYYY')}`
            );
            
        } catch (error) {
            console.error('Erro ao criar meta:', error);
            await client.sendMessage(message.from, 'Ocorreu um erro ao criar a meta.');
        }
    },

    // Gerenciar lembretes
    async lembrete(client, message, params = '') {
        const parts = params.split(' ');
        const userPhone = message.from.split('@')[0];
        
        if (parts.length < 3) {
            // Mostrar lembretes pendentes
            const pendingReminders = await features.reminders.listPendingReminders(userPhone);
            
            if (pendingReminders.length === 0) {
                await client.sendMessage(message.from,
                    'Você não tem lembretes pendentes.\n\n' +
                    'Para criar: /lembrete [descrição] [data] [valor]\n' +
                    'Exemplo: /lembrete Conta_de_luz 2024-02-10 150.00'
                );
                return;
            }
            
            let response = '*⏰ Seus Lembretes:*\n\n';
            pendingReminders.forEach((r, index) => {
                response += `${index + 1}. *${r.description}*\n`;
                if (r.amount > 0) {
                    response += `   Valor: R$ ${r.amount.toFixed(2)}\n`;
                }
                response += `   Data: ${r.formatted_due_date}\n`;
                if (r.category_name) {
                    response += `   Categoria: ${r.category_name}\n`;
                }
                response += `   Status: ${r.status}\n\n`;
            });
            
            response += 'Para marcar como concluído: /concluir [número]';
            
            await client.sendMessage(message.from, response);
            return;
        }
        
        try {
            const description = parts.slice(0, -2).join('_');
            const date = parts[parts.length - 2];
            const amount = parseFloat(parts[parts.length - 1].replace(',', '.'));
            
            if (isNaN(amount)) {
                await client.sendMessage(message.from, 'Por favor, forneça um valor válido.');
                return;
            }
            
            // Validar data
            if (!moment(date, 'YYYY-MM-DD').isValid()) {
                await client.sendMessage(message.from,
                    'Data inválida. Use o formato YYYY-MM-DD\n' +
                    'Exemplo: 2024-02-10'
                );
                return;
            }
            
            // Criar lembrete
            await features.reminders.createReminder(
                userPhone,
                description.replace(/_/g, ' '),
                date,
                amount
            );
            
            await client.sendMessage(message.from,
                `✅ Lembrete criado!\n\n` +
                `Descrição: ${description.replace(/_/g, ' ')}\n` +
                `Data: ${moment(date).format('DD/MM/YYYY')}\n` +
                `Valor: R$ ${amount.toFixed(2)}`
            );
            
        } catch (error) {
            console.error('Erro ao criar lembrete:', error);
            await client.sendMessage(message.from, 'Ocorreu um erro ao criar o lembrete.');
        }
    },

    // Concluir lembrete
    async concluir(client, message, params = '') {
        const userPhone = message.from.split('@')[0];
        const number = parseInt(params);
        
        if (isNaN(number)) {
            await client.sendMessage(message.from,
                'Por favor, forneça o número do lembrete.\n' +
                'Use /lembrete para ver a lista de lembretes.'
            );
            return;
        }
        
        try {
            const pendingReminders = await features.reminders.listPendingReminders(userPhone);
            
            if (number < 1 || number > pendingReminders.length) {
                await client.sendMessage(message.from, 'Número de lembrete inválido.');
                return;
            }
            
            const reminder = pendingReminders[number - 1];
            
            // Marcar como concluído e registrar transação
            await features.reminders.completeReminder(userPhone, reminder.id, true);
            
            await client.sendMessage(message.from,
                `✅ Lembrete concluído!\n\n` +
                `${reminder.description}\n` +
                `Valor: R$ ${reminder.amount.toFixed(2)}`
            );
            
        } catch (error) {
            console.error('Erro ao concluir lembrete:', error);
            await client.sendMessage(message.from, 'Ocorreu um erro ao concluir o lembrete.');
        }
    }
};

// Exportar como função de processamento
module.exports = {
    processCommand: commands.processCommand.bind(commands),
    ...commands
};
