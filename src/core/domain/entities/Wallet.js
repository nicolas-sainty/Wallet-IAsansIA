class Wallet {
    constructor({ wallet_id, user_id, group_id, currency, balance, status, created_at, updated_at }) {
        this.walletId = wallet_id;
        this.userId = user_id;
        this.groupId = group_id;
        this.currency = currency || 'EPIC';
        this.balance = parseFloat(balance) || 0;
        this.status = status || 'active';
        this.createdAt = created_at;
        this.updatedAt = updated_at;
    }

    isActive() {
        return this.status === 'active';
    }

    canDebit(amount) {
        return this.isActive() && this.balance >= amount;
    }

    debit(amount) {
        if (!this.canDebit(amount)) {
            throw new Error('Solde insuffisant ou wallet inactif');
        }
        this.balance -= amount;
    }

    credit(amount) {
        if (!this.isActive()) {
            throw new Error('Impossible de créditer un wallet inactif');
        }
        this.balance += amount;
    }
}

module.exports = Wallet;
