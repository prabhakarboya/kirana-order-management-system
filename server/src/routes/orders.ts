import { Router, Response } from 'express';
import { prisma } from '../db/prisma.js';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth.js';
import { calculateLineScheme, calculateOrderSummary } from '../schemeEngine/index.js';
import { SkuItem } from '../types.js';
import { isRetailerAssignedToSalesman } from './salesman.js';

const router = Router();

// Helper: Maps Prisma SKU to SkuItem
function mapPrismaSkuToItem(sku: any, customCasePrice?: number): SkuItem {
  let scheme = undefined;
  if (sku.schemes && sku.schemes.length > 0) {
    const s = sku.schemes[0];
    scheme = {
      id: s.id,
      skuCode: s.skuCode,
      type: s.type,
      title: s.title,
      description: s.description,
      config: JSON.parse(s.configJson),
      isActive: s.isActive,
    };
  }

  return {
    code: sku.code,
    name: sku.name,
    brand: sku.brand,
    category: sku.category,
    unitLabel: sku.unitLabel,
    piecesPerCase: sku.piecesPerCase,
    dealerPricePerPiece: sku.dealerPrice,
    dealerPricePerCase: customCasePrice !== undefined ? customCasePrice : sku.casePrice,
    gstIncluded: sku.gstIncluded,
    gstRate: sku.gstRate,
    stockCases: sku.stockCases,
    scheme,
  };
}

// Calculate cart schemes live
router.post('/calculate', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { items, retailerId: requestedRetailerId } = req.body as {
    items: Array<{ skuCode: string; qtyCases: number }>;
    retailerId?: string;
  };

  if (!items || !Array.isArray(items)) {
    return res.status(400).json({ error: 'Items array is required.' });
  }

  const user = req.user!;
  let targetRetailerId = user.retailer?.id;

  if (user.role === 'SALESMAN' && requestedRetailerId) {
    const isAssigned = await isRetailerAssignedToSalesman(user.salesman?.id, requestedRetailerId);
    if (!isAssigned) {
      return res.status(403).json({ error: 'Access denied: Retailer is not assigned to your route/beat.' });
    }
    targetRetailerId = requestedRetailerId;
  }

  let creditLimit = 50000;
  let creditUsed = 0;

  if (targetRetailerId) {
    const dbRet = await prisma.retailer.findUnique({ where: { id: targetRetailerId } });
    if (dbRet) {
      creditLimit = dbRet.creditLimit;
      creditUsed = dbRet.creditUsed;
    }
  }

  // Aggregate duplicate SKUs and reject non-integer / fractional quantities
  const aggregatedMap = new Map<string, number>();
  for (const item of items) {
    const num = Number(item.qtyCases);
    if (!Number.isInteger(num) || num <= 0) {
      return res.status(400).json({
        error: `Quantity for SKU ${item.skuCode} must be a whole positive number of cases. Fractional cases (${item.qtyCases}) are not accepted in FMCG wholesale.`,
      });
    }
    aggregatedMap.set(item.skuCode, (aggregatedMap.get(item.skuCode) || 0) + num);
  }

  try {
    const skuCodes = Array.from(aggregatedMap.keys());
    const dbSkus = await prisma.sku.findMany({
      where: { code: { in: skuCodes } },
      include: { schemes: { where: { isActive: true } } },
    });

    // Check custom prices
    const customPrices = targetRetailerId
      ? await prisma.retailerPrice.findMany({ where: { retailerId: targetRetailerId } })
      : [];
    const customPriceMap = new Map(customPrices.map((cp) => [cp.skuCode, cp.casePrice]));

    const lineResults = [];
    for (const [skuCode, qtyCases] of aggregatedMap.entries()) {
      const dbSku = dbSkus.find((s) => s.code === skuCode);
      if (!dbSku) continue;
      const customPrice = customPriceMap.get(skuCode);
      const skuItem = mapPrismaSkuToItem(dbSku, customPrice);
      lineResults.push(calculateLineScheme({ sku: skuItem, qtyCases }));
    }

    const summary = calculateOrderSummary(lineResults, creditLimit, creditUsed);
    return res.json(summary);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Error calculating scheme totals' });
  }
});

// Create new order (Retailer checkout, AI confirmation, or Salesman offline sync)
router.post('/create', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { items, source = 'APP', rawMessage, clientOrderId } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Order must contain at least one item.' });
  }

  const user = req.user!;
  let targetRetailerId = user.retailer?.id;

  if (user.role === 'SALESMAN') {
    const requestedRetailerId = req.body.retailerId;
    if (!requestedRetailerId) {
      return res.status(400).json({ error: 'Salesman must specify a target retailerId.' });
    }
    const isAssigned = await isRetailerAssignedToSalesman(user.salesman?.id, requestedRetailerId);
    if (!isAssigned) {
      return res.status(403).json({ error: 'Access denied: Retailer is not assigned to your route/beat.' });
    }
    targetRetailerId = requestedRetailerId;
  } else if (!targetRetailerId) {
    return res.status(400).json({ error: 'No linked retailer profile found for current user.' });
  }

  // Idempotency check for offline salesman orders
  if (clientOrderId) {
    const existingOrder = await prisma.order.findUnique({
      where: { clientOrderId },
      include: { lines: true },
    });
    if (existingOrder) {
      return res.json({
        success: true,
        order: existingOrder,
        idempotent: true,
        message: 'Order already recorded from offline synchronization.',
      });
    }
  }

  // Aggregate duplicate SKUs to avoid inventory overselling and reject fractional quantities
  const aggregatedMap = new Map<string, number>();
  for (const item of items) {
    const num = Number(item.qtyCases);
    if (!Number.isInteger(num) || num <= 0) {
      return res.status(400).json({
        error: `Quantity for SKU ${item.skuCode} must be a whole positive number of cases. Fractional cases (${item.qtyCases}) are not accepted in FMCG wholesale.`,
      });
    }
    aggregatedMap.set(item.skuCode, (aggregatedMap.get(item.skuCode) || 0) + num);
  }

  const dbRetailer = await prisma.retailer.findUnique({
    where: { id: targetRetailerId },
  });
  if (!dbRetailer) {
    return res.status(404).json({ error: 'Retailer record not found in database.' });
  }

  const skuCodes = Array.from(aggregatedMap.keys());
  const dbSkus = await prisma.sku.findMany({
    where: { code: { in: skuCodes } },
    include: { schemes: { where: { isActive: true } } },
  });

  const customPrices = await prisma.retailerPrice.findMany({
    where: { retailerId: dbRetailer.id },
  });
  const customPriceMap = new Map(customPrices.map((cp) => [cp.skuCode, cp.casePrice]));

  // Calculate schemes and stock
  const lineCalculations: Array<{ lineRes: any; dbSku: any }> = [];
  for (const [skuCode, qtyCases] of aggregatedMap.entries()) {
    const dbSku = dbSkus.find((s) => s.code === skuCode);
    if (!dbSku) {
      return res.status(400).json({ error: `SKU code ${skuCode} not found in catalog.` });
    }
    const customPrice = customPriceMap.get(skuCode);
    const skuItem = mapPrismaSkuToItem(dbSku, customPrice);
    const lineRes = calculateLineScheme({ sku: skuItem, qtyCases });

    if (!lineRes.stockSufficient) {
      return res.status(400).json({ error: lineRes.stockWarning });
    }
    lineCalculations.push({ lineRes, dbSku });
  }

  const summary = calculateOrderSummary(
    lineCalculations.map((l) => l.lineRes),
    dbRetailer.creditLimit,
    dbRetailer.creditUsed
  );

  // Execute Order Creation & Inventory Reservation in ACID Transaction
  try {
    const createdOrder = await prisma.$transaction(async (tx) => {
      // 1. Concurrency-safe order number generation inside transaction
      const orderCount = await tx.order.count();
      const randomSuffix = Math.floor(100 + Math.random() * 900);
      const orderNumber = `ORD-2026-${String(orderCount + 1).padStart(4, '0')}-${randomSuffix}`;

      // 2. Atomically verify current stock inside transaction (protects against concurrent race conditions)
      for (const { lineRes } of lineCalculations) {
        const totalCases = lineRes.qtyCases + lineRes.freeCases;
        const freshSku = await tx.sku.findUnique({ where: { code: lineRes.skuCode } });
        if (!freshSku || freshSku.stockCases < totalCases) {
          throw new Error(
            `Insufficient warehouse stock for ${lineRes.skuCode} during final lock. Available: ${freshSku?.stockCases ?? 0} cases.`
          );
        }
      }

      // 3. Re-verify credit status inside transaction
      const freshRetailer = await tx.retailer.findUnique({ where: { id: dbRetailer.id } });
      const currentCreditLimit = freshRetailer?.creditLimit ?? dbRetailer.creditLimit;
      const currentCreditUsed = freshRetailer?.creditUsed ?? dbRetailer.creditUsed;
      const creditAvailable = currentCreditLimit - currentCreditUsed;
      const isCreditExceeded = summary.grandTotal > creditAvailable;
      const orderStatus = isCreditExceeded ? 'CREDIT_HOLD' : 'PENDING_DESK_REVIEW';
      const creditApproved = !isCreditExceeded;

      // 4. Create order record
      const ord = await tx.order.create({
        data: {
          orderNumber,
          clientOrderId: clientOrderId || null,
          retailerId: dbRetailer.id,
          status: orderStatus,
          source: user.role === 'SALESMAN' && source === 'APP' ? 'SALESMAN_VISIT' : source,
          rawMessage: rawMessage || null,
          subtotal: summary.subtotal,
          discountTotal: summary.discountTotal,
          gstTotal: summary.gstTotal,
          grandTotal: summary.grandTotal,
          totalSavings: summary.totalSavings,
          creditApproved,
          stockDeducted: true,
          lines: {
            create: lineCalculations.map(({ lineRes, dbSku }) => ({
              skuCode: lineRes.skuCode,
              qtyCases: lineRes.qtyCases,
              freeCases: lineRes.freeCases,
              unitPrice: lineRes.unitCasePrice,
              discountAmount: lineRes.discountAmount,
              gstRate: lineRes.gstRate,
              gstAmount: lineRes.gstAmount,
              lineTotal: lineRes.lineTotal,
              schemeApplied: lineRes.explanation,
            })),
          },
          auditLogs: {
            create: [
              {
                userId: user.id,
                userName: user.name,
                action: isCreditExceeded ? 'ORDER_HELD_ON_CREDIT' : 'ORDER_CREATED',
                details: isCreditExceeded
                  ? `Order placed via ${source} for ₹${summary.grandTotal.toFixed(2)}. Credit limit exceeded -> PLACED ON CREDIT HOLD.`
                  : `Order placed via ${source} for ₹${summary.grandTotal.toFixed(2)}. Passed credit validation.`,
              },
            ],
          },
        },
        include: { lines: { include: { sku: true } } },
      });

      // 5. Atomically reserve inventory
      for (const { lineRes } of lineCalculations) {
        const totalPhysicalCases = lineRes.qtyCases + lineRes.freeCases;
        await tx.sku.update({
          where: { code: lineRes.skuCode },
          data: { stockCases: { decrement: totalPhysicalCases } },
        });
      }

      // 6. Update retailer credit used and last order timestamp
      await tx.retailer.update({
        where: { id: dbRetailer.id },
        data: {
          creditUsed: { increment: summary.grandTotal },
          lastOrderAt: new Date(),
        },
      });

      return ord;
    });

    return res.status(201).json({
      success: true,
      order: createdOrder,
      summary,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Transaction failed: ' + err.message });
  }
});

// Retailer's past order history
router.get('/my-orders', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  if (!user.retailer) {
    return res.json({ orders: [] });
  }

  const orders = await prisma.order.findMany({
    where: { retailerId: user.retailer.id },
    orderBy: { createdAt: 'desc' },
    include: {
      retailer: true,
      lines: { include: { sku: true } },
    },
  });

  return res.json({
    orders: orders.map((o: any) => ({
      ...o,
      retailerName: o.retailer?.shopName || 'Retailer',
      lines: (o.lines || []).map((l: any) => ({
        ...l,
        skuName: l.sku?.name || l.skuCode,
      })),
    })),
  });
});

// Repeat order: get lines from an existing order WITH OWNERSHIP AUTHORIZATION
router.post('/:id/repeat', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  const order = await prisma.order.findUnique({
    where: { id },
    include: { lines: true },
  });

  if (!order) {
    return res.status(404).json({ error: 'Order not found.' });
  }

  // Authorization check: Retailers can only repeat their OWN orders!
  if (user.role === 'RETAILER' && (!user.retailer || order.retailerId !== user.retailer.id)) {
    return res.status(403).json({ error: 'Access denied: You cannot access or repeat another store’s order.' });
  }

  const repeatItems = (order.lines || []).map((l: any) => ({
    skuCode: l.skuCode,
    qtyCases: l.qtyCases,
  }));

  return res.json({
    success: true,
    items: repeatItems,
    message: `Loaded ${repeatItems.length} items from past order ${order.orderNumber}`,
  });
});

export default router;
