'use strict';

const express = require('express');
const { requireAuth } = require('../../../../../middleware/auth.middleware');

/**
 * Routes inter-campus — alignées avec le standard EpiPay v1.0.0
 *
 *  POST /intercampus-send    — Authentification JWT (utilisateur connecté)
 *  POST /intercampus-receive — Authentification par API key SHA-256 inter-campus
 */
function createIntercampusRoutes(intercampusController) {
    const router = express.Router();

    /**
     * POST /intercampus-send
     * Envoie des EpiCoins à un campus partenaire (EpiPay, etc.)
     * Requiert un JWT valide (l'utilisateur initie le transfert).
     */
    router.post('/intercampus-send', requireAuth, (req, res) =>
        intercampusController.send(req, res)
    );

    /**
     * POST /intercampus-receive
     * Reçoit des EpiCoins depuis un campus partenaire.
     * PAS de JWT — authentification via le champ `api_key` (hash SHA-256).
     * Ouvert publiquement mais sécurisé par la vérification de clé.
     */
    router.post('/intercampus-receive', (req, res) =>
        intercampusController.receive(req, res)
    );

    return router;
}

module.exports = createIntercampusRoutes;
