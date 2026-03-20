const bcrypt = require('bcrypt');

/**
 * Implémentation de IHashProvider utilisant BCrypt
 */
class BCryptHashProvider {
    constructor(saltRounds = 10) {
        this.saltRounds = saltRounds;
    }

    async hash(payload) {
        return bcrypt.hash(payload, this.saltRounds);
    }

    async compare(payload, hashed) {
        return bcrypt.compare(payload, hashed);
    }
}

module.exports = BCryptHashProvider;
