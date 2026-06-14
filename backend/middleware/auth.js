const jwt = require('jsonwebtoken');

const getTokenFromRequest = (req) => {
  const authHeader =
    req.headers['authorization'] ||
    req.headers['Authorization'] ||
    req.headers['x-access-token'] ||
    req.headers['x-authorization'];

  if (authHeader) {
    return authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : authHeader;
  }

  if (req.query && req.query.token) {
    return req.query.token;
  }

  return null;
};

const authenticateToken = (req, res, next) => {
  const token = getTokenFromRequest(req);

  if (!token) {
    console.log('❌ Authentication token required; no token found.', {
      authorization: req.headers['authorization'],
      xAccessToken: req.headers['x-access-token'],
      xAuthorization: req.headers['x-authorization'],
      queryToken: req.query?.token,
    });
    return res.status(401).json({ message: 'Authentication token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    console.error('❌ Invalid or expired token:', {
      token: token && token.slice(0, 20) + '...',
      error: error.message,
    });
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
};

module.exports = { authenticateToken };
