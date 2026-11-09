import { Router, Response } from 'express';
import { prisma } from '../db/prisma.js';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth.js';
import { isRetailerAssignedToSalesman } from './salesman.js';

const router = Router();

router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  let targetRetailerId = user.retailer?.id;

  if (user.role === 'SALESMAN') {
    const requestedRetailerId = req.query.retailerId as string | undefined;
    if (requestedRetailerId) {
      const isAssigned = await isRetailerAssignedToSalesman(user.salesman?.id, requestedRetailerId);
      if (!isAssigned) {
        return res.status(403).json({ error: 'Access denied: Retailer is not assigned to your route/beat.' });
      }
      targetRetailerId = requestedRetailerId;
    }
  } else if (user.role === 'DESK') {
    const requestedRetailerId = req.query.retailerId as string | undefined;
    if (requestedRetailerId) {
      targetRetailerId = requestedRetailerId;
    }
  }

  // 1. Fetch SKUs and their active trade schemes
  const skus = await prisma.sku.findMany({
    where: { isActive: true },
    include: {
      schemes: {
        where: { isActive: true },
      },
    },
  });

  // 2. Fetch retailer-specific custom negotiated prices
  let customPrices: Record<string, { dealerPrice: number; casePrice: number }> = {};
  if (targetRetailerId) {
    const prices = await prisma.retailerPrice.findMany({
      where: { retailerId: targetRetailerId },
    });
    for (const p of prices) {
      customPrices[p.skuCode] = { dealerPrice: p.dealerPrice, casePrice: p.casePrice };
    }
  }

  // 3. Format catalogue items with retailer-specific pricing and stock badges
  const catalog = skus.map((sku) => {
    const custom = customPrices[sku.code];
    const dealerPricePerPiece = custom ? custom.dealerPrice : sku.dealerPrice;
    const dealerPricePerCase = custom ? custom.casePrice : sku.casePrice;

    let stockBadge: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' = 'IN_STOCK';
    if (sku.stockCases <= 0) stockBadge = 'OUT_OF_STOCK';
    else if (sku.stockCases < 20) stockBadge = 'LOW_STOCK';

    const activeScheme = sku.schemes[0];
    let schemeDefinition = undefined;

    if (activeScheme) {
      try {
        schemeDefinition = {
          id: activeScheme.id,
          skuCode: activeScheme.skuCode,
          type: activeScheme.type as 'FREE_GOODS' | 'SLAB_PERCENT',
          title: activeScheme.title,
          description: activeScheme.description,
          config: JSON.parse(activeScheme.configJson),
          isActive: activeScheme.isActive,
        };
      } catch {
        // Fallback
      }
    }

    return {
      code: sku.code,
      name: sku.name,
      brand: sku.brand,
      category: sku.category,
      unitLabel: sku.unitLabel,
      piecesPerCase: sku.piecesPerCase,
      dealerPricePerPiece,
      dealerPricePerCase,
      gstIncluded: sku.gstIncluded,
      gstRate: sku.gstRate,
      stockCases: sku.stockCases,
      stockBadge,
      imageUrl: sku.imageUrl,
      scheme: schemeDefinition,
    };
  });

  // 4. Return retailer credit information (visible only to that retailer, their salesman, or desk)
  let retailerInfo = null;
  if (targetRetailerId) {
    const dbRetailer = await prisma.retailer.findUnique({
      where: { id: targetRetailerId },
    });
    if (dbRetailer) {
      retailerInfo = {
        id: dbRetailer.id,
        shopName: dbRetailer.shopName,
        creditLimit: dbRetailer.creditLimit,
        creditUsed: dbRetailer.creditUsed,
        creditAvailable: Math.max(0, dbRetailer.creditLimit - dbRetailer.creditUsed),
      };
    }
  }

  return res.json({
    catalog,
    retailer: retailerInfo,
  });
});

export default router;
