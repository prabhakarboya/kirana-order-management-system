import { Router, Response } from 'express';
import multer from 'multer';
import { prisma } from '../db/prisma.js';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth.js';
import {
  parseOrderMessage,
  parseHandwrittenPhotoOrder,
  parseAudioVoiceOrder,
  RetailerPastOrderSummary,
} from '../ai/parser.js';
import { SkuItem } from '../types.js';

const router = Router();
const upload = multer({
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB limit
  storage: multer.memoryStorage(),
});

// Helper: load catalog, aliases, and retailer's past purchase history from MySQL
async function getCatalogAndAliases(retailerId: string | null): Promise<{
  catalog: SkuItem[];
  aliases: Array<{ retailerId?: string | null; phrase: string; skuCode: string }>;
  pastOrders: RetailerPastOrderSummary[];
}> {
  const skus = await prisma.sku.findMany({
    where: { isActive: true },
  });

  const catalog: SkuItem[] = skus.map((s) => ({
    code: s.code,
    name: s.name,
    brand: s.brand,
    category: s.category,
    unitLabel: s.unitLabel,
    piecesPerCase: s.piecesPerCase,
    dealerPricePerPiece: s.dealerPrice,
    dealerPricePerCase: s.casePrice,
    gstIncluded: s.gstIncluded,
    gstRate: s.gstRate,
    stockCases: s.stockCases,
  }));

  const dbAliases = await prisma.alias.findMany({
    where: {
      OR: [
        { retailerId: null },
        ...(retailerId ? [{ retailerId }] : []),
      ],
    },
  });

  let pastOrders: RetailerPastOrderSummary[] = [];
  if (retailerId) {
    try {
      const pastRows = await (prisma as any).rawQuery(
        `SELECT ol.skuCode, s.name, COUNT(*) as frequency, CAST(SUM(ol.qtyCases) AS SIGNED) as totalCases
         FROM order_lines ol
         JOIN orders o ON ol.orderId = o.id
         JOIN skus s ON ol.skuCode = s.code
         WHERE o.retailerId = ?
         GROUP BY ol.skuCode, s.name
         ORDER BY frequency DESC LIMIT 10`,
        [retailerId]
      );
      if (Array.isArray(pastRows)) {
        pastOrders = pastRows.map((r: any) => ({
          skuCode: r.skuCode,
          name: r.name,
          frequency: Number(r.frequency) || 1,
          totalCases: Number(r.totalCases) || 0,
        }));
      }
    } catch (e) {
      console.warn('Could not load retailer past orders:', e);
    }
  }

  return { catalog, aliases: dbAliases, pastOrders };
}

// 1. Text Order Parsing (Hinglish/Hindi WhatsApp texts with retailer past order context)
router.post('/parse-order', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { rawText, retailerId: overrideRetailerId } = req.body;

  if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
    return res.status(400).json({ error: 'Text message is required for order capture.' });
  }

  const user = req.user!;
  const retailerId = user.retailer?.id || overrideRetailerId || null;

  try {
    const { catalog, aliases, pastOrders } = await getCatalogAndAliases(retailerId);
    const parseResult = await parseOrderMessage(rawText, catalog, aliases, pastOrders);
    return res.json(parseResult);
  } catch (err: any) {
    return res.status(500).json({
      error: 'Failed to process AI order capture.',
      details: err.message,
    });
  }
});

// 2. Multimodal Photo OCR (Handwritten paper slips via Gemini Vision)
router.post('/parse-photo', requireAuth, upload.single('photo'), async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const retailerId = user.retailer?.id || null;

  if (!req.file) {
    return res.status(400).json({
      error: 'Photo file is required. Please upload an image of the handwritten slip.',
    });
  }

  try {
    const { catalog, aliases, pastOrders } = await getCatalogAndAliases(retailerId);
    const result = await parseHandwrittenPhotoOrder(
      req.file.buffer,
      req.file.mimetype,
      catalog,
      aliases,
      pastOrders
    );
    return res.json(result);
  } catch (err: any) {
    return res.status(400).json({
      error: err.message || 'Failed to process handwritten photo slip OCR.',
    });
  }
});

// 3. Audio Voice Note Transcription & Parsing (Hindi voice notes via Gemini Audio)
router.post('/parse-audio', requireAuth, upload.single('audio'), async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const retailerId = user.retailer?.id || null;

  if (!req.file) {
    return res.status(400).json({
      error: 'Audio file is required. Please record or upload a voice note.',
    });
  }

  try {
    const { catalog, aliases, pastOrders } = await getCatalogAndAliases(retailerId);
    const result = await parseAudioVoiceOrder(
      req.file.buffer,
      req.file.mimetype || 'audio/webm',
      catalog,
      aliases,
      pastOrders
    );
    return res.json(result);
  } catch (err: any) {
    return res.status(400).json({
      error: err.message || 'Failed to transcribe audio voice note.',
    });
  }
});

// 4. Learn Alias Endpoint WITH SECURE RETAILER OWNERSHIP VALIDATION
router.post('/learn-alias', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { phrase, skuCode, retailerId: requestedRetailerId } = req.body;

  if (!phrase || !skuCode) {
    return res.status(400).json({ error: 'Phrase and skuCode are required.' });
  }

  const user = req.user!;

  // Security: Retailers can ONLY add aliases for their own shop!
  let targetRetailerId: string | null = null;
  if (user.role === 'RETAILER') {
    if (!user.retailer) {
      return res.status(403).json({ error: 'No linked retailer profile.' });
    }
    targetRetailerId = user.retailer.id;
  } else if (user.role === 'DESK') {
    targetRetailerId = requestedRetailerId || null; // Desk can add global or retailer-specific
  }

  const sku = await prisma.sku.findUnique({ where: { code: skuCode } });
  if (!sku) {
    return res.status(400).json({ error: `SKU ${skuCode} does not exist in catalog.` });
  }

  const existing = await prisma.alias.findFirst({
    where: {
      retailerId: targetRetailerId,
      phrase: phrase.toLowerCase().trim(),
    },
  });

  let savedAlias;
  if (existing) {
    savedAlias = await prisma.alias.update({
      where: { id: existing.id },
      data: { skuCode, confidence: 0.99 },
    });
  } else {
    savedAlias = await prisma.alias.create({
      data: {
        retailerId: targetRetailerId,
        phrase: phrase.toLowerCase().trim(),
        skuCode,
        confidence: 0.99,
      },
    });
  }

  return res.json({
    success: true,
    alias: savedAlias,
    message: `Learned alias "${phrase}" -> ${sku.name}. Future orders will map automatically.`,
  });
});

export default router;
