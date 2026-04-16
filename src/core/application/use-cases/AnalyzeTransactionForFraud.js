/**
 * Use Case : Analyser une transaction pour détecter la fraude
 * ============================================================
 * Ce use case orchestre la récupération des données contextuelles
 * (historique, solde) et délègue l'analyse au FraudDetectionService (domaine).
 *
 * Il est appelé par InitiateTransaction AVANT la création de la transaction.
 *
 * @returns {{ alerts, blocked, amlFlag }} — Résultat de l'analyse
 */

'use strict';

const { FraudDetectionService } = require('../../domain/services/FraudDetectionService');

class AnalyzeTransactionForFraud {
    /**
     * @param {object} walletRepository       - Port: accès aux wallets
     * @param {object} transactionRepository  - Port: accès à l'historique transactions
     * @param {object} fraudAlertRepository   - Port: persistance des alertes fraude
     * @param {object} logger
     * @param {object} [thresholds]           - Seuils optionnels (surcharge des défauts)
     */
    constructor(walletRepository, transactionRepository, fraudAlertRepository, logger, thresholds = {}) {
        this.walletRepository = walletRepository;
        this.transactionRepository = transactionRepository;
        this.fraudAlertRepository = fraudAlertRepository;
        this.logger = logger;
        this.fraudService = new FraudDetectionService(thresholds);
    }

    /**
     * @param {object} params
     * @param {string}  params.initiatorUserId
     * @param {string}  params.sourceWalletId
     * @param {string}  params.destinationWalletId
     * @param {number}  params.amount
     * @param {string}  params.currency
     * @param {string}  params.transactionType
     * @param {string}  [params.description]
     *
     * @returns {Promise<{ alerts: import('../../domain/entities/FraudAlert').FraudAlert[], blocked: boolean, amlFlag: boolean }>}
     */
    async execute(params) {
        const {
            initiatorUserId,
            sourceWalletId,
            destinationWalletId,
            amount,
            currency,
            transactionType,
        } = params;

        try {
            // ── 1. Récupérer le solde actuel du wallet source ──────────────────
            const balanceInfo = await this.walletRepository.getBalanceWithPending(sourceWalletId);
            const sourceBalance = balanceInfo.availableBalance;

            // ── 2. Récupérer l'historique des transactions (30 derniers jours) ─
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
            const recentTxHistory = await this.transactionRepository.findBySourceWalletIdSince(
                sourceWalletId,
                thirtyDaysAgo
            );

            // ── 3. Récupérer les tx inverses (dest→src) pour la détection de boucle ─
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
            const reverseTxHistory = await this.transactionRepository.findBySourceWalletIdSince(
                destinationWalletId,
                oneHourAgo
            );

            // ── 4. Récupérer la date de dernière activité (wallet source) ─────
            const lastActivityDate = recentTxHistory.length > 0
                ? new Date(recentTxHistory[recentTxHistory.length - 1].created_at)
                : null;

            // ── 5. Construire le contexte et analyser ─────────────────────────
            const transactionContext = {
                sourceWalletId,
                destinationWalletId,
                amount,
                currency,
                transactionType,
            };

            const analysisResult = this.fraudService.analyze({
                transaction: transactionContext,
                sourceBalance,
                recentTxHistory,
                reverseTxHistory,
                lastActivityDate,
            });

            const { alerts, blocked, amlFlag } = analysisResult;

            // ── 6. Logger et persister les alertes ────────────────────────────
            if (alerts.length > 0) {
                this.logger.warn('🚨 Fraude détectée', {
                    initiatorUserId,
                    sourceWalletId,
                    destinationWalletId,
                    amount,
                    blocked,
                    amlFlag,
                    rules: alerts.map(a => a.rule),
                });

                // Persistance asynchrone (non bloquante) pour ne pas ralentir le flux nominal
                this.fraudAlertRepository.saveAll(
                    alerts.map(a => ({
                        ...a.toJSON(),
                        initiator_user_id:        initiatorUserId,
                        source_wallet_id:          sourceWalletId,
                        destination_wallet_id:     destinationWalletId,
                        amount,
                        currency,
                        transaction_type:          transactionType,
                        is_blocking:               a.isBlocking(),
                        is_aml_flagged:            a.isCritical(),
                    }))
                ).catch(err => {
                    this.logger.error('Erreur lors de la persistance des alertes fraude', { error: err.message });
                });
            } else {
                this.logger.info('✅ Aucune anomalie détectée', { sourceWalletId, amount });
            }

            return { alerts, blocked, amlFlag };

        } catch (error) {
            // En cas d'erreur dans l'analyse, on log mais on NE BLOQUE PAS la transaction
            // (fail-open pour éviter d'impacter l'expérience utilisateur sur une erreur infra)
            this.logger.error('Erreur dans le module de détection de fraude (fail-open)', {
                error: error.message,
                sourceWalletId,
                amount,
            });
            return { alerts: [], blocked: false, amlFlag: false };
        }
    }
}

module.exports = AnalyzeTransactionForFraud;
