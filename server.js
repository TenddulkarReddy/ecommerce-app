require('dotenv').config();

const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');

const app = express();

/* =========================
   MIDDLEWARE
========================= */

app.use(express.json());
app.use(cors());

/* =========================
   FRONTEND STATIC FILES
========================= */

app.use(express.static(path.join(__dirname, 'public')));

/* =========================
   DATABASE CONNECTION
========================= */

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

pool.connect()
    .then(client => {
        console.log('✅ Connected to Supabase PostgreSQL');
        client.release();
    })
    .catch(err => {
        console.error('❌ Database Connection Error:', err.message);
    });

/* =========================
   REGISTER API
========================= */

app.post('/api/register', async (req, res) => {

    const { username, password, role } = req.body;

    if (!username || !password) {
        return res.status(400).json({
            error: 'Username and password required'
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
            RETURNING id, username, role
        `;

        const result = await pool.query(query, [
            username,
            hashedPassword,
            assignedRole
        ]);

        res.status(201).json({
            message: 'User registered successfully',
            user: result.rows[0]
        });

    } catch (error) {

        console.error('REGISTER ERROR:', error);

        if (error.code === '23505') {
            return res.status(400).json({
                error: 'Username already exists'
            });
        }

        res.status(500).json({
            error: error.message
        });
    }
});

/* =========================
   LOGIN API
========================= */

app.post('/api/login', async (req, res) => {

    const { username, password } = req.body;

    try {

        const query = `
            SELECT * FROM users
            WHERE username = $1
        `;

        const result = await pool.query(query, [username]);

        if (result.rows.length === 0) {
            return res.status(400).json({
                error: 'Invalid username or password'
            });
        }

        const user = result.rows[0];

        const validPassword = await bcrypt.compare(
            password,
            user.password
        );

        if (!validPassword) {
            return res.status(400).json({
                error: 'Invalid username or password'
            });
        }

        const token = jwt.sign(
            {
                id: user.id,
                username: user.username,
                role: user.role
            },
            process.env.JWT_SECRET,
            {
                expiresIn: '24h'
            }
        );

        res.json({
            message: 'Login successful',
            token,
            role: user.role
        });

    } catch (error) {

        console.error('LOGIN ERROR:', error);

        res.status(500).json({
            error: error.message
        });
    }
});

/* =========================
   PRODUCTS API
========================= */

app.get('/api/products', async (req, res) => {

    try {

        const result = await pool.query(
            'SELECT * FROM products ORDER BY id DESC'
        );

        res.json(result.rows);

    } catch (error) {

        console.error('PRODUCT ERROR:', error);

        res.status(500).json({
            error: error.message
        });
    }
});

/* =========================
   ORDERS API
========================= */

app.get('/api/orders', async (req, res) => {

    try {

        const result = await pool.query(`
            SELECT orders.*, users.username
            FROM orders
            JOIN users
            ON orders.user_id = users.id
            ORDER BY orders.created_at DESC
        `);

        res.json(result.rows);

    } catch (error) {

        console.error('ORDER ERROR:', error);

        res.status(500).json({
            error: error.message
        });
    }
});

/* =========================
   FRONTEND ROUTE
========================= */

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/* =========================
   START SERVER
========================= */

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});