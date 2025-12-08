const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("./smartqueue.db");

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS tickets (
        id TEXT PRIMARY KEY,
        nome TEXT,
        categoria TEXT,
        preco REAL,
        prioridade TEXT,
        pago INTEGER DEFAULT 0,
        validado INTEGER DEFAULT 0
    )`);
});

module.exports = db;
