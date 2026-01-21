const nodemailer = require('nodemailer');
const logger = require('../config/logger');

class EmailService {
    constructor() {
        this.transporter = null;
        this.init();
    }

    async init() {
        try {
            // Create a test account if in development
            // In production, use environment variables
            if (process.env.NODE_ENV === 'production') {
                this.transporter = nodemailer.createTransport({
                    host: process.env.SMTP_HOST,
                    port: process.env.SMTP_PORT,
                    secure: true,
                    auth: {
                        user: process.env.SMTP_USER,
                        pass: process.env.SMTP_PASS,
                    },
                });
            } else {
                // Generate test SMTP service account from ethereal.email
                const testAccount = await nodemailer.createTestAccount();

                this.transporter = nodemailer.createTransport({
                    host: 'smtp.ethereal.email',
                    port: 587,
                    secure: false,
                    auth: {
                        user: testAccount.user, // generated ethereal user
                        pass: testAccount.pass, // generated ethereal password
                    },
                });

                logger.info('📧 Email Service initialized with Ethereal (Dev Mode)');
                logger.info(`📧 Preview URL base: https://ethereal.email/message/`);
            }
        } catch (error) {
            logger.error('Failed to initialize Email Service', error);
        }
    }

    async sendEmail(to, subject, html) {
        if (!this.transporter) await this.init();

        try {
            const info = await this.transporter.sendMail({
                from: '"Student Wallet" <no-reply@studentwallet.com>',
                to,
                subject,
                html,
            });

            logger.info(`Message sent: ${info.messageId}`);

            // Preview only available when sending through an Ethereal account
            const previewUrl = nodemailer.getTestMessageUrl(info);
            if (previewUrl) {
                logger.info(`📧 Preview URL: ${previewUrl}`);
                console.log(`\n📧 EMAIL PREVIEW: ${previewUrl}\n`);
            }

            return info;
        } catch (error) {
            logger.error('Error sending email', error);
            throw error;
        }
    }

    async sendVerificationEmail(email, token) {
        const verifyUrl = `http://localhost:3000/verify.html?token=${token}`;
        const html = `
            <h1>Bienvenue sur Student Wallet !</h1>
            <p>Merci de cliquer sur le lien ci-dessous pour vérifier votre compte :</p>
            <a href="${verifyUrl}" style="background: #667eea; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Vérifier mon email</a>
            <p>Si le bouton ne fonctionne pas, copiez ce lien : ${verifyUrl}</p>
        `;
        return this.sendEmail(email, 'Vérification de votre compte', html);
    }
}

module.exports = new EmailService();
