'use strict';

/**
 * Contrôleur Express : Transferts inter-campus
 * Expose POST /intercampus-send et POST /intercampus-receive
 * en alignement avec le standard EpiPay.
 */
class IntercampusController {
    /**
     * @param {object} sendIntercampusUseCase    - SendIntercampus
     * @param {object} receiveIntercampusUseCase - ReceiveIntercampus
     */
    constructor(sendIntercampusUseCase, receiveIntercampusUseCase) {
        this.sendUseCase    = sendIntercampusUseCase;
        this.receiveUseCase = receiveIntercampusUseCase;
    }

    /**
     * POST /intercampus-send
     * Envoie des EpiCoins vers un campus partenaire.
     *
     * Body attendu (conforme EpiPay swagger) :
     * {
     *   source_wallet_id, destination_wallet_id,
     *   destination_campus_api_url, amount,
     *   currency?, description?, enriched_data?, api_key
     * }
     */
    async send(req, res) {
        try {
            const {
                source_wallet_id,
                destination_wallet_id,
                destination_campus_api_url,
                amount,
                currency        = 'EPC',
                description,
                enriched_data   = {},
                api_key,
            } = req.body;

            // Validation basique
            if (!source_wallet_id)            return res.status(400).json({ success: false, message: 'source_wallet_id requis' });
            if (!destination_wallet_id)       return res.status(400).json({ success: false, message: 'destination_wallet_id requis' });
            if (!destination_campus_api_url)  return res.status(400).json({ success: false, message: 'destination_campus_api_url requis' });
            if (!amount || amount < 1)        return res.status(400).json({ success: false, message: 'amount doit être >= 1 EPC' });
            if (!api_key)                     return res.status(400).json({ success: false, message: 'api_key requis pour l\'authentification inter-campus' });

            const result = await this.sendUseCase.execute({
                initiatorUserId:          req.user.user_id,
                sourceWalletId:           source_wallet_id,
                destinationWalletId:      destination_wallet_id,
                destinationCampusApiUrl:  destination_campus_api_url,
                amount:                   parseFloat(amount),
                currency,
                description,
                enrichedData:             enriched_data,
                apiKey:                   api_key,
            });

            return res.status(200).json(result);

        } catch (error) {
            const statusCode = error.code === 'FRAUD_AML_FLAGGED' || error.code === 'FRAUD_TRANSACTION_BLOCKED' ? 403 : 400;
            return res.status(statusCode).json({
                success: false,
                status:  error.code === 'FRAUD_AML_FLAGGED' ? 'blocked' : 'failed',
                message: error.message,
                ...(error.fraudAlerts ? { fraud_alerts: error.fraudAlerts } : {}),
            });
        }
    }

    /**
     * POST /intercampus-receive
     * Reçoit un crédit depuis un campus partenaire.
     *
     * Body attendu (conforme EpiPay swagger) :
     * {
     *   transaction_id, source_wallet_id, destination_wallet_id,
     *   amount, currency?, initiator_user_id?,
     *   api_key, source_campus_id, enriched_data?
     * }
     *
     * NB: Pas de requireAuth ici — authentification via api_key SHA-256
     */
    async receive(req, res) {
        try {
            const {
                transaction_id,
                source_wallet_id,
                destination_wallet_id,
                amount,
                currency            = 'EPC',
                initiator_user_id   = null,
                api_key,
                source_campus_id,
                enriched_data       = {},
            } = req.body;

            // Validation basique
            if (!transaction_id)          return res.status(400).json({ success: false, status: 'failed', message: 'transaction_id requis' });
            if (!source_wallet_id)        return res.status(400).json({ success: false, status: 'failed', message: 'source_wallet_id requis' });
            if (!destination_wallet_id)   return res.status(400).json({ success: false, status: 'failed', message: 'destination_wallet_id requis' });
            if (!amount || amount < 1)    return res.status(400).json({ success: false, status: 'failed', message: 'amount doit être >= 1 EPC' });
            if (!api_key)                 return res.status(401).json({ success: false, status: 'unauthorized', message: 'api_key requis' });
            if (!source_campus_id)        return res.status(400).json({ success: false, status: 'failed', message: 'source_campus_id requis' });

            const result = await this.receiveUseCase.execute({
                transactionId:        transaction_id,
                sourceWalletId:       source_wallet_id,
                destinationWalletId:  destination_wallet_id,
                amount:               parseFloat(amount),
                currency,
                initiatorUserId:      initiator_user_id,
                apiKey:               api_key,
                sourceCampusId:       source_campus_id,
                enrichedData:         enriched_data,
            });

            // Mapper le statut HTTP selon la réponse (conforme EpiPay)
            if (result.status === 'unauthorized') return res.status(401).json(result);
            if (result.status === 'blocked')      return res.status(403).json(result);
            if (result.status === 'failed')       return res.status(422).json(result);

            return res.status(200).json(result);

        } catch (error) {
            return res.status(500).json({
                success: false,
                status:  'failed',
                message: `Erreur interne lors de la réception inter-campus : ${error.message}`,
            });
        }
    }
}

module.exports = IntercampusController;
