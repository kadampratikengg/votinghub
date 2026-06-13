const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  const authHeader =
    req.headers['authorization'] ||
    req.headers['Authorization'] ||
    req.headers['x-access-token'] ||
    req.headers['x-authorization'];

  const token = authHeader
    ? authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : authHeader
    : null;

  if (!token) {
    console.log('❌ No token provided; headers:', {
      authorization: req.headers['authorization'],
      xAccessToken: req.headers['x-access-token'],
      xAuthorization: req.headers['x-authorization'],
    });
    return res.status(401).json({ message: 'Authentication token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Expected token payload: { userId, role, subUserId? }
    req.user = decoded; // Attach decoded payload to request
    next();
  } catch (error) {
    console.error('❌ Invalid token:', error);
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
};

module.exports = { authenticateToken };
