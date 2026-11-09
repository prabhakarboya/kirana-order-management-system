import { Router, Response } from 'express';
import { prisma } from '../db/prisma.js';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth.js';

const router = Router();

// Helper: Check if a retailer is assigned to a salesman
export async function isRetailerAssignedToSalesman(salesmanId: string | undefined, retailerId: string): Promise<boolean> {
  if (!salesmanId || !retailerId) return false;
  const rows = await (prisma as any).rawQuery(
    `SELECT 1 FROM retailer_salesman_assignments WHERE salesmanId = ? AND retailerId = ? LIMIT 1`,
    [salesmanId, retailerId]
  );
  return Array.isArray(rows) && rows.length > 0;
}

// Middleware: Verify user is a Salesman or Order Desk
function requireSalesmanOrDesk(req: AuthenticatedRequest, res: Response, next: () => void) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (req.user.role !== 'SALESMAN' && req.user.role !== 'DESK') {
    return res.status(403).json({ error: 'Access restricted to Salesmen and Order Desk.' });
  }
  next();
}

// 1. Get assigned kirana retailers for the logged-in salesman (strictly scoped)
router.get('/my-retailers', requireAuth, requireSalesmanOrDesk, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const salesmanId = user.salesman?.id;

  try {
    let retailers: any[] = [];
    if (user.role === 'SALESMAN') {
      if (salesmanId) {
        const rows = await (prisma as any).rawQuery(
          `SELECT r.*, rsa.isPrimary 
           FROM retailers r
           JOIN retailer_salesman_assignments rsa ON r.id = rsa.retailerId
           WHERE rsa.salesmanId = ?
           ORDER BY r.shopName ASC`,
          [salesmanId]
        );
        retailers = Array.isArray(rows) ? rows : [];
      } else {
        retailers = [];
      }
    } else {
      // Order Desk can view all retailers across Jabalpur
      retailers = await prisma.retailer.findMany({ orderBy: { shopName: 'asc' } });
    }

    return res.json({
      salesman: user.salesman || { name: user.name, territory: 'Jabalpur Beat' },
      retailers: retailers.map((r) => ({
        id: r.id,
        shopName: r.shopName,
        ownerName: r.ownerName,
        phone: r.phone,
        address: r.address,
        creditLimit: Number(r.creditLimit),
        creditUsed: Number(r.creditUsed),
        creditAvailable: Math.max(0, Number(r.creditLimit) - Number(r.creditUsed)),
        lastOrderAt: r.lastOrderAt ? new Date(r.lastOrderAt).toISOString() : null,
      })),
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch assigned retailers: ' + err.message });
  }
});

// 2. Get specific retailer detail for shop visit (strictly scoped to assigned salesman or desk)
router.get('/retailer/:id', requireAuth, requireSalesmanOrDesk, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  if (user.role === 'SALESMAN') {
    const isAssigned = await isRetailerAssignedToSalesman(user.salesman?.id, id);
    if (!isAssigned) {
      return res.status(403).json({ error: 'Access denied: Retailer is not assigned to your route/beat.' });
    }
  }

  try {
    const retailer = await prisma.retailer.findUnique({ where: { id } });
    if (!retailer) {
      return res.status(404).json({ error: 'Retailer not found.' });
    }

    const customPrices = await prisma.retailerPrice.findMany({ where: { retailerId: id } });
    const skus = await prisma.sku.findMany({
      where: { isActive: true },
      include: { schemes: { where: { isActive: true } } },
    });

    const customPriceMap = new Map(customPrices.map((cp) => [cp.skuCode, cp.casePrice]));
    const catalog = skus.map((s) => ({
      code: s.code,
      name: s.name,
      brand: s.brand,
      category: s.category,
      unitLabel: s.unitLabel,
      piecesPerCase: s.piecesPerCase,
      dealerPricePerPiece: s.dealerPrice,
      dealerPricePerCase: customPriceMap.get(s.code) ?? s.casePrice,
      hasCustomPrice: customPriceMap.has(s.code),
      gstIncluded: s.gstIncluded,
      gstRate: s.gstRate,
      stockCases: s.stockCases,
      scheme: s.schemes?.[0]
        ? {
            id: s.schemes[0].id,
            title: s.schemes[0].title,
            description: s.schemes[0].description,
            type: s.schemes[0].type,
          }
        : undefined,
    }));

    return res.json({
      retailer: {
        id: retailer.id,
        shopName: retailer.shopName,
        ownerName: retailer.ownerName,
        phone: retailer.phone,
        address: retailer.address,
        creditLimit: retailer.creditLimit,
        creditUsed: retailer.creditUsed,
        creditAvailable: Math.max(0, retailer.creditLimit - retailer.creditUsed),
      },
      catalog,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to load retailer visit detail: ' + err.message });
  }
});

export default router;
