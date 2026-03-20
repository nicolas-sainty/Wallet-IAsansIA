const express = require('express');
const { requireAuth } = require('../../../../../middleware/auth.middleware');

function createEventRoutes(eventController) {
    const router = express.Router();

    router.get('/', (req, res) => eventController.getAll(req, res));
    router.post('/', requireAuth, (req, res) => eventController.create(req, res));
    router.get('/pending', requireAuth, (req, res) => eventController.getPending(req, res));
    router.post('/participate/:id', requireAuth, (req, res) => eventController.participate(req, res)); // Corrected param order if needed
    router.post('/:id/participate', requireAuth, (req, res) => eventController.participate(req, res));
    router.get('/:id/participants', requireAuth, (req, res) => eventController.getParticipants(req, res));
    router.post('/participants/:id/validate', requireAuth, (req, res) => eventController.validate(req, res));

    return router;
}

module.exports = createEventRoutes;
