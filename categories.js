/**
 * Gerenciamento de categorias para transações
 */

const db = require('../database');

// Categorias padrão
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

// Inicializar categorias para um novo usuário
async function initUserCategories(userPhone) {
    try {
        const hasCategories = await checkUserHasCategories(userPhone);
        if (!hasCategories) {
            for (const category of defaultCategories.expenses) {
                await addCategory(userPhone, category, 'despesa');
            }
            for (const category of defaultCategories.income) {
                await addCategory(userPhone, category, 'receita');
            }
            console.log(`Categorias inicializadas para usuário: ${userPhone}`);
        }
        return true;
    } catch (error) {
        console.error('Erro ao inicializar categorias:', error);
        return false;
    }
}

// Verificar se usuário já tem categorias
async function checkUserHasCategories(userPhone) {
    return new Promise((resolve, reject) => {
        db.get(
            `SELECT COUNT(*) as count FROM categories WHERE user_phone = ?`,
            [userPhone],
            (err, row) => {
                if (err) return reject(err);
                resolve(row && row.count > 0);
            }
        );
    });
}

// Adicionar nova categoria
async function addCategory(userPhone, name, type) {
    return new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO categories (user_phone, name, type) 
             VALUES (?, ?, ?)`,
            [userPhone, name, type],
            function(err) {
                if (err) return reject(err);
                resolve(this.lastID);
            }
        );
    });
}

// Listar categorias do usuário
async function listCategories(userPhone, type = null) {
    try {
        const connection = db.getConnection();
        
        let query = `SELECT id, name, type FROM categories WHERE user_phone = ?`;
        const params = [userPhone];
        
        if (type) {
            query += ` AND type = ?`;
            params.push(type);
        }
        
        query += ` ORDER BY type, name`;
        
        return new Promise((resolve, reject) => {
            connection.all(query, params, (err, rows) => {
                if (err) return reject(err);
                resolve(rows || []);
            });
        });
    } catch (error) {
        console.error('Erro ao listar categorias:', error);
        return [];
    }
}

// Sugerir categoria baseada na descrição da transação
async function suggestCategory(description, type) {
    // Mapeamento de palavras-chave para categorias
    const keywords = {
        despesa: {
            'alimentação': ['restaurante', 'mercado', 'supermercado', 'padaria', 'lanche', 'comida', 'ifood', 'delivery', 'pizza'],
            'moradia': ['aluguel', 'condomínio', 'iptu', 'reforma', 'manutenção', 'casa', 'apartamento'],
            'transporte': ['gasolina', 'combustível', 'uber', '99', 'táxi', 'metrô', 'ônibus', 'estacionamento', 'pedágio'],
            'saúde': ['farmácia', 'remédio', 'hospital', 'consulta', 'médico', 'plano de saúde', 'dentista', 'exame'],
            'educação': ['escola', 'faculdade', 'curso', 'livro', 'material escolar', 'mensalidade'],
            'lazer': ['cinema', 'viagem', 'hotel', 'passeio', 'ingresso', 'show', 'netflix', 'spotify', 'assinatura', 'jogos'],
            'vestuário': ['roupa', 'calçado', 'tênis', 'sapato', 'vestido', 'camisa', 'bolsa'],
            'serviços': ['energia', 'água', 'luz', 'internet', 'telefone', 'celular', 'streaming', 'limpeza', 'conta', 'fatura'],
            'impostos': ['imposto', 'taxa', 'tributo', 'ir', 'ipva']
        },
        receita: {
            'salário': ['salário', 'pagamento', 'contracheque', 'folha', 'remuneração'],
            'freelance': ['freelance', 'freela', 'projeto', 'serviço', 'consultoria'],
            'investimentos': ['dividendo', 'juros', 'rendimento', 'investimento', 'aluguel', 'renda'],
            'presente': ['presente', 'doação', 'gift', 'prêmio'],
            'reembolso': ['reembolso', 'estorno', 'devolução', 'restituição', 'ressarcimento']
        }
    };
    
    const lowerDesc = description.toLowerCase();
    
    // Procurar correspondência nas palavras-chave
    for (const [category, terms] of Object.entries(keywords[type] || {})) {
        for (const term of terms) {
            if (lowerDesc.includes(term)) {
                return category;
            }
        }
    }
    
    // Se não houver correspondência
    return type === 'despesa' ? 'Outros' : 'Outros';
}

// Renomear categoria
async function renameCategory(userPhone, categoryId, newName) {
    return new Promise((resolve, reject) => {
        db.run(
            `UPDATE categories SET name = ? WHERE id = ? AND user_phone = ?`,
            [newName, categoryId, userPhone],
            function(err) {
                if (err) return reject(err);
                resolve(this.changes > 0);
            }
        );
    });
}

// Excluir categoria (e mover transações para 'Outros')
async function deleteCategory(userPhone, categoryId) {
    const db = await db.getConnection();
    
    try {
        await db.run('BEGIN TRANSACTION');
        
        // Obter informações da categoria
        const category = await new Promise((resolve, reject) => {
            db.get(
                `SELECT name, type FROM categories WHERE id = ? AND user_phone = ?`,
                [categoryId, userPhone],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row);
                }
            );
        });
        
        if (!category) {
            throw new Error('Categoria não encontrada');
        }
        
        // Encontrar categoria "Outros" do mesmo tipo
        const otherCategory = await new Promise((resolve, reject) => {
            db.get(
                `SELECT id FROM categories WHERE name = 'Outros' AND type = ? AND user_phone = ?`,
                [category.type, userPhone],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row);
                }
            );
        });
        
        if (!otherCategory) {
            throw new Error('Categoria padrão "Outros" não encontrada');
        }
        
        // Mover transações para a categoria "Outros"
        await new Promise((resolve, reject) => {
            db.run(
                `UPDATE transactions SET category_id = ? WHERE category_id = ? AND user_phone = ?`,
                [otherCategory.id, categoryId, userPhone],
                (err) => {
                    if (err) return reject(err);
                    resolve();
                }
            );
        });
        
        // Excluir a categoria
        await new Promise((resolve, reject) => {
            db.run(
                `DELETE FROM categories WHERE id = ? AND user_phone = ?`,
                [categoryId, userPhone],
                (err) => {
                    if (err) return reject(err);
                    resolve();
                }
            );
        });
        
        await db.run('COMMIT');
        return true;
    } catch (error) {
        await db.run('ROLLBACK');
        throw error;
    }
}

module.exports = {
    initUserCategories,
    addCategory,
    listCategories,
    suggestCategory,
    renameCategory,
    deleteCategory
};
