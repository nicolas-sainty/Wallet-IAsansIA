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

        const response = await fetch(`${API_BASE}${endpoint}`, { headers });
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
    if (!container) return; // Guard clause
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

function checkAuth() {
    const token = localStorage.getItem('token');
    return !!token;
}

function isAuthenticated() { return checkAuth(); }

function updateNavAuth() {
    const navActions = document.querySelector('.nav-actions');
    if (!navActions) return; // May not exist in mobile layout

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
// Card Page Logic (Mobile Home)
// ========================================

async function loadCardData() {
    try {
        const user = JSON.parse(localStorage.getItem('user'));
        const nameEl = document.getElementById('userName');
        const roleEl = document.getElementById('userRoleBadge');
        if (nameEl) nameEl.textContent = user.email;
        if (roleEl) roleEl.textContent = user.role === 'student' ? 'ETUDIANT' : 'BDE / ADMIN';

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
        const result = await api.get('/api/groups');
        const groups = result.data || [];
        const select = document.getElementById('payRecipientGroup');
        if (!select) return;

        select.innerHTML = '<option value="" disabled selected>Choisir un BDE...</option>' +
            groups.map(g => `<option value="${g.group_id}">${g.group_name}</option>`).join('');
    } catch (e) {
        console.error("Error loading groups", e);
    }
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
    if (!user || !user.email) {
        showToast('Erreur utilisateur. Reconnectez-vous.', 'error');
        return;
    }

    if (!confirm("Simuler l'achat (Mode Démo) ?")) return;

    try {
        await api.post('/api/payment/simulate', {
            productId,
            email: user.email
        });
        showToast('Achat simule avec succès ! +Credits', 'success');

        // If we are on the dashboard/card view (which splits shop/home in single page app sometimes)
        // But here shop is separate HTML. 
        // We can just log. Next load of card will fetch fresh data.
        console.log("Purchase simulated. Balance should update on next fetch.");
    } catch (error) {
        showToast(error.message, 'error');
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
// Initialization
// ========================================

async function init() {
    console.log('🚀 Initializing Student Wallet (Mobile)...');

    updateNavAuth();

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
    }

    if (path === '/' || path === '/index.html') {
        if (isAuthenticated()) {
            await loadCardData();
            await loadGroupsForPay();
        } else {
            // Redirect to Login if not auth
            window.location.href = '/login.html';
        }
    } else if (path.includes('events.html')) {
        await loadEvents();
        // Load event listeners for create modal if exists
        const createEventBtn = document.getElementById('createEventBtn');
        if (createEventBtn) createEventBtn.addEventListener('click', createEvent);
    } else if (path.includes('shop.html')) {
        // Shop logic - Attach event listeners to buttons
        document.querySelectorAll('.btn-buy-product').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const productId = e.target.getAttribute('data-product-id');
                // Or e.currentTarget if the click might be on a child
                if (productId) {
                    buyProduct(productId);
                }
            });
        });
    } else if (path.includes('profile.html')) {
        // Load profile data if needed
    }
}

// Start
document.addEventListener('DOMContentLoaded', init);
