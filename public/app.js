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
        document.getElementById('auth-form').classList.add('hidden');
        document.getElementById('logout-btn').classList.remove('hidden');
        document.getElementById('store-section').classList.remove('hidden');
        document.getElementById('auth-status').innerText = `Logged in as: ${localStorage.getItem('username')} (${role})`;
        
        if (role === 'Admin') {
            document.getElementById('admin-section').classList.remove('hidden');
            loadAdminOrders();
        }
    } else {
        document.getElementById('auth-form').classList.remove('hidden');
        document.getElementById('logout-btn').classList.add('hidden');
        document.getElementById('store-section').classList.add('hidden');
        document.getElementById('admin-section').classList.add('hidden');
        document.getElementById('auth-status').innerText = "Not Logged In";
    }
}

// Auth Handlers
async function register() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const role = document.getElementById('role').value;

    const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, role })
    });
    const data = await res.json();
    alert(data.message || data.error);
}

async function login() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if(res.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('role', data.role);
        localStorage.setItem('username', data.username);
        token = data.token;
        role = data.role;
        updateUI();
        loadProducts();
    } else {
        alert(data.message);
    }
}

function logout() {
    localStorage.clear();
    token = null;
    role = null;
    cart = [];
    updateCartUI();
    updateUI();
}

// Catalog & Cart Management
async function loadProducts() {
    const res = await fetch(`${API_URL}/products`);
    const products = await res.json();
    const container = document.getElementById('product-list');
    container.innerHTML = '';

    products.forEach(p => {
        container.innerHTML += `
            <div class="product-card">
                <h4>${p.name} - $${p.price}</h4>
                <p>${p.description}</p>
                <small>In stock: ${p.stock}</small><br><br>
                <button onclick="addToCart(${p.id}, '${p.name}', ${p.price})">Add to Cart</button>
            </div>
        `;
    });
}

function addToCart(id, name, price) {
    cart.push({ id, name, price });
    updateCartUI();
}

function updateCartUI() {
    const cartDetails = document.getElementById('cart-details');
    if(cart.length === 0) {
        cartDetails.innerText = "Cart is empty.";
        document.getElementById('checkout-btn').classList.add('hidden');
        return;
    }
    let total = cart.reduce((sum, item) => sum + item.price, 0);
    cartDetails.innerHTML = cart.map(i => `<li>${i.name} - $${i.price}</li>`).join('') + `<br><strong>Total: $${total.toFixed(2)}</strong>`;
    document.getElementById('checkout-btn').classList.remove('hidden');
}

async function checkout() {
    let total = cart.reduce((sum, item) => sum + item.price, 0);
    const res = await fetch(`${API_URL}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ total_amount: total })
    });
    const data = await res.json();
    alert(data.message);
    cart = [];
    updateCartUI();
    if (role === 'Admin') loadAdminOrders();
}

// Admin Panel Code
async function addProduct() {
    const name = document.getElementById('p-name').value;
    const description = document.getElementById('p-desc').value;
    const price = document.getElementById('p-price').value;
    const stock = document.getElementById('p-stock').value;

    const res = await fetch(`${API_URL}/products`, {
        method: 'POST', // <-- Make sure this line is here
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` // <-- Adds security token
        },
        body: JSON.stringify({ name, description, price, stock })
    });
    const data = await res.json();
    alert(data.message || data.error);
    loadProducts();
}


async function loadAdminOrders() {
    const res = await fetch(`${API_URL}/orders`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const orders = await res.json();
    const container = document.getElementById('admin-orders');
    container.innerHTML = orders.map(o => `
        <p>📦 <strong>Order #${o.id}</strong> by <em>${o.username}</em> - Total: $${o.total_amount} | Status: <strong>${o.status}</strong></p>
    `).join('');
}
