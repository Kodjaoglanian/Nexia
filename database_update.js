/**
 * Script para atualizar o banco de dados com novas tabelas e dados iniciais
 */

const db = require('./database');
const categories = require('./features/categories');

async function updateDatabase() {
    console.log('Iniciando atualização do banco de dados...');
    
    // Inicializar banco de dados com novas tabelas
    db.initDatabase();
    
    // Aguardar um pouco para garantir que as tabelas foram criadas
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    try {
        // Buscar todos os usuários existentes
        const users = await new Promise((resolve, reject) => {
            db.getConnection().all('SELECT phone FROM users', (err, rows) => {
                if (err) return reject(err);
                resolve(rows || []);
            });
        });
        
        console.log(`Encontrado(s) ${users.length} usuário(s).`);
        
        // Para cada usuário, inicializar as categorias padrão
        for (const user of users) {
            console.log(`Inicializando categorias para: ${user.phone}`);
            await categories.initUserCategories(user.phone);
        }
        
        console.log('Banco de dados atualizado com sucesso!');
    } catch (error) {
        console.error('Erro durante a atualização do banco de dados:', error);
    }
}

// Executar a atualização
updateDatabase();
