require('dotenv').config();

const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();

app.use(express.json());
app.use(cors());

// Serve frontend static files
app.use(express.static('public'));

/* ==========================================================================
   DATABASE CONNECTION (SUPABASE + RENDER)
   ========================================================================== */

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Test Database Connection
pool.connect()
    .then(client => {
        console.log('🚀 Connected to Supabase PostgreSQL Database successfully!');
        client.release();
    })
    .catch(err => {
        console.error('❌ Supabase Connection Failure:', err.message);
    });

/* ==========================================================================
   1. USER REGISTRATION API
   ========================================================================== */

const registerHandler = async (req, res) => {
    const { username, password, role } = req.body;

    if (!username || !password) {
        return res.status(400).json({
            error: 'Username and password are required.'
        });
    }

    try {
        let assignedRole = 'User';

        if (
            role &&
            (
                role.toLowerCase().includes('admin') ||
                role.toLowerCase().includes('seller')
            )
        ) {
            assignedRole = 'Admin';
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const query = `
            INSERT INTO users (username, password, role)
            VALUES ($1, $2, $3)
            RETURNING id, username, role;
        `;

        const result = await pool.query(query, [
            username,
            hashedPassword,
            assignedRole
        ]);

        res.status(201).json({
            message: 'User registered successfully!',
            user: result.rows[0]
        });

    } catch (error) {

        console.error(error);

        if (error.code === '23505') {
            return res.status(400).json({
                error: 'Username already exists.'
            });
        }

        res.status(500).json({
            error: 'Database error during registration.'
        });
    }
};

app.post('/api/register', registerHandler);
app.post('/api/auth/register', registerHandler);

/* ==========================================================================
   2. USER LOGIN API
   ========================================================================== */

const loginHandler = async (req, res) => {

    const { username, password } = req.body;

    try {

        const query = `
            SELECT * FROM users
            WHERE username = $1;
        `;

        const result = await pool.query(query, [username]);

        if (result.rows.length === 0) {
            return res.status(400).json({
                error: 'Invalid username or password.'
            });
        }

        const user = result.rows[0];

        const isValidPassword = await bcrypt.compare(
            password,
            user.password
        );

        if (!isValidPassword) {
            return res.status(400).json({
                error: 'Invalid username or password.'
            });
        }

        const token = jwt.sign(
            {
                id: user.id,
                username: user.username,
                role: user.role
            },
            process.env.JWT_SECRET || 'fallback_secret_key',
            {
                expiresIn: '24h'
            }
        );

        res.json({
            message: 'Login successful!',
            token,
            role: user.role
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: 'Database server error during login.'
        });
    }
};

app.post('/api/login', loginHandler);
app.post('/api/auth/login', loginHandler);

/* ==========================================================================
   3. PRODUCTS API
   ========================================================================== */

app.get('/api/products', async (req, res) => {

    try {

        const result = await pool.query(
            'SELECT * FROM products ORDER BY id DESC;'
        );

        res.json(result.rows);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: 'Failed to fetch products.'
        });
    }
});

app.post('/api/products', async (req, res) => {

    const { name, description, price, stock } = req.body;

    try {

        const query = `
            INSERT INTO products
            (name, description, price, stock)
            VALUES ($1, $2, $3, $4)
            RETURNING *;
        `;

        const result = await pool.query(query, [
            name,
            description,
            price,
            stock
        ]);

        res.status(201).json({
            message: 'Product added successfully!',
            product: result.rows[0]
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: 'Failed to create product.'
        });
    }
});

/* ==========================================================================
   4. ORDERS API
   ========================================================================== */

app.post('/api/orders', async (req, res) => {

    const { user_id, total_amount, status } = req.body;

    try {

        const query = `
            INSERT INTO orders
            (user_id, total_amount, status)
            VALUES ($1, $2, $3)
            RETURNING *;
        `;

        const result = await pool.query(query, [
            user_id,
            total_amount,
            status || 'Pending'
        ]);

        res.status(201).json({
            message: 'Order submitted successfully!',
            order: result.rows[0]
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: 'Failed to create order.'
        });
    }
});

app.get('/api/orders', async (req, res) => {

    try {

        const result = await pool.query(`
            SELECT orders.*, users.username
            FROM orders
            JOIN users
            ON orders.user_id = users.id
            ORDER BY orders.created_at DESC;
        `);

        res.json(result.rows);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: 'Failed to fetch orders.'
        });
    }
});

/* ==========================================================================
   SERVER START
   ========================================================================== */

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});