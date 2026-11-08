import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../db/prisma.js';

export interface AuthenticatedUser {
  id: string;
  phone: string;
  name: string;
  role: string;
  retailer?: {
    id: string;
    shopName: string;
    creditLimit: number;
    creditUsed: number;
  } | null;
  salesman?: {
    id: string;
    name: string;
    phone: string;
    territory: string;
  } | null;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_fmcg_distributor_jabalpur_2026';

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Please login.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };

    const dbUser = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { retailer: true },
    });

    if (!dbUser) {
      return res.status(401).json({ error: 'User session invalid. Please login again.' });
    }

    req.user = {
      id: dbUser.id,
      phone: dbUser.phone,
      name: dbUser.name,
      role: dbUser.role,
      retailer: dbUser.retailer
        ? {
            id: dbUser.retailer.id,
            shopName: dbUser.retailer.shopName,
            creditLimit: dbUser.retailer.creditLimit,
            creditUsed: dbUser.retailer.creditUsed,
          }
        : null,
    };

    next();
  } catch {
    return res.status(401).json({ error: 'Session expired or invalid token.' });
  }
}

export function requireDeskRole(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'DESK') {
    return res.status(403).json({ error: 'Access denied: Desk role required for this action.' });
  }
  next();
}
