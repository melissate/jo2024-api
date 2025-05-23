// db.js
const mysql = require('mysql2');
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'JoParis2024!',
  database: 'jo2024'
});

db.connect(err => {
  if (err) throw err;
  console.log('✅ Connecté à MySQL');
});

module.exports = db;
