/**
 * Port (interface) : Client HTTP inter-campus
 * Abstraction pour l'appel vers le campus distant (injectable / testable)
 */
class IIntercampusHttpClient {
    /**
     * Appelle le endpoint /intercampus-receive du campus distant
     * pour créditer le wallet destinataire.
     *
     * @param {string} destinationApiUrl - URL de base du campus distant (ex: https://campus-xyz.supabase.co/functions/v1)
     * @param {object} payload           - Corps de la requête conforme au standard EpiPay
     * @returns {Promise<{ success: boolean, status: string, message: string, transaction_id: string }>}
     */
    async sendToRemoteCampus(destinationApiUrl, payload) {
        throw new Error('Method not implemented');
    }
}

module.exports = IIntercampusHttpClient;
