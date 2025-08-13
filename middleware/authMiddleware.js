// middleware/authenticate.js
import { verifyToken } from '../utils/token.js';

export function authenticate(req, res, next) {
  try {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    let token = null;

    // Cek Bearer token di Authorization header
    if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
    // Jika tidak ada, cek cookie (cookieParser harus sudah dipasang di server.js)
    else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }
    // Fallback: cek query param (berguna utk debugging)
    else if (req.query && req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      console.log('AUTH: no token. headers:', authHeader, 'cookies:', req.cookies);
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      console.log('AUTH: invalid/expired token');
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    req.user = decoded;
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    return res.status(500).json({ message: 'Server error in auth' });
  }
}
