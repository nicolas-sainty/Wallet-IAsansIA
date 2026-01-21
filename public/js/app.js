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
            const error = await response.json();
            throw new Error(error.error || response.statusText);
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
                            onclick="participateInEvent('${event.event_id}')">
                        Participer
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

async function participateInEvent(eventId) {
    if (state.wallets.length === 0) {
        showToast('Créez d\'abord un wallet étudiant !', 'error');
        return;
    }

    // Pick first wallet as participant for demo
    const walletId = state.wallets[0].wallet_id;

    try {
        await api.post(`/api/events/${eventId}/participate`, { walletId });
        showToast('Participation enregistrée ! Points crédités.', 'success');
        await loadWallets(); // Update balance
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// ========================================
// Wallet Management
// ========================================

async function createWallet() {
    const groupsData = await api.get('/api/groups');
    const groups = groupsData.data || [];

    if (groups.length === 0) {
        showToast('Aucune association trouvée. Créez-en une d\'abord !', 'error');
        return;
    }

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
    try {
        const groupsData = await api.get('/api/groups');
        const groups = groupsData.data || [];

        state.wallets = [];

        for (const group of groups) {
            const members = await api.get(`/api/groups/${group.group_id}/members`);
            if (members.data) {
                state.wallets.push(...members.data.map(w => ({ ...w, group_name: group.group_name })));
            }
        }

        renderWallets();
        // updateWalletSelect(); // If we keep transfers
    } catch (error) {
        console.error('Error loading wallets:', error);
    }
}

function renderWallets() {
    const container = document.getElementById('walletsList');

    if (state.wallets.length === 0) {
        container.innerHTML = `
      <div class="glass" style="padding: 3rem; text-align: center;">
        <p style="color: var(--text-secondary); margin-bottom: 1rem;">Pas encore de compte ?</p>
        <button class="btn-primary" onclick="createWallet()">Créer mon compte</button>
      </div>
    `;
        return;
    }

    container.innerHTML = state.wallets.map(wallet => `
    <div class="wallet-card glass">
      <div class="wallet-header">
        <div>
          <small style="color: var(--text-muted);">${wallet.group_name || 'N/A'}</small>
          <p class="wallet-id">${truncateId(wallet.wallet_id)}</p>
        </div>
        <span class="transaction-status success">Actif</span>
      </div>
      <div class="wallet-balance">${formatAmount(wallet.balance)} pts</div>
      <div class="wallet-actions">
        <button class="btn-secondary" onclick="viewWalletDetails('${wallet.wallet_id}')">Détails</button>
      </div>
    </div>
  `).join('');
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
            <button class="btn-primary" onclick="window.location.href='/login.html'">Rejoindre</button>
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

    // Navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            e.target.classList.add('active');
            const target = e.target.getAttribute('href');
            document.querySelector(target).scrollIntoView({ behavior: 'smooth' });
        });
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

    // Load initial data
    try {
        await loadGroups();
        await loadWallets();
        await loadEvents();
        await loadTransactions();
        await updateDashboardStats();

        showToast('Student Wallet prêt !', 'success');
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
