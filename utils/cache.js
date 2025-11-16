// utils/cache.js

const NodeCache = require("node-cache");

// Default TTL = 60 seconds
const cache = new NodeCache({
    stdTTL: 60,        // default time-to-live for items
    checkperiod: 120,  // auto-delete interval
});

/**
 * Cache middleware for GET routes.
 * Automatically:
 *  - creates a cache key
 *  - returns cached response if available
 *  - sets Cache-Control header
 *  - caches the outgoing JSON response
 *
 * @param {Function} keyBuilder - function that receives req and returns unique key
 * @param {number} ttl - time to cache in seconds
 */
function cacheMiddleware(keyBuilder, ttl = 60) {
    return (req, res, next) => {
        const key = keyBuilder(req);

        // If cached → return instantly
        const cached = cache.get(key);
        if (cached) {
            res.set("Cache-Control", `public, max-age=${ttl}`);
            return res.json(cached);
        }

        // Monkey-patch res.json to store the response
        const originalJson = res.json.bind(res);

        res.json = (body) => {
            cache.set(key, body, ttl);
            res.set("Cache-Control", `public, max-age=${ttl}`);
            return originalJson(body);
        };

        next();
    };
}

module.exports = {
    cache,
    cacheMiddleware
};
