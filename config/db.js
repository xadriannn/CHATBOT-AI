import sqlite3 from "sqlite3";

const db = new sqlite3.Database("admin.db", (err) => {
  if (err) console.error("SQLite error:", err.message);
  else console.log("Terhubung ke database admin.db");
});

db.serialize(() => {
  db.run(`
  CREATE TABLE IF NOT EXISTS admin (
    id INTEGER PRIMARY KEY, 
    username TEXT UNIQUE NOT NULL, 
    password TEXT NOT NULL
  )
`);
  db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY, 
    username TEXT UNIQUE NOT NULL, 
    password TEXT NOT NULL, 
    email TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
    `);
//   db.run(`
//   CREATE TABLE IF NOT EXISTS logs (
//     id INTEGER PRIMARY KEY AUTOINCREMENT,
//     username TEXT,
//     activity TEXT,
//     timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
//   )
// `);
db.run(
    `CREATE TABLE IF NOT EXISTS faqs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  );
});

export default db;
