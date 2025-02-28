/**
 * Gestão de orçamentos por categoria
 */

const db = require('../database');
const moment = require('moment');

// Criar ou atualizar orçamento para uma categoria
async function setBudget(userPhone, categoryId, amount, period = 'monthly') {
    return new Promise((resolve, reject) => {
        // Verificar se o orçamento já existe
        db.get(
            `SELECT id FROM budgets WHERE user_phone = ? AND category_id = ? AND period = ?`,
            [userPhone, categoryId, period],
            (err, row) => {
                if (err) return reject(err);
                
                if (row) {
                    // Atualizar orçamento existente
                    db.run(
                        `UPDATE budgets SET amount = ?, updated_at = CURRENT_TIMESTAMP 
                         WHERE id = ?`,
                        [amount, row.id],
                        function(err) {
                            if (err) return reject(err);
                            resolve({id: row.id, updated: true});
                        }
                    );
                } else {
                    // Criar novo orçamento
                    db.run(
                        `INSERT INTO budgets (user_phone, category_id, amount, period) 
                         VALUES (?, ?, ?, ?)`,
                        [userPhone, categoryId, amount, period],
                        function(err) {
                            if (err) return reject(err);
                            resolve({id: this.lastID, updated: false});
                        }
                    );
                }
            }
        );
    });
}

// Obter orçamento por categoria
async function getBudget(userPhone, categoryId, period = 'monthly') {
    return new Promise((resolve, reject) => {
        db.get(
            `SELECT b.*, c.name as category_name, c.type as category_type
             FROM budgets b
             JOIN categories c ON b.category_id = c.id
             WHERE b.user_phone = ? AND b.category_id = ? AND b.period = ?`,
            [userPhone, categoryId, period],
            (err, row) => {
                if (err) return reject(err);
                resolve(row);
            }
        );
    });
}

// Listar todos os orçamentos do usuário
async function listBudgets(userPhone, period = 'monthly') {
    return new Promise((resolve, reject) => {
        db.all(
            `SELECT b.*, c.name as category_name, c.type as category_type
             FROM budgets b
             JOIN categories c ON b.category_id = c.id
             WHERE b.user_phone = ? AND b.period = ?
             ORDER BY c.type, c.name`,
            [userPhone, period],
            (err, rows) => {
                if (err) return reject(err);
                resolve(rows || []);
            }
        );
    });
}

// Verificar progresso do orçamento
async function checkBudgetProgress(userPhone, categoryId = null) {
    const now = moment();
    const startOfMonth = now.clone().startOf('month').format('YYYY-MM-DD');
    const endOfMonth = now.clone().endOf('month').format('YYYY-MM-DD');
    
    try {
        const connection = db.getConnection();
        
        let query, params;
        
        if (categoryId) {
            // Verificar orçamento específico
            query = `
                SELECT b.id, b.amount as budget_amount, c.name as category_name,
                       (SELECT COALESCE(SUM(amount), 0) 
                        FROM transactions 
                        WHERE user_phone = ? 
                        AND category_id = ? 
                        AND date BETWEEN ? AND ?) as spent_amount
                FROM budgets b
                JOIN categories c ON b.category_id = c.id
                WHERE b.user_phone = ? AND b.category_id = ? AND b.period = 'monthly'`;
            
            params = [userPhone, categoryId, startOfMonth, endOfMonth, userPhone, categoryId];
        } else {
            // Verificar todos os orçamentos
            query = `
                SELECT b.id, b.amount as budget_amount, b.category_id, 
                       c.name as category_name, c.type as category_type,
                       (SELECT COALESCE(SUM(amount), 0) 
                        FROM transactions 
                        WHERE user_phone = ? 
                        AND category_id = b.category_id 
                        AND date BETWEEN ? AND ?) as spent_amount
                FROM budgets b
                JOIN categories c ON b.category_id = c.id
                WHERE b.user_phone = ? AND b.period = 'monthly'
                ORDER BY c.type, c.name`;
            
            params = [userPhone, startOfMonth, endOfMonth, userPhone];
        }
        
        return new Promise((resolve, reject) => {
            connection.all(query, params, (err, rows) => {
                if (err) return reject(err);
                
                // Calcular percentual gasto de cada orçamento
                const results = (rows || []).map(row => {
                    const percentUsed = (row.spent_amount / row.budget_amount) * 100;
                    return {
                        ...row,
                        percent_used: percentUsed,
                        remaining: row.budget_amount - row.spent_amount,
                        status: percentUsed >= 100 ? 'exceeded' : 
                               percentUsed >= 80 ? 'warning' : 'ok'
                    };
                });
                
                resolve(results);
            });
        });
    } catch (error) {
        console.error('Erro ao verificar orçamentos:', error);
        return [];
    }
}

// Excluir orçamento
async function deleteBudget(userPhone, budgetId) {
    return new Promise((resolve, reject) => {
        db.run(
            `DELETE FROM budgets WHERE id = ? AND user_phone = ?`,
            [budgetId, userPhone],
            function(err) {
                if (err) return reject(err);
                resolve(this.changes > 0);
            }
        );
    });
}

module.exports = {
    setBudget,
    getBudget,
    listBudgets,
    checkBudgetProgress,
    deleteBudget
};
