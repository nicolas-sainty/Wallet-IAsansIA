const express = require('express');
const { requireAuth } = require('../../../../../middleware/auth.middleware');

/**
 * Configuration des routes wallet via injection de dépendances
 */
function createWalletRoutes(walletController) {
    const router = express.Router();

    router.get('/', requireAuth, (req, res) => walletController.getWallets(req, res));
    router.get('/:walletId/balance', requireAuth, (req, res) => walletController.getBalance(req, res));
    router.get('/:walletId/transactions', requireAuth, (req, res) => walletController.getTransactions(req, res));

    return router;
}

module.exports = createWalletRoutes;
