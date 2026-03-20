class Transaction {
    constructor({ 
        transaction_id, 
        initiator_user_id, 
        source_wallet_id, 
        destination_wallet_id, 
        amount, 
        currency, 
        transaction_type, 
        direction, 
        status, 
        description, 
        reason_code,
        created_at, 
        executed_at 
    }) {
        this.transactionId = transaction_id;
        this.initiatorUserId = initiator_user_id;
        this.sourceWalletId = source_wallet_id;
        this.destinationWalletId = destination_wallet_id;
        this.amount = parseFloat(amount);
        this.currency = currency;
        this.transactionType = transaction_type;
        this.direction = direction;
        this.status = status || 'PENDING';
        this.description = description;
        this.reasonCode = reason_code;
        this.createdAt = created_at;
        this.executedAt = executed_at;
    }

    isPending() {
        return this.status === 'PENDING';
    }

    markAsSuccess() {
        this.status = 'SUCCESS';
        this.executedAt = new Date().toISOString();
    }

    markAsFailed(reason) {
        this.status = 'FAILED';
        this.reasonCode = reason;
        this.executedAt = new Date().toISOString();
    }
}

module.exports = Transaction;
