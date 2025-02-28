/**
 * Sistema de lembretes financeiros
 */

const db = require('../database');
const moment = require('moment');
moment.locale('pt-br');

// Criar novo lembrete
async function createReminder(userPhone, description, dueDate, amount = null, category = null, recurring = false, recurrencePattern = null) {
    // Converter a data para formato ISO se for uma string
    if (typeof dueDate === 'string') {
        dueDate = moment(dueDate, 'YYYY-MM-DD').format('YYYY-MM-DD');
    }
    
    return new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO reminders (user_phone, description, amount, due_date, category_id, recurring, recurrence_pattern)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [userPhone, description, amount, dueDate, category, recurring ? 1 : 0, recurrencePattern],
            function(err) {
                if (err) return reject(err);
                resolve(this.lastID);
            }
        );
    });
}

// Listar lembretes pendentes
async function listPendingReminders(userPhone, daysAhead = 7) {
    try {
        const connection = db.getConnection();
        const today = moment().startOf('day').format('YYYY-MM-DD');
        const futureDate = moment().add(daysAhead, 'days').endOf('day').format('YYYY-MM-DD');
        
        return new Promise((resolve, reject) => {
            connection.all(
                `SELECT r.*, c.name as category_name
                FROM reminders r
                LEFT JOIN categories c ON r.category_id = c.id
                WHERE r.user_phone = ? AND r.completed = 0
                AND r.due_date BETWEEN ? AND ?
                ORDER BY r.due_date`,
                [userPhone, today, futureDate],
                (err, rows) => {
                    if (err) return reject(err);
                    
                    // Formatar datas e adicionar informações úteis
                    const results = (rows || []).map(row => {
                        const dueDate = moment(row.due_date);
                        const daysLeft = dueDate.diff(moment(), 'days');
                        
                        return {
                            ...row,
                            formatted_due_date: dueDate.format('DD/MM/YYYY'),
                            days_left: daysLeft,
                            status: daysLeft < 0 ? 'atrasado' : 
                                  daysLeft === 0 ? 'hoje' : 'próximo'
                        };
                    });
                    
                    resolve(results);
                }
            );
        });
    } catch (error) {
        console.error('Erro ao listar lembretes pendentes:', error);
        return [];
    }
}

// Marcar lembrete como concluído e opcionalmente registrar a transação
async function completeReminder(userPhone, reminderId, registerTransaction = false) {
    try {
        // Obter informações do lembrete
        const reminder = await new Promise((resolve, reject) => {
            db.get(
                `SELECT * FROM reminders WHERE id = ? AND user_phone = ?`,
                [reminderId, userPhone],
                (err, row) => {
                    if (err) return reject(err);
                    if (!row) return reject(new Error('Lembrete não encontrado'));
                    resolve(row);
                }
            );
        });
        
        // Registrar transação se solicitado
        if (registerTransaction && reminder.amount > 0) {
            // Determinar o tipo com base na descrição ou categoria
            // (Uma implementação mais sofisticada poderia analisar a categoria)
            const transactionType = reminder.description.toLowerCase().includes('pagamento') ? 'despesa' : 'receita';
            
            await db.addTransaction(
                userPhone, 
                transactionType,
                reminder.amount,
                reminder.description,
                reminder.category_id
            );
        }
        
        // Marcar como concluído
        await new Promise((resolve, reject) => {
            db.run(
                `UPDATE reminders SET completed = 1, completed_at = CURRENT_TIMESTAMP
                 WHERE id = ? AND user_phone = ?`,
                [reminderId, userPhone],
                function(err) {
                    if (err) return reject(err);
                    resolve(this.changes > 0);
                }
            );
        });
        
        // Se for recorrente, criar o próximo lembrete
        if (reminder.recurring && reminder.recurrence_pattern) {
            const pattern = reminder.recurrence_pattern;
            let nextDueDate;
            
            // Calcular próxima data com base no padrão
            if (pattern === 'daily') {
                nextDueDate = moment(reminder.due_date).add(1, 'day');
            } else if (pattern === 'weekly') {
                nextDueDate = moment(reminder.due_date).add(1, 'week');
            } else if (pattern === 'monthly') {
                nextDueDate = moment(reminder.due_date).add(1, 'month');
            } else if (pattern === 'yearly') {
                nextDueDate = moment(reminder.due_date).add(1, 'year');
            }
            
            if (nextDueDate) {
                await createReminder(
                    userPhone,
                    reminder.description,
                    nextDueDate.format('YYYY-MM-DD'),
                    reminder.amount,
                    reminder.category_id,
                    true,
                    pattern
                );
            }
        }
        
        return { success: true, transactionRegistered: registerTransaction };
    } catch (error) {
        throw error;
    }
}

// Excluir lembrete
async function deleteReminder(userPhone, reminderId) {
    return new Promise((resolve, reject) => {
        db.run(
            `DELETE FROM reminders WHERE id = ? AND user_phone = ?`,
            [reminderId, userPhone],
            function(err) {
                if (err) return reject(err);
                resolve(this.changes > 0);
            }
        );
    });
}

// Verificar e enviar lembretes do dia
async function checkDailyReminders(client) {
    const today = moment().format('YYYY-MM-DD');
    
    try {
        // Buscar todos os lembretes para o dia atual
        const reminders = await new Promise((resolve, reject) => {
            db.all(
                `SELECT r.*, u.phone, c.name as category_name
                 FROM reminders r
                 JOIN users u ON r.user_phone = u.phone
                 LEFT JOIN categories c ON r.category_id = c.id
                 WHERE r.due_date = ? AND r.completed = 0
                 ORDER BY r.user_phone`,
                [today],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows || []);
                }
            );
        });
        
        // Agrupar por usuário
        const remindersByUser = {};
        for (const reminder of reminders) {
            if (!remindersByUser[reminder.user_phone]) {
                remindersByUser[reminder.user_phone] = [];
            }
            remindersByUser[reminder.user_phone].push(reminder);
        }
        
        // Enviar mensagens para cada usuário
        for (const [phone, userReminders] of Object.entries(remindersByUser)) {
            if (userReminders.length > 0) {
                let message = `📅 *Lembretes para hoje (${moment().format('DD/MM/YYYY')})*\n\n`;
                
                userReminders.forEach((reminder, index) => {
                    message += `${index + 1}. *${reminder.description}*\n`;
                    if (reminder.amount > 0) {
                        message += `   Valor: R$ ${reminder.amount.toFixed(2)}\n`;
                    }
                    if (reminder.category_name) {
                        message += `   Categoria: ${reminder.category_name}\n`;
                    }
                    message += '\n';
                });
                
                message += `Para marcar como concluído, responda com "/concluir [número]"`;
                
                // Enviar mensagem para o usuário
                await client.sendMessage(`${phone}@c.us`, message);
            }
        }
        
        return reminders.length;
    } catch (error) {
        console.error('Erro ao processar lembretes diários:', error);
        return 0;
    }
}

module.exports = {
    createReminder,
    listPendingReminders,
    completeReminder,
    deleteReminder,
    checkDailyReminders
};