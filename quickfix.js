/**
 * Emergency repair script for database issues
 * This is a minimal script that focuses ONLY on fixing the transactions table
 */
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// Config
const dbPath = path.join(__dirname, 'finance.db');
const backupPath = path.join(__dirname, `finance_backup_${Date.now()}.db`);

// Create backup first
console.log('📦 Creating database backup...');
try {
    fs.copyFileSync(dbPath, backupPath);
    console.log(`✅ Backup created: ${backupPath}`);
} catch (err) {
    console.error('❌ Failed to create backup:', err.message);
    process.exit(1);
}

// Connect to database
const db = new sqlite3.Database(dbPath);

// Function to run SQL with proper error handling
function runSql(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) {
                console.error(`❌ SQL Error: ${err.message}`);
                console.error('Failed SQL:', sql);
                reject(err);
            } else {
                resolve({
                    lastID: this.lastID,
                    changes: this.changes
                });
            }
        });
    });
}

// Function to check if the table exists and its structure
function checkTable(tableName) {
    return new Promise((resolve, reject) => {
        db.all(`PRAGMA table_info(${tableName})`, (err, columns) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(columns);
        });
    });
}

// Main repair function
async function repair() {
    console.log('🔧 Starting emergency database repair');
    
    try {
        // 1. Check if the transactions table exists
        console.log('Checking transactions table...');
        const tableColumns = await checkTable('transactions');
        
        // 2. Check if it has category_id column
        const hasCategoryId = tableColumns.some(col => col.name === 'category_id');
        
        if (hasCategoryId) {
            console.log('✅ The category_id column already exists, no repair needed!');
            return;
        }
        
        console.log('❌ Missing category_id column. Starting repair...');
        
        // 3. Begin transaction
        await runSql('BEGIN TRANSACTION');
        
        // 4. Create a temporary fixed table
        console.log('Creating new table structure...');
        await runSql(`
            CREATE TABLE transactions_new (
                id INTEGER PRIMARY KEY,
                user_phone TEXT,
                type TEXT,
                amount REAL,
                description TEXT,
                category_id INTEGER NULL,
                date DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // 5. Copy data to new table
        console.log('Copying existing transactions data...');
        let copied = await runSql(`
            INSERT INTO transactions_new (id, user_phone, type, amount, description, date)
            SELECT id, user_phone, type, amount, description, date FROM transactions
        `);
        
        console.log(`✅ Copied ${copied.changes || 'all'} transactions`);
        
        // 6. Rename tables
        console.log('Replacing old table with new one...');
        await runSql('DROP TABLE transactions');
        await runSql('ALTER TABLE transactions_new RENAME TO transactions');
        
        // 7. Create necessary indexes
        console.log('Creating indexes...');
        await runSql('CREATE INDEX idx_transactions_user ON transactions(user_phone)');
        await runSql('CREATE INDEX idx_transactions_category ON transactions(category_id)');
        await runSql('CREATE INDEX idx_transactions_date ON transactions(date)');
        
        // 8. Commit
        await runSql('COMMIT');
        
        console.log('🎉 Repair completed successfully!');
    } catch (error) {
        console.error('❌ Repair failed:', error);
        
        // Rollback if in transaction
        try {
            await runSql('ROLLBACK');
            console.log('⚠️ Changes have been rolled back');
        } catch (rollbackError) {
            console.error('Failed to rollback:', rollbackError);
        }
    } finally {
        // Close database connection
        db.close();
    }
}

// Run repair
repair()
    .then(() => {
        console.log('✅ Database repair process finished');
        console.log('You can now start your bot with: npm start');
    })
    .catch(err => {
        console.error('✖️ Fatal error during repair:', err);
        console.log('\nRestore instructions:');
        console.log(`1. Delete the current database: rm ${dbPath}`);
        console.log(`2. Restore from backup: copy ${backupPath} ${dbPath}`);
    });
