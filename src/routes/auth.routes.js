const express = require('express');
const { body, query } = require('express-validator');
const authService = require('../services/auth.service');
const jwt = require('jsonwebtoken');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key_change_me';

// Middleware to verify JWT (can be moved to separate file)
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

router.post(
    '/register',
    [
        body('email').isEmail(),
        body('password').isLength({ min: 6 }),
        body('fullName').notEmpty()
    ],
    async (req, res) => {
        try {
            const { email, password, fullName, role } = req.body;
            const result = await authService.register(email, password, fullName, role);
            res.status(201).json(result);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
);

router.post(
    '/login',
    [
        body('email').isEmail(),
        body('password').exists()
    ],
    async (req, res) => {
        try {
            const { email, password } = req.body;
            const result = await authService.login(email, password);
            res.json(result);
        } catch (error) {
            res.status(401).json({ error: error.message });
        }
    }
);

router.get(
    '/verify-email',
    [query('token').notEmpty()],
    async (req, res) => {
        try {
            const { token } = req.query;
            const result = await authService.verifyEmail(token);
            res.json(result);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
);

router.get('/me', authenticateToken, async (req, res) => {
    try {
        const user = await authService.getUserById(req.user.userId);
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
