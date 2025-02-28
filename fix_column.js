/**
 * Script de correção de emergência para adicionar a coluna category_id na tabela transactions
 */
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'finance.db');
const db = new sqlite3.Database(dbPath);

console.log('🔧 Iniciando correção de emergência na tabela transactions...');

// Verificar se a coluna category_id existe na tabela transactions
db.all("PRAGMA table_info(transactions)", (err, columns) => {
    if (err) {
        console.error('Erro ao verificar estrutura da tabela:', err);
        process.exit(1);
    }
    
    // Verificar se a coluna category_id existe
    const hasCategoryId = columns.some(col => col.name === 'category_id');
    
    if (hasCategoryId) {
        console.log('✅ A coluna category_id já existe na tabela transactions.');
        db.close();
        process.exit(0);
    }
    
    // Coluna não existe, adicionar
    console.log('⚠️ A coluna category_id não foi encontrada. Adicionando...');
    
    // Iniciar transação
    db.run('BEGIN TRANSACTION', (err) => {
        if (err) {
            console.error('Erro ao iniciar transação:', err);
            db.close();
            process.exit(1);
        }
        
        // 1. Criar tabela temporária com a nova estrutura
        db.run(`CREATE TABLE transactions_new (
            id INTEGER PRIMARY KEY,
            user_phone TEXT,
            type TEXT,
            amount REAL,
            description TEXT,
            category_id INTEGER NULL,
            date DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_phone) REFERENCES users(phone),
            FOREIGN KEY (category_id) REFERENCES categories(id)
        )`, (err) => {
            if (err) {
                console.error('Erro ao criar tabela temporária:', err);
                db.run('ROLLBACK');
                db.close();
                process.exit(1);
            }
            
            // 2. Copiar dados existentes
            db.run(`INSERT INTO transactions_new (id, user_phone, type, amount, description, date)
                    SELECT id, user_phone, type, amount, description, date FROM transactions`, (err) => {
                if (err) {
                    console.error('Erro ao copiar dados:', err);
                    db.run('ROLLBACK');
                    db.close();
                    process.exit(1);
                }
                
                // 3. Remover tabela antiga
                db.run(`DROP TABLE transactions`, (err) => {
                    if (err) {
                        console.error('Erro ao remover tabela antiga:', err);
                        db.run('ROLLBACK');
                        db.close();
                        process.exit(1);
                    }
                    
                    // 4. Renomear tabela nova para o nome original
                    db.run(`ALTER TABLE transactions_new RENAME TO transactions`, (err) => {
                        if (err) {
                            console.error('Erro ao renomear tabela nova:', err);
                            db.run('ROLLBACK');
                            db.close();
                            process.exit(1);
                        }
                        
                        // 5. Criar índices
                        db.run(`CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_phone)`, (err) => {
                            if (err) {
                                console.error('Erro ao criar índice de usuário:', err);
                                db.run('ROLLBACK');
                                db.close();
                                process.exit(1);
                            }
                            
                            db.run(`CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id)`, (err) => {
                                if (err) {
                                    console.error('Erro ao criar índice de categoria:', err);
                                    db.run('ROLLBACK');
                                    db.close();
                                    process.exit(1);
                                }
                                
                                db.run(`CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date)`, (err) => {
                                    if (err) {
                                        console.error('Erro ao criar índice de data:', err);
                                        db.run('ROLLBACK');
                                        db.close();
                                        process.exit(1);
                                    }
                                    
                                    // 6. Commit da transação
                                    db.run('COMMIT', (err) => {
                                        if (err) {
                                            console.error('Erro ao finalizar transação:', err);
                                            db.run('ROLLBACK');
                                            db.close();
                                            process.exit(1);
                                        }
                                        
                                        console.log('✅ Coluna category_id adicionada com sucesso à tabela transactions!');
                                        console.log('🎉 O banco de dados foi corrigido.');
                                        db.close();
                                        process.exit(0);
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    });
});
