require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');


const app = express();

// Middleware Configurations
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Initialize PostgreSQL Connection Pool using unified URL string
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Verify cloud database connectivity upon initialization
pool.connect((err, client, release) => {
    if (err) {
        return console.error('❌ Supabase Connection Failure:', err.stack);
    }
    console.log('🚀 Connected to Supabase PostgreSQL Database successfully!');
    release();
});

/* ==========================================================================
   1. USER REGISTRATION API
   ========================================================================== */
app.post('/api/auth/register', async (req, res) => {
    const { username, password, role } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
    }

    try {
        const assignedRole = role || 'Customer / Shopper';
        const hashedPassword = await bcrypt.hash(password, 10);

        const insertUserQuery = 'INSERT INTO users (username, password, role) VALUES ($1, $2, $3) RETURNING id, username, role';
        const result = await pool.query(insertUserQuery, [username, hashedPassword, assignedRole]);

        res.status(201).json({ message: 'User registered successfully!', user: result.rows[0] });
    } catch (error) {
        console.error('REGISTER ERROR:', error);
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Username already exists.' });
        }
        res.status(500).json({ error: 'Database server error occurred during registration.' });
    }
});

/* ==========================================================================
   2. USER LOGIN API
   ========================================================================== */
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
    }

    try {
        const userQuery = 'SELECT * FROM users WHERE username = $1';
        const result = await pool.query(userQuery, [username]);

        if (result.rows.length === 0) {
            return res.status(400).json({ error: 'Invalid username or password.' });
        }

        const user = result.rows[0];
        const validPassword = await bcrypt.compare(password, user.password);

        if (!validPassword) {
            return res.status(400).json({ error: 'Invalid username or password.' });
        }

        const jwtSecret = process.env.JWT_SECRET || 'fallback_secret_key';
        const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, jwtSecret, { expiresIn: '24h' });

        res.status(200).json({ message: 'Login successful!', token, role: user.role });
    } catch (error) {
        console.error('LOGIN ERROR:', error);
        res.status(500).json({ error: 'Database server error occurred during login.' });
    }
});

/* ==========================================================================
   3. PRODUCTS API
   ========================================================================== */
app.get('/api/products', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM products ORDER BY id DESC');
        res.json(result.rows);
    } catch (error) {
        console.error('PRODUCT FETCH ERROR:', error);
        res.status(500).json({ error: 'Failed to fetch products catalog.' });
    }
});

app.post('/api/products', async (req, res) => {
    const { name, description, price, stock } = req.body;
    try {
        const insertProductQuery = 'INSERT INTO products (name, description, price, stock) VALUES ($1, $2, $3, $4) RETURNING *';
        const result = await pool.query(insertProductQuery, [name, description, price, stock]);
        res.status(201).json({ message: 'Product added successfully!', product: result.rows[0] });
    } catch (error) {
        console.error('PRODUCT INSERT ERROR:', error);
        res.status(500).json({ error: error.message });
    }
});

/* ==========================================================================
   4. ORDERS API
   ========================================================================== */
app.post('/api/orders', async (req, res) => {
    const { user_id, total_amount, status } = req.body;
    try {
        const insertOrderQuery = 'INSERT INTO orders (user_id, total_amount, status) VALUES ($1, $2, $3) RETURNING *';
        const result = await pool.query(insertOrderQuery, [user_id, total_amount, status || 'Pending']);
        res.status(201).json({ message: 'Order submitted successfully!', order: result.rows[0] });
    } catch (error) {
        console.error('ORDER INSERT ERROR:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/orders', async (req, res) => {
    try {
        const result = await pool.query('SELECT orders.*, users.username FROM orders JOIN users ON orders.user_id = users.id ORDER BY orders.created_at DESC');
        res.json(result.rows);
    } catch (error) {
        console.error('ORDER FETCH ERROR:', error);
        res.status(500).json({ error: error.message });
    }
});

// Base Testing Route
app.get('/', (req, res) => {
    res.send('🚀 Backend Server Running Successfully!');
});

// Boot Port Configurer
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});