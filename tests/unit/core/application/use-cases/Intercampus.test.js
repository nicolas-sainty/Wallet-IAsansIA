'use strict';

/**
 * Tests unitaires : SendIntercampus + ReceiveIntercampus
 * Tous les I/O sont mockés.
 */

const SendIntercampus    = require('../../../../../src/core/application/use-cases/SendIntercampus');
const ReceiveIntercampus = require('../../../../../src/core/application/use-cases/ReceiveIntercampus');

// ─── Factories de mocks ─────────────────────────────────────────────────────

const makeActiveWallet = (id, balance = 1000) => ({
    walletId:   id,
    balance,
    isActive:   () => true,
    canDebit:   (a) => balance >= a,
    debit:      jest.fn(function(a) { this.balance -= a; }),
    credit:     jest.fn(function(a) { this.balance += a; }),
});

const makeWalletRepo = (wallet) => ({
    findById:                jest.fn().mockResolvedValue(wallet),
    getBalanceWithPending:   jest.fn().mockResolvedValue({ availableBalance: wallet?.balance ?? 0 }),
    save:                    jest.fn().mockResolvedValue(wallet),
});

const makeTransactionRepo = () => ({
    create:   jest.fn().mockResolvedValue({ transactionId: 'tx-local-001', markAsSuccess: jest.fn(), markAsFailed: jest.fn() }),
    findById: jest.fn().mockResolvedValue({ transactionId: 'tx-local-001', markAsSuccess: jest.fn(), markAsFailed: jest.fn() }),
    save:     jest.fn().mockResolvedValue({ transactionId: 'tx-local-001' }),
});


const makeIntercampusRepo = (keyValid = true) => ({
    save:                         jest.fn().mockResolvedValue(undefined),
    findByRemoteTransactionId:    jest.fn().mockResolvedValue(null), // pas de doublon
    verifyHashedKey:              jest.fn().mockResolvedValue(keyValid),
    updateLastUsed:               jest.fn().mockResolvedValue(undefined),
});

const makeHttpClient = (success = true) => ({
    sendToRemoteCampus: success
        ? jest.fn().mockResolvedValue({ success: true, status: 'completed', transaction_id: 'remote-tx-001' })
        : jest.fn().mockRejectedValue(new Error('Campus distant injoignable')),
});

const makeFraudUC = (blocked = false) => ({
    execute: jest.fn().mockResolvedValue({
        alerts:    blocked ? [{ rule: 'LARGE_SINGLE_AMOUNT', riskLevel: 'HIGH', isBlocking: () => true, isCritical: () => false, toJSON: () => ({}) }] : [],
        blocked,
        amlFlag:   false,
    }),
});

const mockLogger = {
    info:  jest.fn(),
    warn:  jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
};

// ═══════════════════════════════════════════════════════════════════════════
//  SendIntercampus
// ═══════════════════════════════════════════════════════════════════════════

describe('SendIntercampus', () => {
    const baseParams = {
        initiatorUserId:         'user-001',
        sourceWalletId:          'wallet-src',
        destinationWalletId:     'wallet-dst',
        destinationCampusApiUrl: 'https://epipay.example.com/functions/v1',
        amount:                  100,
        currency:                'EPC',
        description:             'Test intercampus',
        apiKey:                  'my-secret-key-123',
    };

    it('doit débiter le wallet et retourner success=true quand le campus distant répond OK', async () => {
        const srcWallet = makeActiveWallet('wallet-src', 500);
        const walletRepo = makeWalletRepo(srcWallet);
        const txRepo = makeTransactionRepo();
        const icRepo = makeIntercampusRepo();
        const httpClient = makeHttpClient(true);

        const uc = new SendIntercampus(walletRepo, txRepo, httpClient, icRepo, null, mockLogger, 'groupe_2_BDX');
        const result = await uc.execute(baseParams);

        expect(result.success).toBe(true);
        expect(result.status).toBe('completed');
        expect(result.transaction_id).toBeDefined();
        expect(result.destination_tx_id).toBe('remote-tx-001');
        expect(srcWallet.debit).toHaveBeenCalledWith(100);
        expect(walletRepo.save).toHaveBeenCalled();
        expect(icRepo.save).toHaveBeenCalledWith(expect.objectContaining({ direction: 'outgoing', status: 'completed' }));
    });

    it('doit effectuer un rollback (credit + REFUND) quand le campus distant échoue', async () => {
        const srcWallet = makeActiveWallet('wallet-src', 500);
        const walletRepo = makeWalletRepo(srcWallet);
        walletRepo.findById = jest.fn().mockResolvedValue(srcWallet);
        const txRepo = makeTransactionRepo();
        const icRepo = makeIntercampusRepo();
        const httpClient = makeHttpClient(false); // Simulation d'échec distant

        const uc = new SendIntercampus(walletRepo, txRepo, httpClient, icRepo, null, mockLogger, 'groupe_2_BDX');

        await expect(uc.execute(baseParams)).rejects.toThrow('Transfert inter-campus échoué');

        // Le log doit indiquer 'failed'
        expect(icRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }));
        // Le rollback (credit) doit avoir eu lieu
        expect(srcWallet.credit).toHaveBeenCalledWith(100);
    });

    it('doit lever une erreur si le solde est insuffisant', async () => {
        const srcWallet = makeActiveWallet('wallet-src', 50); // solde insuffisant
        const walletRepo = makeWalletRepo(srcWallet);
        walletRepo.getBalanceWithPending = jest.fn().mockResolvedValue({ availableBalance: 50 });
        const txRepo = makeTransactionRepo();
        const icRepo = makeIntercampusRepo();
        const httpClient = makeHttpClient(true);

        const uc = new SendIntercampus(walletRepo, txRepo, httpClient, icRepo, null, mockLogger, 'groupe_2_BDX');

        await expect(uc.execute({ ...baseParams, amount: 200 })).rejects.toThrow('Fonds insuffisants');
        expect(httpClient.sendToRemoteCampus).not.toHaveBeenCalled();
    });

    it('doit bloquer et ne pas appeler le campus distant si la fraude est détectée', async () => {
        const srcWallet = makeActiveWallet('wallet-src', 1000);
        const walletRepo = makeWalletRepo(srcWallet);
        const txRepo = makeTransactionRepo();
        const icRepo = makeIntercampusRepo();
        const httpClient = makeHttpClient(true);
        const fraudUC = makeFraudUC(true); // Fraude détectée

        const uc = new SendIntercampus(walletRepo, txRepo, httpClient, icRepo, fraudUC, mockLogger, 'groupe_2_BDX');

        const err = await uc.execute(baseParams).catch(e => e);
        expect(err.message).toMatch(/bloqué/);
        expect(err.code).toBe('FRAUD_TRANSACTION_BLOCKED');
        expect(httpClient.sendToRemoteCampus).not.toHaveBeenCalled();
    });
});

// ═══════════════════════════════════════════════════════════════════════════
//  ReceiveIntercampus
// ═══════════════════════════════════════════════════════════════════════════

describe('ReceiveIntercampus', () => {
    const baseParams = {
        transactionId:        'remote-tx-abc',
        sourceWalletId:       'wallet-src-remote',
        destinationWalletId:  'wallet-dst-local',
        amount:               150,
        currency:             'EPC',
        initiatorUserId:      'user-remote-001',
        apiKey:               'hashed-key-abc', // déjà hashé côté expéditeur
        sourceCampusId:       'epipay-campus',
        enrichedData:         { country: 'FR' },
    };

    it('doit créditer le wallet et retourner success=true avec une clé valide', async () => {
        const dstWallet = makeActiveWallet('wallet-dst-local', 200);
        const walletRepo = makeWalletRepo(dstWallet);
        const txRepo = makeTransactionRepo();
        const icRepo = makeIntercampusRepo(true); // clé valide

        const uc = new ReceiveIntercampus(walletRepo, txRepo, icRepo, icRepo, null, mockLogger);
        const result = await uc.execute(baseParams);

        expect(result.success).toBe(true);
        expect(result.status).toBe('completed');
        expect(dstWallet.credit).toHaveBeenCalledWith(150);
        expect(txRepo.create).toHaveBeenCalledWith(expect.objectContaining({
            transactionType: 'INTERCAMPUS',
            direction:       'incoming',
            status:          'SUCCESS',
        }));
    });

    it('doit refuser avec status=unauthorized si la clé est invalide', async () => {
        const dstWallet = makeActiveWallet('wallet-dst-local', 200);
        const walletRepo = makeWalletRepo(dstWallet);
        const txRepo = makeTransactionRepo();
        const icRepo = makeIntercampusRepo(false); // clé INVALIDE

        const uc = new ReceiveIntercampus(walletRepo, txRepo, icRepo, icRepo, null, mockLogger);
        const result = await uc.execute(baseParams);

        expect(result.success).toBe(false);
        expect(result.status).toBe('unauthorized');
        expect(dstWallet.credit).not.toHaveBeenCalled();
        expect(txRepo.create).not.toHaveBeenCalled();
    });

    it('doit être idempotent : retourner completed si la transaction a déjà été traitée', async () => {
        const dstWallet = makeActiveWallet('wallet-dst-local', 200);
        const walletRepo = makeWalletRepo(dstWallet);
        const txRepo = makeTransactionRepo();
        const icRepo = makeIntercampusRepo(true);
        // Simuler une transaction déjà traitée
        icRepo.findByRemoteTransactionId = jest.fn().mockResolvedValue({ transfer_id: 'existing-001', status: 'completed' });

        const uc = new ReceiveIntercampus(walletRepo, txRepo, icRepo, icRepo, null, mockLogger);
        const result = await uc.execute(baseParams);

        expect(result.success).toBe(true);
        expect(result.status).toBe('completed');
        expect(result.message).toMatch(/déjà traitée/);
        // Aucun crédit ne doit avoir été effectué
        expect(dstWallet.credit).not.toHaveBeenCalled();
    });

    it('doit bloquer le crédit si la fraude est détectée côté récepteur', async () => {
        const dstWallet = makeActiveWallet('wallet-dst-local', 200);
        const walletRepo = makeWalletRepo(dstWallet);
        const txRepo = makeTransactionRepo();
        const icRepo = makeIntercampusRepo(true);
        const fraudUC = makeFraudUC(true);

        const uc = new ReceiveIntercampus(walletRepo, txRepo, icRepo, icRepo, fraudUC, mockLogger);
        const result = await uc.execute(baseParams);

        expect(result.success).toBe(false);
        expect(result.status).toBe('blocked');
        expect(dstWallet.credit).not.toHaveBeenCalled();
    });
});
