import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { dbStore, UserRecord } from '../db/store.js';

export interface AuthenticatedRequest extends Request {
  user?: UserRecord;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Please login.' });
  }

  try {
    const jwtSecret = process.env.JWT_SECRET || 'kirana_fmcg_distributor_jabalpur_secret_key_2026_xyz';
    const decoded = jwt.verify(token, jwtSecret) as { userId: string };
    const user = dbStore.users.find((u) => u.id === decoded.userId);

    if (!user) {
      return res.status(401).json({ error: 'User session invalid. Please login again.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Session expired or invalid token.' });
  }
}

export function requireDeskRole(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'DESK') {
    return res.status(403).json({ error: 'Access denied: Desk role required for this action.' });
  }
  next();
}
