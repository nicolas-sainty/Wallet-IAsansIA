'use strict';

/**
 * Tests unitaires du FraudDetectionService
 * Couvre toutes les règles de détection de fraude et de blanchiment.
 */

const { FraudDetectionService } = require('../../../../../src/core/domain/services/FraudDetectionService');
const { FRAUD_RULE, RISK_LEVEL } = require('../../../../../src/core/domain/entities/FraudAlert');

// ─── Helpers ────────────────────────────────────────────────────────────────

const makeTx = (overrides = {}) => ({
    sourceWalletId:      'wallet-A',
    destinationWalletId: 'wallet-B',
    amount:              100,
    currency:            'EPIC',
    transactionType:     'TRANSFER',
    ...overrides,
});

const makeHistory = (count, overrides = {}) =>
    Array.from({ length: count }, (_, i) => ({
        transaction_id:          `tx-${i}`,
        source_wallet_id:        'wallet-A',
        destination_wallet_id:   'wallet-B',
        amount:                  50,
        status:                  'SUCCESS',
        created_at:              new Date(Date.now() - i * 60_000).toISOString(), // 1 min apart
        ...overrides,
    }));

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('FraudDetectionService', () => {
    let service;

    beforeEach(() => {
        // Seuils abaissés pour rendre les tests déterministes
        service = new FraudDetectionService({
            MAX_SINGLE_AMOUNT:       1_000,
            DAILY_LIMIT:             3_000,
            VELOCITY_MAX_COUNT:      3,
            VELOCITY_WINDOW_MS:      10 * 60 * 1000, // 10 min
            STRUCTURING_MIN_COUNT:   3,
            STRUCTURING_SMALL_AMOUNT: 200,
            CIRCULAR_WINDOW_MS:      60 * 60 * 1000, // 1 heure
            DORMANT_DAYS:            30,
            ROUND_AMOUNT_MIN_COUNT:  3,
        });
    });

    // ── Règle 1 : Solde négatif ────────────────────────────────────────────

    describe('Règle NEGATIVE_BALANCE', () => {
        it('doit déclencher une alerte CRITICAL quand le solde deviendrait négatif', () => {
            const result = service.analyze({
                transaction: makeTx({ amount: 500 }),
                sourceBalance: 400,
                recentTxHistory: [],
            });
            const alert = result.alerts.find(a => a.rule === FRAUD_RULE.NEGATIVE_BALANCE);
            expect(alert).toBeDefined();
            expect(alert.riskLevel).toBe(RISK_LEVEL.CRITICAL);
            expect(result.blocked).toBe(true);
            expect(result.amlFlag).toBe(true);
        });

        it('ne doit PAS déclencher si le solde reste positif ou nul', () => {
            const result = service.analyze({
                transaction: makeTx({ amount: 100 }),
                sourceBalance: 100,
                recentTxHistory: [],
            });
            expect(result.alerts.find(a => a.rule === FRAUD_RULE.NEGATIVE_BALANCE)).toBeUndefined();
        });
    });

    // ── Règle 2 : Montant élevé ────────────────────────────────────────────

    describe('Règle LARGE_SINGLE_AMOUNT', () => {
        it('doit bloquer un montant supérieur au seuil MAX_SINGLE_AMOUNT', () => {
            const result = service.analyze({
                transaction: makeTx({ amount: 1_500 }),
                sourceBalance: 10_000,
                recentTxHistory: [],
            });
            const alert = result.alerts.find(a => a.rule === FRAUD_RULE.LARGE_SINGLE_AMOUNT);
            expect(alert).toBeDefined();
            expect(alert.riskLevel).toBe(RISK_LEVEL.HIGH);
            expect(result.blocked).toBe(true);
        });

        it('ne doit pas bloquer si le montant est dans les limites', () => {
            const result = service.analyze({
                transaction: makeTx({ amount: 999 }),
                sourceBalance: 5_000,
                recentTxHistory: [],
            });
            expect(result.alerts.find(a => a.rule === FRAUD_RULE.LARGE_SINGLE_AMOUNT)).toBeUndefined();
        });
    });

    // ── Règle 3 : Limite journalière ───────────────────────────────────────

    describe('Règle DAILY_LIMIT_EXCEEDED', () => {
        it('doit bloquer quand le cumul journalier dépasse la limite', () => {
            const history = makeHistory(5, { amount: 600, created_at: new Date().toISOString() });
            const result = service.analyze({
                transaction: makeTx({ amount: 600 }),
                sourceBalance: 10_000,
                recentTxHistory: history,
            });
            const alert = result.alerts.find(a => a.rule === FRAUD_RULE.DAILY_LIMIT_EXCEEDED);
            expect(alert).toBeDefined();
            expect(alert.riskLevel).toBe(RISK_LEVEL.HIGH);
        });

        it('ne doit pas déclencher si on reste sous la limite', () => {
            const history = makeHistory(2, { amount: 100, created_at: new Date().toISOString() });
            const result = service.analyze({
                transaction: makeTx({ amount: 100 }),
                sourceBalance: 10_000,
                recentTxHistory: history,
            });
            expect(result.alerts.find(a => a.rule === FRAUD_RULE.DAILY_LIMIT_EXCEEDED)).toBeUndefined();
        });
    });

    // ── Règle 4 : Vélocité ─────────────────────────────────────────────────

    describe('Règle HIGH_FREQUENCY', () => {
        it('doit bloquer quand trop de transactions récentes', () => {
            // 3 tx dans les 10 dernières minutes (= seuil), la nouvelle en ferait 4
            const history = makeHistory(3, {
                created_at: new Date(Date.now() - 60_000).toISOString(), // 1 min ago
            });
            const result = service.analyze({
                transaction: makeTx({ amount: 50 }),
                sourceBalance: 10_000,
                recentTxHistory: history,
            });
            const alert = result.alerts.find(a => a.rule === FRAUD_RULE.HIGH_FREQUENCY);
            expect(alert).toBeDefined();
            expect(alert.riskLevel).toBe(RISK_LEVEL.HIGH);
        });

        it('ne doit pas déclencher si les tx sont espacées dans le temps', () => {
            // Tx vieilles de 2h, hors de la fenêtre de 10 min
            const history = makeHistory(10, {
                created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            });
            const result = service.analyze({
                transaction: makeTx({ amount: 50 }),
                sourceBalance: 10_000,
                recentTxHistory: history,
            });
            expect(result.alerts.find(a => a.rule === FRAUD_RULE.HIGH_FREQUENCY)).toBeUndefined();
        });
    });

    // ── Règle 5 : Structuring ──────────────────────────────────────────────

    describe('Règle STRUCTURING (blanchiment par fragmentation)', () => {
        it('doit déclencher CRITICAL quand plusieurs petits montants vers le même dest.', () => {
            // STRUCTURING_MIN_COUNT = 3, STRUCTURING_SMALL_AMOUNT = 200
            // 2 tx dans l'historique + la tx en cours = 3 → seuil atteint
            const history = [
                {
                    source_wallet_id: 'wallet-A',
                    destination_wallet_id: 'wallet-B',
                    amount: 150,
                    status: 'SUCCESS',
                    created_at: new Date().toISOString(),
                },
                {
                    source_wallet_id: 'wallet-A',
                    destination_wallet_id: 'wallet-B',
                    amount: 180,
                    status: 'SUCCESS',
                    created_at: new Date().toISOString(),
                },
            ];
            const result = service.analyze({
                transaction: makeTx({ amount: 190, destinationWalletId: 'wallet-B' }),
                sourceBalance: 10_000,
                recentTxHistory: history,
            });
            const alert = result.alerts.find(a => a.rule === FRAUD_RULE.STRUCTURING);
            expect(alert).toBeDefined();
            expect(alert.riskLevel).toBe(RISK_LEVEL.CRITICAL);
            expect(result.amlFlag).toBe(true);
        });

        it('ne doit pas déclencher si les dest. sont différentes', () => {
            const history = [
                { source_wallet_id: 'wallet-A', destination_wallet_id: 'wallet-C', amount: 150, status: 'SUCCESS', created_at: new Date().toISOString() },
                { source_wallet_id: 'wallet-A', destination_wallet_id: 'wallet-D', amount: 180, status: 'SUCCESS', created_at: new Date().toISOString() },
            ];
            const result = service.analyze({
                transaction: makeTx({ amount: 190, destinationWalletId: 'wallet-B' }),
                sourceBalance: 10_000,
                recentTxHistory: history,
            });
            expect(result.alerts.find(a => a.rule === FRAUD_RULE.STRUCTURING)).toBeUndefined();
        });
    });

    // ── Règle 6 : Transfert circulaire ────────────────────────────────────

    describe('Règle CIRCULAR_TRANSFER (blanchiment A→B→A)', () => {
        it('doit déclencher CRITICAL si un aller-retour est détecté dans la fenêtre', () => {
            // A envoie à B, et B a déjà envoyé à A dans l'heure
            const reverseTxHistory = [
                {
                    source_wallet_id: 'wallet-B',      // dest → source (retour)
                    destination_wallet_id: 'wallet-A',
                    amount: 100,
                    status: 'SUCCESS',
                    created_at: new Date(Date.now() - 30 * 60_000).toISOString(), // 30 min ago
                },
            ];
            const result = service.analyze({
                transaction: makeTx({ sourceWalletId: 'wallet-A', destinationWalletId: 'wallet-B' }),
                sourceBalance: 10_000,
                recentTxHistory: [],
                reverseTxHistory,
            });
            const alert = result.alerts.find(a => a.rule === FRAUD_RULE.CIRCULAR_TRANSFER);
            expect(alert).toBeDefined();
            expect(alert.riskLevel).toBe(RISK_LEVEL.CRITICAL);
        });

        it('ne doit pas déclencher si la tx inverse est hors de la fenêtre', () => {
            const reverseTxHistory = [
                {
                    source_wallet_id: 'wallet-B',
                    destination_wallet_id: 'wallet-A',
                    amount: 100,
                    status: 'SUCCESS',
                    created_at: new Date(Date.now() - 3 * 60 * 60_000).toISOString(), // 3h ago
                },
            ];
            const result = service.analyze({
                transaction: makeTx({ sourceWalletId: 'wallet-A', destinationWalletId: 'wallet-B' }),
                sourceBalance: 10_000,
                recentTxHistory: [],
                reverseTxHistory,
            });
            expect(result.alerts.find(a => a.rule === FRAUD_RULE.CIRCULAR_TRANSFER)).toBeUndefined();
        });
    });

    // ── Règle 7 : Pattern montants ronds ──────────────────────────────────

    describe('Règle ROUND_AMOUNT_PATTERN', () => {
        it('doit déclencher MEDIUM après plusieurs montants ronds (multiple de 100)', () => {
            // ROUND_AMOUNT_MIN_COUNT = 3 — historique avec 3 montants ronds
            const history = [
                { amount: 200, source_wallet_id: 'wallet-A', destination_wallet_id: 'wallet-B', status: 'SUCCESS', created_at: new Date().toISOString() },
                { amount: 500, source_wallet_id: 'wallet-A', destination_wallet_id: 'wallet-B', status: 'SUCCESS', created_at: new Date().toISOString() },
                { amount: 100, source_wallet_id: 'wallet-A', destination_wallet_id: 'wallet-B', status: 'SUCCESS', created_at: new Date().toISOString() },
            ];
            const result = service.analyze({
                transaction: makeTx({ amount: 300 }),
                sourceBalance: 10_000,
                recentTxHistory: history,
            });
            const alert = result.alerts.find(a => a.rule === FRAUD_RULE.ROUND_AMOUNT_PATTERN);
            expect(alert).toBeDefined();
            expect(alert.riskLevel).toBe(RISK_LEVEL.MEDIUM);
        });

        it('ne doit pas déclencher pour un montant non-rond', () => {
            const result = service.analyze({
                transaction: makeTx({ amount: 137 }),
                sourceBalance: 10_000,
                recentTxHistory: [],
            });
            expect(result.alerts.find(a => a.rule === FRAUD_RULE.ROUND_AMOUNT_PATTERN)).toBeUndefined();
        });
    });

    // ── Règle 8 : Auto-transfert ───────────────────────────────────────────

    describe('Règle SELF_TRANSFER', () => {
        it('doit déclencher MEDIUM si source === destination', () => {
            const result = service.analyze({
                transaction: makeTx({ sourceWalletId: 'wallet-A', destinationWalletId: 'wallet-A' }),
                sourceBalance: 10_000,
                recentTxHistory: [],
            });
            const alert = result.alerts.find(a => a.rule === FRAUD_RULE.SELF_TRANSFER);
            expect(alert).toBeDefined();
            expect(alert.riskLevel).toBe(RISK_LEVEL.MEDIUM);
            // MEDIUM n'est pas bloquant
            expect(result.blocked).toBe(false);
        });

        it('ne doit pas déclencher si les wallets sont différents', () => {
            const result = service.analyze({
                transaction: makeTx({ sourceWalletId: 'wallet-A', destinationWalletId: 'wallet-B' }),
                sourceBalance: 10_000,
                recentTxHistory: [],
            });
            expect(result.alerts.find(a => a.rule === FRAUD_RULE.SELF_TRANSFER)).toBeUndefined();
        });
    });

    // ── Règle 9 : Compte dormant ───────────────────────────────────────────

    describe('Règle DORMANT_ACCOUNT_SPIKE', () => {
        it('doit déclencher HIGH si le compte est inactif depuis > DORMANT_DAYS jours avec un gros montant', () => {
            const lastActivity = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000); // 35 jours ago
            const result = service.analyze({
                transaction: makeTx({ amount: 800 }), // > MAX_SINGLE_AMOUNT/2 = 500
                sourceBalance: 10_000,
                recentTxHistory: [],
                lastActivityDate: lastActivity,
            });
            const alert = result.alerts.find(a => a.rule === FRAUD_RULE.DORMANT_ACCOUNT_SPIKE);
            expect(alert).toBeDefined();
            expect(alert.riskLevel).toBe(RISK_LEVEL.HIGH);
        });

        it('ne doit pas déclencher si le compte est récemment actif', () => {
            const lastActivity = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 jours ago
            const result = service.analyze({
                transaction: makeTx({ amount: 800 }),
                sourceBalance: 10_000,
                recentTxHistory: [],
                lastActivityDate: lastActivity,
            });
            expect(result.alerts.find(a => a.rule === FRAUD_RULE.DORMANT_ACCOUNT_SPIKE)).toBeUndefined();
        });
    });

    // ── Comportement général ───────────────────────────────────────────────

    describe('Comportement général', () => {
        it('doit retourner blocked=false et amlFlag=false pour une transaction propre', () => {
            const result = service.analyze({
                transaction: makeTx({ amount: 50 }),
                sourceBalance: 1_000,
                recentTxHistory: [],
            });
            expect(result.alerts).toHaveLength(0);
            expect(result.blocked).toBe(false);
            expect(result.amlFlag).toBe(false);
        });

        it('doit cumuler plusieurs alertes simultanées', () => {
            // Tx de 1500 (large amount) + solde insuffisant
            const result = service.analyze({
                transaction: makeTx({ amount: 1_500 }),
                sourceBalance: 1_000, // solde insuffisant
                recentTxHistory: [],
            });
            // NEGATIVE_BALANCE + LARGE_SINGLE_AMOUNT doivent tous deux se déclencher
            expect(result.alerts.length).toBeGreaterThanOrEqual(2);
            expect(result.blocked).toBe(true);
            expect(result.amlFlag).toBe(true);
        });
    });
});
