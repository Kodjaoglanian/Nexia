const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const moment = require('moment'); // Added moment import

const dbPath = path.resolve(__dirname, 'finance.db');
const db = new sqlite3.Database(dbPath);

// Verificar e atualizar estrutura de tabela existente
function checkTableStructure() {
    return new Promise((resolve, reject) => {
        // Verificar se a tabela users tem as colunas necessárias
        db.all("PRAGMA table_info(users)", async (err, columns) => {
            if (err) return reject(err);
            
            try {
                // Lista de colunas que queremos garantir que existam
                const requiredColumns = [
                    { name: 'authenticated', type: 'BOOLEAN DEFAULT 0' },
                    { name: 'login', type: 'TEXT' }
                ];
                
                // Verificar e adicionar cada coluna necessária
                for (const col of requiredColumns) {
                    const hasColumn = columns.some(c => c.name === col.name);
                    
                    if (!hasColumn) {
                        console.log(`Adicionando coluna ${col.name} à tabela users...`);
                        await new Promise((res, rej) => {
                            db.run(`ALTER TABLE users ADD COLUMN ${col.name} ${col.type}`, (err) => {
                                if (err) return rej(err);
                                res();
                            });
                        });
                    }
                }
                
                resolve();
            } catch (error) {
                reject(error);
            }
        });
    });
}

function initDatabase() {
    // Criar tabelas caso não existam
    db.serialize(async () => {
        // Tabela de usuários
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY,
            phone TEXT UNIQUE,
            name TEXT,
            authenticated BOOLEAN DEFAULT 0,
            login TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Tabela de categorias
        db.run(`CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY,
            user_phone TEXT,
            name TEXT,
            type TEXT, -- 'receita' ou 'despesa'
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_phone) REFERENCES users(phone)
        )`);

        // Tabela de transações com suporte a categorias
        db.run(`CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY,
            user_phone TEXT,
            type TEXT, -- 'receita' ou 'despesa'
            amount REAL,
            description TEXT,
            category_id INTEGER,
            date DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_phone) REFERENCES users(phone),
            FOREIGN KEY (category_id) REFERENCES categories(id)
        )`);

        // Tabela de transações recorrentes
        db.run(`CREATE TABLE IF NOT EXISTS recurring (
            id INTEGER PRIMARY KEY,
            user_phone TEXT,
            type TEXT,
            amount REAL,
            description TEXT,
            category_id INTEGER,
            day_of_month INTEGER,
            active BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_phone) REFERENCES users(phone),
            FOREIGN KEY (category_id) REFERENCES categories(id)
        )`);

        // Tabela de orçamentos
        db.run(`CREATE TABLE IF NOT EXISTS budgets (
            id INTEGER PRIMARY KEY,
            user_phone TEXT,
            category_id INTEGER,
            amount REAL,
            period TEXT DEFAULT 'monthly', -- 'monthly', 'yearly', etc
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_phone) REFERENCES users(phone),
            FOREIGN KEY (category_id) REFERENCES categories(id)
        )`);

        // Tabela de metas financeiras
        db.run(`CREATE TABLE IF NOT EXISTS goals (
            id INTEGER PRIMARY KEY,
            user_phone TEXT,
            name TEXT,
            target_amount REAL,
            current_amount REAL DEFAULT 0,
            target_date DATE,
            category_id INTEGER,
            completed BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_phone) REFERENCES users(phone),
            FOREIGN KEY (category_id) REFERENCES categories(id)
        )`);

        // Tabela de lembretes
        db.run(`CREATE TABLE IF NOT EXISTS reminders (
            id INTEGER PRIMARY KEY,
            user_phone TEXT,
            description TEXT,
            amount REAL,
            due_date DATE,
            category_id INTEGER,
            recurring BOOLEAN DEFAULT 0,
            recurrence_pattern TEXT, -- 'daily', 'weekly', 'monthly', 'yearly'
            completed BOOLEAN DEFAULT 0,
            completed_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_phone) REFERENCES users(phone),
            FOREIGN KEY (category_id) REFERENCES categories(id)
        )`);

        // Verificar e atualizar tabelas existentes se necessário
        try {
            await checkTableStructure();
        } catch (error) {
            console.error('Erro ao atualizar estrutura do banco:', error);
        }

        console.log('Banco de dados inicializado com sucesso!');
    });
}

// Registrar ou atualizar usuário
function registerUser(phone, name) {
    return new Promise((resolve, reject) => {
        db.run(
            `INSERT OR REPLACE INTO users (phone, name) VALUES (?, ?)`,
            [phone, name],
            function(err) {
                if (err) return reject(err);
                resolve(this.lastID);
            }
        );
    });
}

// Registrar usuário com login
function registerUserWithLogin(phone, name, login) {
    return new Promise((resolve, reject) => {
        db.run(
            `INSERT OR REPLACE INTO users (phone, name, login) VALUES (?, ?, ?)`,
            [phone, name, login],
            function(err) {
                if (err) return reject(err);
                resolve(this.lastID);
            }
        );
    });
}

// Adicionar transação
function addTransaction(userPhone, type, amount, description, categoryId = null) {
    return new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO transactions (user_phone, type, amount, description, category_id) 
             VALUES (?, ?, ?, ?, ?)`,
            [userPhone, type, amount, description, categoryId],
            function(err) {
                if (err) return reject(err);
                resolve(this.lastID);
            }
        );
    });
}

// Adicionar transação recorrente
function addRecurring(userPhone, type, amount, description, dayOfMonth, categoryId = null) {
    return new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO recurring (user_phone, type, amount, description, day_of_month, category_id) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [userPhone, type, amount, description, dayOfMonth, categoryId],
            function(err) {
                if (err) return reject(err);
                resolve(this.lastID);
            }
        );
    });
}

// Obter saldo atual
function getBalance(userPhone) {
    return new Promise((resolve, reject) => {
        db.get(
            `SELECT
                (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE user_phone = ? AND type = 'receita') -
                (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE user_phone = ? AND type = 'despesa') AS balance`,
            [userPhone, userPhone],
            (err, row) => {
                if (err) return reject(err);
                resolve(row.balance || 0);
            }
        );
    });
}

// Get transactions for a specific period with user isolation fixed
function getTransactions(userPhone, month, year) {
    return new Promise((resolve, reject) => {
        // Ensure the query has proper date ranges and strict user filtering
        const startDate = `${year}-${month.padStart(2, '0')}-01`;
        // Use moment to get the last day of the month correctly
        const endDate = moment(`${year}-${month.padStart(2, '0')}-01`).endOf('month').format('YYYY-MM-DD');
        
        console.log(`Fetching transactions for user ${userPhone} from ${startDate} to ${endDate}`);
        
        // Add join with categories table to get category names
        const query = `
            SELECT 
                t.*,
                c.name as category_name
            FROM transactions t
            LEFT JOIN categories c ON t.category_id = c.id
            WHERE t.user_phone = ? 
            AND date(t.date) BETWEEN date(?) AND date(?)
            ORDER BY t.date DESC`;
        
        db.all(query, [userPhone, startDate, endDate], (err, rows) => {
            if (err) return reject(err);
            console.log(`Found ${rows?.length || 0} transactions for user ${userPhone}`);
            resolve(rows || []);
        });
    });
}

// Get chart data - Fix user isolation
async function getChartData(userPhone, month, year, type) {
    try {
        // Create dates with the first and last day of the month
        const startDate = `${year}-${month.padStart(2, '0')}-01`;
        const endDate = moment(startDate).endOf('month').format('YYYY-MM-DD');
        
        console.log(`Fetching chart data for user ${userPhone}, type ${type}, period ${startDate} to ${endDate}`);
        
        if (type === 'pizza') {
            return new Promise((resolve, reject) => {
                db.all(
                    `SELECT 
                        CASE 
                            WHEN c.name IS NOT NULL THEN c.name
                            ELSE t.description
                         END as description,
                         t.type, 
                         SUM(t.amount) as total
                     FROM transactions t
                     LEFT JOIN categories c ON t.category_id = c.id
                     WHERE t.user_phone = ? AND date(t.date) BETWEEN date(?) AND date(?)
                     AND t.type = 'despesa'
                     GROUP BY description
                     ORDER BY total DESC`,
                    [userPhone, startDate, endDate],
                    (err, rows) => {
                        if (err) return reject(err);
                        console.log(`Found ${rows?.length || 0} expense categories for user ${userPhone}`);
                        resolve(rows || []);
                    }
                );
            });
        } else if (type === 'linha') {
            return new Promise((resolve, reject) => {
                db.all(
                    `SELECT strftime('%d', date) as day,
                            SUM(CASE WHEN type = 'despesa' THEN amount ELSE 0 END) as expenses,
                            SUM(CASE WHEN type = 'receita' THEN amount ELSE 0 END) as income
                     FROM transactions 
                     WHERE user_phone = ? AND date(date) BETWEEN date(?) AND date(?)
                     GROUP BY day
                     ORDER BY day`,
                    [userPhone, startDate, endDate],
                    (err, rows) => {
                        if (err) return reject(err);
                        console.log(`Found ${rows?.length || 0} days with transactions for user ${userPhone}`);
                        resolve(rows || []);
                    }
                );
            });
        }
        
        return [];
    } catch (error) {
        console.error('Error fetching chart data:', error);
        return [];
    }
}

// Verificar se usuário está autenticado
function isUserAuthenticated(userPhone) {
    return new Promise((resolve, reject) => {
        db.get(
            `SELECT authenticated FROM users WHERE phone = ?`,
            [userPhone],
            (err, row) => {
                if (err) return reject(err);
                if (!row) return resolve(false);
                resolve(row.authenticated === 1);
            }
        );
    });
}

// Autenticar usuário
function authenticateUser(userPhone) {
    return new Promise((resolve, reject) => {
        db.run(
            `UPDATE users SET authenticated = 1 WHERE phone = ?`,
            [userPhone],
            (err) => {
                if (err) return reject(err);
                resolve(true);
            }
        );
    });
}

// Verificar credenciais de login
function verifyCredentials(login, password, config) {
    return config.credentials.some(cred => 
        cred.login === login && cred.password === password
    );
}

// Fornecer conexão para transações
function getConnection() {
    return db;
}

module.exports = {
    initDatabase,
    registerUser,
    registerUserWithLogin,
    addTransaction,
    addRecurring,
    getBalance,
    getTransactions,
    getChartData,
    isUserAuthenticated,
    authenticateUser,
    verifyCredentials,
    getConnection
};
