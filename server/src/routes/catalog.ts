import { Router, Response } from 'express';
import { dbStore } from '../db/store.js';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth.js';

const router = Router();

// Get Catalog with live schemes, stock levels, and price breakdown
router.get('/', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const retailer = user.retailerId ? dbStore.getRetailer(user.retailerId) : undefined;

  const catalogWithPrices = dbStore.catalog.map((sku) => {
    // Check if retailer has custom negotiated dealer price
    let customPrice = sku.dealerPricePerCase;

    // Stock classification
    let stockBadge: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' = 'IN_STOCK';
    if (sku.stockCases <= 0) stockBadge = 'OUT_OF_STOCK';
    else if (sku.stockCases < 20) stockBadge = 'LOW_STOCK';

    return {
      ...sku,
      dealerPricePerCase: customPrice,
      stockBadge,
    };
  });

  return res.json({
    catalog: catalogWithPrices,
    retailer: retailer
      ? {
          id: retailer.id,
          shopName: retailer.shopName,
          creditLimit: retailer.creditLimit,
          creditUsed: retailer.creditUsed,
          creditAvailable: retailer.creditLimit - retailer.creditUsed,
        }
      : null,
  });
});

export default router;
