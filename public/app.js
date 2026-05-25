const API_URL = 'https://ecommerce-app-backend-fmcl.onrender.com/api';

let cart = [];
let token = localStorage.getItem('token');
let role = localStorage.getItem('role');

// App Initialization
window.onload = () => {
    updateUI();
    loadProducts();
};

function updateUI() {
    if (token) {
        if (document.getElementById('auth-form')) document.getElementById('auth-form').classList.add('hidden');
        if (document.getElementById('logout-btn')) document.getElementById('logout-btn').classList.remove('hidden');
        if (document.getElementById('store-section')) document.getElementById('store-section').classList.remove('hidden');
        if (document.getElementById('auth-status')) {
            document.getElementById('auth-status').innerText = `Logged in as: ${localStorage.getItem('username')} (${role})`;
        }
        
        if (role === 'Admin') {
            if (document.getElementById('admin-section')) document.getElementById('admin-section').classList.remove('hidden');
        } else {
            if (document.getElementById('admin-section')) document.getElementById('admin-section').classList.add('hidden');
        }
    } else {
        if (document.getElementById('auth-form')) document.getElementById('auth-form').classList.remove('hidden');
        if (document.getElementById('logout-btn')) document.getElementById('logout-btn').classList.add('hidden');
        if (document.getElementById('store-section')) document.getElementById('store-section').classList.add('hidden');
        if (document.getElementById('admin-section')) document.getElementById('admin-section').classList.add('hidden');
        if (document.getElementById('auth-status')) {
            document.getElementById('auth-status').innerText = '';
        }
    }
}

async function login(event) {
    if (event) event.preventDefault();
    await handleAuth('login');
}

async function register(event) {
    if (event) event.preventDefault();
    await handleAuth('register');
}

async function handleAuth(type) {
    const usernameInput = document.getElementById('username')?.value;
    const passwordInput = document.getElementById('password')?.value;
    const roleInput = document.getElementById('role') ? document.getElementById('role').value : 'Customer / Shopper';

    if (!usernameInput || !passwordInput) {
        alert('Please fill out all fields.');
        return;
    }

    const endpoint = type === 'login' ? '/auth/login' : '/auth/register';
    
    try {
        const response = await fetch(`${API_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: usernameInput, password: passwordInput, role: roleInput })
        });

        const data = await response.json();

        if (!response.ok) {
            alert(data.error || 'Authentication task failed.');
            return;
        }

        if (type === 'login') {
            localStorage.setItem('token', data.token);
            localStorage.setItem('role', data.role);
            localStorage.setItem('username', usernameInput);
            token = data.token;
            role = data.role;
            alert('Welcome! Login successful.');
            updateUI();
            loadProducts();
        } else {
            alert('Registration completed successfully! You can login now.');
        }
    } catch (err) {
        console.error('Error during auth:', err);
        alert('Server communication error occurred.');
    }
}

async function loadProducts() {
    try {
        const response = await fetch(`${API_URL}/products`);
        const products = await response.json();
        
        const container = document.getElementById('products-container');
        if (!container) return;
        container.innerHTML = '';

        // Safety Guard: Check if server returned a valid array list instead of an error object
        if (!Array.isArray(products)) {
            console.warn('Database connection is still waking up on Render. Retrying...');
            container.innerHTML = `<p style="color: gray;">Loading store inventory...</p>`;
            return;
        }

        products.forEach(product => {
            const card = document.createElement('div');
            card.className = 'product-card';
            card.innerHTML = `
                <h3>${product.name}</h3>
                <p>${product.description}</p>
                <p><strong>Price:</strong> $${product.price}</p>
                <p><strong>Stock:</strong> ${product.stock}</p>
                <button onclick="addToCart(${product.id}, '${product.name}', ${product.price})">Add To Cart</button>
            `;
            container.appendChild(card);
        });
    } catch (err) {
        console.error('Error loading products catalog:', err);
    }
}

function logout() {
    localStorage.clear();
    token = null;
    role = null;
    alert('Logged out successfully.');
    updateUI();
}

window.login = login;
window.register = register;
window.logout = logout;
