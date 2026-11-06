import { Router, Response } from 'express';
import { dbStore } from '../db/store.js';
import { AuthenticatedRequest, requireAuth, requireDeskRole } from '../middleware/auth.js';
import { generateTallyXml, generateTallyCsv } from '../tally/export.js';
import { calculateLineScheme, calculateOrderSummary } from '../schemeEngine/index.js';

const router = Router();

// Order Desk: List all orders with filters
router.get('/orders', requireAuth, requireDeskRole, (req: AuthenticatedRequest, res: Response) => {
  const { status, retailerId, search } = req.query as {
    status?: string;
    retailerId?: string;
    search?: string;
  };

  let filtered = [...dbStore.orders];

  if (status && status !== 'ALL') {
    filtered = filtered.filter((o) => o.status === status);
  }

  if (retailerId && retailerId !== 'ALL') {
    filtered = filtered.filter((o) => o.retailerId === retailerId);
  }

  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (o) =>
        o.orderNumber.toLowerCase().includes(q) ||
        o.retailerName.toLowerCase().includes(q) ||
        (o.rawMessage && o.rawMessage.toLowerCase().includes(q))
    );
  }

  return res.json({ orders: filtered });
});

// Order Desk: Single order detail with AI transcript & audit trail
router.get('/orders/:id', requireAuth, requireDeskRole, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const order = dbStore.orders.find((o) => o.id === id);

  if (!order) {
    return res.status(404).json({ error: 'Order not found.' });
  }

  const retailer = dbStore.getRetailer(order.retailerId);
  const auditLogs = dbStore.auditLogs.filter((a) => a.orderId === id);

  return res.json({
    order,
    retailer,
    auditLogs,
  });
});

// Order Desk: Edit lines (e.g. correct quantity or map to correct SKU, optionally learning alias)
router.put('/orders/:id/update-lines', requireAuth, requireDeskRole, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { lines, learnAliases } = req.body as {
    lines: Array<{ skuCode: string; qtyCases: number }>;
    learnAliases?: Array<{ phrase: string; skuCode: string }>;
  };

  const order = dbStore.orders.find((o) => o.id === id);
  if (!order) {
    return res.status(404).json({ error: 'Order not found.' });
  }

  const retailer = dbStore.getRetailer(order.retailerId);
  if (!retailer) {
    return res.status(404).json({ error: 'Retailer not found.' });
  }

  // Recalculate schemes
  const lineCalculations = lines.map((item) => {
    const sku = dbStore.getSku(item.skuCode);
    if (!sku) throw new Error(`SKU ${item.skuCode} not found.`);
    return calculateLineScheme({ sku, qtyCases: Number(item.qtyCases) || 0 });
  });

  const summary = calculateOrderSummary(lineCalculations, retailer.creditLimit, retailer.creditUsed);

  // Update order lines
  order.lines = lineCalculations.map((line, idx) => {
    const sku = dbStore.getSku(line.skuCode)!;
    return {
      id: `LN-EDIT-${Date.now()}-${idx}`,
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
  });

  order.subtotal = summary.subtotal;
  order.discountTotal = summary.discountTotal;
  order.gstTotal = summary.gstTotal;
  order.grandTotal = summary.grandTotal;
  order.totalSavings = summary.totalSavings;
  order.creditApproved = !summary.creditExceeded;
  order.updatedAt = new Date().toISOString();

  // Save desk learned aliases if provided
  if (learnAliases && Array.isArray(learnAliases)) {
    for (const alias of learnAliases) {
      if (alias.phrase && alias.skuCode) {
        dbStore.addAlias(order.retailerId, alias.phrase, alias.skuCode);
      }
    }
  }

  dbStore.logAudit(
    order.id,
    req.user!.name,
    'LINES_EDITED_BY_DESK',
    `Desk updated lines. New total: ₹${summary.grandTotal.toFixed(2)}. ${learnAliases?.length || 0} aliases learned.`
  );

  return res.json({
    success: true,
    order,
    summary,
  });
});

// Order Desk: Approve order
router.post('/orders/:id/approve', requireAuth, requireDeskRole, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const order = dbStore.orders.find((o) => o.id === id);

  if (!order) {
    return res.status(404).json({ error: 'Order not found.' });
  }

  order.status = 'APPROVED';
  order.updatedAt = new Date().toISOString();

  dbStore.logAudit(order.id, req.user!.name, 'ORDER_APPROVED', 'Approved for warehouse picking and dispatch.');

  return res.json({ success: true, order });
});

// Order Desk: Reject order
router.post('/orders/:id/reject', requireAuth, requireDeskRole, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { reason = 'Order rejected by desk' } = req.body;
  const order = dbStore.orders.find((o) => o.id === id);

  if (!order) {
    return res.status(404).json({ error: 'Order not found.' });
  }

  order.status = 'REJECTED';
  order.rejectionReason = reason;
  order.updatedAt = new Date().toISOString();

  // Return stock back to inventory
  for (const line of order.lines) {
    const sku = dbStore.getSku(line.skuCode);
    if (sku) {
      sku.stockCases += line.qtyCases + line.freeCases;
    }
  }

  // Restore retailer credit
  const retailer = dbStore.getRetailer(order.retailerId);
  if (retailer) {
    retailer.creditUsed = Math.max(0, retailer.creditUsed - order.grandTotal);
  }

  dbStore.logAudit(order.id, req.user!.name, 'ORDER_REJECTED', `Reason: ${reason}`);

  return res.json({ success: true, order });
});

// Order Desk: Export to Tally (XML / CSV)
router.get('/orders/:id/export-tally', requireAuth, requireDeskRole, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { format = 'xml' } = req.query as { format?: 'xml' | 'csv' };
  const order = dbStore.orders.find((o) => o.id === id);

  if (!order) {
    return res.status(404).json({ error: 'Order not found.' });
  }

  order.tallyExported = true;
  order.tallyVoucherNo = `JBP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

  dbStore.logAudit(
    order.id,
    req.user!.name,
    'TALLY_EXPORTED',
    `Exported format: ${format.toUpperCase()} (Voucher: ${order.tallyVoucherNo})`
  );

  if (format === 'csv') {
    const csvContent = generateTallyCsv(order);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${order.orderNumber}-tally.csv"`);
    return res.send(csvContent);
  } else {
    const xmlContent = generateTallyXml(order);
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename="${order.orderNumber}-tally.xml"`);
    return res.send(xmlContent);
  }
});

// Order Desk: Dashboard metrics (inactivity, van loading, error rates)
router.get('/dashboard', requireAuth, requireDeskRole, (_req: AuthenticatedRequest, res: Response) => {
  const now = new Date().getTime();
  const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

  // Inactive retailers (no order in past 14 days)
  const inactiveRetailers = dbStore.retailers.filter((r) => {
    if (!r.lastOrderDate) return true;
    const diff = now - new Date(r.lastOrderDate).getTime();
    return diff > FOURTEEN_DAYS_MS;
  });

  // Approved orders awaiting loading
  const approvedOrders = dbStore.orders.filter((o) => o.status === 'APPROVED');

  // Van Loading Item Totals
  const vanLoadingSummary: Record<string, { skuCode: string; skuName: string; totalCases: number; freeCases: number }> = {};
  for (const o of approvedOrders) {
    for (const l of o.lines) {
      if (!vanLoadingSummary[l.skuCode]) {
        vanLoadingSummary[l.skuCode] = {
          skuCode: l.skuCode,
          skuName: l.skuName,
          totalCases: 0,
          freeCases: 0,
        };
      }
      vanLoadingSummary[l.skuCode].totalCases += l.qtyCases;
      vanLoadingSummary[l.skuCode].freeCases += l.freeCases;
    }
  }

  // Pending count
  const pendingDeskCount = dbStore.orders.filter((o) => o.status === 'PENDING_DESK_REVIEW').length;

  return res.json({
    pendingDeskCount,
    totalRetailers: dbStore.retailers.length,
    inactiveRetailers,
    approvedOrdersCount: approvedOrders.length,
    vanLoadingSummary: Object.values(vanLoadingSummary),
  });
});

export default router;
