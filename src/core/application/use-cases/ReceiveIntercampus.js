'use strict';

const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

/**
 * Use Case : Recevoir un transfert inter-campus
 * ==============================================
 * Appelé par notre endpoint POST /intercampus-receive lorsqu'un campus
 * partenaire (ex: EpiPay) envoie des EpiCoins vers un de nos wallets.
 *
 * Flux :
 *  1. Vérifie l'authenticité de l'appel (hash SHA-256 de l'api_key)
 *  2. Vérifie l'idempotence (transaction_id déjà traité ?)
 *  3. Lance l'analyse anti-fraude côté récepteur
 *  4. Crédite le wallet destinataire
 *  5. Enregistre la transaction et le log intercampus
 *
 * Compatible avec le standard EpiPay (swagger v1.0.0).
 */
class ReceiveIntercampus {
    /**
     * @param {object} walletRepository
     * @param {object} transactionRepository
     * @param {object} intercampusRepository
     * @param {object} apiKeyRepository          - Pour vérifier le hash SHA-256
     * @param {object} [fraudAnalysisUseCase]
     * @param {object} logger
     */
    constructor(
        walletRepository,
        transactionRepository,
        intercampusRepository,
        apiKeyRepository,
        fraudAnalysisUseCase,
        logger
    ) {
        this.walletRepository       = walletRepository;
        this.transactionRepository  = transactionRepository;
        this.intercampusRepository  = intercampusRepository;
        this.apiKeyRepository       = apiKeyRepository;
        this.fraudAnalysisUseCase   = fraudAnalysisUseCase;
        this.logger                 = logger;
    }

    /**
     * @param {object} params
     * @param {string}  params.transactionId       - UUID généré par le campus source
     * @param {string}  params.sourceWalletId      - Wallet source (campus distant)
     * @param {string}  params.destinationWalletId - Wallet local à créditer
     * @param {number}  params.amount
     * @param {string}  [params.currency]           - "EPC" ou "EPIC"
     * @param {string}  [params.initiatorUserId]   - Utilisateur côté source
     * @param {string}  params.apiKey              - SHA-256 hash de l'API key (envoyé par le campus source)
     * @param {string}  params.sourceCampusId      - Identifiant du campus source
     * @param {object}  [params.enrichedData]
     */
    async execute(params) {
        const {
            transactionId,
            sourceWalletId,
            destinationWalletId,
            amount,
            currency        = 'EPC',
            initiatorUserId = null,
            apiKey,
            sourceCampusId,
            enrichedData    = {},
        } = params;

        // ── 1. Vérification de l'API key ───────────────────────────────────
        const isAuthorized = await this.apiKeyRepository.verifyHashedKey(apiKey, sourceCampusId);
        if (!isAuthorized) {
            this.logger.warn('Tentative inter-campus non autorisée', { sourceCampusId, transactionId });
            return {
                success: false,
                status:  'unauthorized',
                message: 'Clé API invalide ou campus non reconnu',
            };
        }

        // ── 2. Idempotence : transaction déjà traitée ? ────────────────────
        const existing = await this.intercampusRepository.findByRemoteTransactionId(transactionId);
        if (existing) {
            this.logger.info('Transaction inter-campus déjà traitée (idempotence)', { transactionId });
            return {
                success:        true,
                status:         'completed',
                message:        'Transaction déjà traitée',
                transaction_id: transactionId,
            };
        }

        // ── 3. Vérification du wallet destination ──────────────────────────
        const destWallet = await this.walletRepository.findById(destinationWalletId);
        if (!destWallet) {
            this.logger.warn('Wallet destination introuvable', { destinationWalletId });
            return {
                success: false,
                status:  'failed',
                message: 'Wallet destination introuvable sur ce campus',
            };
        }
        if (!destWallet.isActive()) {
            return { success: false, status: 'failed', message: 'Wallet destination inactif' };
        }

        // ── 4. Analyse anti-fraude (côté récepteur) ────────────────────────
        let fraudScore = 0;
        if (this.fraudAnalysisUseCase) {
            const fraudResult = await this.fraudAnalysisUseCase.execute({
                initiatorUserId:      initiatorUserId,
                sourceWalletId:       sourceWalletId,
                destinationWalletId,
                amount,
                currency,
                transactionType:      'INTERCAMPUS',
            });
            fraudScore = Math.min(100, fraudResult.alerts.length * 25);

            if (fraudResult.blocked) {
                const rules = fraudResult.alerts.filter(a => a.isBlocking()).map(a => a.rule).join(', ');
                this.logger.warn('Crédit inter-campus bloqué par la détection fraude', { transactionId, rules });

                await this.intercampusRepository.save({
                    remoteTransactionId:  transactionId,
                    direction:            'incoming',
                    sourceCampusId,
                    amount,
                    currency:             'EPC',
                    status:               'blocked',
                    fraudScore,
                    enrichedData,
                    errorMessage:         rules,
                });

                return {
                    success: false,
                    status:  'blocked',
                    message: `Transfert bloqué pour suspicion de fraude : ${rules}`,
                    transaction_id: transactionId,
                };
            }
        }

        // ── 5. Crédit du wallet destination ───────────────────────────────
        const localTransactionId = uuidv4();
        await this.transactionRepository.create({
            transactionId:        localTransactionId,
            initiatorUserId:      initiatorUserId,
            sourceWalletId:       sourceWalletId,
            destinationWalletId,
            amount,
            currency:             this._normalizeCurrency(currency),
            transactionType:      'INTERCAMPUS',
            direction:            'incoming',
            status:               'SUCCESS',
            description:          `Réception inter-campus depuis ${sourceCampusId}`,
        });

        destWallet.credit(amount);
        await this.walletRepository.save(destWallet);

        // ── 6. Log inter-campus ────────────────────────────────────────────
        await this.intercampusRepository.save({
            localTransactionId,
            remoteTransactionId:  transactionId,
            direction:            'incoming',
            sourceCampusId,
            amount,
            currency:             'EPC',
            status:               'completed',
            fraudScore,
            enrichedData,
        });

        // Mise à jour de la dernière utilisation de la clé
        await this.apiKeyRepository.updateLastUsed(apiKey, sourceCampusId).catch(() => {});

        this.logger.info('Crédit inter-campus réussi', {
            transactionId,
            localTransactionId,
            sourceCampusId,
            amount,
            destinationWalletId,
        });

        return {
            success:        true,
            status:         'completed',
            message:        'Crédit inter-campus appliqué avec succès',
            transaction_id: transactionId,
        };
    }

    _normalizeCurrency(currency) {
        const map = { EPC: 'EPIC', EPIC: 'EPIC', CREDITS: 'CREDITS' };
        return map[currency?.toUpperCase()] || 'EPIC';
    }
}

module.exports = ReceiveIntercampus;
