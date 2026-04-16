'use strict';

const https = require('https');
const http  = require('http');
const { URL } = require('url');

/**
 * Adapteur HTTP natif (Node.js https/http) pour les appels inter-campus.
 * Aucune dépendance externe — utilise les modules natifs Node 18+.
 *
 * Implémente IIntercampusHttpClient.
 */
class NativeIntercampusHttpClient {
    /**
     * @param {object} [options]
     * @param {number} [options.timeoutMs]  - Timeout par défaut en ms (défaut: 10 000)
     * @param {object} logger
     */
    constructor(options = {}, logger) {
        this.timeoutMs = options.timeoutMs || 10_000;
        this.logger    = logger || console;
    }

    /**
     * POST /intercampus-receive sur le campus distant.
     *
     * @param {string} destinationApiUrl - URL de base (ex: https://campus-xyz.supabase.co/functions/v1)
     * @param {object} payload
     * @returns {Promise<{ success: boolean, status: string, message: string, transaction_id: string }>}
     */
    async sendToRemoteCampus(destinationApiUrl, payload) {
        const targetUrl = new URL('/intercampus-receive', destinationApiUrl);
        const body      = JSON.stringify(payload);

        this.logger.info('Appel inter-campus sortant', {
            url:    targetUrl.toString(),
            amount: payload.amount,
        });

        return new Promise((resolve, reject) => {
            const protocol = targetUrl.protocol === 'https:' ? https : http;

            const options = {
                hostname: targetUrl.hostname,
                port:     targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80),
                path:     targetUrl.pathname,
                method:   'POST',
                headers:  {
                    'Content-Type':   'application/json',
                    'Content-Length': Buffer.byteLength(body),
                    'User-Agent':     'EpiCoin-Intercampus/1.0 (groupe_2_BDX)',
                },
                timeout: this.timeoutMs,
            };

            const req = protocol.request(options, (res) => {
                let data = '';

                res.on('data', (chunk) => { data += chunk; });

                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);

                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            resolve(parsed);
                        } else {
                            reject(new Error(
                                `Campus distant a répondu ${res.statusCode}: ${parsed.message || data}`
                            ));
                        }
                    } catch {
                        reject(new Error(`Réponse non-JSON du campus distant (HTTP ${res.statusCode}): ${data}`));
                    }
                });
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new Error(`Timeout (${this.timeoutMs}ms) lors de l'appel au campus distant`));
            });

            req.on('error', (err) => {
                reject(new Error(`Erreur réseau vers le campus distant : ${err.message}`));
            });

            req.write(body);
            req.end();
        });
    }
}

module.exports = NativeIntercampusHttpClient;
