/**
 * Entité de domaine : Alerte de fraude
 * Représente une anomalie détectée lors de l'analyse d'une transaction.
 */

const RISK_LEVEL = {
    LOW: 'LOW',       // Scoring info, pas de blocage
    MEDIUM: 'MEDIUM', // À surveiller, log + notification
    HIGH: 'HIGH',     // Transaction bloquée
    CRITICAL: 'CRITICAL' // Blocage + signalement AML
};

const FRAUD_RULE = {
    // Anomalies de solde
    NEGATIVE_BALANCE:        'NEGATIVE_BALANCE',
    INSUFFICIENT_FUNDS_BYPASS: 'INSUFFICIENT_FUNDS_BYPASS',

    // Velocity (rapidité / fréquence)
    HIGH_FREQUENCY:          'HIGH_FREQUENCY',
    DAILY_LIMIT_EXCEEDED:    'DAILY_LIMIT_EXCEEDED',
    LARGE_SINGLE_AMOUNT:     'LARGE_SINGLE_AMOUNT',

    // Blanchiment / structuring
    STRUCTURING:             'STRUCTURING',   // Fragmentation en petits montants
    CIRCULAR_TRANSFER:       'CIRCULAR_TRANSFER', // A→B→A boucle
    ROUND_AMOUNT_PATTERN:    'ROUND_AMOUNT_PATTERN', // Montants toujours ronds

    // Autres
    SELF_TRANSFER:           'SELF_TRANSFER', // Même source/destination
    DORMANT_ACCOUNT_SPIKE:   'DORMANT_ACCOUNT_SPIKE', // Compte inactif soudainement actif
};

class FraudAlert {
    /**
     * @param {object} params
     * @param {string} params.rule        - Code de la règle violée (FRAUD_RULE)
     * @param {string} params.riskLevel   - Niveau de risque (RISK_LEVEL)
     * @param {string} params.message     - Description lisible
     * @param {object} [params.metadata]  - Données contextuelles (montants, fréquences…)
     */
    constructor({ rule, riskLevel, message, metadata = {} }) {
        this.rule = rule;
        this.riskLevel = riskLevel;
        this.message = message;
        this.metadata = metadata;
        this.detectedAt = new Date().toISOString();
    }

    isBlocking() {
        return this.riskLevel === RISK_LEVEL.HIGH || this.riskLevel === RISK_LEVEL.CRITICAL;
    }

    isCritical() {
        return this.riskLevel === RISK_LEVEL.CRITICAL;
    }

    toJSON() {
        return {
            rule:       this.rule,
            riskLevel:  this.riskLevel,
            message:    this.message,
            metadata:   this.metadata,
            detectedAt: this.detectedAt,
        };
    }
}

module.exports = { FraudAlert, FRAUD_RULE, RISK_LEVEL };
