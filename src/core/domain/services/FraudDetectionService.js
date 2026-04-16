/**
 * Service de domaine : Détection de fraude
 * ==========================================
 * Règles implémentées :
 *  1.  NEGATIVE_BALANCE          — le solde deviendrait négatif après débit
 *  2.  LARGE_SINGLE_AMOUNT       — montant unique dépasse le seuil absolu
 *  3.  DAILY_LIMIT_EXCEEDED      — cumul journalier dépasse la limite
 *  4.  HIGH_FREQUENCY            — trop de transactions en peu de temps (velocity)
 *  5.  STRUCTURING               — fragmentation : petits montants répétés vers même dest.
 *  6.  CIRCULAR_TRANSFER         — boucle A→B→A détectée dans la fenêtre glissante
 *  7.  ROUND_AMOUNT_PATTERN      — pattern de montants ronds anormalement répété
 *  8.  SELF_TRANSFER             — source et destination identiques
 *  9.  DORMANT_ACCOUNT_SPIKE     — compte dormant qui s'active brutalement
 *
 * NOTE : Ce service est PURE (pas d'I/O). Toutes les données lui sont passées en paramètre.
 */

'use strict';

const { FraudAlert, FRAUD_RULE, RISK_LEVEL } = require('../entities/FraudAlert');

// ─── Seuils configurables (peuvent être surchargés par les env vars via le use case) ───

const DEFAULT_THRESHOLDS = {
    /** Montant max pour une seule transaction (EPIC/CREDITS) */
    MAX_SINGLE_AMOUNT: 5_000,

    /** Cumul max par jour et par wallet source */
    DAILY_LIMIT: 15_000,

    /** Nombre max de transactions sur la fenêtre glissante de vitesse */
    VELOCITY_MAX_COUNT: 5,

    /** Fenêtre de temps (ms) pour le calcul de vélocité */
    VELOCITY_WINDOW_MS: 10 * 60 * 1000, // 10 minutes

    /** Nb min de petites transactions vers le même destinataire pour déclencher STRUCTURING */
    STRUCTURING_MIN_COUNT: 4,

    /** Seuil en-dessous duquel un montant est considéré "petit" pour le structuring */
    STRUCTURING_SMALL_AMOUNT: 500,

    /** Fenêtre temporelle pour détecter une boucle (ms) */
    CIRCULAR_WINDOW_MS: 60 * 60 * 1000, // 1 heure

    /** Nb de jours sans activité pour qualifier un compte comme "dormant" */
    DORMANT_DAYS: 90,

    /** Nb min de montants ronds dans l'historique pour déclencher ROUND_AMOUNT_PATTERN */
    ROUND_AMOUNT_MIN_COUNT: 5,
};

class FraudDetectionService {
    /**
     * @param {object} [thresholds] - Surcharge partielle des seuils par défaut
     */
    constructor(thresholds = {}) {
        this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
    }

    // ═════════════════════════════════════════════════════════
    //  Point d'entrée principal
    // ═════════════════════════════════════════════════════════

    /**
     * Analyse une transaction avant son exécution.
     *
     * @param {object} context
     * @param {object}   context.transaction      - La transaction à analyser
     * @param {string}     context.transaction.sourceWalletId
     * @param {string}     context.transaction.destinationWalletId
     * @param {number}     context.transaction.amount
     * @param {string}     context.transaction.currency
     * @param {string}     context.transaction.transactionType
     * @param {number}   context.sourceBalance    - Solde actuel du wallet source
     * @param {object[]}  context.recentTxHistory  - Transactions récentes du wallet source (30 j)
     *                                               Chaque élément : { amount, source_wallet_id, destination_wallet_id, created_at, status }
     * @param {object[]}  [context.reverseTxHistory] - Transactions du wallet DEST vers la SOURCE (pour circular check)
     * @param {Date}     [context.lastActivityDate]  - Dernière date d'activité du wallet source
     *
     * @returns {{ alerts: FraudAlert[], blocked: boolean, amlFlag: boolean }}
     */
    analyze(context) {
        const {
            transaction,
            sourceBalance,
            recentTxHistory = [],
            reverseTxHistory = [],
            lastActivityDate = null,
        } = context;

        const alerts = [];

        // — Règle 1 : Vérification du solde négatif
        const negativeBalanceAlert = this._checkNegativeBalance(transaction, sourceBalance);
        if (negativeBalanceAlert) alerts.push(negativeBalanceAlert);

        // — Règle 2 : Montant unitaire trop élevé
        const largeAmountAlert = this._checkLargeAmount(transaction);
        if (largeAmountAlert) alerts.push(largeAmountAlert);

        // — Règle 3 : Cumul journalier dépassé
        const dailyLimitAlert = this._checkDailyLimit(transaction, recentTxHistory);
        if (dailyLimitAlert) alerts.push(dailyLimitAlert);

        // — Règle 4 : Vélocité (trop de transactions rapides)
        const velocityAlert = this._checkVelocity(transaction, recentTxHistory);
        if (velocityAlert) alerts.push(velocityAlert);

        // — Règle 5 : Structuring (fragmentation blanchiment)
        const structuringAlert = this._checkStructuring(transaction, recentTxHistory);
        if (structuringAlert) alerts.push(structuringAlert);

        // — Règle 6 : Transfert circulaire (A→B→A)
        const circularAlert = this._checkCircularTransfer(transaction, reverseTxHistory);
        if (circularAlert) alerts.push(circularAlert);

        // — Règle 7 : Pattern de montants ronds
        const roundAlert = this._checkRoundAmountPattern(transaction, recentTxHistory);
        if (roundAlert) alerts.push(roundAlert);

        // — Règle 8 : Auto-transfert
        const selfAlert = this._checkSelfTransfer(transaction);
        if (selfAlert) alerts.push(selfAlert);

        // — Règle 9 : Compte dormant soudainement actif
        const dormantAlert = this._checkDormantAccountSpike(transaction, lastActivityDate);
        if (dormantAlert) alerts.push(dormantAlert);

        const blocked = alerts.some(a => a.isBlocking());
        const amlFlag = alerts.some(a => a.isCritical());

        return { alerts, blocked, amlFlag };
    }

    // ═════════════════════════════════════════════════════════
    //  Règles individuelles (privées)
    // ═════════════════════════════════════════════════════════

    /**
     * Règle 1 — Solde négatif
     * Si le solde après débit serait strictement négatif → anomalie critique.
     * (Impossible en pratique avec la protection Wallet.canDebit, mais on double les gardes.)
     */
    _checkNegativeBalance(transaction, sourceBalance) {
        const balanceAfter = sourceBalance - transaction.amount;
        if (balanceAfter < 0) {
            return new FraudAlert({
                rule: FRAUD_RULE.NEGATIVE_BALANCE,
                riskLevel: RISK_LEVEL.CRITICAL,
                message: `Le solde deviendrait négatif après débit (solde actuel : ${sourceBalance}, montant : ${transaction.amount})`,
                metadata: { sourceBalance, amount: transaction.amount, balanceAfter },
            });
        }
        return null;
    }

    /**
     * Règle 2 — Montant unitaire élevé
     */
    _checkLargeAmount(transaction) {
        if (transaction.amount > this.thresholds.MAX_SINGLE_AMOUNT) {
            return new FraudAlert({
                rule: FRAUD_RULE.LARGE_SINGLE_AMOUNT,
                riskLevel: RISK_LEVEL.HIGH,
                message: `Montant anormalement élevé : ${transaction.amount} (seuil : ${this.thresholds.MAX_SINGLE_AMOUNT})`,
                metadata: { amount: transaction.amount, threshold: this.thresholds.MAX_SINGLE_AMOUNT },
            });
        }
        return null;
    }

    /**
     * Règle 3 — Limite journalière cumulée
     */
    _checkDailyLimit(transaction, history) {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const dailyTotal = history
            .filter(tx => new Date(tx.created_at) >= oneDayAgo && tx.status === 'SUCCESS')
            .reduce((sum, tx) => sum + parseFloat(tx.amount), 0);

        const projected = dailyTotal + transaction.amount;
        if (projected > this.thresholds.DAILY_LIMIT) {
            return new FraudAlert({
                rule: FRAUD_RULE.DAILY_LIMIT_EXCEEDED,
                riskLevel: RISK_LEVEL.HIGH,
                message: `Limite journalière dépassée : cumul projeté ${projected.toFixed(2)} > ${this.thresholds.DAILY_LIMIT}`,
                metadata: { dailyTotal, amount: transaction.amount, projected, limit: this.thresholds.DAILY_LIMIT },
            });
        }
        return null;
    }

    /**
     * Règle 4 — Vélocité anormale
     * Trop de transactions en peu de temps = possible attaque ou bot.
     */
    _checkVelocity(transaction, history) {
        const windowStart = new Date(Date.now() - this.thresholds.VELOCITY_WINDOW_MS);
        const recentCount = history.filter(
            tx => new Date(tx.created_at) >= windowStart
        ).length;

        if (recentCount >= this.thresholds.VELOCITY_MAX_COUNT) {
            return new FraudAlert({
                rule: FRAUD_RULE.HIGH_FREQUENCY,
                riskLevel: RISK_LEVEL.HIGH,
                message: `Trop de transactions récentes : ${recentCount} dans les ${this.thresholds.VELOCITY_WINDOW_MS / 60000} min`,
                metadata: {
                    recentCount,
                    windowMinutes: this.thresholds.VELOCITY_WINDOW_MS / 60000,
                    maxAllowed: this.thresholds.VELOCITY_MAX_COUNT,
                },
            });
        }
        return null;
    }

    /**
     * Règle 5 — Structuring (fragmentation)
     * Technique de blanchiment : découper un gros montant en petites transactions
     * pour passer sous les radars. Ici on détecte plusieurs petits transferts
     * vers le MÊME destinataire dans la même journée.
     */
    _checkStructuring(transaction, history) {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const { STRUCTURING_MIN_COUNT, STRUCTURING_SMALL_AMOUNT } = this.thresholds;

        const sameDestSmall = history.filter(
            tx =>
                tx.destination_wallet_id === transaction.destinationWalletId &&
                parseFloat(tx.amount) < STRUCTURING_SMALL_AMOUNT &&
                new Date(tx.created_at) >= oneDayAgo
        );

        if (
            transaction.amount < STRUCTURING_SMALL_AMOUNT &&
            sameDestSmall.length >= STRUCTURING_MIN_COUNT - 1 // -1 car la tx en cours est la Nième
        ) {
            const totalStructured = sameDestSmall.reduce((s, tx) => s + parseFloat(tx.amount), 0) + transaction.amount;
            return new FraudAlert({
                rule: FRAUD_RULE.STRUCTURING,
                riskLevel: RISK_LEVEL.CRITICAL,
                message: `Structuring détecté : ${sameDestSmall.length + 1} petites transactions vers le même destinataire (total ${totalStructured.toFixed(2)})`,
                metadata: {
                    count: sameDestSmall.length + 1,
                    totalStructured,
                    destinationWalletId: transaction.destinationWalletId,
                    threshold: STRUCTURING_SMALL_AMOUNT,
                    minCount: STRUCTURING_MIN_COUNT,
                },
            });
        }
        return null;
    }

    /**
     * Règle 6 — Transfert circulaire (A→B puis B→A dans la fenêtre)
     * Indicateur fort de blanchiment en passant par plusieurs comptes.
     */
    _checkCircularTransfer(transaction, reverseTxHistory) {
        const windowStart = new Date(Date.now() - this.thresholds.CIRCULAR_WINDOW_MS);

        // reverseTxHistory contient les tx du wallet DESTINATAIRE vers le wallet SOURCE
        const hasReverse = reverseTxHistory.some(
            tx =>
                tx.source_wallet_id === transaction.destinationWalletId &&
                tx.destination_wallet_id === transaction.sourceWalletId &&
                new Date(tx.created_at) >= windowStart &&
                tx.status === 'SUCCESS'
        );

        if (hasReverse) {
            return new FraudAlert({
                rule: FRAUD_RULE.CIRCULAR_TRANSFER,
                riskLevel: RISK_LEVEL.CRITICAL,
                message: `Transfert circulaire détecté : un aller-retour entre ces deux wallets a eu lieu dans l'heure`,
                metadata: {
                    sourceWalletId: transaction.sourceWalletId,
                    destinationWalletId: transaction.destinationWalletId,
                    windowHours: this.thresholds.CIRCULAR_WINDOW_MS / 3_600_000,
                },
            });
        }
        return null;
    }

    /**
     * Règle 7 — Pattern de montants ronds
     * Des transferts toujours en chiffre ronds (100, 500, 1000…) répétés
     * peuvent signaler un usage de mule financière ou de script automatisé.
     */
    _checkRoundAmountPattern(transaction, history) {
        const isRound = (n) => n % 100 === 0;
        if (!isRound(transaction.amount)) return null;

        const recentRounds = history.filter(
            tx => isRound(parseFloat(tx.amount))
        ).length;

        if (recentRounds >= this.thresholds.ROUND_AMOUNT_MIN_COUNT) {
            return new FraudAlert({
                rule: FRAUD_RULE.ROUND_AMOUNT_PATTERN,
                riskLevel: RISK_LEVEL.MEDIUM,
                message: `Pattern de montants ronds détecté : ${recentRounds + 1} transactions avec des montants multiples de 100`,
                metadata: {
                    currentAmount: transaction.amount,
                    recentRoundsCount: recentRounds,
                    minCount: this.thresholds.ROUND_AMOUNT_MIN_COUNT,
                },
            });
        }
        return null;
    }

    /**
     * Règle 8 — Auto-transfert (source === destination)
     * Légitime dans certains cas (consolidation), mais suspect s'il est récurrent.
     */
    _checkSelfTransfer(transaction) {
        if (transaction.sourceWalletId === transaction.destinationWalletId) {
            return new FraudAlert({
                rule: FRAUD_RULE.SELF_TRANSFER,
                riskLevel: RISK_LEVEL.MEDIUM,
                message: `Auto-transfert détecté : le wallet source et destination sont identiques`,
                metadata: { walletId: transaction.sourceWalletId },
            });
        }
        return null;
    }

    /**
     * Règle 9 — Compte dormant soudainement actif
     * Un compte sans activité depuis N jours qui effectue soudain une grosse
     * transaction est un signal fort de compromission ou de blanchiment.
     */
    _checkDormantAccountSpike(transaction, lastActivityDate) {
        if (!lastActivityDate) return null;

        const daysSinceActivity = (Date.now() - new Date(lastActivityDate).getTime()) / (24 * 60 * 60 * 1000);

        if (
            daysSinceActivity >= this.thresholds.DORMANT_DAYS &&
            transaction.amount > this.thresholds.MAX_SINGLE_AMOUNT / 2
        ) {
            return new FraudAlert({
                rule: FRAUD_RULE.DORMANT_ACCOUNT_SPIKE,
                riskLevel: RISK_LEVEL.HIGH,
                message: `Compte dormant depuis ${Math.floor(daysSinceActivity)} jours avec une transaction importante de ${transaction.amount}`,
                metadata: {
                    daysSinceActivity: Math.floor(daysSinceActivity),
                    amount: transaction.amount,
                    dormantThreshold: this.thresholds.DORMANT_DAYS,
                    lastActivityDate: lastActivityDate instanceof Date
                        ? lastActivityDate.toISOString()
                        : lastActivityDate,
                },
            });
        }
        return null;
    }
}

module.exports = { FraudDetectionService, DEFAULT_THRESHOLDS };
