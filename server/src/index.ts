import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import dotenv from 'dotenv';
import path from 'path';

import { prisma } from './db/prisma.js';
import { seedDatabase } from './seed.js';

import authRoutes from './routes/auth.js';
import catalogRoutes from './routes/catalog.js';
import orderRoutes from './routes/orders.js';
import aiRoutes from './routes/ai.js';
import deskRoutes from './routes/desk.js';
import salesmanRoutes from './routes/salesman.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

// 1. Remove identifying server header
app.disable('x-powered-by');

// 2. Security Headers Middleware
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

// 3. Official Gzip Compression Middleware
app.use(compression());

app.use(
  cors({
    origin: CLIENT_ORIGIN,
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/catalog', catalogRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/desk', deskRoutes);
app.use('/api/salesman', salesmanRoutes);

// Health check endpoint
app.get('/api/health', async (_req, res) => {
  try {
    const skuCount = await prisma.sku.count();
    res.json({
      status: 'ok',
      database: 'connected',
      skuCount,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// Auto-seed if database is empty on start
async function startServer() {
  try {
    const skuCount = await prisma.sku.count();
    if (skuCount === 0) {
      console.log('Database empty. Running initial seed...');
      await seedDatabase();
    }
  } catch (err) {
    console.warn('Initial seed check error:', err);
  }

  app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(` FMCG Kirana Distributor Server (Company A, Jabalpur) `);
    console.log(` Running on: http://localhost:${PORT}`);
    console.log(` API Health: http://localhost:${PORT}/api/health`);
    console.log(`=======================================================`);
  });
}

startServer();
