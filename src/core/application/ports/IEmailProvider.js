/**
 * Interface pour le service d'envoi d'emails
 */
class IEmailProvider {
    async sendVerificationEmail(email, token) { throw new Error('Method not implemented'); }
}

module.exports = IEmailProvider;
