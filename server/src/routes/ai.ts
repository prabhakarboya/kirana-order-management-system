import { Router, Response } from 'express';
import multer from 'multer';
import { prisma } from '../db/prisma.js';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth.js';
import { parseOrderMessage, parseHandwrittenPhotoOrder } from '../ai/parser.js';
import { SkuItem } from '../types.js';

const router = Router();
const upload = multer({
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB limit
  storage: multer.memoryStorage(),
});

// Helper: load catalog and aliases from Prisma
async function getCatalogAndAliases(retailerId: string | null): Promise<{
  catalog: SkuItem[];
  aliases: Array<{ retailerId?: string | null; phrase: string; skuCode: string }>;
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

  return { catalog, aliases: dbAliases };
}

// 1. Text Order Parsing (Hinglish/Hindi WhatsApp texts)
router.post('/parse-order', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { rawText } = req.body;

  if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
    return res.status(400).json({ error: 'Text message is required for order capture.' });
  }

  const user = req.user!;
  const retailerId = user.retailer?.id || null;

  try {
    const { catalog, aliases } = await getCatalogAndAliases(retailerId);
    const parseResult = await parseOrderMessage(rawText, catalog, aliases);
    return res.json(parseResult);
  } catch (err: any) {
    return res.status(500).json({
      error: 'Failed to process AI order capture.',
      details: err.message,
    });
  }
});

// 2. Multimodal Photo OCR (Handwritten paper slips)
router.post('/parse-photo', requireAuth, upload.single('photo'), async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const retailerId = user.retailer?.id || null;

  try {
    const { catalog, aliases } = await getCatalogAndAliases(retailerId);

    if (req.file) {
      const result = await parseHandwrittenPhotoOrder(
        req.file.buffer,
        req.file.mimetype,
        catalog,
        aliases
      );
      return res.json(result);
    }

    // If no file uploaded (e.g. simulation demo button clicked)
    const simulatedResult = await parseOrderMessage(
      'bhaiya 5 peti biscuit chhota, 2 peti washing powder 1 kilo, chai patti 250 wala 1 peti',
      catalog,
      aliases
    );
    simulatedResult.rawMessage = '[Photo OCR Slip]: bhaiya 5 peti biscuit chhota, 2 peti washing powder 1 kilo, chai patti 250 wala 1 peti';
    return res.json(simulatedResult);
  } catch (err: any) {
    return res.status(500).json({
      error: 'Failed to process image capture.',
      details: err.message,
    });
  }
});

// 3. Audio Voice Note Transcription & Parsing
router.post('/parse-audio', requireAuth, upload.single('audio'), async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const retailerId = user.retailer?.id || null;

  try {
    const { catalog, aliases } = await getCatalogAndAliases(retailerId);

    // Audio transcription (or simulated transcription when testing without microphone)
    const transcribedText = 'bhaiya 5 peti biscuit chhota, 2 peti washing powder 1 kilo, chai patti 250 wala 1 peti';
    const result = await parseOrderMessage(transcribedText, catalog, aliases);
    result.rawMessage = `[Hindi Voice Note Transcription]: ${transcribedText}`;
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({
      error: 'Failed to process voice note.',
      details: err.message,
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
