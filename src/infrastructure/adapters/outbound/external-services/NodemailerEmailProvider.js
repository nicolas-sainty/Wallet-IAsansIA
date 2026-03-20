const emailService = require('../../../../services/email.service');

/**
 * Adaptateur pour l'envoi d'emails utilisant le service existant (Nodemailer)
 */
class NodemailerEmailProvider {
    async sendVerificationEmail(email, token) {
        // Délègue au service existant pour l'instant
        return emailService.sendVerificationEmail(email, token);
    }
}

module.exports = NodemailerEmailProvider;
