// utils/cache.js

const NodeCache = require("node-cache");

// Default TTL = 60 seconds
const cache = new NodeCache({
    stdTTL: 60,
    checkperiod: 120,
});

/**
 * Server-side cache middleware for GET routes.
 *
 * Important: authenticated JSON defaults to Cache-Control: no-store so the
 * browser does not reuse one student's response for another login on the same
 * device. NodeCache still avoids repeated DB work on the server.
 *
 * @param {Function} keyBuilder - receives req and returns a unique server cache key
 * @param {number} ttl - server cache time in seconds
 * @param {Object} options
 * @param {string} options.cacheControl - browser Cache-Control header
 */
function cacheMiddleware(keyBuilder, ttl = 60, options = {}) {
    const cacheControl = options.cacheControl || "no-store";

    return (req, res, next) => {
        const key = keyBuilder(req);
        const cached = cache.get(key);

        if (cached) {
            res.set("Cache-Control", cacheControl);
            res.set("Vary", "Cookie");
            res.set("X-Cache", "HIT");
            return res.json(cached);
        }

        const originalJson = res.json.bind(res);

        res.json = (body) => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
                cache.set(key, body, ttl);
            }

            res.set("Cache-Control", cacheControl);
            res.set("Vary", "Cookie");
            res.set("X-Cache", "MISS");
            return originalJson(body);
        };

        next();
    };
}

function clearUserCache(tr) {
    if (!tr) return;

    [
        `ach_${tr}`,
        `wh_${tr}`,
        `fit_history_${tr}`,
        `planner_insights_${tr}`,
        `workout_${tr}`,
        `train_plans_${tr}`,
        `train_analytics_${tr}`,
        `workout_calendar_${tr}`,
        `analytics_overview_${tr}`,
        `analytics_history_${tr}`,
        `attendance_summary_${tr}`,
        `eligible_weeks_${tr}`,
        `leaves_${tr}`,
        `student_achievements_${tr}`
    ].forEach(key => cache.del(key));

    for (const key of cache.keys()) {
        if (key.startsWith(`attendance_${tr}_`)) {
            cache.del(key);
        }
    }
}

module.exports = {
    cache,
    cacheMiddleware,
    clearUserCache
};
