// backend/server.js

const express = require('express');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = 'your_jwt_secret_key'; // CHANGEZ CELA POUR UNE CLÉ SECRÈTE ROBUSTE EN PRODUCTION

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Database setup
const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        // Create tables if they don't exist
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            full_name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            is_admin BOOLEAN DEFAULT 0,
            org_key TEXT UNIQUE
        )`, (err) => {
            if (err) console.error("Error creating users table:", err.message);
        });

        db.run(`CREATE TABLE IF NOT EXISTS offers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            price REAL NOT NULL,
            image_url TEXT,
            category TEXT,
            ticket_count INTEGER DEFAULT 1
        )`, (err) => {
            if (err) console.error("Error creating offers table:", err.message);
            else {
                db.get("SELECT COUNT(*) as count FROM offers", (err, row) => {
                    if (row.count === 0) {
                        const stmt = db.prepare("INSERT INTO offers (title, description, price, image_url, category, ticket_count) VALUES (?, ?, ?, ?, ?, ?)");

                        stmt.run("Offre Solo", "Accès à un événement pour une personne, choix d'une discipline.", 150.00, "/images/solo.jpg", "Classique", 1);
                        stmt.run("Offre Duo", "Accès à un événement pour deux personnes, idéal pour un couple. Choix Populaire !", 280.00, "/images/duo.jpg", "Classique", 2);
                        stmt.run("Offre Familiale", "Accès à un événement pour 4 personnes, parfait pour la famille.", 500.00, "/images/familiale.jpg", "Famille", 4);
                        stmt.run("Expérience Village Olympique", "Visitez le cœur de l'événement et rencontrez des athlètes.", 150.00, "/images/village-olympique.jpg", "Expérience", 2);
                        stmt.run("Place Escrime - Finale", "Assistez à la finale d'escrime.", 120.00, "/images/escrime.jpg", "Sport", 2);
                        stmt.run("Billet Cérémonie Ouverture", "Accédez à la cérémonie d'ouverture inoubliable sur la Seine !", 2500.00, "/images/ceremonie-ouverture.jpg", "Cérémonie", 4);

                        stmt.finalize();
                        console.log("Offers added to database.");
                    }
                });
            }
        });

        // NOUVELLE TABLE POUR LES COMMANDES (ORDERS)
        db.run(`CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            order_date TEXT NOT NULL,
            total_price REAL NOT NULL,
            items TEXT NOT NULL, -- Stocke les articles du panier en JSON stringifié
            qr_code_key TEXT UNIQUE NOT NULL, -- Clé unique pour le QR code de cette commande
            FOREIGN KEY (user_id) REFERENCES users(id)
        )`, (err) => {
            if (err) console.error("Error creating orders table:", err.message);
        });
    }
});


// Middleware d'authentification
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

app.post('/api/register', (req, res) => {
    const { full_name, email, password } = req.body;
    if (!full_name || !email || !password) {
        return res.status(400).json({ message: 'Veuillez remplir tous les champs.' });
    }

    bcrypt.hash(password, 10, (err, hashedPassword) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: 'Erreur interne du serveur.' });
        }

        const orgKey = uuidv4();

        db.run('INSERT INTO users (full_name, email, password, is_admin, org_key) VALUES (?, ?, ?, ?, ?)',
            [full_name, email, hashedPassword, 0, orgKey],
            function (err) {
                if (err) {
                    if (err.message.includes('UNIQUE constraint failed')) {
                        return res.status(409).json({ message: 'Cet email est déjà enregistré.' });
                    }
                    console.error(err);
                    return res.status(500).json({ message: 'Erreur lors de l\'enregistrement de l\'utilisateur.' });
                }
                res.status(201).json({ message: 'Utilisateur enregistré avec succès.' });
            }
        );
    });
});

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: 'Veuillez entrer l\'email et le mot de passe.' });
    }

    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: 'Erreur interne du serveur.' });
        }
        if (!user) {
            return res.status(401).json({ message: 'Email ou mot de passe incorrect.' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Email ou mot de passe incorrect.' });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, is_admin: user.is_admin, full_name: user.full_name },
            JWT_SECRET,
            { expiresIn: '1h' }
        );
        res.json({ token, user: { id: user.id, full_name: user.full_name, email: user.email, is_admin: user.is_admin } });
    });
});

app.get('/api/protected', authenticateToken, (req, res) => {
    res.json({ message: 'Accès autorisé à la route protégée.', user: req.user });
});

// ROUTE POUR RÉCUPÉRER LES OFFRES
app.get('/api/offers', (req, res) => {
    db.all("SELECT id, title, description, price, image_url, category, ticket_count FROM offers", [], (err, rows) => {
        if (err) {
            console.error(err);
            res.status(500).json({ message: "Erreur lors de la récupération des offres." });
            return;
        }
        res.json(rows);
    });
});

// ROUTE DE PAIEMENT SIMULÉ - MAINTENANT AVEC ENREGISTREMENT DE COMMANDE
app.post('/api/payment', authenticateToken, (req, res) => {
    const { cartItems, totalPrice } = req.body; // Récupère les articles du panier et le total du frontend
    const userId = req.user.id; // L'ID de l'utilisateur connecté

    if (!cartItems || cartItems.length === 0 || !totalPrice) {
        return res.status(400).json({ message: "Panier vide ou données manquantes pour le paiement." });
    }

    // Simuler un succès ou un échec aléatoire pour un mock (vous pouvez le forcer à true pour les tests)
    // Toujours réussir le paiement
    const orderDate = new Date().toISOString();
    const qrCodeKey = uuidv4();

    db.run(
    `INSERT INTO orders (user_id, order_date, total_price, items, qr_code_key) VALUES (?, ?, ?, ?, ?)`,
    [userId, orderDate, totalPrice, JSON.stringify(cartItems), qrCodeKey],
    function (err) {
        if (err) {
        console.error("Error inserting order:", err.message);
        return res.status(500).json({ message: 'Erreur serveur lors de l\'enregistrement de la commande.', success: false });
        }
        res.status(200).json({
        message: 'Paiement simulé réussi ! Votre commande a été confirmée.',
        success: true,
        orderId: this.lastID,
        qrCodeKey: qrCodeKey
        });
    }
    );

});

// NOUVELLE ROUTE POUR RÉCUPÉRER LES COMMANDES DE L'UTILISATEUR
app.get('/api/user/orders', authenticateToken, (req, res) => {
    const userId = req.user.id;

    db.all("SELECT * FROM orders WHERE user_id = ? ORDER BY order_date DESC", [userId], (err, rows) => {
        if (err) {
            console.error("Error fetching user orders:", err.message);
            return res.status(500).json({ message: "Erreur lors de la récupération de vos commandes." });
        }
        // Parsez les items JSON avant de les envoyer au frontend
        const ordersWithParsedItems = rows.map(order => ({
            ...order,
            items: JSON.parse(order.items) // Convertit la chaîne JSON en objet JavaScript
        }));
        res.json(ordersWithParsedItems);
    });
});


// Démarrer le serveur
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});