import { Router, Response } from 'express';
import { dbStore } from '../db/store.js';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth.js';
import { calculateLineScheme, calculateOrderSummary } from '../schemeEngine/index.js';
import { OrderRecord } from '../types.js';

const router = Router();

// Calculate cart schemes, taxes, savings, and credit check
router.post('/calculate', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { items } = req.body as { items: Array<{ skuCode: string; qtyCases: number }> };

  if (!items || !Array.isArray(items)) {
    return res.status(400).json({ error: 'Items array is required.' });
  }

  const user = req.user!;
  const retailer = user.retailerId ? dbStore.getRetailer(user.retailerId) : undefined;
  const creditLimit = retailer ? retailer.creditLimit : 50000;
  const creditUsed = retailer ? retailer.creditUsed : 0;

  try {
    const lineResults = items
      .map((item) => {
        const sku = dbStore.getSku(item.skuCode);
        if (!sku) return null;
        return calculateLineScheme({ sku, qtyCases: Number(item.qtyCases) || 0 });
      })
      .filter((res): res is NonNullable<typeof res> => res !== null);

    const summary = calculateOrderSummary(lineResults, creditLimit, creditUsed);
    return res.json(summary);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Error calculating schemes' });
  }
});

// Create new order (Retailer checkout or confirmed AI capture)
router.post('/create', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { items, source = 'APP', rawMessage } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Order must contain at least one item.' });
  }

  const user = req.user!;
  const retailer = user.retailerId ? dbStore.getRetailer(user.retailerId) : undefined;
  if (!retailer) {
    return res.status(400).json({ error: 'No linked retailer profile found for current user.' });
  }

  // Calculate order lines
  const calculatedLines = items.map((item: { skuCode: string; qtyCases: number }) => {
    const sku = dbStore.getSku(item.skuCode);
    if (!sku) throw new Error(`SKU ${item.skuCode} not found in catalog.`);
    return calculateLineScheme({ sku, qtyCases: Number(item.qtyCases) || 0 });
  });

  const summary = calculateOrderSummary(calculatedLines, retailer.creditLimit, retailer.creditUsed);

  // Check out of stock items
  const outOfStockLine = calculatedLines.find((l) => !l.stockSufficient);
  if (outOfStockLine) {
    return res.status(400).json({
      error: `Cannot place order: ${outOfStockLine.stockWarning}`,
    });
  }

  const orderId = `ORD-2026-${String(dbStore.orders.length + 1).padStart(4, '0')}`;

  const newOrder: OrderRecord = {
    id: orderId,
    orderNumber: orderId,
    retailerId: retailer.id,
    retailerName: retailer.shopName,
    status: 'PENDING_DESK_REVIEW',
    source: source,
    rawMessage: rawMessage || undefined,
    subtotal: summary.subtotal,
    discountTotal: summary.discountTotal,
    gstTotal: summary.gstTotal,
    grandTotal: summary.grandTotal,
    totalSavings: summary.totalSavings,
    creditApproved: !summary.creditExceeded,
    tallyExported: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lines: calculatedLines.map((line, idx) => {
      const sku = dbStore.getSku(line.skuCode)!;
      return {
        id: `LN-${Date.now()}-${idx}`,
        skuCode: line.skuCode,
        skuName: sku.name,
        qtyCases: line.qtyCases,
        freeCases: line.freeCases,
        unitPrice: line.unitCasePrice,
        discountAmount: line.discountAmount,
        gstRate: line.gstRate,
        gstAmount: line.gstAmount,
        lineTotal: line.lineTotal,
        schemeApplied: line.explanation,
      };
    }),
  };

  // Deduct warehouse stock
  for (const line of calculatedLines) {
    const sku = dbStore.getSku(line.skuCode);
    if (sku) {
      sku.stockCases = Math.max(0, sku.stockCases - (line.qtyCases + line.freeCases));
    }
  }

  // Update retailer credit and last order timestamp
  retailer.creditUsed += summary.grandTotal;
  retailer.lastOrderDate = newOrder.createdAt;

  dbStore.orders.unshift(newOrder);
  dbStore.logAudit(
    orderId,
    user.name,
    'ORDER_CREATED',
    `Order placed via ${source} with total value ₹${summary.grandTotal.toFixed(2)} (${calculatedLines.length} lines)`
  );

  return res.status(201).json({
    success: true,
    order: newOrder,
    summary,
  });
});

// Retailer's past order history
router.get('/my-orders', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const retailerId = user.retailerId;

  const orders = dbStore.orders.filter((o) => o.retailerId === retailerId);
  return res.json({ orders });
});

// Repeat order: get lines from an existing order
router.post('/:id/repeat', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const order = dbStore.orders.find((o) => o.id === id);

  if (!order) {
    return res.status(404).json({ error: 'Order not found.' });
  }

  const repeatItems = order.lines.map((l) => ({
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
