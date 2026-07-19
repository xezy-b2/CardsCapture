function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Connecte-toi avec Discord pour faire ça.' });
  }
  next();
}

module.exports = { requireAuth };
