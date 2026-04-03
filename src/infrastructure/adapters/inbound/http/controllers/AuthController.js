/**
 * Contrôleur Express pour l'authentification (Architecture Hexagonale)
 */
class AuthController {
    constructor(registerUserUseCase, loginUserUseCase, verifyEmailUseCase, refreshTokenUseCase, registerBDEUseCase, createMemberAccessUseCase) {
        this.registerUserUseCase = registerUserUseCase;
        this.loginUserUseCase = loginUserUseCase;
        this.verifyEmailUseCase = verifyEmailUseCase;
        this.refreshTokenUseCase = refreshTokenUseCase;
        this.registerBDEUseCase = registerBDEUseCase;
        this.createMemberAccessUseCase = createMemberAccessUseCase;
    }

    async register(req, res) {
        try {
            const { email, password, fullName, role } = req.body;
            const result = await this.registerUserUseCase.execute({ email, password, fullName, role });
            return res.status(201).json({ success: true, user: result });
        } catch (error) {
            return res.status(400).json({ success: false, error: error.message });
        }
    }

    async login(req, res) {
        try {
            const { email, password } = req.body;
            const result = await this.loginUserUseCase.execute({ email, password });
            
            // Set refresh token cookie if successful
            res.cookie('refresh_token', result.refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
            });

            // Map user back to snake_case for frontend compatibility
            const userData = {
                user_id: result.user.userId,
                email: result.user.email,
                full_name: result.user.fullName,
                role: result.user.role,
                bde_id: result.user.bde_id
            };

            return res.json({
                success: true,
                token: result.token,
                refreshToken: result.refreshToken,
                user: userData
            });
        } catch (error) {
            return res.status(401).json({ success: false, error: error.message });
        }
    }

    async verify(req, res) {
        try {
            const { token } = req.query;
            await this.verifyEmailUseCase.execute(token);
            return res.json({ success: true, message: 'Email vérifié avec succès' });
        } catch (error) {
            return res.status(400).json({ success: false, error: error.message });
        }
    }

    async refresh(req, res) {
        try {
            const refreshToken = req.cookies?.refresh_token || req.body.refreshToken;
            if (!refreshToken) throw new Error('Token de rafraîchissement manquant');

            const result = await this.refreshTokenUseCase.execute(refreshToken);
            return res.json({ success: true, token: result.token });
        } catch (error) {
            return res.status(401).json({ success: false, error: error.message });
        }
    }
    async registerBDE(req, res) {
        try {
            const { bdeName, email, password, fullName } = req.body;
            const result = await this.registerBDEUseCase.execute({ bdeName, email, password, fullName });
            return res.status(201).json({ success: true, ...result });
        } catch (error) {
            return res.status(400).json({ success: false, error: error.message });
        }
    }

    async createMember(req, res) {
        try {
            const { email, fullName, password } = req.body;
            const bdeId = req.user.bde_id || req.user.bdeId; // Injecté par le middleware d'auth
            const adminUserId = req.user.userId;

            if (req.user.role !== 'bde_admin') {
                return res.status(403).json({ success: false, error: 'Seul un BDE peut créer des accès membres' });
            }

            const result = await this.createMemberAccessUseCase.execute({ email, fullName, password, bdeId, adminUserId });
            return res.status(201).json({ success: true, ...result });
        } catch (error) {
            return res.status(400).json({ success: false, error: error.message });
        }
    }
}

module.exports = AuthController;
