/**
 * Gestão de metas financeiras
 */

const db = require('../database');
const moment = require('moment');

// Criar nova meta financeira
async function createGoal(userPhone, name, targetAmount, targetDate, category = null) {
    // Converter a data para formato ISO se for uma string
    if (typeof targetDate === 'string') {
        targetDate = moment(targetDate, 'YYYY-MM-DD').format('YYYY-MM-DD');
    }
    
    return new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO goals (user_phone, name, target_amount, current_amount, target_date, category_id)
             VALUES (?, ?, ?, 0, ?, ?)`,
            [userPhone, name, targetAmount, targetDate, category],
            function(err) {
                if (err) return reject(err);
                resolve(this.lastID);
            }
        );
    });
}

// Atualizar progresso de uma meta
async function updateGoalProgress(userPhone, goalId, amount, isAddition = true) {
    return new Promise((resolve, reject) => {
        db.get(
            `SELECT current_amount, target_amount FROM goals
             WHERE id = ? AND user_phone = ?`,
            [goalId, userPhone],
            (err, row) => {
                if (err) return reject(err);
                if (!row) return reject(new Error('Meta não encontrada'));
                
                // Calcular novo valor
                let newAmount;
                if (isAddition) {
                    newAmount = row.current_amount + amount;
                } else {
                    newAmount = amount; // Substituir pelo valor direto
                }
                
                // Limitar ao valor alvo
                newAmount = Math.min(newAmount, row.target_amount);
                
                // Atualizar meta
                db.run(
                    `UPDATE goals
                     SET current_amount = ?, updated_at = CURRENT_TIMESTAMP,
                         completed = CASE WHEN current_amount >= target_amount THEN 1 ELSE 0 END
                     WHERE id = ? AND user_phone = ?`,
                    [newAmount, goalId, userPhone],
                    function(err) {
                        if (err) return reject(err);
                        
                        // Verificar se a meta foi completada
                        const completed = newAmount >= row.target_amount;
                        
                        resolve({
                            updated: this.changes > 0,
                            completed,
                            progress: (newAmount / row.target_amount) * 100
                        });
                    }
                );
            }
        );
    });
}

// Listar metas do usuário
async function listGoals(userPhone, includeCompleted = false) {
    try {
        const connection = db.getConnection();
        
        let query = `
            SELECT g.*, c.name as category_name
            FROM goals g
            LEFT JOIN categories c ON g.category_id = c.id
            WHERE g.user_phone = ?`;
        
        if (!includeCompleted) {
            query += ` AND g.completed = 0`;
        }
        
        query += ` ORDER BY g.target_date`;
        
        return new Promise((resolve, reject) => {
            connection.all(query, [userPhone], (err, rows) => {
                if (err) return reject(err);
                
                // Calcular informações adicionais
                const results = (rows || []).map(row => {
                    const targetDate = moment(row.target_date);
                    const daysLeft = targetDate.diff(moment(), 'days');
                    const progress = (row.current_amount / row.target_amount) * 100;
                    
                    return {
                        ...row,
                        days_left: daysLeft,
                        progress: progress,
                        remaining_amount: row.target_amount - row.current_amount
                    };
                });
                
                resolve(results);
            });
        });
    } catch (error) {
        console.error('Erro ao listar metas:', error);
        return [];
    }
}

// Obter detalhes de uma meta
async function getGoalDetails(userPhone, goalId) {
    try {
        const connection = db.getConnection();
        
        return new Promise((resolve, reject) => {
            connection.get(
                `SELECT g.*, c.name as category_name
                FROM goals g
                LEFT JOIN categories c ON g.category_id = c.id
                WHERE g.id = ? AND g.user_phone = ?`,
                [goalId, userPhone],
                (err, row) => {
                    if (err) return reject(err);
                    if (!row) return reject(new Error('Meta não encontrada'));
                    
                    // Calcular informações adicionais
                    const targetDate = moment(row.target_date);
                    const daysLeft = targetDate.diff(moment(), 'days');
                    const progress = (row.current_amount / row.target_amount) * 100;
                    
                    const result = {
                        ...row,
                        days_left: daysLeft,
                        progress: progress,
                        remaining_amount: row.target_amount - row.current_amount,
                        formatted_target_date: moment(row.target_date).format('DD/MM/YYYY')
                    };
                    
                    resolve(result);
                }
            );
        });
    } catch (error) {
        console.error('Erro ao obter detalhes da meta:', error);
        throw error;
    }
}

// Excluir meta
async function deleteGoal(userPhone, goalId) {
    return new Promise((resolve, reject) => {
        db.run(
            `DELETE FROM goals WHERE id = ? AND user_phone = ?`,
            [goalId, userPhone],
            function(err) {
                if (err) return reject(err);
                resolve(this.changes > 0);
            }
        );
    });
}

module.exports = {
    createGoal,
    updateGoalProgress,
    listGoals,
    getGoalDetails,
    deleteGoal
};
