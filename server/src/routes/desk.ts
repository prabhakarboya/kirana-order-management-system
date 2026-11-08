import { Router, Response } from 'express';
import { prisma } from '../db/prisma.js';
import { AuthenticatedRequest, requireAuth, requireDeskRole } from '../middleware/auth.js';
import { generateTallyXml, generateTallyCsv } from '../tally/export.js';
import { calculateLineScheme, calculateOrderSummary } from '../schemeEngine/index.js';
import { OrderRecord } from '../types.js';

const router = Router();

// Helper: Format Prisma Order to OrderRecord
function formatPrismaOrder(o: any): OrderRecord {
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    retailerId: o.retailerId,
    retailerName: o.retailer?.shopName || 'Retailer',
    status: o.status,
    source: o.source,
    rawMessage: o.rawMessage || undefined,
    subtotal: o.subtotal,
    discountTotal: o.discountTotal,
    gstTotal: o.gstTotal,
    grandTotal: o.grandTotal,
    totalSavings: o.totalSavings,
    creditApproved: o.creditApproved,
    rejectionReason: o.rejectionReason || undefined,
    tallyExported: o.tallyExported,
    tallyVoucherNo: o.tallyVoucherNo || undefined,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
    lines: (o.lines || []).map((l: any) => ({
      id: l.id,
      skuCode: l.skuCode,
      skuName: l.sku?.name || l.skuCode,
      qtyCases: l.qtyCases,
      freeCases: l.freeCases,
      unitPrice: l.unitPrice,
      discountAmount: l.discountAmount,
      gstRate: l.gstRate,
      gstAmount: l.gstAmount,
      lineTotal: l.lineTotal,
      schemeApplied: l.schemeApplied || '',
    })),
  };
}

// 1. List all orders with filters
router.get('/orders', requireAuth, requireDeskRole, async (req: AuthenticatedRequest, res: Response) => {
  const { status, retailerId, search } = req.query as {
    status?: string;
    retailerId?: string;
    search?: string;
  };

  const whereClause: any = {};

  if (status && status !== 'ALL') {
    whereClause.status = status;
  }

  if (retailerId && retailerId !== 'ALL') {
    whereClause.retailerId = retailerId;
  }

  if (search && search.trim()) {
    const q = search.trim();
    whereClause.OR = [
      { orderNumber: { contains: q } },
      { rawMessage: { contains: q } },
      { retailer: { shopName: { contains: q } } },
    ];
  }

  const orders = await prisma.order.findMany({
    where: whereClause,
    orderBy: { createdAt: 'desc' },
    include: {
      retailer: true,
      lines: { include: { sku: true } },
    },
  });

  return res.json({
    orders: orders.map(formatPrismaOrder),
  });
});

// 2. Single Order Detail with Audit Trail
router.get('/orders/:id', requireAuth, requireDeskRole, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      retailer: true,
      lines: { include: { sku: true } },
      auditLogs: { orderBy: { timestamp: 'desc' } },
    },
  });

  if (!order) {
    return res.status(404).json({ error: 'Order not found.' });
  }

  return res.json({
    order: formatPrismaOrder(order),
    retailer: order.retailer,
    auditLogs: order.auditLogs,
  });
});

// 3. Edit Order Lines (Recalculates schemes, updates inventory, and optionally learns aliases)
router.put('/orders/:id/update-lines', requireAuth, requireDeskRole, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { lines, learnAliases } = req.body as {
    lines: Array<{ skuCode: string; qtyCases: number }>;
    learnAliases?: Array<{ phrase: string; skuCode: string }>;
  };

  const existingOrder = await prisma.order.findUnique({
    where: { id },
    include: { lines: true, retailer: true },
  });

  if (!existingOrder) {
    return res.status(404).json({ error: 'Order not found.' });
  }

  if (existingOrder.status === 'APPROVED' || existingOrder.status === 'REJECTED') {
    return res.status(400).json({ error: `Cannot edit lines on an order with status ${existingOrder.status}.` });
  }

  // Aggregate duplicate SKUs
  const aggregatedMap = new Map<string, number>();
  for (const item of lines) {
    const qty = parseInt(String(item.qtyCases), 10) || 0;
    if (qty <= 0) continue;
    aggregatedMap.set(item.skuCode, (aggregatedMap.get(item.skuCode) || 0) + qty);
  }

  const skuCodes = Array.from(aggregatedMap.keys());
  const dbSkus = await prisma.sku.findMany({
    where: { code: { in: skuCodes } },
    include: { schemes: { where: { isActive: true } } },
  });

  const customPrices = await prisma.retailerPrice.findMany({
    where: { retailerId: existingOrder.retailerId },
  });
  const customPriceMap = new Map(customPrices.map((cp) => [cp.skuCode, cp.casePrice]));

  // Calculate new schemes
  const newCalculations: Array<{ calc: any; dbSku: any }> = [];
  for (const [skuCode, qtyCases] of aggregatedMap.entries()) {
    const dbSku = dbSkus.find((s) => s.code === skuCode);
    if (!dbSku) return res.status(400).json({ error: `SKU ${skuCode} not found.` });

    const customPrice = customPriceMap.get(skuCode);
    let scheme = undefined;
    if (dbSku.schemes && dbSku.schemes.length > 0) {
      const s = dbSku.schemes[0];
      scheme = {
        id: s.id,
        skuCode: s.skuCode,
        type: s.type as any,
        title: s.title,
        description: s.description,
        config: JSON.parse(s.configJson),
        isActive: s.isActive,
      };
    }

    const skuItem = {
      code: dbSku.code,
      name: dbSku.name,
      brand: dbSku.brand,
      category: dbSku.category,
      unitLabel: dbSku.unitLabel,
      piecesPerCase: dbSku.piecesPerCase,
      dealerPricePerPiece: dbSku.dealerPrice,
      dealerPricePerCase: customPrice !== undefined ? customPrice : dbSku.casePrice,
      gstIncluded: dbSku.gstIncluded,
      gstRate: dbSku.gstRate,
      stockCases: dbSku.stockCases,
      scheme,
    };

    const calc = calculateLineScheme({ sku: skuItem, qtyCases });
    newCalculations.push({ calc, dbSku });
  }

  const summary = calculateOrderSummary(
    newCalculations.map((c) => c.calc),
    existingOrder.retailer.creditLimit,
    existingOrder.retailer.creditUsed - existingOrder.grandTotal // Subtract old order amount
  );

  // Execute update in transaction
  const updatedOrder = await prisma.$transaction(async (tx) => {
    // 1. Restore previous line stock
    if (existingOrder.stockDeducted) {
      for (const oldLine of existingOrder.lines) {
        await tx.sku.update({
          where: { code: oldLine.skuCode },
          data: { stockCases: { increment: oldLine.qtyCases + oldLine.freeCases } },
        });
      }
    }

    // 2. Delete old lines and re-create new lines
    await tx.orderLine.deleteMany({ where: { orderId: id } });

    // 3. Deduct new line stock
    for (const { calc } of newCalculations) {
      await tx.sku.update({
        where: { code: calc.skuCode },
        data: { stockCases: { decrement: calc.qtyCases + calc.freeCases } },
      });
    }

    // 4. Update retailer credit
    const creditDifference = summary.grandTotal - existingOrder.grandTotal;
    await tx.retailer.update({
      where: { id: existingOrder.retailerId },
      data: { creditUsed: { increment: creditDifference } },
    });

    // 5. Update order record
    const ord = await tx.order.update({
      where: { id },
      data: {
        status: summary.creditExceeded ? 'CREDIT_HOLD' : 'PENDING_DESK_REVIEW',
        creditApproved: !summary.creditExceeded,
        subtotal: summary.subtotal,
        discountTotal: summary.discountTotal,
        gstTotal: summary.gstTotal,
        grandTotal: summary.grandTotal,
        totalSavings: summary.totalSavings,
        lines: {
          create: newCalculations.map(({ calc }) => ({
            skuCode: calc.skuCode,
            qtyCases: calc.qtyCases,
            freeCases: calc.freeCases,
            unitPrice: calc.unitCasePrice,
            discountAmount: calc.discountAmount,
            gstRate: calc.gstRate,
            gstAmount: calc.gstAmount,
            lineTotal: calc.lineTotal,
            schemeApplied: calc.explanation,
          })),
        },
        auditLogs: {
          create: [
            {
              userId: req.user!.id,
              userName: req.user!.name,
              action: 'LINES_EDITED_BY_DESK',
              details: `Desk modified lines. New grand total: ₹${summary.grandTotal.toFixed(2)}. ${
                summary.creditExceeded ? 'Exceeds credit limit -> Placed on CREDIT HOLD.' : ''
              }`,
            },
          ],
        },
      },
      include: {
        retailer: true,
        lines: { include: { sku: true } },
      },
    });

    // 6. Learn aliases if provided
    if (learnAliases && Array.isArray(learnAliases)) {
      for (const al of learnAliases) {
        if (al.phrase && al.skuCode) {
          const phraseClean = al.phrase.toLowerCase().trim();
          const existingAl = await tx.alias.findFirst({
            where: {
              retailerId: existingOrder.retailerId,
              phrase: phraseClean,
            },
          });
          if (existingAl) {
            await tx.alias.update({
              where: { id: existingAl.id },
              data: { skuCode: al.skuCode, confidence: 0.99 },
            });
          } else {
            await tx.alias.create({
              data: {
                retailerId: existingOrder.retailerId,
                phrase: phraseClean,
                skuCode: al.skuCode,
                confidence: 0.99,
              },
            });
          }
        }
      }
    }

    return ord;
  });

  return res.json({
    success: true,
    order: formatPrismaOrder(updatedOrder),
    summary,
  });
});

// 4. Approve Order (Enforces Credit Hold Guard)
router.post('/orders/:id/approve', requireAuth, requireDeskRole, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { overrideCreditHold, overrideReason } = req.body;

  const order = await prisma.order.findUnique({
    where: { id },
    include: { retailer: true },
  });

  if (!order) {
    return res.status(404).json({ error: 'Order not found.' });
  }

  // Credit Hold Guard: prevent approving credit-hold orders without explicit override authorization!
  if (order.status === 'CREDIT_HOLD' && !overrideCreditHold) {
    return res.status(400).json({
      error: `Cannot approve order ${order.orderNumber}: Placed on CREDIT HOLD. Retailer has exceeded credit limit. To approve, provide authorized override credentials.`,
      isCreditHold: true,
    });
  }

  const updated = await prisma.order.update({
    where: { id },
    data: {
      status: 'APPROVED',
      creditApproved: true,
      auditLogs: {
        create: [
          {
            userId: req.user!.id,
            userName: req.user!.name,
            action: overrideCreditHold ? 'CREDIT_HOLD_OVERRIDDEN_AND_APPROVED' : 'ORDER_APPROVED',
            details: overrideCreditHold
              ? `Approved with managerial credit hold override. Reason: ${overrideReason || 'Authorized by order desk'}`
              : 'Approved for warehouse packing and next morning dispatch.',
          },
        ],
      },
    },
    include: { retailer: true, lines: { include: { sku: true } } },
  });

  return res.json({ success: true, order: formatPrismaOrder(updated) });
});

// 5. Reject Order (Checks duplicate rejection and restores inventory accurately)
router.post('/orders/:id/reject', requireAuth, requireDeskRole, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { reason = 'Rejected by order desk' } = req.body;

  const order = await prisma.order.findUnique({
    where: { id },
    include: { lines: true, retailer: true },
  });

  if (!order) {
    return res.status(404).json({ error: 'Order not found.' });
  }

  // Prevent multiple rejections restoring stock multiple times!
  if (order.status === 'REJECTED') {
    return res.status(400).json({ error: 'Order has already been rejected. Cannot reject again.' });
  }

  const updatedOrder = await prisma.$transaction(async (tx) => {
    // 1. Only restore stock if stock was actually deducted!
    if (order.stockDeducted) {
      for (const line of order.lines) {
        await tx.sku.update({
          where: { code: line.skuCode },
          data: { stockCases: { increment: line.qtyCases + line.freeCases } },
        });
      }

      // Restore retailer credit
      await tx.retailer.update({
        where: { id: order.retailerId },
        data: { creditUsed: { decrement: order.grandTotal } },
      });
    }

    return await tx.order.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectionReason: reason,
        stockDeducted: false,
        auditLogs: {
          create: [
            {
              userId: req.user!.id,
              userName: req.user!.name,
              action: 'ORDER_REJECTED',
              details: `Rejected by ${req.user!.name}. Reason: ${reason}. Inventory restored to warehouse.`,
            },
          ],
        },
      },
      include: { retailer: true, lines: { include: { sku: true } } },
    });
  });

  return res.json({ success: true, order: formatPrismaOrder(updatedOrder) });
});

// 6. Export to Tally (Guards against exporting unapproved orders!)
router.get('/orders/:id/export-tally', requireAuth, requireDeskRole, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { format = 'xml' } = req.query as { format?: 'xml' | 'csv' };

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      retailer: true,
      lines: { include: { sku: true } },
    },
  });

  if (!order) {
    return res.status(404).json({ error: 'Order not found.' });
  }

  // Guard: Orders can only be exported to Tally once approved!
  if (order.status !== 'APPROVED') {
    return res.status(400).json({
      error: `Cannot export order ${order.orderNumber} to Tally: Only APPROVED orders can be exported. Current status is ${order.status}.`,
    });
  }

  const voucherNo = order.tallyVoucherNo || `JBP-SALES-2026-${Math.floor(1000 + Math.random() * 9000)}`;

  await prisma.order.update({
    where: { id },
    data: {
      tallyExported: true,
      tallyVoucherNo: voucherNo,
      auditLogs: {
        create: [
          {
            userId: req.user!.id,
            userName: req.user!.name,
            action: 'TALLY_EXPORTED',
            details: `Exported format: ${format.toUpperCase()} (Voucher: ${voucherNo})`,
          },
        ],
      },
    },
  });

  const formattedOrder = formatPrismaOrder(order);

  if (format === 'csv') {
    const csvContent = generateTallyCsv(formattedOrder);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${order.orderNumber}-tally.csv"`);
    return res.send(csvContent);
  } else {
    const xmlContent = generateTallyXml(formattedOrder);
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename="${order.orderNumber}-tally.xml"`);
    return res.send(xmlContent);
  }
});

// 7. Operations Dashboard (Inactive Retailers > 14 days and Van Loading summary)
router.get('/dashboard', requireAuth, requireDeskRole, async (_req: AuthenticatedRequest, res: Response) => {
  const FOURTEEN_DAYS_AGO = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  // Inactive retailers (no order in past 14 days)
  const inactiveRetailers = await prisma.retailer.findMany({
    where: {
      OR: [
        { lastOrderAt: null },
        { lastOrderAt: { lt: FOURTEEN_DAYS_AGO } },
      ],
    },
    orderBy: { lastOrderAt: 'asc' },
  });

  // Approved orders awaiting van loading
  const approvedOrders = await prisma.order.findMany({
    where: { status: 'APPROVED' },
    include: { lines: { include: { sku: true } } },
  });

  // Aggregate van loading quantities
  const vanLoadingSummary: Record<string, { skuCode: string; skuName: string; totalCases: number; freeCases: number }> = {};
  for (const o of approvedOrders) {
    for (const l of o.lines) {
      if (!vanLoadingSummary[l.skuCode]) {
        vanLoadingSummary[l.skuCode] = {
          skuCode: l.skuCode,
          skuName: l.sku.name,
          totalCases: 0,
          freeCases: 0,
        };
      }
      vanLoadingSummary[l.skuCode].totalCases += l.qtyCases;
      vanLoadingSummary[l.skuCode].freeCases += l.freeCases;
    }
  }

  const pendingDeskCount = await prisma.order.count({
    where: { status: 'PENDING_DESK_REVIEW' },
  });
  const creditHoldCount = await prisma.order.count({
    where: { status: 'CREDIT_HOLD' },
  });
  const totalRetailers = await prisma.retailer.count();

  return res.json({
    pendingDeskCount,
    creditHoldCount,
    totalRetailers,
    inactiveRetailers,
    approvedOrdersCount: approvedOrders.length,
    vanLoadingSummary: Object.values(vanLoadingSummary),
  });
});

export default router;
