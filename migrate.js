const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'finance.db');
const db = new sqlite3.Database(dbPath);

async function migrate() {
    console.log('Iniciando migração do banco de dados...');

    return new Promise((resolve, reject) => {
        db.serialize(() => {
            try {
                // 1. Renomear tabela antiga
                console.log('Fazendo backup da tabela transactions...');
                db.run(`DROP TABLE IF EXISTS transactions_old`);
                db.run(`ALTER TABLE transactions RENAME TO transactions_old`);

                // 2. Criar nova tabela com a estrutura atualizada
                console.log('Criando nova estrutura...');
                db.run(`CREATE TABLE transactions (
                    id INTEGER PRIMARY KEY,
                    user_phone TEXT,
                    type TEXT,
                    amount REAL,
                    description TEXT,
                    category_id INTEGER NULL,
                    date DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_phone) REFERENCES users(phone),
                    FOREIGN KEY (category_id) REFERENCES categories(id)
                )`);

                // 3. Migrar dados
                console.log('Migrando dados...');
                db.run(`INSERT INTO transactions 
                       (id, user_phone, type, amount, description, date)
                       SELECT id, user_phone, type, amount, description, date 
                       FROM transactions_old`);

                // 4. Criar índices
                console.log('Criando índices...');
                db.run(`CREATE INDEX IF NOT EXISTS idx_transactions_user 
                       ON transactions(user_phone)`);
                db.run(`CREATE INDEX IF NOT EXISTS idx_transactions_category 
                       ON transactions(category_id)`);
                db.run(`CREATE INDEX IF NOT EXISTS idx_transactions_date 
                       ON transactions(date)`);

                // 5. Verificar se migração foi bem sucedida
                db.get(`SELECT COUNT(*) as count FROM transactions`, [], (err, row) => {
                    if (err) throw err;
                    console.log(`Migração concluída. ${row.count} transações migradas.`);
                    
                    // 6. Remover tabela antiga
                    db.run(`DROP TABLE transactions_old`);
                    resolve();
                });

            } catch (error) {
                console.error('Erro durante a migração:', error);
                reject(error);
            }
        });
    });
}

// Executar migração
migrate()
    .then(() => {
        console.log('Processo de migração concluído com sucesso!');
        process.exit(0);
    })
    .catch(error => {
        console.error('Falha na migração:', error);
        process.exit(1);
    });
