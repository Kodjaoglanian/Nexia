const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.resolve(__dirname, 'finance.db');

// Delete existing database to start fresh
console.log('Removing existing database...');
if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
}

const db = new sqlite3.Database(dbPath);

console.log('Creating new database structure...');

db.serialize(() => {
    // Create users table
    db.run(`CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        phone TEXT UNIQUE,
        name TEXT,
        authenticated BOOLEAN DEFAULT 0,
        login TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Create categories table
    db.run(`CREATE TABLE categories (
        id INTEGER PRIMARY KEY,
        user_phone TEXT,
        name TEXT,
        type TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_phone) REFERENCES users(phone)
    )`);

    // Create transactions table with category support
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

    // Create indexes
    db.run(`CREATE INDEX idx_transactions_user ON transactions(user_phone)`);
    db.run(`CREATE INDEX idx_transactions_category ON transactions(category_id)`);
    db.run(`CREATE INDEX idx_transactions_date ON transactions(date)`);
    db.run(`CREATE INDEX idx_categories_user ON categories(user_phone)`);

    console.log('✅ Database structure created successfully!');
    db.close(() => {
        console.log('✨ Database initialized and ready to use!');
        console.log('🚀 You can now start the bot with: npm start');
    });
});
