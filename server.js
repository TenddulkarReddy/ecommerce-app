const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// Serve frontend static assets from your public folder
app.use(express.static('public'));

// Initialize PostgreSQL Connection Pool using your Supabase string
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // Required for secure cloud hosting providers like Render
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
app.post('/api/register', async (req, res) => {
    const { username, password, role } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password fields are required.' });
    }

    try {
        // Standardize registration roles to match your Supabase DB rules ('User' or 'Admin')
        let assignedRole = 'User';
        if (role && (role.toLowerCase().includes('admin') || role.toLowerCase().includes('seller'))) {
            assignedRole = 'Admin';
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        
        const insertQuery = `
            INSERT INTO users (username, password, role) 
            VALUES ($1, $2, $3) 
            RETURNING id, username, role;
        `;
        
        const result = await pool.query(insertQuery, [username, hashedPassword, assignedRole]);
        res.status(201).json({ message: 'User registered successfully!', user: result.rows[0] });
    } catch (error) {
        console.error(error);
        if (error.code === '23505') { // PostgreSQL unique violation error code
            return res.status(400).json({ error: 'Username already exists.' });
        }
        res.status(500).json({ error: 'Database error occurred during registration.' });
    }
});

/* ==========================================================================
   2. USER LOGIN API
   ========================================================================== */
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const findUserQuery = 'SELECT * FROM users WHERE username = $1;';
        const result = await pool.query(findUserQuery, [username]);

        if (result.rows.length === 0) {
            return res.status(400).json({ error: 'Invalid username or password.' });
        }

        const user = result.rows[0];
        const isPasswordValid = await bcrypt.compare(password, user.password);
        
        if (!isPasswordValid) {
            return res.status(400).json({ error: 'Invalid username or password.' });
        }

        // Generate JWT authentication token
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            process.env.JWT_SECRET || 'fallback_secret_key',
            { expiresIn: '24h' }
        );

        res.json({ message: 'Login successful!', token, role: user.role });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Database server error occurred during login.' });
    }
});

/* ==========================================================================
   3. PRODUCTS & INVENTORY MANAGEMENT APIS
   ========================================================================== */
app.get('/api/products', async (req, res) => {
    try {
        const productsResult = await pool.query('SELECT * FROM products ORDER BY id DESC;');
        res.json(productsResult.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch products catalog.' });
    }
});

app.post('/api/products', async (req, res) => {
    const { name, description, price, stock } = req.body;
    try {
        const insertProductQuery = `
            INSERT INTO products (name, description, price, stock) 
            VALUES ($1, $2, $3, $4) 
            RETURNING *;
        `;
        const result = await pool.query(insertProductQuery, [name, description, price, stock]);
        res.status(201).json({ message: 'Product added successfully!', product: result.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to create new product entry.' });
    }
});

/* ==========================================================================
   4. ORDER EXECUTION & CHECKOUT APIS
   ========================================================================== */
app.post('/api/orders', async (req, res) => {
    const { user_id, total_amount, status } = req.body;
    try {
        const insertOrderQuery = `
            INSERT INTO orders (user_id, total_amount, status) 
            VALUES ($1, $2, $3) 
            RETURNING *;
        `;
        const result = await pool.query(insertOrderQuery, [user_id, total_amount, status || 'Pending']);
        res.status(201).json({ message: 'Order submitted successfully!', order: result.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to create system order transaction.' });
    }
});

app.get('/api/orders', async (req, res) => {
    try {
        const ordersResult = await pool.query(`
            SELECT orders.*, users.username 
            FROM orders 
            JOIN users ON orders.user_id = users.id 
            ORDER BY orders.created_at DESC;
        `);
        res.json(ordersResult.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch tracking orders database.' });
    }
});

// Fallback configuration parameters
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
