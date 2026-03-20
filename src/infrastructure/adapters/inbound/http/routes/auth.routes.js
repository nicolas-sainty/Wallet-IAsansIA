const express = require('express');

/**
 * Configuration des routes d'authentification via injection de dépendances
 */
function createAuthRoutes(authController) {
    const router = express.Router();

    router.post('/register', (req, res) => authController.register(req, res));
    router.post('/login', (req, res) => authController.login(req, res));
    router.post('/refresh', (req, res) => authController.refresh(req, res));
    router.get('/verify', (req, res) => authController.verify(req, res));

    return router;
}

module.exports = createAuthRoutes;
