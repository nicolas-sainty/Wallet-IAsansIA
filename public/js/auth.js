const API_BASE = window.location.origin;

// Toast Utility
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerText = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// Login
document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
        const res = await fetch(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        // Keep both storages aligned: the rest of the app reads localStorage.
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        try { sessionStorage.setItem('token', data.token); } catch (e) { }
        try { sessionStorage.setItem('user', JSON.stringify(data.user)); } catch (e) { }

        showToast('Connexion réussie', 'success');
        setTimeout(() => window.location.href = '/', 1000);
    } catch (error) {
        showToast(error.message, 'error');
    }
});

// Register BDE
document.getElementById('registerForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const bdeName = document.getElementById('regBdeName').value;
    const fullName = document.getElementById('regFullName').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;

    try {
        const res = await fetch(`${API_BASE}/api/auth/bde/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bdeName, fullName, email, password })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        showToast('BDE créé avec succès ! Connectez-vous.', 'success');
        // Switch to login tab
        setTimeout(() => {
            const loginTab = document.querySelector('[data-target="loginLink"]');
            if (loginTab) loginTab.click();
        }, 1500);
    } catch (error) {
        showToast(error.message, 'error');
    }
});
