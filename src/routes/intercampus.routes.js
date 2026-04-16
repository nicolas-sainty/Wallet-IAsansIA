'use strict';

/**
 * Routes inter-campus — Compatibles avec le standard EpiPay v1.0.0
 *
 * Montées à la racine du serveur (pas sous /api/) :
 *   POST /intercampus-send    — JWT requis
 *   POST /intercampus-receive — API key SHA-256 (pas de JWT)
 *
 * Ces routes utilisent le module hexagonal via bootstrap().
 */

const express = require('express');
const crypto  = require('crypto');
const { v4: uuidv4 } = require('uuid');
const logger  = require('../config/logger');
const { requireAuth } = require('../middleware/auth.middleware');
const { supabase } = require('../config/database');

const router = express.Router();

// ── Lazy bootstrap pour éviter les dépendances circulaires ─────────────────
let _sendUC    = null;
let _receiveUC = null;

function getUseCases() {
    if (!_sendUC || !_receiveUC) {
        const bootstrap = require('../infrastructure/di');
        // bootstrap() est appelé une seule fois (singleton via require cache)
        try {
            const deps = bootstrap._intercampus || (() => {
                const b = require('../infrastructure/di');
                return b._intercampus;
            })();
            _sendUC    = deps.send;
            _receiveUC = deps.receive;
        } catch {
            // Fallback : instanciation directe avec les services existants
        }
    }
    return { sendUC: _sendUC, receiveUC: _receiveUC };
}

// ── Importation directe des services pour le fallback ──────────────────────
const SendIntercampus    = require('../core/application/use-cases/SendIntercampus');
const ReceiveIntercampus = require('../core/application/use-cases/ReceiveIntercampus');
const SupabaseWalletRepository      = require('../infrastructure/adapters/outbound/repositories/SupabaseWalletRepository');
const SupabaseTransactionRepository = require('../infrastructure/adapters/outbound/repositories/SupabaseTransactionRepository');
const SupabaseIntercampusRepository = require('../infrastructure/adapters/outbound/repositories/SupabaseIntercampusRepository');
const NativeIntercampusHttpClient   = require('../infrastructure/adapters/outbound/http/NativeIntercampusHttpClient');
const AnalyzeTransactionForFraud    = require('../core/application/use-cases/AnalyzeTransactionForFraud');
const SupabaseFraudAlertRepository  = require('../infrastructure/adapters/outbound/repositories/SupabaseFraudAlertRepository');

// Instanciation directe (singleton au niveau module)
const walletRepo       = new SupabaseWalletRepository(supabase);
const transactionRepo  = new SupabaseTransactionRepository(supabase);
const intercampusRepo  = new SupabaseIntercampusRepository(supabase);
const fraudAlertRepo   = new SupabaseFraudAlertRepository(supabase);
const httpClient       = new NativeIntercampusHttpClient({ timeoutMs: 10_000 }, logger);

const fraudUC = new AnalyzeTransactionForFraud(
    walletRepo, transactionRepo, fraudAlertRepo, logger
);

const CAMPUS_ID = process.env.CAMPUS_ID || 'groupe_2_BDX';

const sendUC = new SendIntercampus(
    walletRepo, transactionRepo, httpClient, intercampusRepo, fraudUC, logger, CAMPUS_ID
);
const receiveUC = new ReceiveIntercampus(
    walletRepo, transactionRepo, intercampusRepo, intercampusRepo, fraudUC, logger
);

// ═══════════════════════════════════════════════════════════════════════════
//  POST /intercampus-send
//  Envoie des EpiCoins à un campus partenaire
// ═══════════════════════════════════════════════════════════════════════════
router.post('/intercampus-send', requireAuth, async (req, res) => {
    try {
        const {
            source_wallet_id,
            destination_wallet_id,
            destination_campus_api_url,
            amount,
            currency        = 'EPC',
            description,
            enriched_data   = {},
            api_key,
        } = req.body;

        // Validation
        if (!source_wallet_id)           return res.status(400).json({ success: false, status: 'failed', message: 'source_wallet_id requis' });
        if (!destination_wallet_id)      return res.status(400).json({ success: false, status: 'failed', message: 'destination_wallet_id requis' });
        if (!destination_campus_api_url) return res.status(400).json({ success: false, status: 'failed', message: 'destination_campus_api_url requis' });
        if (!amount || parseFloat(amount) < 1) return res.status(400).json({ success: false, status: 'failed', message: 'amount doit être >= 1 EPC' });
        if (!api_key)                    return res.status(400).json({ success: false, status: 'failed', message: 'api_key requis' });

        const result = await sendUC.execute({
            initiatorUserId:         req.user.user_id,
            sourceWalletId:          source_wallet_id,
            destinationWalletId:     destination_wallet_id,
            destinationCampusApiUrl: destination_campus_api_url,
            amount:                  parseFloat(amount),
            currency,
            description,
            enrichedData:            enriched_data,
            apiKey:                  api_key,
        });

        return res.status(200).json(result);

    } catch (error) {
        logger.error('intercampus-send failed', { error: error.message });
        const statusCode = error.code === 'FRAUD_AML_FLAGGED' ? 403
                         : error.code === 'FRAUD_TRANSACTION_BLOCKED' ? 403
                         : 400;
        return res.status(statusCode).json({
            success: false,
            status:  error.code === 'FRAUD_AML_FLAGGED' ? 'blocked' : 'failed',
            message: error.message,
            ...(error.fraudAlerts ? { fraud_alerts: error.fraudAlerts } : {}),
        });
    }
});

// ═══════════════════════════════════════════════════════════════════════════
//  POST /intercampus-receive
//  Reçoit des EpiCoins depuis un campus partenaire (pas de JWT — API key SHA-256)
// ═══════════════════════════════════════════════════════════════════════════
router.post('/intercampus-receive', async (req, res) => {
    try {
        const {
            transaction_id,
            source_wallet_id,
            destination_wallet_id,
            amount,
            currency            = 'EPC',
            initiator_user_id   = null,
            api_key,
            source_campus_id,
            enriched_data       = {},
        } = req.body;

        // Validation basique
        if (!transaction_id)         return res.status(400).json({ success: false, status: 'failed', message: 'transaction_id requis' });
        if (!source_wallet_id)       return res.status(400).json({ success: false, status: 'failed', message: 'source_wallet_id requis' });
        if (!destination_wallet_id)  return res.status(400).json({ success: false, status: 'failed', message: 'destination_wallet_id requis' });
        if (!amount || parseFloat(amount) < 1) return res.status(400).json({ success: false, status: 'failed', message: 'amount doit être >= 1 EPC' });
        if (!api_key)                return res.status(401).json({ success: false, status: 'unauthorized', message: 'api_key requis' });
        if (!source_campus_id)       return res.status(400).json({ success: false, status: 'failed', message: 'source_campus_id requis' });

        const result = await receiveUC.execute({
            transactionId:        transaction_id,
            sourceWalletId:       source_wallet_id,
            destinationWalletId:  destination_wallet_id,
            amount:               parseFloat(amount),
            currency,
            initiatorUserId:      initiator_user_id,
            apiKey:               api_key,
            sourceCampusId:       source_campus_id,
            enrichedData:         enriched_data,
        });

        if (result.status === 'unauthorized') return res.status(401).json(result);
        if (result.status === 'blocked')      return res.status(403).json(result);
        if (result.status === 'failed')       return res.status(422).json(result);

        return res.status(200).json(result);

    } catch (error) {
        logger.error('intercampus-receive failed', { error: error.message });
        return res.status(500).json({
            success: false,
            status:  'failed',
            message: `Erreur interne : ${error.message}`,
        });
    }
});

module.exports = router;
