// ========================================
// Student Wallet - App Logic
// ========================================

const API_BASE = window.location.origin;

// ========================================
// State Management
// ========================================

const state = {
    wallets: [],
    groups: [],
    transactions: [],
    events: [],
    currentWallet: null,
    currentFilter: 'all',
};

// ========================================
// API Service
// ========================================

const api = {
    async get(endpoint) {
        const response = await fetch(`${API_BASE}${endpoint}`);
        if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
        return await response.json();
    },

    async post(endpoint, data) {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            let errorMsg;
            try {
                const error = await response.json();
                errorMsg = error.error || response.statusText;
            } catch (e) {
                errorMsg = await response.text() || response.statusText;
            }
            throw new Error(errorMsg);
        }
        return await response.json();
    },
};

// ========================================
// UI Utilities
// ========================================

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
    <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      ${type === 'success' ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>' :
            type === 'error' ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>' :
                '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>'}
    </svg>
    <span>${message}</span>
  `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('fr-FR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
}

function formatAmount(amount) {
    return parseFloat(amount).toLocaleString('fr-FR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    });
}

function truncateId(id) {
    return `${id.substring(0, 8)}...${id.substring(id.length - 6)}`;
}

// ========================================
// Dashboard Stats
// ========================================

async function updateDashboardStats() {
    try {
        const groupsData = await api.get('/api/groups');
        const groups = groupsData.data || [];

        let totalWallets = 0;
        let totalTransactions = 0;
        let totalVolume = 0;

        for (const group of groups) {
            const stats = await api.get(`/api/groups/${group.group_id}/stats`);
            if (stats.data) {
                totalWallets += parseInt(stats.data.total_wallets) || 0;
                totalTransactions += parseInt(stats.data.total_transactions) || 0;
                totalVolume += parseFloat(stats.data.total_volume) || 0;
            }
        }

        document.getElementById('totalWallets').textContent = totalWallets;
        document.getElementById('totalGroups').textContent = groups.length;
        document.getElementById('totalEvents').textContent = state.events.length;
    } catch (error) {
        console.error('Error updating stats:', error);
    }
}

// ========================================
// Event Management
// ========================================

async function createEvent() {
    const groupsData = await api.get('/api/groups');
    const groups = groupsData.data || [];

    if (groups.length === 0) {
        showToast('Créez d\'abord un groupe (Asso/BDE) !', 'error');
        return;
    }

    const title = prompt('Titre de l\'événement :');
    if (!title) return;

    const rewardPoints = prompt('Points de récompense :', '50');
    if (!rewardPoints) return;

    // Use first group as organizer for simplicity in this demo
    const groupId = groups[0].group_id;

    try {
        await api.post('/api/events', {
            groupId,
            title,
            description: 'Un super événement campus !',
            eventDate: new Date().toISOString(),
            rewardPoints: parseFloat(rewardPoints)
        });

        showToast('Événement créé avec succès !', 'success');
        await loadEvents();
        updateDashboardStats();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function loadEvents() {
    try {
        const result = await api.get('/api/events');
        state.events = result.data || [];
        renderEvents();
    } catch (error) {
        console.error('Error loading events:', error);
    }
}

function renderEvents() {
    const container = document.getElementById('eventsGrid');

    if (state.events.length === 0) {
        container.innerHTML = `
            <div class="glass" style="padding: 2rem; text-align: center; grid-column: 1 / -1;">
                <p style="color: var(--text-secondary);">Aucun événement à venir</p>
            </div>
        `;
        return;
    }

    container.innerHTML = state.events.map(event => `
        <div class="event-card">
            <div class="event-image">
                <svg width="40" height="40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
            </div>
            <div class="event-content">
                <div class="event-date">${formatDate(event.event_date)}</div>
                <h3 class="event-title">${event.title}</h3>
                <p class="event-description">${event.description || 'Pas de description'}</p>
                <div class="event-footer">
                    <span class="event-reward">+${event.reward_points} pts</span>
                    <button class="btn-primary" style="font-size: 0.8rem; padding: 0.4rem 0.8rem;" 
                            onclick="participateInEvent('${event.event_id}', this)">
                        Participer
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

async function participateInEvent(eventId, btnElement) {
    if (state.wallets.length === 0) {
        showToast('Créez d\'abord un wallet étudiant !', 'error');
        return;
    }

    // Visual feedback
    if (btnElement) {
        btnElement.disabled = true;
        btnElement.innerHTML = '<span class="spinner"></span> ...';
    }

    const walletId = state.wallets[0].wallet_id;

    try {
        const result = await api.post(`/api/events/${eventId}/participate`, { walletId });

        showToast('Inscription validée ! En attente du BDE.', 'success');

        // Update UI locally without reload to show "Pending" state
        // Find the event card and update the footer
        if (btnElement) {
            btnElement.textContent = 'En attente';
            btnElement.classList.replace('btn-primary', 'btn-secondary');
            btnElement.style.opacity = '0.7';
        }

    } catch (error) {
        showToast(error.message, 'error');
        if (btnElement) {
            btnElement.disabled = false;
            btnElement.textContent = 'Participer';
        }
    }
}

// ========================================
// Wallet Management
// ========================================

async function createWallet(e) {
    if (e) e.preventDefault();
    if (!checkAuth()) {
        window.location.href = '/login.html?tab=register';
        return;
    }

    // Single Wallet Rule: Check if user already has a wallet
    if (state.wallets && state.wallets.length > 0) {
        showToast('Vous avez déjà un compte BDE actif !', 'error');
        return;
    }

    const groupsData = await api.get('/api/groups');
    const groups = groupsData.data || [];

    if (groups.length === 0) {
        showToast('Aucun BDE disponible.', 'error');
        return;
    }

    // Auto-select the first (and only) BDE
    const groupId = groups[0].group_id;

    try {
        await api.post('/api/wallets', {
            groupId,
            currency: 'PTS',
        });

        showToast('Compte étudiant créé !', 'success');
        await loadWallets();
        updateDashboardStats();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function loadWallets() {
    if (!checkAuth()) return;

    try {
        const token = localStorage.getItem('token');
        const payload = JSON.parse(atob(token.split('.')[1]));
        const userId = payload.userId;

        const response = await api.get(`/api/wallets?userId=${userId}`);
        state.wallets = response.data || [];

        renderWallets();
    } catch (error) {
        console.error('Error loading wallets:', error);
    }
}

function renderWallets() {
    const container = document.getElementById('walletsList');

    // Calculate Total Balance
    const totalBalance = state.wallets.reduce((sum, w) => sum + parseFloat(w.balance), 0);
    const balanceDisplay = document.getElementById('totalBalanceDisplay');
    if (balanceDisplay) {
        balanceDisplay.textContent = formatAmount(totalBalance);
    }

    if (state.wallets.length === 0) {
        container.innerHTML = `
      <div class="glass" style="padding: 3rem; text-align: center; grid-column: 1 / -1;">
        <p style="color: var(--text-secondary); margin-bottom: 1rem;">Pas encore de compte ?</p>
        <button class="btn-primary" onclick="createWallet()">Créer mon compte</button>
      </div>
    `;
        return;
    }

    container.innerHTML = state.wallets.map((wallet, index) => {
        // Generate a random gradient class for variety
        // const gradientClass = `card-gradient-${(index % 3) + 1}`; 

        return `
    <div class="credit-card" onclick="viewWalletDetails('${wallet.wallet_id}')" style="cursor: pointer;">
        <div class="card-top">
            <div class="card-chip"></div>
            <div class="card-contactless">
                <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a14 14 0 00-2.833-6.663l-.053-.09M19.5 11a7.5 7.5 0 00-15 0m15 0a7.5 7.5 0 00-15 0" />
                </svg>
            </div>
        </div>
        
        <div class="card-balance">${formatAmount(wallet.balance)} pts</div>
        
        <div class="card-bottom">
            <div class="card-holder">
                <span>Titulaire</span>
                <strong>${wallet.group_name || 'Étudiant'}</strong>
            </div>
            <div class="card-logo">EPICOIN</div>
        </div>
    </div>
  `}).join('');
}

async function viewWalletDetails(walletId) {
    try {
        const result = await api.get(`/api/wallets/${walletId}`);
        const wallet = result.data;
        const balance = await api.get(`/api/wallets/${walletId}/balance`);

        // Simple alert for now
        alert(`Solde actuel : ${formatAmount(balance.data.confirmedBalance)} points`);
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// ========================================
// Group Management
// ========================================

async function createGroup() {
    const groupName = prompt('Nom de l\'asso / BDE :');
    if (!groupName) return;

    try {
        const adminUserId = crypto.randomUUID();

        await api.post('/api/groups', {
            groupName,
            adminUserId,
            settings: {},
        });

        showToast('Association créée !', 'success');
        await loadGroups();
        updateDashboardStats();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function loadGroups() {
    try {
        const result = await api.get('/api/groups');
        state.groups = result.data || [];
        renderGroups();
    } catch (error) {
        console.error('Error loading groups:', error);
    }
}

async function renderGroups() {
    const container = document.getElementById('groupsList');

    if (state.groups.length === 0) {
        container.innerHTML = `
      <div class="glass" style="padding: 3rem; text-align: center; grid-column: 1 / -1;">
        <p style="color: var(--text-secondary); margin-bottom: 1rem;">Aucune asso enregistrée</p>
        <button class="btn-primary" onclick="createGroup()">Enregistrer une asso</button>
      </div>
    `;
        return;
    }

    const groupsHtml = await Promise.all(state.groups.map(async (group) => {
        let stats = { total_wallets: 0, total_volume: 0 };
        try {
            const statsResult = await api.get(`/api/groups/${group.group_id}/stats`);
            stats = statsResult.data || stats;
        } catch (error) {
            console.error('Error loading group data:', error);
        }

        return `
      <div class="group-card glass">
        <div class="group-header">
          <h3 class="group-name">${group.group_name}</h3>
        </div>
        <div class="group-stats">
          <div class="group-stat">
            <span class="group-stat-label">Adhérents</span>
            <span class="group-stat-value">${stats.total_wallets || 0}</span>
          </div>
          <div class="group-stat">
            <span class="group-stat-label">Points Distribués</span>
            <span class="group-stat-value">${formatAmount(stats.total_volume || 0)}</span>
          </div>
        </div>
      </div>
    `;
    }));

    container.innerHTML = groupsHtml.join('');
}


// ========================================
// Transaction Management (Simplified)
// ========================================

async function loadTransactions() {
    try {
        state.transactions = [];
        for (const wallet of state.wallets) {
            const result = await api.get(`/api/wallets/${wallet.wallet_id}/transactions`);
            if (result.data) {
                state.transactions.push(...result.data);
            }
        }
        state.transactions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        renderTransactions();
    } catch (error) {
        console.error('Error loading transactions:', error);
    }
}

function renderTransactions() {
    const container = document.getElementById('transactionsList');

    if (state.transactions.length === 0) {
        container.innerHTML = `
      <div class="glass" style="padding: 2rem; text-align: center;">
        <p style="color: var(--text-secondary);">Aucune activité récente</p>
      </div>
    `;
        return;
    }

    container.innerHTML = state.transactions.map(tx => `
      <div class="transaction-card glass">
        <div class="transaction-icon incoming">
          <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
             <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div class="transaction-info">
          <p class="transaction-description">Gain de points</p>
          <p class="transaction-meta">${formatDate(tx.created_at)}</p>
        </div>
        <div style="text-align: right;">
          <p class="transaction-amount incoming">+${formatAmount(tx.amount)} pts</p>
        </div>
      </div>
    `).join('');
}

// ========================================
// Initialization
// ========================================

// ========================================
// Authentication Logic
// ========================================

function checkAuth() {
    const token = localStorage.getItem('token');
    return !!token;
}

function updateNavAuth() {
    const navActions = document.querySelector('.nav-actions');
    const isLoggedIn = checkAuth();

    if (isLoggedIn) {
        navActions.innerHTML = `
            <a href="/profile.html" class="btn-secondary" style="text-decoration: none;">Mon Profil</a>
            <button class="btn-primary" id="createWalletBtn">Démarrer</button>
        `;
    } else {
        navActions.innerHTML = `
            <a href="/login.html" class="btn-secondary" style="text-decoration: none;">Se Connecter</a>
            <a href="/login.html?tab=register" class="btn-primary" style="text-decoration: none;">Rejoindre</a>
        `;
    }
}

// ========================================
// Initialization
// ========================================

async function init() {
    console.log('🚀 Initializing Student Wallet...');

    updateNavAuth();

    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            document.body.classList.toggle('light-theme');
        });
    }

    // Navigation - Highlight active link based on URL if not already hardcoded
    const currentPath = window.location.pathname;
    document.querySelectorAll('.nav-link').forEach(link => {
        if (link.getAttribute('href') === currentPath) {
            link.classList.add('active');
        }
    });

    // Event listeners
    const createWalletBtn = document.getElementById('createWalletBtn');
    if (createWalletBtn) createWalletBtn.addEventListener('click', createWallet);

    const addWalletBtn = document.getElementById('addWalletBtn');
    if (addWalletBtn) addWalletBtn.addEventListener('click', createWallet);

    const createGroupBtn = document.getElementById('createGroupBtn');
    if (createGroupBtn) createGroupBtn.addEventListener('click', createGroup);

    const createEventBtn = document.getElementById('createEventBtn');
    if (createEventBtn) createEventBtn.addEventListener('click', createEvent);

    // Initial Data Loading based on page presence
    try {
        // Always load stats for the dashboard if elements exist
        if (document.getElementById('totalWallets')) {
            await updateDashboardStats();
        }

        // Load specific sections if they exist in the DOM
        if (document.getElementById('groupsList')) {
            await loadGroups();
        }

        if (document.getElementById('walletsList')) {
            await loadWallets();
        }

        if (document.getElementById('eventsGrid')) {
            await loadEvents();
        }

        if (document.getElementById('transactionsList')) {
            await loadTransactions();
        }

        // If checks pass, show ready toast
        // showToast('Student Wallet prêt !', 'success'); 
    } catch (error) {
        console.error('Initialization error:', error);
        showToast('Erreur de connexion au serveur.', 'error');
    }
}

// Start app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
