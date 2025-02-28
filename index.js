/**
 * Índice consolidado de todos os módulos de features
 */

// Importar todos os módulos de funcionalidades
const budget = require('./budget');
const categories = require('./categories');
const goals = require('./goals');
const reminders = require('./reminders');

// Exportar módulos 
module.exports = {
    budget,
    categories,
    goals,
    reminders
};
