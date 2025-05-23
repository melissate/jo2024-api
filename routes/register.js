const express = require('express');
const router = express.Router();
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const filePath = path.join(__dirname, 'users.json');

router.post('/api/register', async (req, res) => {
  console.log("🔍 Données reçues :", req.body); // ✅ BON ENDROIT

  const { full_name, email, password } = req.body;

  if (!full_name || !email || !password) {
    return res.status(400).json({ message: "Champs manquants" });
  }

  try {
    const users = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    // Vérifie l'unicité de l'email
    if (users.find(u => u.email === email)) {
      return res.status(409).json({ message: "Email déjà utilisé" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const registrationKey = uuidv4();

    const newUser = {
      id: uuidv4(),
      full_name,
      email,
      password_hash: hashedPassword,
      registration_key: registrationKey,
      is_admin: false
    };

    users.push(newUser);
    fs.writeFileSync(filePath, JSON.stringify(users, null, 2));

    res.status(201).json({ message: "Compte créé avec succès" });
  } catch (err) {
    console.error("Erreur:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

module.exports = router;
