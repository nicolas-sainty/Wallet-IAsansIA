const Transaction = require('../../../../core/domain/entities/Transaction');

/**
 * Implémentation Supabase du repository des transactions
 */
class SupabaseTransactionRepository {
    constructor(supabaseClient) {
        this.supabase = supabaseClient;
    }

    async findById(transactionId) {
        const { data, error } = await this.supabase
            .from('transactions')
            .select('*')
            .eq('transaction_id', transactionId)
            .single();

        if (error || !data) return null;
        return new Transaction(data);
    }

    async findByWalletId(walletId, options = {}) {
        const { limit = 50, offset = 0 } = options;
        const { data, error } = await this.supabase
            .from('transactions')
            .select('*')
            .or(`source_wallet_id.eq.${walletId},destination_wallet_id.eq.${walletId}`)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) throw error;
        return data.map(tx => new Transaction(tx));
    }

    async save(transaction) {
        const { data, error } = await this.supabase
            .from('transactions')
            .update({
                status: transaction.status,
                executed_at: transaction.executedAt,
                reason_code: transaction.reasonCode
            })
            .eq('transaction_id', transaction.transactionId)
            .select()
            .single();

        if (error) throw error;
        return new Transaction(data);
    }

    async create(txData) {
        const { data, error } = await this.supabase
            .from('transactions')
            .insert({
                transaction_id: txData.transactionId,
                initiator_user_id: txData.initiatorUserId,
                source_wallet_id: txData.sourceWalletId,
                destination_wallet_id: txData.destinationWalletId,
                amount: txData.amount,
                currency: txData.currency,
                transaction_type: txData.transactionType,
                direction: txData.direction,
                status: txData.status,
                description: txData.description
            })
            .select()
            .single();

        if (error) throw error;
        return new Transaction(data);
    }

    // Payment Requests
    async findRequestsByStudentId(studentId) {
        const { data, error } = await this.supabase
            .from('payment_requests')
            .select('*')
            .eq('student_user_id', studentId)
            .eq('status', 'PENDING');
        if (error) throw error;
        return data;
    }

    async findRequestsByBDEId(bdeId) {
        const { data, error } = await this.supabase
            .from('payment_requests')
            .select('*')
            .eq('bde_group_id', bdeId);
        if (error) throw error;
        return data;
    }

    async findRequestById(requestId) {
        const { data, error } = await this.supabase
            .from('payment_requests')
            .select('*')
            .eq('request_id', requestId)
            .maybeSingle();
        if (error) throw error;
        return data;
    }

    async updateRequestStatus(requestId, status) {
        const { error } = await this.supabase
            .from('payment_requests')
            .update({ status, updated_at: new Date().toISOString() })
            .eq('request_id', requestId);
        if (error) throw error;
        return true;
    }
}

module.exports = SupabaseTransactionRepository;
