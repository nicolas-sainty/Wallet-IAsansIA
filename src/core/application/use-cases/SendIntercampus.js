'use strict';

const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

/**
 * Use Case : Envoyer un transfert inter-campus
 * =============================================
 * Flux :
 *  1. Vérifie que le wallet source est actif et a assez de fonds
 *  2. Lance l'analyse anti-fraude
 *  3. Débite le wallet source (transaction locale PENDING → SUCCESS)
 *  4. Appelle le campus distant via le client HTTP injecté
 *  5. Si l'appel distant échoue → rollback automatique (transaction REFUND)
 *  6. Logue le transfert dans intercampus_transfers
 *
 * Compatible avec le standard EpiPay (swagger v1.0.0).
 */
class SendIntercampus {
    /**
     * @param {object} walletRepository
     * @param {object} transactionRepository
     * @param {object} intercampusHttpClient   - IIntercampusHttpClient
     * @param {object} intercampusRepository   - Pour persister dans intercampus_transfers
     * @param {object} [fraudAnalysisUseCase]  - AnalyzeTransactionForFraud (optionnel)
     * @param {object} logger
     * @param {string} localCampusId           - Notre identifiant (ex: "groupe_2_BDX")
     */
    constructor(
        walletRepository,
        transactionRepository,
        intercampusHttpClient,
        intercampusRepository,
        fraudAnalysisUseCase,
        logger,
        localCampusId
    ) {
        this.walletRepository       = walletRepository;
        this.transactionRepository  = transactionRepository;
        this.intercampusHttpClient  = intercampusHttpClient;
        this.intercampusRepository  = intercampusRepository;
        this.fraudAnalysisUseCase   = fraudAnalysisUseCase;
        this.logger                 = logger;
        this.localCampusId          = localCampusId || process.env.CAMPUS_ID || 'groupe_2_BDX';
    }

    /**
     * @param {object} params
     * @param {string}  params.initiatorUserId
     * @param {string}  params.sourceWalletId
     * @param {string}  params.destinationWalletId        - UUID du wallet sur le campus distant
     * @param {string}  params.destinationCampusApiUrl    - URL de base de leur API
     * @param {number}  params.amount
     * @param {string}  [params.currency]                 - Défaut: "EPC"
     * @param {string}  [params.description]
     * @param {object}  [params.enrichedData]             - Géoloc, device info…
     * @param {string}  params.apiKey                     - Notre API key (sera hashée et envoyée)
     */
    async execute(params) {
        const {
            initiatorUserId,
            sourceWalletId,
            destinationWalletId,
            destinationCampusApiUrl,
            amount,
            currency        = 'EPC',
            description     = 'Transfert inter-campus',
            enrichedData    = {},
            apiKey,
        } = params;

        // ── 1. Vérification du wallet source ──────────────────────────────
        const sourceWallet = await this.walletRepository.findById(sourceWalletId);
        if (!sourceWallet) throw new Error('Wallet source introuvable');
        if (!sourceWallet.isActive()) throw new Error('Wallet source inactif');

        const balanceInfo = await this.walletRepository.getBalanceWithPending(sourceWalletId);
        if (balanceInfo.availableBalance < amount) {
            throw new Error(`Fonds insuffisants (disponible: ${balanceInfo.availableBalance} EPC, requis: ${amount} EPC)`);
        }

        // ── 2. Analyse anti-fraude ─────────────────────────────────────────
        let fraudScore = 0;
        if (this.fraudAnalysisUseCase) {
            const fraudResult = await this.fraudAnalysisUseCase.execute({
                initiatorUserId,
                sourceWalletId,
                destinationWalletId,
                amount,
                currency,
                transactionType: 'INTERCAMPUS',
            });
            fraudScore = fraudResult.alerts.length > 0
                ? Math.min(100, fraudResult.alerts.length * 25)
                : 0;

            if (fraudResult.blocked) {
                const rules = fraudResult.alerts.filter(a => a.isBlocking()).map(a => a.rule).join(', ');
                const err = new Error(`Transfert inter-campus bloqué : ${rules}`);
                err.code = fraudResult.amlFlag ? 'FRAUD_AML_FLAGGED' : 'FRAUD_TRANSACTION_BLOCKED';
                err.fraudAlerts = fraudResult.alerts.map(a => a.toJSON());
                throw err;
            }
        }

        // ── 3. Créer et enregistrer la transaction locale (PENDING) ───────
        const localTransactionId = uuidv4();
        await this.transactionRepository.create({
            transactionId:        localTransactionId,
            initiatorUserId,
            sourceWalletId,
            destinationWalletId,
            amount,
            currency:             this._normalizeCurrency(currency),
            transactionType:      'INTERCAMPUS',
            direction:            'outgoing',
            status:               'PENDING',
            description,
        });

        // Débit du wallet source
        sourceWallet.debit(amount);
        await this.walletRepository.save(sourceWallet);

        // Marquer la transaction comme SUCCESS côté local
        const localTx = await this.transactionRepository.findById(localTransactionId);
        localTx.markAsSuccess();
        await this.transactionRepository.save(localTx);

        // ── 4. Appel au campus distant ────────────────────────────────────
        const remotePayload = {
            transaction_id:       localTransactionId,
            source_wallet_id:     sourceWalletId,
            destination_wallet_id: destinationWalletId,
            amount,
            currency:             'EPC',
            initiator_user_id:    initiatorUserId,
            api_key:              this._hashApiKey(apiKey),
            source_campus_id:     this.localCampusId,
            enriched_data:        enrichedData,
        };

        let remoteResult;
        try {
            remoteResult = await this.intercampusHttpClient.sendToRemoteCampus(
                destinationCampusApiUrl,
                remotePayload
            );
        } catch (remoteError) {
            // ── 5. Rollback : remboursement automatique ────────────────────
            this.logger.error('Appel inter-campus échoué — rollback en cours', {
                localTransactionId,
                error: remoteError.message,
            });

            await this._createRefundTransaction(sourceWallet, sourceWalletId, amount, currency, initiatorUserId, localTransactionId, remoteError.message);

            await this.intercampusRepository.save({
                localTransactionId,
                direction:              'outgoing',
                sourceCampusId:         this.localCampusId,
                destinationCampusId:    null,
                destinationApiUrl:      destinationCampusApiUrl,
                amount,
                currency:               'EPC',
                status:                 'failed',
                fraudScore,
                enrichedData,
                errorMessage:           remoteError.message,
            });

            throw new Error(`Transfert inter-campus échoué (rollback effectué) : ${remoteError.message}`);
        }

        // ── 6. Log du transfert réussi ────────────────────────────────────
        await this.intercampusRepository.save({
            localTransactionId,
            remoteTransactionId:    remoteResult.transaction_id,
            direction:              'outgoing',
            sourceCampusId:         this.localCampusId,
            destinationCampusId:    null,
            destinationApiUrl:      destinationCampusApiUrl,
            amount,
            currency:               'EPC',
            status:                 remoteResult.status || 'completed',
            fraudScore,
            enrichedData,
        });

        this.logger.info('Transfert inter-campus réussi', {
            localTransactionId,
            remoteTransactionId: remoteResult.transaction_id,
            amount,
            destinationCampusApiUrl,
        });

        return {
            success:            true,
            status:             'completed',
            message:            'Transfert intercampus réussi',
            transaction_id:     localTransactionId,
            destination_tx_id:  remoteResult.transaction_id || null,
            new_balance:        sourceWallet.balance,
            fraud_score:        fraudScore,
        };
    }

    // ─── Helpers privés ────────────────────────────────────────────────────

    _normalizeCurrency(currency) {
        const map = { EPC: 'EPIC', EPIC: 'EPIC', CREDITS: 'CREDITS' };
        return map[currency?.toUpperCase()] || 'EPIC';
    }

    _hashApiKey(apiKey) {
        if (!apiKey) return '';
        return crypto.createHash('sha256').update(apiKey).digest('hex');
    }

    async _createRefundTransaction(sourceWallet, sourceWalletId, amount, currency, initiatorUserId, originalTxId, reason) {
        try {
            sourceWallet.credit(amount);
            await this.walletRepository.save(sourceWallet);

            const refundTxId = uuidv4();
            await this.transactionRepository.create({
                transactionId:        refundTxId,
                initiatorUserId,
                sourceWalletId:       sourceWalletId,
                destinationWalletId:  sourceWalletId, // remboursement sur le même wallet
                amount,
                currency:             this._normalizeCurrency(currency),
                transactionType:      'REFUND',
                direction:            'incoming',
                status:               'SUCCESS',
                description:          `Remboursement auto — échec intercampus tx:${originalTxId} : ${reason}`,
            });
        } catch (err) {
            this.logger.error('Échec critique : rollback intercampus impossible !', { error: err.message, originalTxId });
        }
    }
}

module.exports = SendIntercampus;
