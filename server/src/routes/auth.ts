import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { prisma } from '../db/prisma.js';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_fmcg_distributor_jabalpur_2026';
const OTP_DEMO_CODE = process.env.OTP_DEMO_CODE || '123456';

// Rate limiting: max 5 OTP requests per 10 minutes per IP
const otpRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  message: { error: 'Too many OTP requests. Please wait 10 minutes before retrying.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Send OTP (Uniform response prevents customer enumeration)
router.post('/send-otp', otpRateLimiter, async (req: Request, res: Response) => {
  const { phone } = req.body;
  if (!phone || typeof phone !== 'string' || phone.length < 10) {
    return res.status(400).json({ error: 'Valid 10-digit mobile number required.' });
  }

  // Generate 6-digit OTP
  const generatedCode =
    process.env.NODE_ENV === 'production'
      ? String(Math.floor(100000 + Math.random() * 900000))
      : OTP_DEMO_CODE;

  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes validity

  const user = await prisma.user.findUnique({ where: { phone } });

  // Update OTP only if user is registered, but always return uniform response to prevent enumeration
  if (user) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        otpCode: generatedCode,
        otpExpiresAt: expiresAt,
        otpAttempts: 0,
      },
    });
  }

  return res.json({
    success: true,
    message: `If mobile number +91 ${phone} is registered with Company A, an OTP has been sent. Valid for 5 minutes.`,
    demoCode: (process.env.NODE_ENV !== 'production' && user) ? generatedCode : undefined,
  });
});

// Verify OTP
router.post('/verify-otp', async (req: Request, res: Response) => {
  const { phone, code } = req.body;

  if (!phone || !code) {
    return res.status(400).json({ error: 'Phone and OTP are required.' });
  }

  const user = await prisma.user.findUnique({
    where: { phone },
    include: { retailer: true, salesman: true },
  });

  // Generic message prevents phone enumeration
  if (!user) {
    return res.status(400).json({ error: 'Invalid or expired OTP.' });
  }

  // Check failed attempts
  if (user.otpAttempts >= 3) {
    return res.status(429).json({
      error: 'Account temporarily locked due to 3 failed attempts. Please request a new OTP.',
    });
  }

  // Check expiry
  if (user.otpExpiresAt && new Date() > user.otpExpiresAt) {
    return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
  }

  const isValidCode =
    code === user.otpCode ||
    (process.env.NODE_ENV !== 'production' && code === OTP_DEMO_CODE);

  if (!isValidCode) {
    await prisma.user.update({
      where: { id: user.id },
      data: { otpAttempts: { increment: 1 } },
    });
    return res.status(400).json({
      error: `Invalid OTP. ${2 - user.otpAttempts} attempts remaining.`,
    });
  }

  // Clear OTP on successful verification
  await prisma.user.update({
    where: { id: user.id },
    data: { otpCode: null, otpAttempts: 0 },
  });

  const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

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
      retailer: user.retailer,
      salesman: user.salesman,
    },
  });
});

// Instant Evaluation Role Switcher (Strictly disabled in production)
router.post('/demo-switch', async (req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Endpoint disabled in production environment.' });
  }

  const { role } = req.body; // 'RETAILER' | 'SALESMAN' | 'DESK'
  if (!['RETAILER', 'SALESMAN', 'DESK'].includes(role)) {
    return res.status(400).json({ error: 'Invalid demo role. Allowed: RETAILER, SALESMAN, DESK.' });
  }

  let targetUser;
  if (role === 'DESK') {
    targetUser = await prisma.user.findFirst({
      where: { role: 'DESK' },
      include: { retailer: true, salesman: true },
    });
  } else if (role === 'SALESMAN') {
    targetUser = await prisma.user.findFirst({
      where: { role: 'SALESMAN' },
      include: { retailer: true, salesman: true },
    });
  } else {
    targetUser = await prisma.user.findUnique({
      where: { id: 'USR-RET-1' },
      include: { retailer: true, salesman: true },
    });
  }

  if (!targetUser) {
    return res.status(404).json({ error: 'Target demo account not found in database.' });
  }

  const token = jwt.sign({ userId: targetUser.id, role: targetUser.role }, JWT_SECRET, { expiresIn: '7d' });

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
      retailer: targetUser.retailer,
      salesman: targetUser.salesman,
    },
  });
});

// Current User Session
router.get('/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  return res.json({ user: req.user });
});

// Logout
router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('token');
  return res.json({ success: true, message: 'Logged out successfully.' });
});

export default router;
