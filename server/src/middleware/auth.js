const jwt = require("jsonwebtoken");

function requireAuth(req, res, next) {
    const token = req.cookies.token;
    if (!token) {
        return res.status(401).json({ erreur: "Non connecté." });
    }
    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = payload.userId;
        next();
    } catch {
        return res.status(401).json({ erreur: "Session invalide ou expirée." });
    }
}

module.exports = requireAuth;
