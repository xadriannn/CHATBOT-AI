// db.js
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./users.db');

// Buat tabel utama untuk user terverifikasi
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      email TEXT UNIQUE,
      password TEXT
    )
  `);

  // Tabel sementara untuk simpan user + otp sebelum verifikasi
  db.run(`
    CREATE TABLE IF NOT EXISTS pending_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT,
      email TEXT,
      password TEXT,
      otp TEXT,
      expires_at INTEGER
    )
  `);
});

module.exports = db;
