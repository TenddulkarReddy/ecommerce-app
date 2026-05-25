const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static('public')); // Serves frontend files

// MySQL Connection Pool
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10
}).promise();

// --- MIDDLEWARES ---

// Authenticate JWT Token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Access Denied. No token provided.' });

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ message: 'Invalid Token' });
        req.user = user;
        next();
    });
};

// Authorize Roles (RBAC)
const authorizeRole = (role) => {
    return (req, res, next) => {
        if (req.user.role !== role) {
            return res.status(403).json({ message: 'Forbidden: Insufficient Permissions' });
        }
        next();
    };
};

// --- ROUTES ---

// 1. User Registration
app.post('/api/auth/register', async (req, res) => {
    const { username, password, role } = req.body; // role can be 'User' or 'Admin'
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.query('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', [username, hashedPassword, role || 'User']);
        res.status(201).json({ message: 'User registered successfully!' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. User Login
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
        if (rows.length === 0) return res.status(400).json({ message: 'User not found' });

        const user = rows[0];
        const validPass = await bcrypt.compare(password, user.password);
        if (!validPass) return res.status(400).json({ message: 'Invalid password' });

        const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.json({ token, role: user.role, username: user.username });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Get All Products (Public)
app.get('/api/products', async (req, res) => {
    try {
        const [products] = await pool.query('SELECT * FROM products');
        res.json(products);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. Add Product (Admin Only)
app.post('/api/products', authenticateToken, authorizeRole('Admin'), async (req, res) => {
    const { name, description, price, stock } = req.body;
    try {
        await pool.query('INSERT INTO products (name, description, price, stock) VALUES (?, ?, ?, ?)', [name, description, price, stock]);
        res.status(201).json({ message: 'Product added successfully!' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. Place an Order (Authenticated Users)
app.post('/api/orders', authenticateToken, async (req, res) => {
    const { total_amount } = req.body;
    try {
        await pool.query('INSERT INTO orders (user_id, total_amount) VALUES (?, ?)', [req.user.id, total_amount]);
        res.status(201).json({ message: 'Order placed successfully!' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 6. Get All Orders (Admin Only for Tracking)
app.get('/api/orders', authenticateToken, authorizeRole('Admin'), async (req, res) => {
    try {
        const [orders] = await pool.query('SELECT orders.*, users.username FROM orders JOIN users ON orders.user_id = users.id');
        res.json(orders);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));

