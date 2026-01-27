// ========================================
// Admin Dashboard Logic
// ========================================

// Reuse API_BASE from app.js if available, otherwise define context-aware base
const ADMIN_API_BASE = window.location.origin;
let currentBdeId = null;

// ========================================
// Initialization
// ========================================

document.addEventListener("DOMContentLoaded", async () => {
    // Check Auth
    // Check Auth
    const userStored = JSON.parse(localStorage.getItem('user'));
    if (!userStored || userStored.role !== 'bde_admin') {
        alert("Accès refusé. Réservé aux administrateurs BDE.");
        window.location.href = '/';
        return;
    }

    // Refresh User Data to ensure bde_id is present
    let finalBdeId = userStored.bde_id;
    if (!finalBdeId) {
        try {
            const meRes = await fetch(`${ADMIN_API_BASE}/api/auth/me`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (meRes.ok) {
                const meData = await meRes.json();
                // /api/auth/me returns user object directly
                if (meData && meData.bde_id) {
                    finalBdeId = meData.bde_id;
                    // Update local storage
                    userStored.bde_id = finalBdeId;
                    localStorage.setItem('user', JSON.stringify(userStored));
                }
            }
        } catch (e) { console.error("Failed to refresh user data", e); }
    }

    currentBdeId = finalBdeId;
    if (!currentBdeId) {
        // Fallback: fetch group where user is admin
        try {
            const res = await fetch(`${ADMIN_API_BASE}/api/groups`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const groups = (await res.json()).data;
            const myGroup = groups.find(g => g.admin_user_id === userStored.user_id);
            if (myGroup) {
                currentBdeId = myGroup.group_id;
                // Save it for next time
                userStored.bde_id = currentBdeId;
                localStorage.setItem('user', JSON.stringify(userStored));
            }
        } catch (e) { console.error(e); }
    }

    if (!currentBdeId) {
        console.warn("No BDE assigned found for admin.");
        // We do NOT return/block here immediately if we can avoid it, 
        // to allow viewing parts of UI that might not need it? 
        // No, most admin functions need it. But let's show a better UI message instead of alert if possible, 
        // or just alert once.
        if (!document.getElementById('profileBdeName')) { // Don't alert if we are just on profile (if logic shared)
            alert("Attention: Aucun BDE associé détecté. Certaines fonctions seront indisponibles.");
        }
    }

    // Init Logic - Conditional based on page
    if (document.getElementById('statMembers')) loadDashboardStats();
    if (document.getElementById('studentsList')) {
        loadStudents();
        const addBtn = document.getElementById('addStudentBtn');
        if (addBtn) addBtn.addEventListener('click', addStudent);
    }
    if (document.getElementById('adminEventsList')) {
        loadAdminEvents();

        // Create Event
        const createBtn = document.getElementById('createEventBtn');
        if (createBtn) createBtn.addEventListener('click', createAdminEvent);

        // Delegation for Participants Buttons
        document.getElementById('adminEventsList').addEventListener('click', (e) => {
            const btn = e.target.closest('.btn-participants');
            if (btn) {
                openParticipantsModal(btn.dataset.eventId);
            }
        });

        // Modal Close
        const closeBtn = document.getElementById('closeParticipantsModalBtn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                document.getElementById('participantsModal').style.display = 'none';
            });
        }

        // Delegation for Validate/Reject Participants
        const partList = document.getElementById('participantsListCtx');
        if (partList) {
            partList.addEventListener('click', (e) => {
                const btn = e.target.closest('.btn-validate-part');
                if (btn) {
                    validatePart(btn.dataset.partId, btn.dataset.status);
                }
            });
        }
    }
    if (document.getElementById('paymentRequestsList')) loadFinances();

    // Remove old Tab Switching Logic (Tabs handled by separate pages now)

    // Modal Listeners
    window.onclick = function (event) {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = "none";
        }
    }
});

// Modal Listeners
window.onclick = function (event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = "none";
    }
}

// ========================================
// 1. Dashboard & Stats
// ========================================

async function loadDashboardStats() {
    try {
        const res = await fetch(`${ADMIN_API_BASE}/api/groups/${currentBdeId}/stats`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const stats = (await res.json()).data;

        document.getElementById('statMembers').textContent = stats.total_members || stats.totalWallets || 0;
        document.getElementById('statVolume').textContent = parseFloat(stats.totalVolume || 0).toFixed(2);

        // Fetch BDE Wallet (EUR)
        const wRes = await fetch(`${ADMIN_API_BASE}/api/wallets?groupId=${currentBdeId}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const wallets = (await wRes.json()).data;
        const eurWallet = wallets.find(w => w.currency === 'EUR');
        if (eurWallet) {
            document.getElementById('statBalance').textContent = parseFloat(eurWallet.balance).toFixed(2) + ' €';
        }
    } catch (e) { console.error(e); }
}


// ========================================
// 2. Students Management
// ========================================

async function loadStudents() {
    console.log("Loading students for BDE:", currentBdeId);
    if (!currentBdeId) {
        document.getElementById('studentsList').innerHTML = '<p class="error">Erreur: BDE ID non trouvé (null).</p>';
        return;
    }

    try {
        const res = await fetch(`${ADMIN_API_BASE}/api/groups/${currentBdeId}/members`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (!res.ok) {
            const errCtx = await res.json();
            throw new Error(`API Error ${res.status}: ${JSON.stringify(errCtx)}`);
        }
        const members = (await res.json()).data;

        if (!members || members.length === 0) {
            document.getElementById('studentsList').innerHTML = '<p class="text-muted">Aucun étudiant membre pour le moment.</p>';
            return;
        }

        const list = document.getElementById('studentsList');
        list.innerHTML = members.map(m => `
            <div class="list-item">
                <div class="item-info">
                   <strong>${m.full_name || m.email}</strong> <small class="text-muted">(${truncateId(m.user_id)})</small>
                   <span class="sub-text">Balance: ${parseFloat(m.balance).toFixed(2)} ${m.currency}</span>
                </div>
            </div>
        `).join('');

        // Populate Select for Payments
        const select = document.getElementById('paymentTargetStudent');
        if (select) {
            select.innerHTML = members.map(m => `<option value="${m.user_id}">${m.full_name || m.email}</option>`).join('');
        }

    } catch (e) {
        console.error("Load Students Failed:", e);
        document.getElementById('studentsList').innerHTML = `<p class="error">Erreur: ${e.message}</p>`;
    }
}

async function addStudent() {
    const emailEl = document.getElementById('newStudentEmail');
    const email = emailEl.value;

    console.log(`Add Student clicked. Email: ${email}, BDE: ${currentBdeId}`);

    if (!currentBdeId) {
        alert("Erreur critique: ID du BDE non chargé. Rechargez la page.");
        return;
    }
    if (!email) {
        alert("Veuillez entrer un email.");
        return;
    }

    try {
        const res = await fetch(`${ADMIN_API_BASE}/api/groups/${currentBdeId}/students`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            body: JSON.stringify({ email })
        });

        const data = await res.json();

        if (res.ok) {
            alert(`Étudiant ajouté avec succès !\nConnecté à : ${data.userId || 'User'}`);
            emailEl.value = '';
            loadStudents();
        } else {
            console.error("Add Student API Error:", data);
            alert("Erreur: " + (data.error || data.message || "Impossible d'ajouter l'étudiant."));
        }
    } catch (e) {
        console.error("Add Student Network Error:", e);
        alert("Erreur réseau: " + e.message);
    }
}

// ========================================
// 3. Events Management
// ========================================

async function loadAdminEvents() {
    // Re-use existing GET /api/events logic but filtered? 
    // Currently fetches all OPEN. We might need filtered list for admin to see DRAFT/CLOSED too.
    const res = await fetch(`${ADMIN_API_BASE}/api/events`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    const events = (await res.json()).data;
    const myEvents = events.filter(e => e.group_id === currentBdeId);

    const list = document.getElementById('adminEventsList');
    list.innerHTML = myEvents.map(e => `
        <div class="list-item">
            <div class="item-info">
                <strong>${e.title}</strong>
                <span class="sub-text">${e.status} | ${new Date(e.event_date).toLocaleDateString()}</span>
            </div>
            <div class="item-actions">
                <button class="btn-sm btn-participants" data-event-id="${e.event_id}">Participants</button>
            </div>
        </div>
    `).join('');
}

async function createAdminEvent() {
    const title = document.getElementById('evtTitle').value;
    const date = document.getElementById('evtDate').value;
    const points = document.getElementById('evtPoints').value;

    if (!title || !date || !points) return;

    try {
        const res = await fetch(`${ADMIN_API_BASE}/api/events`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            body: JSON.stringify({
                groupId: currentBdeId,
                title,
                description: "Event via Admin",
                eventDate: date,
                rewardPoints: parseFloat(points),
                status: 'OPEN'
            })
        });
        if (res.ok) {
            alert("Événement créé");
            loadAdminEvents();
            // Clear form
        }
    } catch (e) { console.error(e); }
}

async function openParticipantsModal(eventId) {
    window.currentEventId = eventId;
    document.getElementById('participantsModal').style.display = 'block';
    const container = document.getElementById('participantsListCtx');
    container.innerHTML = "Chargement...";

    try {
        const res = await fetch(`${ADMIN_API_BASE}/api/events/pending`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const all = (await res.json()).data;
        const pending = all.filter(p => p.event_id === eventId);

        if (pending.length === 0) {
            container.innerHTML = "Aucune participation en attente.";
            return;
        }

        container.innerHTML = pending.map(p => `
            <div class="participant-row">
                <span>${p.user_name || 'User'} (${p.user_email})</span>
                <div>
                     <button class="btn-icon check btn-validate-part" data-part-id="${p.participant_id}" data-status="verified">✔</button>
                     <button class="btn-icon cross btn-validate-part" data-part-id="${p.participant_id}" data-status="rejected">✘</button>
                </div>
            </div>
        `).join('');

    } catch (e) { container.innerHTML = "Erreur."; }
}

async function validatePart(pId, status) {
    // Call API
    try {
        await fetch(`${ADMIN_API_BASE}/api/events/participants/${pId}/validate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            body: JSON.stringify({ status })
        });

        // Refresh the list instead of closing
        document.getElementById('participantsListCtx').innerHTML = 'Mise à jour...';

        // We need the event ID to refresh. 
        // Best way is to find it from the current modal context or DOM
        // Since we don't store it globally, let's close for now but show success clearly, 
        // OR better: store currentEventId when opening modal
        alert("Traité !");

        if (window.currentEventId) {
            openParticipantsModal(window.currentEventId);
        } else {
            document.getElementById('participantsModal').style.display = 'none';
        }
    } catch (e) { alert("Erreur"); }
}


// ========================================
// 4. Finances & Payments
// ========================================

async function loadFinances() {
    loadPaymentRequests();
    loadTransactions();
}

async function loadPaymentRequests() {
    try {
        const res = await fetch(`${ADMIN_API_BASE}/api/payment/requests`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const requests = (await res.json()).data;

        const list = document.getElementById('paymentRequestsList');
        list.innerHTML = requests.map(r => `
            <div class="list-item">
                <div class="item-info">
                    <strong>${r.amount} pts</strong> vers ${r.full_name || r.email || r.student_user_id}
                    <span class="sub-text">${r.description} | ${r.status}</span>
                </div>
            </div>
        `).join('');
    } catch (e) { console.error(e); }
}

async function sendPaymentRequest() {
    const studentId = document.getElementById('paymentTargetStudent').value;
    const amount = document.getElementById('paymentAmount').value;
    const desc = document.getElementById('paymentDesc').value;

    if (!studentId || !amount) return;

    try {
        const res = await fetch(`${ADMIN_API_BASE}/api/payment/requests`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            body: JSON.stringify({
                studentUserId: studentId,
                amount: amount,
                description: desc
            })
        });

        if (res.ok) {
            alert("Demande envoyée !");
            loadPaymentRequests();
            document.getElementById('paymentAmount').value = '';
        } else {
            alert("Erreur lors de l'envoi");
        }
    } catch (e) { alert("Erreur"); }
}

async function loadTransactions() {
    // History of BDE wallet transactions (Polar.sh sales etc)
    // First get wallet ID
    try {
        const wRes = await fetch(`${ADMIN_API_BASE}/api/wallets?groupId=${currentBdeId}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const wallets = (await wRes.json()).data; // Array of wallets

        let allTxs = [];
        for (let w of wallets) {
            const tRes = await fetch(`${ADMIN_API_BASE}/api/wallets/${w.wallet_id}/transactions`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const txs = (await tRes.json()).data;
            allTxs = [...allTxs, ...txs];
        }

        // Sort by date
        allTxs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        const list = document.getElementById('transactionsList');
        list.innerHTML = allTxs.slice(0, 10).map(tx => `
            <div class="list-item">
                <div class="item-info">
                    <strong>${tx.description || tx.transaction_type}</strong>
                    <span class="sub-text">${new Date(tx.created_at).toLocaleDateString()}</span>
                </div>
                <div class="item-amount ${tx.amount > 0 ? 'pos' : 'neg'}">
                    ${tx.amount > 0 ? '+' : ''}${parseFloat(tx.amount).toFixed(2)} ${tx.currency}
                </div>
            </div>
        `).join('');

    } catch (e) { console.error(e); }
}

function truncateId(id) {
    return id.substring(0, 8) + '...';
}
