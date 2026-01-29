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
        const token = localStorage.getItem('token');
        const headers = {};
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${API_BASE}${endpoint}`, { headers, cache: 'no-store' });
        if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
        return await response.json();
    },

    async post(endpoint, data) {
        const token = localStorage.getItem('token');
        const headers = { 'Content-Type': 'application/json' };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${API_BASE}${endpoint}`, {
            method: 'POST',
            headers,
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
    if (!id) return '';
    if (id.length <= 14) return id; // Don't truncate if short
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
<<<<<<< HEAD
=======
// Card Page Logic (Mobile Home)
// ========================================

async function loadCardData() {
    try {
        const user = JSON.parse(localStorage.getItem('user'));
        const nameEl = document.getElementById('userName');
        const roleEl = document.getElementById('userRoleBadge');
        if (nameEl) nameEl.textContent = user.email;
        if (roleEl) roleEl.textContent = user.role === 'student' ? 'ETUDIANT' : 'BDE / ADMIN';

        // Load Pending Requests on Home
        loadHomeRequests();

        // Fetch User Wallet (CREDITS)
        // Use existing /api/wallets endpoint with userId query
        const result = await api.get(`/api/wallets?userId=${user.userId || user.user_id}`);
        const wallets = result.data || [];

        // Find CREDITS wallet (or first available if none specific)
        const creditWallet = wallets.find(w => w.currency === 'CREDITS') || wallets[0];

        const balanceEl = document.getElementById('balanceDisplay');
        if (balanceEl) {
            if (creditWallet) {
                balanceEl.textContent = parseFloat(creditWallet.balance).toFixed(2);
            } else {
                balanceEl.textContent = "0.00";
            }
        }

        // Store in state
        state.wallets = wallets;

        // Load History (Placeholder or real)
        const activityList = document.getElementById('recentTransactionsList');
        if (activityList && creditWallet) {
            const txResult = await api.get(`/api/wallets/${creditWallet.wallet_id}/transactions`);
            const txs = txResult.data || [];
            if (txs.length === 0) {
                activityList.innerHTML = '<p class="empty-text">Aucune transaction.</p>';
            } else {
                activityList.innerHTML = txs.slice(0, 5).map(tx => `
                    <div style="display:flex; justify-content:space-between; padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                        <div>
                            <span style="font-size:0.9rem;">${tx.description || 'Transaction'}</span><br>
                            <small style="color:var(--text-muted);">${formatDate(tx.created_at)}</small>
                        </div>
                        <span style="color:${tx.amount > 0 ? '#4ade80' : '#ef4444'};">
                            ${tx.amount > 0 ? '+' : ''}${formatAmount(tx.amount)}
                        </span>
                    </div>
                 `).join('');
            }
        }

    } catch (error) {
        console.error("Error loading card data", error);
        showToast("Erreur chargement carte", "error");
    }
}

async function loadGroupsForPay() {
    try {
        const user = JSON.parse(localStorage.getItem('user'));
        const select = document.getElementById('payRecipientGroup');
        if (!select) return;

        if (!user || !user.bde_id) {
            select.innerHTML = '<option value="" disabled selected>Aucun BDE assigné</option>';
            return;
        }

        const result = await api.get(`/api/groups/${user.bde_id}`);
        const group = result.data;

        if (group) {
            select.innerHTML = `<option value="${group.group_id}" selected>${group.group_name}</option>`;
        } else {
            select.innerHTML = '<option value="" disabled selected>BDE introuvable</option>';
        }
    } catch (e) {
        console.error("Error loading groups", e);
    }
}

async function loadHomeRequests() {
    const container = document.getElementById('homePendingRequests');
    if (!container) return;

    try {
        const res = await api.get('/api/payment/requests');
        const requests = res.data || [];

        if (requests.length > 0) {
            container.style.display = 'block';
            container.innerHTML = requests.map(r => `
                <div class="glass-panel" style="padding: 1rem; margin-bottom: 0.5rem; background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
                        <strong style="color:var(--color-orange);">Demande de Paiement</strong>
                        <span style="background:var(--color-orange); color:black; padding:2px 8px; border-radius:10px; font-weight:bold;">${r.amount} Pts</span>
                    </div>
                    <p style="margin:0 0 1rem 0; font-size:0.9rem;">${r.description || 'Paiement requis'}</p>
                    <div style="display:flex; gap:0.5rem;">
                        <button class="btn-primary" style="flex:1; padding:0.5rem;" onclick="respondRequestHome('${r.request_id}', 'PAY')">Payer</button>
                        <button class="btn-secondary" style="flex:1; padding:0.5rem;" onclick="respondRequestHome('${r.request_id}', 'REJECT')">Rejeter</button>
                    </div>
                </div>
            `).join('');

            // Also define helper if not exists
            if (!window.respondRequestHome) {
                window.respondRequestHome = async (reqId, action) => {
                    if (!confirm(action === 'PAY' ? "Confirmer le paiement ?" : "Refuser la demande ?")) return;
                    try {
                        await api.post(`/api/payment/requests/${reqId}/respond`, { action });
                        showToast("Action effectuée !", "success");
                        setTimeout(() => window.location.reload(), 500);
                    } catch (e) { showToast(e.message, 'error'); }
                };
            }
        } else {
            container.style.display = 'none';
        }
    } catch (e) { console.error("Home requests error", e); }
}

function openPayModal() {
    const el = document.getElementById('payModal');
    if (el) el.classList.remove('hidden');
}

function closePayModal() {
    const el = document.getElementById('payModal');
    if (el) el.classList.add('hidden');
}

async function processPayment() {
    const amountEl = document.getElementById('payAmount');
    const groupEl = document.getElementById('payRecipientGroup');
    const user = JSON.parse(localStorage.getItem('user'));

    if (!amountEl || !groupEl) return;

    const amount = parseFloat(amountEl.value);
    const groupId = groupEl.value;

    if (!amount || amount <= 0) {
        showToast('Montant invalide', 'error');
        return;
    }
    if (!groupId) {
        showToast('Veuillez choisir un bénéficiaire', 'error');
        return;
    }

    try {
        await api.post('/api/transactions/pay', {
            userId: user.userId || user.user_id, // Check how userId is stored
            groupId: groupId,
            amount: amount
        });

        showToast('Paiement envoyé !', 'success');
        closePayModal();
        await loadCardData(); // Refresh balance
    } catch (error) {
        showToast(error.message || 'Erreur paiement', 'error');
    }
}

// ========================================
// Event Logic (Retained & Adapted)
// ========================================

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
    if (!container) return; // Might not exist on other pages

    if (state.events.length === 0) {
        container.innerHTML = `
            <div class="glass" style="padding: 2rem; text-align: center; grid-column: 1 / -1;">
                <p style="color: var(--text-secondary);">Aucun événement à venir</p>
            </div>
        `;
        return;
    }

    // Check user role
    const user = JSON.parse(localStorage.getItem('user'));
    const isAdmin = user && (user.role === 'bde_admin' || user.role === 'admin');

    // Show create button for admins
    const createBtn = document.getElementById('createEventBtn');
    if (createBtn && isAdmin) {
        createBtn.style.display = 'block';
    }

    container.innerHTML = state.events.map(event => {
        // Status badge
        const statusColors = {
            'DRAFT': '#6b7280',
            'OPEN': '#10b981',
            'FULL': '#f59e0b',
            'CLOSED': '#ef4444',
            'CANCELLED': '#6b7280'
        };
        const status = event.status || 'OPEN';
        const statusBadge = `<span style="background: ${statusColors[status]}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: 600; margin-left: 0.5rem;">${status}</span>`;

        // Participants count
        const participantsInfo = event.max_participants
            ? `<small style="color: var(--text-muted);">${event.current_participants || 0}/${event.max_participants} inscrits</small>`
            : `<small style="color: var(--text-muted);">${event.current_participants || 0} inscrits</small>`;

        let actionArea = '';
        let participantsSection = '';

        if (isAdmin) {
            // BDE View: Show participant count and list
            actionArea = `
                <div style="margin-top: 0.5rem;">
                    ${participantsInfo}
                </div>
            `;

            // Add participants list section for BDE
            participantsSection = `
                <div id="participants-${event.event_id}" style="margin-top: 1rem; padding-top: 0.5rem; border-top: 1px solid rgba(255,255,255,0.1);">
                    <small style="color: var(--text-muted); font-weight: 600;">Participants:</small>
                </div>
            `;
            // Auto-load participants for this event
            setTimeout(() => loadEventParticipants(event.event_id), 100);
        } else {
            // Student View: Check registration status and show appropriate action
            // We'll check status asynchronously and update the card
            const eventCardId = `event-action-${event.event_id}`;

            if (status === 'OPEN') {
                actionArea = `
                    <div id="${eventCardId}">
                        <button class="btn-primary" style="font-size: 1rem; padding: 1rem; width: 100%; justify-content: center;" 
                                onclick="participateInEvent('${event.event_id}')">
                            S'inscrire
                        </button>
                    </div>
                `;
                // Check registration status asynchronously
                setTimeout(async () => {
                    const regStatus = await checkUserRegistrationStatus(event.event_id);
                    const actionEl = document.getElementById(eventCardId);
                    if (actionEl && regStatus) {
                        if (regStatus === 'pending') {
                            actionEl.innerHTML = `<span style="background: #f59e0b; color: white; padding: 1rem; border-radius: 8px; font-size: 0.9rem; display: block; text-align: center; font-weight: 600;">⏳ En attente de validation</span>`;
                        } else if (regStatus === 'verified') {
                            actionEl.innerHTML = `<span style="background: #10b981; color: white; padding: 1rem; border-radius: 8px; font-size: 0.9rem; display: block; text-align: center; font-weight: 600;">✅ Présence validée</span>`;
                        } else if (regStatus === 'rejected') {
                            actionEl.innerHTML = `<span style="background: #ef4444; color: white; padding: 1rem; border-radius: 8px; font-size: 0.9rem; display: block; text-align: center; font-weight: 600;">✗ Refusé</span>`;
                        }
                    }
                }, 100);
            } else if (status === 'FULL') {
                actionArea = `<p style="color: #f59e0b; font-size: 0.8rem; margin-top: 0.5rem;">Complet</p>`;
            } else if (status === 'CLOSED') {
                actionArea = `<p style="color: var(--text-muted); font-size: 0.8rem; margin-top: 0.5rem;">Terminé</p>`;
            } else if (status === 'CANCELLED') {
                actionArea = `<p style="color: var(--text-muted); font-size: 0.8rem; margin-top: 0.5rem;">Annulé</p>`;
            } else {
                actionArea = `<p style="color: var(--text-muted); font-size: 0.8rem; margin-top: 0.5rem;">Non disponible</p>`;
            }
        }
        return `
        <div class="event-card">
            <div class="event-image">
                <svg width="40" height="40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
            </div>
            <div class="event-content">
                <div class="event-date">${formatDate(event.event_date)}${statusBadge}</div>
                <h3 class="event-title">${event.title}</h3>
                <p class="event-description">${event.description || 'Pas de description'}</p>
                <div class="event-footer">
                    <span class="event-reward">+${event.reward_points} pts</span>
                    <div style="flex: 1;">${actionArea}</div>
                </div>
                ${participantsSection}
            </div>
        </div>
    `}).join('');
}

// Helper function to check user's registration status for an event
async function checkUserRegistrationStatus(eventId) {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) return null;

    try {
        const result = await api.get(`/api/events/${eventId}/participants`);
        const participants = result.data || [];
        const userParticipation = participants.find(p => p.user_id === (user.userId || user.user_id));
        return userParticipation ? userParticipation.status : null;
    } catch (error) {
        console.error('Error checking registration status:', error);
        return null;
    }
}

async function participateInEvent(eventId) {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) {
        showToast('Connectez-vous d\'abord', 'error');
        return;
    }

    // Find the button container and button
    const actionContainer = document.getElementById(`event-action-${eventId}`);
    if (!actionContainer) return;

    const button = actionContainer.querySelector('button');
    if (!button) return;

    const originalText = button.textContent;
    button.disabled = true;
    button.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" style="animation: spin 1s linear infinite; display: inline-block;">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Inscription...
    `;

    try {
        await api.post(`/api/events/${eventId}/participate`, {});
        actionContainer.innerHTML = `<span style="background: #10b981; color: white; padding: 1rem; border-radius: 8px; font-size: 0.9rem; display: block; text-align: center; font-weight: 600;">✅ Présence validée</span>`;
        showToast('Inscription réussie !', 'success');

        // Reload events after a short delay to show success state
        setTimeout(async () => {
            await loadEvents();
        }, 1500);
    } catch (error) {
        button.disabled = false;
        button.textContent = originalText;
        showToast(error.message, 'error');
    }
}

async function loadEventParticipants(eventId) {
    const container = document.getElementById(`participants-${eventId}`);
    if (!container) return;

    container.innerHTML = '<small>Chargement...</small>';

    try {
        const result = await api.get('/api/events/pending');
        const allPending = result.data || [];
        const eventPending = allPending.filter(p => p.event_id === eventId);

        if (eventPending.length === 0) {
            container.innerHTML = '<small style="color: var(--text-muted);">Aucune demande en attente.</small>';
            return;
        }

        container.innerHTML = eventPending.map(p => `
            <div style="background: rgba(0,0,0,0.2); padding: 0.5rem; margin-bottom: 0.5rem; border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <span style="font-weight: 600; font-size: 0.9rem;">${p.user_name}</span>
                </div>
                <div style="display: flex; gap: 0.2rem;">
                    <button style="background: #10b981; border: none; border-radius: 4px; cursor: pointer; padding: 2px 6px;" onclick="validateParticipation('${p.participant_id}', 'verified')">✔</button>
                    <button style="background: #ef4444; border: none; border-radius: 4px; cursor: pointer; padding: 2px 6px;" onclick="validateParticipation('${p.participant_id}', 'rejected')">✖</button>
                </div>
            </div>
        `).join('');

    } catch (error) {
        container.innerHTML = '<small style="color: red;">Erreur</small>';
    }
}

async function validateParticipation(participantId, status) {
    try {
        await api.post(`/api/events/participants/${participantId}/validate`, { status });
        showToast(status === 'verified' ? 'Validé !' : 'Rejeté', 'success');
        // Refresh the specific list? Hard to access parent ID here easily without DOM trav.
        showToast('Refresh manuel requis pour voir les changements (Demo)', 'info');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function buyProduct(productId) {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || user.role !== 'student') {
        showToast('Erreur: Seuls les étudiants peuvent acheter des crédits.', 'error');
        return;
    }

    let amount = 0;
    let credits = 0;

    switch (productId) {
        case 'pack_10': // Pack Découverte
            amount = 2.00;
            credits = 20;
            break;
        case 'pack_50': // Pack Standard
            amount = 5.00;
            credits = 50;
            break;
        case 'pack_100': // Pack Premium
            amount = 10.00;
            credits = 100;
            break;
        default:
            console.error('Unknown product');
            return;
    }

    try {
        showToast('Redirection vers Stripe...', 'info');
        const res = await api.post('/api/payment/create-checkout-session', {
            amount,
            credits
        });

        if (res.url) {
            window.location.href = res.url;
        } else {
            showToast('Erreur lors de la création de la session Stripe', 'error');
        }
    } catch (error) {
        console.error(error);
        showToast(error.message || "Erreur de paiement", 'error');
    }
}

async function createEvent() {
    // Simplified creation for BDE
    const title = prompt('Titre de l\'événement :');
    if (!title) return;
    const points = prompt('Points :', '50');

    // Need group ID. For demo, fetch groups and pick first.
    try {
        const grpRes = await api.get('/api/groups');
        if (!grpRes.data || grpRes.data.length === 0) {
            alert("Aucun groupe BDE trouvé."); return;
        }
        await api.post('/api/events', {
            groupId: grpRes.data[0].group_id,
            title,
            description: 'Event Mobile',
            eventDate: new Date().toISOString(),
            rewardPoints: parseFloat(points)
        });
        showToast("Event créé", "success");
        await loadEvents();
    } catch (e) { showToast(e.message, 'error'); }
}


// ========================================
>>>>>>> fix-detached-head
// Initialization
// ========================================

async function init() {
    console.log('🚀 Initializing Student Wallet...');

    updateNavAuth();

<<<<<<< HEAD
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            document.body.classList.toggle('light-theme');
        });
=======
    // Make globally available
    window.validateParticipation = validateParticipation;
    window.loadEventParticipants = loadEventParticipants;
    window.openPayModal = openPayModal;
    window.closePayModal = closePayModal;
    window.processPayment = processPayment;
    window.buyProduct = buyProduct;
    window.participateInEvent = participateInEvent;

    const path = window.location.pathname;

    const user = JSON.parse(localStorage.getItem('user'));

    // BDE Admin Layout Override
    if (isAuthenticated() && user && (user.role === 'bde_admin' || user.role === 'admin')) {

        // 2. Override Bottom Nav
        const nav = document.querySelector('.bottom-nav');
        if (nav) {
            nav.innerHTML = `
                <a href="/admin.html" class="nav-item ${path.includes('admin.html') ? 'active' : ''}">
                    <span style="font-size:1.2rem;">📊</span>
                    <span>Dashboard</span>
                </a>
                <a href="/admin-students.html" class="nav-item ${path.includes('admin-students.html') ? 'active' : ''}">
                    <span style="font-size:1.2rem;">👥</span>
                    <span>Étudiants</span>
                </a>
                <a href="/admin-events.html" class="nav-item ${path.includes('admin-events.html') ? 'active' : ''}">
                    <span style="font-size:1.2rem;">📅</span>
                    <span>Events</span>
                </a>
                 <a href="/admin-finances.html" class="nav-item ${path.includes('admin-finances.html') ? 'active' : ''}">
                    <span style="font-size:1.2rem;">💰</span>
                    <span>Finances</span>
                </a>
                <a href="/profile.html" class="nav-item ${path.includes('profile.html') ? 'active' : ''}">
                    <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    <span>Profil</span>
                </a>
            `;
        }
>>>>>>> fix-detached-head
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
