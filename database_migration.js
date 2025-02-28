const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'finance.db');
const db = new sqlite3.Database(dbPath);

async function migrateDatabase() {
    console.log('Iniciando migração do banco de dados...');

    return new Promise((resolve, reject) => {
        db.serialize(() => {
            try {
                // Backup da tabela existente
                db.run(`ALTER TABLE transactions RENAME TO transactions_backup`);

                // Criar nova tabela com estrutura atualizada
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

                // Copiar dados da tabela antiga para a nova
                db.run(`INSERT INTO transactions (id, user_phone, type, amount, description, date)
                       SELECT id, user_phone, type, amount, description, date 
                       FROM transactions_backup`);

                // Remover tabela de backup
                db.run(`DROP TABLE transactions_backup`);

                // Criar índices para melhor performance
                db.run(`CREATE INDEX idx_transactions_user ON transactions(user_phone)`);
                db.run(`CREATE INDEX idx_transactions_category ON transactions(category_id)`);
                db.run(`CREATE INDEX idx_transactions_date ON transactions(date)`);

                console.log('Migração concluída com sucesso!');
                resolve();
            } catch (error) {
                console.error('Erro durante a migração:', error);
                reject(error);
            }
        });
    });
}

// Executar migração
migrateDatabase().then(() => {
    console.log('Processo de migração finalizado.');
    process.exit(0);
}).catch(error => {
    console.error('Falha na migração:', error);
    process.exit(1);
});
