const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'finance.db');
const db = new sqlite3.Database(dbPath);

const defaultCategories = {
    expenses: [
        'Alimentação', 'Moradia', 'Transporte', 'Saúde', 'Educação', 
        'Lazer', 'Vestuário', 'Serviços', 'Impostos', 'Outros'
    ],
    income: [
        'Salário', 'Freelance', 'Investimentos', 'Presente', 'Bônus',
        'Reembolso', 'Aluguel', 'Vendas', 'Outros'
    ]
};

async function setupDatabase() {
    console.log('Iniciando configuração do banco de dados...');

    return new Promise((resolve, reject) => {
        db.serialize(() => {
            try {
                // 1. Backup das tabelas existentes
                db.run(`ALTER TABLE IF EXISTS transactions RENAME TO transactions_old`);
                db.run(`ALTER TABLE IF EXISTS categories RENAME TO categories_old`);

                // 2. Criar tabela de categorias
                db.run(`CREATE TABLE categories (
                    id INTEGER PRIMARY KEY,
                    user_phone TEXT,
                    name TEXT,
                    type TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_phone) REFERENCES users(phone)
                )`);

                // 3. Criar tabela de transações
                db.run(`CREATE TABLE transactions (
                    id INTEGER PRIMARY KEY,
                    user_phone TEXT,
                    type TEXT,
                    amount REAL,
                    description TEXT,
                    category_id INTEGER,
                    date DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_phone) REFERENCES users(phone),
                    FOREIGN KEY (category_id) REFERENCES categories(id)
                )`);

                // 4. Criar índices
                db.run(`CREATE INDEX idx_transactions_user ON transactions(user_phone)`);
                db.run(`CREATE INDEX idx_transactions_category ON transactions(category_id)`);
                db.run(`CREATE INDEX idx_transactions_date ON transactions(date)`);
                db.run(`CREATE INDEX idx_categories_user ON categories(user_phone)`);

                // 5. Obter usuários existentes
                db.all(`SELECT phone FROM users`, [], async (err, users) => {
                    if (err) throw err;

                    // 6. Para cada usuário, criar categorias padrão
                    for (const user of users) {
                        console.log(`Criando categorias para usuário ${user.phone}`);
                        
                        // Categorias de despesa
                        for (const category of defaultCategories.expenses) {
                            db.run(
                                `INSERT INTO categories (user_phone, name, type) VALUES (?, ?, ?)`,
                                [user.phone, category, 'despesa']
                            );
                        }
                        
                        // Categorias de receita
                        for (const category of defaultCategories.income) {
                            db.run(
                                `INSERT INTO categories (user_phone, name, type) VALUES (?, ?, ?)`,
                                [user.phone, category, 'receita']
                            );
                        }
                    }

                    // 7. Migrar dados antigos se existirem
                    db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name='transactions_old'`, (err, row) => {
                        if (row) {
                            console.log('Migrando transações antigas...');
                            db.run(`
                                INSERT INTO transactions (id, user_phone, type, amount, description, date)
                                SELECT id, user_phone, type, amount, description, date 
                                FROM transactions_old
                            `);
                            db.run(`DROP TABLE transactions_old`);
                        }
                    });

                    // 8. Remover tabelas antigas
                    db.run(`DROP TABLE IF EXISTS categories_old`);

                    console.log('Setup concluído com sucesso!');
                    resolve();
                });

            } catch (error) {
                console.error('Erro durante o setup:', error);
                reject(error);
            }
        });
    });
}

// Executar setup
setupDatabase()
    .then(() => {
        console.log('Processo de setup finalizado com sucesso.');
        process.exit(0);
    })
    .catch(error => {
        console.error('Falha no processo de setup:', error);
        process.exit(1);
    });
