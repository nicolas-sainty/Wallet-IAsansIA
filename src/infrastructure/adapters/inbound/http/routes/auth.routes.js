const express = require('express');
const { requireAuth } = require('../../../../../middleware/auth.middleware');

/**
 * Configuration des routes d'authentification via injection de dépendances
 */
function createAuthRoutes(authController) {
    const router = express.Router();

    router.post('/register', (req, res) => authController.register(req, res));
    router.post('/login', (req, res) => authController.login(req, res));
    router.post('/refresh', (req, res) => authController.refresh(req, res));
    router.get('/verify', (req, res) => authController.verify(req, res));
    
    // BDE Routes
    router.post('/bde/register', (req, res) => authController.registerBDE(req, res));
    router.post('/bde/members', requireAuth, (req, res) => authController.createMember(req, res));

    return router;
}

module.exports = createAuthRoutes;
