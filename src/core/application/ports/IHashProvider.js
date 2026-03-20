/**
 * Interface pour le hachage des mots de passe
 */
class IHashProvider {
    async hash(payload) { throw new Error('Method not implemented'); }
    async compare(payload, hashed) { throw new Error('Method not implemented'); }
}

module.exports = IHashProvider;
