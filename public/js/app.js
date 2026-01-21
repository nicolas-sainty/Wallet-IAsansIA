// ========================================
// Epicoin Exchange System - App Logic
// ========================================

const API_BASE = window.location.origin;

// ========================================
// State Management
// ========================================

const state = {
    wallets: [],
    groups: [],
    transactions: [],
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
        minimumFractionDigits: 2,
        maximumFractionDigits: 8,
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
        document.getElementById('totalTransactions').textContent = totalTransactions;
        document.getElementById('totalVolume').textContent = formatAmount(totalVolume);
    } catch (error) {
        console.error('Error updating stats:', error);
    }
}

// ========================================
// Wallet Management
// ========================================

async function createWallet() {
    const groupsData = await api.get('/api/groups');
    const groups = groupsData.data || [];

    if (groups.length === 0) {
        showToast('Créez d\'abord un groupe avant de créer un wallet', 'error');
        return;
    }

    const groupId = groups[0].group_id; // Use first group for demo

    try {
        const result = await api.post('/api/wallets', {
            groupId,
            currency: 'EPIC',
        });

        showToast('Wallet créé avec succès !', 'success');
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
        updateWalletSelect();
    } catch (error) {
        console.error('Error loading wallets:', error);
    }
}

function renderWallets() {
    const container = document.getElementById('walletsList');

    if (state.wallets.length === 0) {
        container.innerHTML = `
      <div class="glass" style="padding: 3rem; text-align: center;">
        <p style="color: var(--text-secondary); margin-bottom: 1rem;">Aucun wallet trouvé</p>
        <button class="btn-primary" onclick="createWallet()">Créer votre premier wallet</button>
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
        <span class="transaction-status success">${wallet.status}</span>
      </div>
      <div class="wallet-balance">${formatAmount(wallet.balance)}</div>
      <div class="wallet-currency">${wallet.currency}</div>
      <div class="wallet-actions">
        <button class="btn-secondary" onclick="viewWalletDetails('${wallet.wallet_id}')">Détails</button>
        <button class="btn-primary" onclick="prepareTransfer('${wallet.wallet_id}')">Envoyer</button>
      </div>
    </div>
  `).join('');
}

function updateWalletSelect() {
    const select = document.getElementById('fromWallet');
    select.innerHTML = '<option value="">Sélectionner un wallet</option>' +
        state.wallets.map(w => `
      <option value="${w.wallet_id}">
        ${truncateId(w.wallet_id)} - ${formatAmount(w.balance)} ${w.currency}
      </option>
    `).join('');
}

async function viewWalletDetails(walletId) {
    try {
        const result = await api.get(`/api/wallets/${walletId}`);
        const wallet = result.data;

        const balance = await api.get(`/api/wallets/${walletId}/balance`);

        alert(`Wallet: ${wallet.wallet_id}\nBalance confirmé: ${formatAmount(balance.data.confirmedBalance)} ${wallet.currency}\nBalance disponible: ${formatAmount(balance.data.availableBalance)} ${wallet.currency}\nStatut: ${wallet.status}`);
    } catch (error) {
        showToast(error.message, 'error');
    }
}

function prepareTransfer(walletId) {
    document.getElementById('fromWallet').value = walletId;
    document.getElementById('transfer').scrollIntoView({ behavior: 'smooth' });
}

// ========================================
// Transaction Management
// ========================================

async function handleTransfer(event) {
    event.preventDefault();

    const sourceWalletId = document.getElementById('fromWallet').value;
    const destinationWalletId = document.getElementById('toWallet').value;
    const amount = parseFloat(document.getElementById('amount').value);
    const description = document.getElementById('description').value;

    if (!sourceWalletId || !destinationWalletId || !amount) {
        showToast('Veuillez remplir tous les champs obligatoires', 'error');
        return;
    }

    const sourceWallet = state.wallets.find(w => w.wallet_id === sourceWalletId);
    if (!sourceWallet) {
        showToast('Wallet source introuvable', 'error');
        return;
    }

    try {
        const result = await api.post('/api/transactions', {
            initiatorUserId: sourceWallet.user_id,
            sourceWalletId,
            destinationWalletId,
            amount,
            currency: 'EPIC',
            transactionType: 'P2P',
            description,
        });

        showToast('Transaction initiée avec succès !', 'success');

        // Reset form
        event.target.reset();

        // Reload data
        setTimeout(async () => {
            await loadTransactions();
            await loadWallets();
            updateDashboardStats();
        }, 2000);
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function loadTransactions() {
    try {
        state.transactions = [];

        for (const wallet of state.wallets) {
            const result = await api.get(`/api/wallets/${wallet.wallet_id}/transactions`);
            if (result.data) {
                state.transactions.push(...result.data);
            }
        }

        // Sort by date descending
        state.transactions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        renderTransactions();
    } catch (error) {
        console.error('Error loading transactions:', error);
    }
}

function renderTransactions() {
    const container = document.getElementById('transactionsList');

    const filtered = state.currentFilter === 'all'
        ? state.transactions
        : state.transactions.filter(t => t.status === state.currentFilter);

    if (filtered.length === 0) {
        container.innerHTML = `
      <div class="glass" style="padding: 2rem; text-align: center;">
        <p style="color: var(--text-secondary);">Aucune transaction trouvée</p>
      </div>
    `;
        return;
    }

    container.innerHTML = filtered.map(tx => {
        const isOutgoing = state.wallets.some(w => w.wallet_id === tx.source_wallet_id);

        return `
      <div class="transaction-card glass">
        <div class="transaction-icon ${isOutgoing ? 'outgoing' : 'incoming'}">
          <svg width="24" height="24" fill="none" stroke="white" viewBox="0 0 24 24">
            ${isOutgoing
                ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11l5-5m0 0l5 5m-5-5v12"/>'
                : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 13l-5 5m0 0l-5-5m5 5V6"/>'
            }
          </svg>
        </div>
        <div class="transaction-info">
          <p class="transaction-description">${tx.description || (isOutgoing ? 'Envoi' : 'Réception')}</p>
          <p class="transaction-meta">
            ${formatDate(tx.created_at)} · ${tx.transaction_type}
            <br><small style="font-family: monospace;">${truncateId(tx.transaction_id)}</small>
          </p>
        </div>
        <div style="text-align: right;">
          <p class="transaction-amount ${isOutgoing ? 'outgoing' : 'incoming'}">
            ${isOutgoing ? '-' : '+'}${formatAmount(tx.amount)} ${tx.currency}
          </p>
          <span class="transaction-status ${tx.status.toLowerCase()}">${tx.status}</span>
        </div>
      </div>
    `;
    }).join('');
}

// ========================================
// Group Management
// ========================================

async function createGroup() {
    const groupName = prompt('Nom du groupe:');
    if (!groupName) return;

    try {
        const adminUserId = crypto.randomUUID(); // Generate admin ID

        const result = await api.post('/api/groups', {
            groupName,
            adminUserId,
            settings: {},
        });

        showToast('Groupe créé avec succès !', 'success');
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
        <p style="color: var(--text-secondary); margin-bottom: 1rem;">Aucun groupe trouvé</p>
        <button class="btn-primary" onclick="createGroup()">Créer votre premier groupe</button>
      </div>
    `;
        return;
    }

    const groupsHtml = await Promise.all(state.groups.map(async (group) => {
        let stats = { total_wallets: 0, total_transactions: 0, total_volume: 0 };
        let trustScores = [];

        try {
            const statsResult = await api.get(`/api/groups/${group.group_id}/stats`);
            stats = statsResult.data || stats;

            const trustResult = await api.get(`/api/groups/${group.group_id}/trust-scores`);
            trustScores = trustResult.data || [];
        } catch (error) {
            console.error('Error loading group data:', error);
        }

        const avgTrust = trustScores.length > 0
            ? trustScores.reduce((sum, t) => sum + parseFloat(t.trust_score), 0) / trustScores.length
            : 50;

        return `
      <div class="group-card glass">
        <div class="group-header">
          <h3 class="group-name">${group.group_name}</h3>
        </div>
        <div class="group-stats">
          <div class="group-stat">
            <span class="group-stat-label">Membres</span>
            <span class="group-stat-value">${stats.total_wallets || 0}</span>
          </div>
          <div class="group-stat">
            <span class="group-stat-label">Transactions</span>
            <span class="group-stat-value">${stats.total_transactions || 0}</span>
          </div>
          <div class="group-stat">
            <span class="group-stat-label">Volume</span>
            <span class="group-stat-value">${formatAmount(stats.total_volume || 0)} EPIC</span>
          </div>
        </div>
        <div class="trust-score">
          <p class="trust-score-label">Score de Confiance Moyen</p>
          <div class="trust-score-bar">
            <div class="trust-score-fill" style="width: ${avgTrust}%"></div>
          </div>
          <p style="text-align: right; margin-top: 0.25rem; font-size: 0.875rem; font-weight: 600;">
            ${avgTrust.toFixed(1)}/100
          </p>
        </div>
      </div>
    `;
    }));

    container.innerHTML = groupsHtml.join('');
}

// ========================================
// Filter Management
// ========================================

function setupFilters() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            state.currentFilter = e.target.dataset.status;
            renderTransactions();
        });
    });
}

// ========================================
// Theme Toggle
// ========================================

function setupThemeToggle() {
    const btn = document.getElementById('themeToggle');
    btn.addEventListener('click', () => {
        document.body.classList.toggle('light-theme');
        localStorage.setItem('theme', document.body.classList.contains('light-theme') ? 'light' : 'dark');
    });

    // Load saved theme
    if (localStorage.getItem('theme') === 'light') {
        document.body.classList.add('light-theme');
    }
}

// ========================================
// Navigation
// ========================================

function setupNavigation() {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            e.target.classList.add('active');

            const target = e.target.getAttribute('href');
            document.querySelector(target).scrollIntoView({ behavior: 'smooth' });
        });
    });
}

// ========================================
// Initialization
// ========================================

async function init() {
    console.log('🚀 Initializing Epicoin App...');

    setupThemeToggle();
    setupNavigation();
    setupFilters();

    // Event listeners
    document.getElementById('createWalletBtn').addEventListener('click', createWallet);
    document.getElementById('addWalletBtn').addEventListener('click', createWallet);
    document.getElementById('createGroupBtn').addEventListener('click', createGroup);
    document.getElementById('transferForm').addEventListener('submit', handleTransfer);

    // Load initial data
    try {
        await loadGroups();
        await loadWallets();
        await loadTransactions();
        await updateDashboardStats();

        showToast('Application chargée avec succès !', 'success');
    } catch (error) {
        console.error('Initialization error:', error);
        showToast('Erreur de chargement. Vérifiez que le serveur est en cours d\'exécution.', 'error');
    }
}

// Start app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
