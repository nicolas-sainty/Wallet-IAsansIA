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

        sessionStorage.setItem('token', data.token);
        sessionStorage.setItem('user', JSON.stringify(data.user));

        showToast('Connexion réussie', 'success');
        setTimeout(() => window.location.href = '/', 1000);
    } catch (error) {
        showToast(error.message, 'error');
    }
});

// Register
document.getElementById('registerForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fullName = document.getElementById('regName').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    // Security: registration endpoint only allows student role.
    const role = 'student';

    try {
        const res = await fetch(`${API_BASE}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fullName, email, password, role })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        showToast('Compte créé ! Vérifiez votre email ou connectez-vous.', 'success');
        // Switch to login tab
        document.querySelector('[data-target="loginLink"]').click();
    } catch (error) {
        showToast(error.message, 'error');
    }
});
