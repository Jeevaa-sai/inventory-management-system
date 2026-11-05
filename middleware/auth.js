const crypto = require("crypto");

/**
 * Authentication Middleware:
 * Checks if a valid user session exists. Returns 401 if not authenticated.
 */
function requireAuth(req, res, next) {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ message: "Authentication required. Please log in." });
    }
    next();
}

/**
 * Role-Based Access Control (RBAC) Middleware:
 * Checks if the authenticated user has one of the allowed roles.
 * Returns 403 Forbidden if the role is insufficient.
 */
function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.session || !req.session.user) {
            return res.status(401).json({ message: "Authentication required. Please log in." });
        }
        if (!allowedRoles.includes(req.session.user.role)) {
            return res.status(403).json({
                message: `Forbidden. Action requires role: ${allowedRoles.join(" or ")}. Your role is: ${req.session.user.role}.`
            });
        }
        next();
    };
}

/**
 * CSRF Protection Middleware:
 * Protects state-changing HTTP requests (POST, PUT, DELETE, PATCH).
 * The client must send the CSRF token in the 'x-csrf-token' header.
 */
function csrfProtection(req, res, next) {
    const safeMethods = ["GET", "HEAD", "OPTIONS"];
    if (safeMethods.includes(req.method)) {
        return next();
    }

    // Bypass CSRF for public login and init endpoints
    const openEndpoints = ["/api/auth/login", "/api/auth/init", "/api/products/seed"];
    if (openEndpoints.some(path => req.path.startsWith(path))) {
        return next();
    }

    if (!req.session) {
        return res.status(401).json({ message: "Session expired or missing." });
    }

    const clientToken = req.headers["x-csrf-token"] || req.headers["csrf-token"];
    if (!clientToken || clientToken !== req.session.csrfToken) {
        return res.status(403).json({ message: "Invalid or missing CSRF token. Please refresh your session." });
    }

    next();
}

/**
 * Helper to generate or retrieve the session CSRF token
 */
function getOrCreateCsrfToken(req) {
    if (!req.session.csrfToken) {
        req.session.csrfToken = crypto.randomBytes(24).toString("hex");
    }
    return req.session.csrfToken;
}

module.exports = {
    requireAuth,
    requireRole,
    csrfProtection,
    getOrCreateCsrfToken
};

