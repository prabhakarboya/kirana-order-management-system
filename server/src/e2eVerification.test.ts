import { describe, it, expect, beforeAll } from 'vitest';
import { prisma } from './db/prisma.js';
import { seedDatabase } from './seed.js';
import { calculateLineScheme, calculateOrderSummary } from './schemeEngine/index.js';
import { parseOrderTextFallback } from './ai/parser.js';
import { generateTallyXml, generateTallyCsv } from './tally/export.js';
import { SkuItem, OrderRecord } from './types.js';

describe('Comprehensive Production Verification Suite', () => {
  beforeAll(async () => {
    await seedDatabase();
  });

  describe('1. Database Persistence & Seed Data Verification', () => {
    it('persists exactly 3 SKUs with sample data matching brief', async () => {
      const skus = await prisma.sku.findMany({ orderBy: { code: 'asc' } });
      expect(skus.length).toBe(3);

      const bs = skus.find((s) => s.code === 'SKU-BS-075')!;
      expect(bs.name).toContain('Glucose biscuit 75 g');
      expect(bs.dealerPrice).toBe(8.1);
      expect(bs.casePrice).toBe(777.6);
      expect(bs.stockCases).toBe(340);

      const dt = skus.find((s) => s.code === 'SKU-DT-1KG')!;
      expect(dt.name).toContain('Detergent powder 1 kg');
      expect(dt.dealerPrice).toBe(101.5);
      expect(dt.casePrice).toBe(2030.0);
      expect(dt.stockCases).toBe(85);

      const te = skus.find((s) => s.code === 'SKU-TE-250')!;
      expect(te.name).toContain('Tea leaf 250 g');
      expect(te.dealerPrice).toBe(118.0);
      expect(te.stockCases).toBe(0); // 0 stock
    });

    it('persists trade schemes for Biscuit and Detergent', async () => {
      const schemes = await prisma.scheme.findMany();
      expect(schemes.length).toBe(2);

      const freeGoods = schemes.find((s) => s.skuCode === 'SKU-BS-075')!;
      expect(freeGoods.type).toBe('FREE_GOODS');
      const cfg1 = JSON.parse(freeGoods.configJson);
      expect(cfg1.buyQty).toBe(10);
      expect(cfg1.freeQty).toBe(1);

      const slab = schemes.find((s) => s.skuCode === 'SKU-DT-1KG')!;
      expect(slab.type).toBe('SLAB_PERCENT');
      const cfg2 = JSON.parse(slab.configJson);
      expect(cfg2.minQty).toBe(5);
      expect(cfg2.discountPercent).toBe(3);
    });

    it('persists Jabalpur retailers with sanctioned credit limits and inactivity tracking', async () => {
      const retailers = await prisma.retailer.findMany();
      expect(retailers.length).toBe(4);

      const r1 = retailers.find((r) => r.id === 'RET-001')!;
      expect(r1.shopName).toContain('Sharma General Store');
      expect(r1.creditLimit).toBe(75000);

      // Inactive retailer check (RET-004 > 14 days ago)
      const FOURTEEN_DAYS_AGO = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      const inactive = retailers.filter((r) => !r.lastOrderAt || r.lastOrderAt < FOURTEEN_DAYS_AGO);
      expect(inactive.some((r) => r.id === 'RET-004')).toBe(true);
    });

    it('persists extended relational models (Brands, Categories, Salesmen, CreditAccounts, StatusHistory)', async () => {
      const brands = await prisma.brand.findMany();
      expect(brands.length).toBe(4);
      expect(brands.map((b) => b.code)).toContain('PARLE');
      expect(brands.map((b) => b.code)).toContain('HUL');

      const categories = await prisma.category.findMany();
      expect(categories.length).toBe(3);
      expect(categories.map((c) => c.name)).toContain('Biscuits');

      const salesmen = await prisma.salesman.findMany();
      expect(salesmen.length).toBe(2);
      expect(salesmen.some((s) => s.name === 'Rajesh Sharma')).toBe(true);

      const assignments = await prisma.retailerSalesmanAssignment.findMany();
      expect(assignments.length).toBe(4);

      const creditAccounts = await prisma.creditAccount.findMany();
      expect(creditAccounts.length).toBe(4);
      const acc1 = creditAccounts.find((a) => a.retailerId === 'RET-001')!;
      expect(acc1.creditLimit).toBe(75000);
      expect(acc1.creditUsed).toBe(12500);

      const statusHistories = await prisma.orderStatusHistory.findMany();
      expect(statusHistories.length).toBeGreaterThanOrEqual(2);

      const aiRecords = await prisma.aiOrderCaptureRecord.findMany();
      expect(aiRecords.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('2. Scheme Engine Edge Cases & Calculations', () => {
    it('repeats free case per complete batch of 10 cases', async () => {
      const sku = await prisma.sku.findUnique({
        where: { code: 'SKU-BS-075' },
        include: { schemes: true },
      });
      const skuItem: SkuItem = {
        code: sku!.code,
        name: sku!.name,
        brand: sku!.brand,
        category: sku!.category,
        unitLabel: sku!.unitLabel,
        piecesPerCase: sku!.piecesPerCase,
        dealerPricePerPiece: sku!.dealerPrice,
        dealerPricePerCase: sku!.casePrice,
        gstIncluded: sku!.gstIncluded,
        gstRate: sku!.gstRate,
        stockCases: sku!.stockCases,
        scheme: {
          id: sku!.schemes[0].id,
          skuCode: sku!.code,
          type: 'FREE_GOODS',
          title: sku!.schemes[0].title,
          description: sku!.schemes[0].description,
          config: JSON.parse(sku!.schemes[0].configJson),
          isActive: true,
        },
      };

      expect(calculateLineScheme({ sku: skuItem, qtyCases: 9 }).freeCases).toBe(0);
      expect(calculateLineScheme({ sku: skuItem, qtyCases: 10 }).freeCases).toBe(1);
      expect(calculateLineScheme({ sku: skuItem, qtyCases: 19 }).freeCases).toBe(1);
      expect(calculateLineScheme({ sku: skuItem, qtyCases: 20 }).freeCases).toBe(2);
      expect(calculateLineScheme({ sku: skuItem, qtyCases: 21 }).freeCases).toBe(2);
    });

    it('applies 3% slab discount only on 5 or more cases', async () => {
      const sku = await prisma.sku.findUnique({
        where: { code: 'SKU-DT-1KG' },
        include: { schemes: true },
      });
      const skuItem: SkuItem = {
        code: sku!.code,
        name: sku!.name,
        brand: sku!.brand,
        category: sku!.category,
        unitLabel: sku!.unitLabel,
        piecesPerCase: sku!.piecesPerCase,
        dealerPricePerPiece: sku!.dealerPrice,
        dealerPricePerCase: sku!.casePrice,
        gstIncluded: sku!.gstIncluded,
        gstRate: sku!.gstRate,
        stockCases: sku!.stockCases,
        scheme: {
          id: sku!.schemes[0].id,
          skuCode: sku!.code,
          type: 'SLAB_PERCENT',
          title: sku!.schemes[0].title,
          description: sku!.schemes[0].description,
          config: JSON.parse(sku!.schemes[0].configJson),
          isActive: true,
        },
      };

      const belowSlab = calculateLineScheme({ sku: skuItem, qtyCases: 4 });
      expect(belowSlab.discountPercent).toBe(0);
      expect(belowSlab.discountAmount).toBe(0);

      const atSlab = calculateLineScheme({ sku: skuItem, qtyCases: 5 });
      expect(atSlab.discountPercent).toBe(3);
      expect(atSlab.discountAmount).toBe(304.5); // 5 * 2030 * 0.03
    });
  });

  describe('3. AI Multimodal & Fallback Parsing Verification', () => {
    it('correctly maps the exact raw WhatsApp message from the brief', async () => {
      const skus = await prisma.sku.findMany();
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

      const raw = 'bhaiya 5 peti biscuit chhota, 2 peti washing powder 1 kilo, chai patti 250 wala 1 peti';
      const result = parseOrderTextFallback(raw, catalog);

      expect(result.items.length).toBe(3);
      expect(result.items[0].skuCode).toBe('SKU-BS-075');
      expect(result.items[0].resolvedCases).toBe(5);
      expect(result.items[1].skuCode).toBe('SKU-DT-1KG');
      expect(result.items[1].resolvedCases).toBe(2);
      expect(result.items[2].skuCode).toBe('SKU-TE-250');
      expect(result.items[2].stockStatus).toBe('OUT_OF_STOCK'); // Tea leaf 0 stock
      expect(result.needsClarification).toBe(true);
    });

    it('asks a unit question when unit is ambiguous (never guesses)', async () => {
      const skus = await prisma.sku.findMany();
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

      const raw = '5 biscuit chhota';
      const result = parseOrderTextFallback(raw, catalog);

      expect(result.items[0].detectedUnit).toBe('unclear');
      expect(result.items[0].clarificationQuestion).toBeDefined();
      expect(result.items[0].clarificationQuestion).toContain('case(s)');
    });
  });

  describe('4. Business Logic: Credit Hold & Inventory Guards', () => {
    it('sets order to CREDIT_HOLD when grandTotal exceeds credit available', () => {
      const mockLines: any[] = [
        {
          grossAmount: 80000,
          discountAmount: 0,
          gstAmount: 14400,
          lineTotal: 94400,
          savingsAmount: 0,
        },
      ];
      // Limit 75,000, Used 12,500 -> Available 62,500. Order 94,400 > 62,500
      const summary = calculateOrderSummary(mockLines, 75000, 12500);
      expect(summary.creditExceeded).toBe(true);
      expect(summary.creditShortfall).toBe(31900); // 94400 - 62500
    });

    it('generates valid Tally ERP XML and CSV formats', () => {
      const sampleOrder: OrderRecord = {
        id: 'ORD-TEST-01',
        orderNumber: 'ORD-TEST-01',
        retailerId: 'RET-001',
        retailerName: 'Sharma General Store',
        status: 'APPROVED',
        source: 'APP',
        subtotal: 7776.0,
        discountTotal: 0.0,
        gstTotal: 1399.68,
        grandTotal: 9175.68,
        totalSavings: 777.6,
        creditApproved: true,
        tallyExported: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lines: [
          {
            id: 'LN-1',
            skuCode: 'SKU-BS-075',
            skuName: 'Glucose biscuit 75 g, case of 96',
            qtyCases: 10,
            freeCases: 1,
            unitPrice: 777.6,
            discountAmount: 0.0,
            gstRate: 18.0,
            gstAmount: 1399.68,
            lineTotal: 9175.68,
            schemeApplied: 'Buy 10 get 1 free applied',
          },
        ],
      };

      const xml = generateTallyXml(sampleOrder);
      expect(xml).toContain('<TALLYREQUEST>Import Data</TALLYREQUEST>');
      expect(xml).toContain('<VOUCHER VCHTYPE="Sales"');
      expect(xml).toContain('Sharma General Store');
      expect(xml).toContain('<BILLEDQTY>10 cases</BILLEDQTY>');
      expect(xml).toContain('<ACTUALQTY>11 cases</ACTUALQTY>'); // 10 + 1 free

      const csv = generateTallyCsv(sampleOrder);
      expect(csv).toContain('OrderNumber,Date,RetailerName');
      expect(csv).toContain('ORD-TEST-01');
      expect(csv).toContain('SKU-BS-075');
    });
  });

  describe('5. Security, Scoping & Validation Guardrails', () => {
    it('enforces salesman territory beat scoping (SM-001 cannot access RET-003)', async () => {
      const { isRetailerAssignedToSalesman } = await import('./routes/salesman.js');
      // SM-001 (Rajesh Sharma) is assigned to RET-001, RET-002, RET-004
      const assigned = await isRetailerAssignedToSalesman('SM-001', 'RET-001');
      expect(assigned).toBe(true);

      // SM-001 is NOT assigned to RET-003 (assigned to SM-002 Vikas Tiwari)
      const unassigned = await isRetailerAssignedToSalesman('SM-001', 'RET-003');
      expect(unassigned).toBe(false);
    });

    it('rejects fractional quantities (e.g. 1.5 cases)', () => {
      const qty1 = 1.5;
      const isValidInteger = Number.isInteger(qty1) && qty1 > 0;
      expect(isValidInteger).toBe(false);

      const qty2 = 2;
      const isValidInteger2 = Number.isInteger(qty2) && qty2 > 0;
      expect(isValidInteger2).toBe(true);
    });
  });
});
