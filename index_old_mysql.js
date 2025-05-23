const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

// Connexion MySQL
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'JoParis2024!',
  database: 'jo2024'
});

db.connect((err) => {
  if (err) {
    console.error('❌ Erreur de connexion MySQL:', err.message);
  } else {
    console.log('✅ Connecté à MySQL');
  }
});

// Route d'inscription
app.post('/register', (req, res) => {
  const { full_name, email, password } = req.body;

  console.log("📥 Données reçues :", req.body);

  if (!full_name || !email || !password) {
    return res.status(400).json({ message: 'Champs manquants' });
  }

  const query = 'INSERT INTO users (full_name, email, password_hash, registration_key) VALUES (?, ?, ?, ?)';

  const fakeHashed = password + '_HASH'; // à remplacer par bcrypt dans la vraie version
  const fakeKey = Date.now().toString(36); // génère une clé simple

  db.query(query, [full_name, email, fakeHashed, fakeKey], (err, result) => {
    if (err) {
      console.error('❌ Erreur MySQL :', err.sqlMessage);
      return res.status(500).json({ message: 'Erreur SQL', error: err.sqlMessage });
    }

    res.status(201).json({ message: 'Utilisateur ajouté ! ✅', id: result.insertId });
  });
});

app.listen(5000, () => {
  console.log('🚀 Serveur lancé sur http://localhost:5000');
});
