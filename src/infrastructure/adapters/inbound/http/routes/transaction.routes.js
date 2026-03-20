const express = require('express');
const { requireAuth } = require('../../../../../middleware/auth.middleware');

/**
 * Configuration des routes transaction via injection de dépendances
 */
function createTransactionRoutes(transactionController) {
    const router = express.Router();

    router.post('/initiate', requireAuth, (req, res) => transactionController.initiate(req, res));
    router.post('/pay', requireAuth, (req, res) => transactionController.pay(req, res));
    router.post('/:transactionId/process', requireAuth, (req, res) => transactionController.process(req, res));

    return router;
}

module.exports = createTransactionRoutes;
