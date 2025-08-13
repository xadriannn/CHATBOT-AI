import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

const SECRET_KEY = process.env.JWT_SECRET || 'secret';

export function generateToken(payload) {
  return jwt.sign(payload, SECRET_KEY, { expiresIn: '1h' });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET_KEY);
  } catch {
    return null;
  }
}
