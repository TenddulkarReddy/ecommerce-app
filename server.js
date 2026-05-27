const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/* Secure database configuration instructing the pg connection pool 
   to handle Supabase connection poolers without rejecting self-signed handshakes */
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

/* Test database connectivity immediately on launch */
pool.connect((err, client, release) => {
    if (err) {
        return console.error('❌ Database Connection Error:', err.stack);
    }
    console.log('🚀 Connected to Supabase PostgreSQL Database successfully!');
    release();
});

/* ==========================================
   1. USER REGISTRATION API
   ========================================== */
app.post('/api/auth/register', async (req, res) => {
    const { username, password, role } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
    }
    try {
        const assignedRole = role || 'Admin';
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await pool.query(
            'INSERT INTO users (username, password, role) VALUES ($1, $2, $3) RETURNING id, username, role',
            [username, hashedPassword, assignedRole]
        );
        res.status(201).json({ message: 'User registered successfully!', user: result.rows[0] });
    } catch (error) {
        console.error('REGISTER ERROR:', error);
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Username already exists.' });
        }
        res.status(500).json({ error: 'Database error occurred during registration.' });
    }
});

/* ==========================================
   2. USER LOGIN API (UPDATED TO RETURN USER ID)
   ========================================== */
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
    }
    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
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
        
        // Return user.id so the frontend knows who is ordering
        res.status(200).json({ message: 'Login successful!', token, role: user.role, id: user.id });
    } catch (error) {
        console.error('LOGIN ERROR:', error);
        res.status(500).json({ error: 'Database server error occurred during login.' });
    }
});

/* ==========================================
   3. PRODUCTS API
   ========================================== */
app.get('/api/products', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM products ORDER BY id DESC');
        res.json(result.rows);
    } catch (error) {
        console.error('PRODUCT FETCH ERROR:', error);
        res.status(500).json({ error: 'Failed to fetch products.' });
    }
});

app.post('/api/products', async (req, res) => {
    const { name, description, price, stock, image_url } = req.body;
    try {
        const defaultImg = 'https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=500&auto=format&fit=crop&q=60';
        const finalImg = image_url || defaultImg;
        
        const result = await pool.query(
            'INSERT INTO products (name, description, price, stock, image_url) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [name, description, price, stock, finalImg]
        );
        res.status(201).json({ message: 'Product added successfully!', product: result.rows[0] });
    } catch (error) {
        console.error('PRODUCT INSERT ERROR:', error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/products/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM products WHERE id = $1 RETURNING *', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Product not found.' });
        }
        res.json({ message: 'Product deleted from inventory successfully.' });
    } catch (error) {
        console.error('PRODUCT DELETE ERROR:', error);
        res.status(500).json({ error: 'Failed to delete target product.' });
    }
});

/* ==========================================
   4. ORDERS API
   ========================================== */
app.post('/api/orders', async (req, res) => {
    const { user_id, total_amount, status } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO orders (user_id, total_amount, status) VALUES ($1, $2, $3) RETURNING *',
            [user_id, total_amount, status || 'Pending']
        );
        res.status(201).json({ message: 'Order submitted successfully!', order: result.rows[0] });
    } catch (error) {
        console.error('ORDER INSERT ERROR:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/orders', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT orders.*, users.username FROM orders JOIN users ON orders.user_id = users.id ORDER BY orders.id DESC'
        );
        res.json(result.rows);
    } catch (error) {
        console.error('ORDER FETCH ERROR:', error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/orders/:id', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
        const result = await pool.query(
            'UPDATE orders SET status = $1 WHERE id = $2 RETURNING *',
            [status, id]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Order profile row not found.' });
        }
        res.json({ message: 'Order status saved.', order: result.rows[0] });
    } catch (error) {
        console.error('ORDER UPDATE ERROR:', error);
        res.status(500).json({ error: 'Failed to update order status details.' });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
