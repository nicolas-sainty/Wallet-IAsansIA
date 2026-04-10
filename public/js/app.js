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

function migrateLocalStorageToSession() {
    // Backward compatibility: move token/user once from localStorage to sessionStorage.
    try {
        const legacyToken = localStorage.getItem('token');
        const legacyUser = localStorage.getItem('user');
        if (legacyToken && !sessionStorage.getItem('token')) {
            sessionStorage.setItem('token', legacyToken);
        }
        if (legacyUser && !sessionStorage.getItem('user')) {
            sessionStorage.setItem('user', legacyUser);
        }
    } catch (e) {
        // ignore
    }
}
migrateLocalStorageToSession();

// ========================================
// API Service
// ========================================

const api = {
    async fetchWithAuth(endpoint, options = {}, { retryOn401 = true } = {}) {
        const getHeaders = () => {
            const headers = { ...(options.headers || {}) };
            const token = sessionStorage.getItem('token');
            if (token) headers['Authorization'] = `Bearer ${token}`;
            return headers;
        };

        let response = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers: getHeaders(),
            cache: options.cache ?? 'no-store',
            credentials: options.credentials ?? 'same-origin',
        });

        if (response.status === 401 && retryOn401) {
            // Refresh access token via HttpOnly cookie.
            const refreshRes = await fetch(`${API_BASE}/api/auth/refresh`, {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
            });

            if (refreshRes.ok) {
                const refreshData = await refreshRes.json();
                if (refreshData?.token) sessionStorage.setItem('token', refreshData.token);
                if (refreshData?.user) sessionStorage.setItem('user', JSON.stringify(refreshData.user));

                response = await fetch(`${API_BASE}${endpoint}`, {
                    ...options,
                    headers: getHeaders(),
                    cache: options.cache ?? 'no-store',
                    credentials: options.credentials ?? 'same-origin',
                });
            }
        }

        if (!response.ok) {
            const error = await response.json().catch(() => null);
            throw new Error(error?.error || error?.message || response.statusText);
        }

        return await response.json();
    },

    async get(endpoint) {
        return this.fetchWithAuth(endpoint, { method: 'GET' });
    },

    async post(endpoint, data) {
        return this.fetchWithAuth(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
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
    if (!id) return '';
    if (id.length <= 14) return id; // Don't truncate if short
    return `${id.substring(0, 8)}...${id.substring(id.length - 6)}`;
}

function checkAuth() {
    const token = sessionStorage.getItem('token');
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
        const user = JSON.parse(sessionStorage.getItem('user'));
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
                activityList.innerHTML = `
                    <div style="text-align:center; padding:1.5rem 0;">
                        <i data-lucide="receipt" style="width:36px;height:36px;margin:0 auto 0.75rem;display:block;opacity:0.2;"></i>
                        <p style="color:var(--text-muted); font-size:0.9rem;">Aucune transaction</p>
                    </div>`;
                if (typeof lucide !== 'undefined') lucide.createIcons();
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
        const user = JSON.parse(sessionStorage.getItem('user'));
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
                <div class="glass-card" style="padding: 1rem; margin-bottom: 0.5rem; background: rgba(245, 158, 11, 0.06); border: 1px solid rgba(245, 158, 11, 0.2);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
                        <strong style="color:var(--color-orange);">Demande de Paiement</strong>
                        <span style="background:var(--color-orange); color:black; padding:2px 8px; border-radius:10px; font-weight:bold;">${r.amount} Pts</span>
                    </div>
                    <p style="margin:0 0 1rem 0; font-size:0.9rem;">${r.description || 'Paiement requis'}</p>
                    <div style="display:flex; gap:0.5rem;">
                        <button class="btn btn-primary btn-sm btn-respond-request" style="flex:1;" data-id="${r.request_id}" data-action="PAY">Payer</button>
                        <button class="btn btn-ghost btn-sm btn-respond-request" style="flex:1;" data-id="${r.request_id}" data-action="REJECT">Rejeter</button>
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
    const user = JSON.parse(sessionStorage.getItem('user'));

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
            <div class="glass-card" style="padding: 2.5rem 1.5rem; text-align: center; grid-column: 1 / -1;">
                <i data-lucide="calendar-off" style="width:48px;height:48px;margin:0 auto 1rem;display:block;opacity:0.25;"></i>
                <p style="color: var(--text-secondary); font-weight:500;">Aucun événement à venir</p>
                <p style="color: var(--text-muted); font-size:0.85rem; margin-top:0.25rem;">Les prochains events apparaîtront ici</p>
            </div>
        `;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }

    // Check user role
    const user = JSON.parse(sessionStorage.getItem('user'));
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
                        <button class="btn btn-primary w-full btn-participate" 
                                data-event-id="${event.event_id}">
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
                            actionEl.innerHTML = `<span class="badge badge-warning w-full py-3">En attente de validation</span>`;
                        } else if (regStatus === 'verified') {
                            actionEl.innerHTML = `<span class="badge badge-success w-full py-3">Présence validée</span>`;
                        } else if (regStatus === 'rejected') {
                            actionEl.innerHTML = `<span class="badge badge-error w-full py-3">Refusé</span>`;
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
        <div class="event-tile">
            <i data-lucide="calendar" class="bg-icon"></i>
            <div class="event-banner">
                <i data-lucide="calendar" style="width:36px;height:36px;opacity:0.6;"></i>
            </div>
            <div class="event-body">
                <div class="event-date">${formatDate(event.event_date)}${statusBadge}</div>
                <h3 class="event-title">${event.title}</h3>
                <p class="event-desc">${event.description || 'Pas de description'}</p>
                <div class="event-foot">
                    <span class="badge-reward">+${event.reward_points} pts</span>
                    <div style="flex: 1;">${actionArea}</div>
                </div>
                ${participantsSection}
            </div>
        </div>
    `}).join('');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// Helper function to check user's registration status for an event
async function checkUserRegistrationStatus(eventId) {
    const user = JSON.parse(sessionStorage.getItem('user'));
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
    const user = JSON.parse(sessionStorage.getItem('user'));
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
        actionContainer.innerHTML = `<span class="badge badge-success w-full py-3">Présence validée</span>`;
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
                    <button class="btn btn-success btn-xs btn-validate" data-id="${p.participant_id}" data-status="verified"><i data-lucide="check" class="w-3 h-3"></i></button>
                    <button class="btn btn-error btn-xs btn-validate" data-id="${p.participant_id}" data-status="rejected"><i data-lucide="x" class="w-3 h-3"></i></button>
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
    const user = JSON.parse(sessionStorage.getItem('user'));
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
// Initialization
// ========================================

async function init() {
    console.log('Initializing Student Wallet (Mobile)...');

    updateNavAuth();

    // Make globally available
    window.validateParticipation = validateParticipation;
    window.loadEventParticipants = loadEventParticipants;
    window.openPayModal = openPayModal;
    window.closePayModal = closePayModal;
    window.processPayment = processPayment;
    window.buyProduct = buyProduct;
    window.participateInEvent = participateInEvent;
    
    // Event Delegation for CSP compliance
    const eventsGrid = document.getElementById('eventsGrid');
    if (eventsGrid) {
        eventsGrid.addEventListener('click', async (e) => {
            // Participation
            const partBtn = e.target.closest('.btn-participate');
            if (partBtn) {
                const eventId = partBtn.getAttribute('data-event-id');
                if (eventId) participateInEvent(eventId);
                return;
            }

            // Validation
            const valBtn = e.target.closest('.btn-validate');
            if (valBtn) {
                const id = valBtn.getAttribute('data-id');
                const status = valBtn.getAttribute('data-status');
                if (id && status) validateParticipation(id, status);
                return;
            }
        });
    }

    const requestsContainer = document.getElementById('homePendingRequests');
    if (requestsContainer) {
        requestsContainer.addEventListener('click', async (e) => {
            const btn = e.target.closest('.btn-respond-request');
            if (btn) {
                const id = btn.getAttribute('data-id');
                const action = btn.getAttribute('data-action');
                if (id && action && window.respondRequestHome) {
                    window.respondRequestHome(id, action);
                }
            }
        });
    }

    const path = window.location.pathname;

    const user = JSON.parse(sessionStorage.getItem('user'));

    // BDE Admin Layout Override
    if (isAuthenticated() && user && (user.role === 'bde_admin' || user.role === 'admin')) {

        // 2. Override Bottom Nav
        const nav = document.querySelector('.bottom-bar');
        if (nav) {
            nav.innerHTML = `
                <a href="/admin.html" class="${path.includes('admin.html') && !path.includes('admin-') ? 'active' : ''}">
                    <i data-lucide="layout-dashboard"></i>
                    <span>Dashboard</span>
                </a>
                <a href="/admin-students.html" class="${path.includes('admin-students.html') ? 'active' : ''}">
                    <i data-lucide="users"></i>
                    <span>Étudiants</span>
                </a>
                <a href="/admin-events.html" class="${path.includes('admin-events.html') ? 'active' : ''}">
                    <i data-lucide="calendar"></i>
                    <span>Events</span>
                </a>
                <a href="/admin-finances.html" class="${path.includes('admin-finances.html') ? 'active' : ''}">
                    <i data-lucide="wallet"></i>
                    <span>Finances</span>
                </a>
                <a href="/profile.html" class="${path.includes('profile.html') ? 'active' : ''}">
                    <i data-lucide="user"></i>
                    <span>Profil</span>
                </a>
            `;
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }

        // 3. Override Top Nav links for admin (desktop)
        const topNavLinks = document.querySelector('.top-nav .nav-links');
        if (topNavLinks) {
            topNavLinks.innerHTML = `
                <a href="/admin.html" class="${path.includes('admin.html') && !path.includes('admin-') ? 'active' : ''}">Dashboard</a>
                <a href="/admin-students.html" class="${path.includes('admin-students.html') ? 'active' : ''}">Étudiants</a>
                <a href="/admin-events.html" class="${path.includes('admin-events.html') ? 'active' : ''}">Events</a>
                <a href="/admin-finances.html" class="${path.includes('admin-finances.html') ? 'active' : ''}">Finances</a>
                <a href="/profile.html" class="${path.includes('profile.html') ? 'active' : ''}">Profil</a>
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
