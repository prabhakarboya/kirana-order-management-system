import { Router, Response } from 'express';
import { dbStore } from '../db/store.js';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth.js';
import { parseOrderMessage } from '../ai/parser.js';

const router = Router();

// AI Order Capture parse endpoint
router.post('/parse-order', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { rawText } = req.body;

  if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
    return res.status(400).json({ error: 'Text message is required for order capture.' });
  }

  const user = req.user!;
  const retailerId = user.retailerId || null;

  // Filter aliases relevant to this retailer (global + specific)
  const applicableAliases = dbStore.aliases.filter(
    (a) => a.retailerId === null || a.retailerId === retailerId
  );

  try {
    const parseResult = await parseOrderMessage(rawText, dbStore.catalog, applicableAliases);
    return res.json(parseResult);
  } catch (err: any) {
    return res.status(500).json({
      error: 'Failed to process AI order capture.',
      details: err.message,
    });
  }
});

// Learn alias from desk correction or user feedback
router.post('/learn-alias', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { phrase, skuCode, retailerId } = req.body;

  if (!phrase || !skuCode) {
    return res.status(400).json({ error: 'Phrase and skuCode are required.' });
  }

  const user = req.user!;
  const targetRetailerId = retailerId || user.retailerId || null;

  const sku = dbStore.getSku(skuCode);
  if (!sku) {
    return res.status(400).json({ error: `SKU ${skuCode} does not exist.` });
  }

  const savedAlias = dbStore.addAlias(targetRetailerId, phrase, skuCode);

  return res.json({
    success: true,
    alias: savedAlias,
    message: `Learned alias "${phrase}" -> ${sku.name}. Future orders will map automatically.`,
  });
});

export default router;
