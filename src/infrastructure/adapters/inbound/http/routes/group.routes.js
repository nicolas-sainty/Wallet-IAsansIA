const express = require('express');
const { requireAuth } = require('../../../../../middleware/auth.middleware');

function createGroupRoutes(groupController) {
    const router = express.Router();

    router.get('/', (req, res) => groupController.getAll(req, res));
    router.get('/:groupId', (req, res) => groupController.getById(req, res));
    router.post('/', requireAuth, (req, res) => groupController.create(req, res));

    return router;
}

module.exports = createGroupRoutes;
