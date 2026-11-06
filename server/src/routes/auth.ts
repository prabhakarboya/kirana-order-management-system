import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { dbStore } from '../db/store.js';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'kirana_fmcg_distributor_jabalpur_secret_key_2026_xyz';
const OTP_DEMO_CODE = process.env.OTP_DEMO_CODE || '123456';

// Send OTP (Mock - fixed code 123456 for instant testing)
router.post('/send-otp', (req: Request, res: Response) => {
  const { phone } = req.body;
  if (!phone || typeof phone !== 'string' || phone.length < 10) {
    return res.status(400).json({ error: 'Valid 10-digit mobile number required.' });
  }

  // Find user or allow registration as new retailer
  let user = dbStore.users.find((u) => u.phone === phone);
  if (!user) {
    user = {
      id: `USR-${Date.now()}`,
      phone,
      name: `Retailer ${phone.slice(-4)}`,
      role: 'RETAILER',
      retailerId: `RET-${Date.now()}`,
    };
    dbStore.users.push(user);
    dbStore.retailers.push({
      id: user.retailerId!,
      userId: user.id,
      shopName: `New Kirana Store (${phone.slice(-4)})`,
      ownerName: `Retailer ${phone.slice(-4)}`,
      phone,
      address: 'Jabalpur, Madhya Pradesh',
      creditLimit: 50000,
      creditUsed: 0,
      salesmanName: 'Rajesh Sharma',
    });
  }

  return res.json({
    success: true,
    message: `OTP sent successfully to +91 ${phone}`,
    demoCode: OTP_DEMO_CODE,
  });
});

// Verify OTP
router.post('/verify-otp', (req: Request, res: Response) => {
  const { phone, code } = req.body;

  if (code !== OTP_DEMO_CODE && code !== '123456') {
    return res.status(400).json({ error: 'Invalid OTP. Please enter 123456 for demo login.' });
  }

  const user = dbStore.users.find((u) => u.phone === phone);
  if (!user) {
    return res.status(404).json({ error: 'User not registered for this phone number.' });
  }

  const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  const retailer = user.retailerId ? dbStore.getRetailer(user.retailerId) : undefined;

  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return res.json({
    success: true,
    token,
    user: {
      id: user.id,
      phone: user.phone,
      name: user.name,
      role: user.role,
      retailer,
    },
  });
});

// Demo account instant switch (Retailer vs Desk)
router.post('/demo-switch', (req: Request, res: Response) => {
  const { role } = req.body; // 'RETAILER' or 'DESK'
  const targetUser =
    role === 'DESK'
      ? dbStore.users.find((u) => u.role === 'DESK')
      : dbStore.users.find((u) => u.id === 'USR-RET-1');

  if (!targetUser) {
    return res.status(404).json({ error: 'Target demo account not found.' });
  }

  const token = jwt.sign({ userId: targetUser.id, role: targetUser.role }, JWT_SECRET, { expiresIn: '7d' });
  const retailer = targetUser.retailerId ? dbStore.getRetailer(targetUser.retailerId) : undefined;

  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return res.json({
    success: true,
    token,
    user: {
      id: targetUser.id,
      phone: targetUser.phone,
      name: targetUser.name,
      role: targetUser.role,
      retailer,
    },
  });
});

// Current session
router.get('/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const retailer = user.retailerId ? dbStore.getRetailer(user.retailerId) : undefined;

  return res.json({
    user: {
      id: user.id,
      phone: user.phone,
      name: user.name,
      role: user.role,
      retailer,
    },
  });
});

// Logout
router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('token');
  return res.json({ success: true, message: 'Logged out successfully.' });
});

export default router;
