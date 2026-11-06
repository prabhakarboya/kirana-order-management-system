import { describe, it, expect } from 'vitest';
import { calculateLineScheme, calculateOrderSummary, roundPaisa } from './index.js';
import { SkuItem } from '../types.js';

describe('Scheme Engine Unit Tests', () => {
  // Test SKU 1: Glucose biscuit (Buy 10 cases get 1 free)
  // 96 pieces per case @ ₹8.10/piece = ₹777.60 / case. GST 18%. Stock: 340
  const biscuitSku: SkuItem = {
    code: 'SKU-BS-075',
    name: 'Glucose biscuit 75 g, case of 96',
    brand: 'Parle',
    category: 'Biscuits',
    unitLabel: 'case of 96',
    piecesPerCase: 96,
    dealerPricePerPiece: 8.1,
    dealerPricePerCase: 777.6, // 8.10 * 96
    gstIncluded: false,
    gstRate: 18,
    stockCases: 340,
    scheme: {
      id: 'SCH-01',
      skuCode: 'SKU-BS-075',
      type: 'FREE_GOODS',
      title: 'Buy 10 cases get 1 free',
      description: 'Get 1 free case for every 10 cases ordered',
      config: { buyQty: 10, freeQty: 1 },
      isActive: true,
    },
  };

  // Test SKU 2: Detergent powder (3% off 5+ cases)
  // 20 pieces per case @ ₹101.50/piece = ₹2030.00 / case. GST 18%. Stock: 85
  const detergentSku: SkuItem = {
    code: 'SKU-DT-1KG',
    name: 'Detergent powder 1 kg, case of 20',
    brand: 'Wheel',
    category: 'Home Care',
    unitLabel: 'case of 20',
    piecesPerCase: 20,
    dealerPricePerPiece: 101.5,
    dealerPricePerCase: 2030.0,
    gstIncluded: false,
    gstRate: 18,
    stockCases: 85,
    scheme: {
      id: 'SCH-02',
      skuCode: 'SKU-DT-1KG',
      type: 'SLAB_PERCENT',
      title: '3% off on 5 or more cases',
      description: 'Flat 3% discount when ordering 5 or more cases',
      config: { minQty: 5, discountPercent: 3 },
      isActive: true,
    },
  };

  // Test SKU 3: Tea leaf (No scheme, 0 stock)
  // 40 pieces per case @ ₹118.00/piece = ₹4720.00 / case. GST 5%. Stock: 0
  const teaSku: SkuItem = {
    code: 'SKU-TE-250',
    name: 'Tea leaf 250 g, case of 40',
    brand: 'Red Label',
    category: 'Beverages',
    unitLabel: 'case of 40',
    piecesPerCase: 40,
    dealerPricePerPiece: 118.0,
    dealerPricePerCase: 4720.0,
    gstIncluded: false,
    gstRate: 5,
    stockCases: 0,
    scheme: undefined,
  };

  describe('Free Goods Scheme Edge Cases (Buy 10 Get 1 Free)', () => {
    it('gives 0 free cases for 9 cases (below threshold)', () => {
      const res = calculateLineScheme({ sku: biscuitSku, qtyCases: 9 });
      expect(res.qtyCases).toBe(9);
      expect(res.freeCases).toBe(0);
      expect(res.grossAmount).toBe(6998.4); // 9 * 777.60
      expect(res.discountAmount).toBe(0);
      expect(res.gstAmount).toBe(1259.71); // 6998.40 * 0.18 = 1259.712 -> 1259.71
      expect(res.lineTotal).toBe(8258.11);
      expect(res.explanation).toContain('Buy 10 get 1 free (add 1 more case to qualify)');
    });

    it('gives exactly 1 free case for 10 cases (exact threshold)', () => {
      const res = calculateLineScheme({ sku: biscuitSku, qtyCases: 10 });
      expect(res.qtyCases).toBe(10);
      expect(res.freeCases).toBe(1);
      expect(res.grossAmount).toBe(7776.0); // 10 * 777.60
      expect(res.discountAmount).toBe(0);
      expect(res.savingsAmount).toBe(777.6); // 1 free case valued at ₹777.60
      expect(res.explanation).toContain('10 cases ordered → 1 free case');
      expect(res.stockSufficient).toBe(true);
    });

    it('repeats scheme for multiple batches: gives 2 free cases for 20 cases', () => {
      const res = calculateLineScheme({ sku: biscuitSku, qtyCases: 20 });
      expect(res.qtyCases).toBe(20);
      expect(res.freeCases).toBe(2);
      expect(res.savingsAmount).toBe(1555.2); // 2 * 777.60
      expect(res.explanation).toContain('20 cases ordered → 2 free cases');
    });

    it('repeats scheme for 21 cases (2 batches completed + 1 extra case): gives 2 free cases', () => {
      const res = calculateLineScheme({ sku: biscuitSku, qtyCases: 21 });
      expect(res.qtyCases).toBe(21);
      expect(res.freeCases).toBe(2);
      expect(res.grossAmount).toBe(16329.6); // 21 * 777.60
      expect(res.savingsAmount).toBe(1555.2);
    });
  });

  describe('Slab Discount Scheme Edge Cases (3% off on 5+ cases)', () => {
    it('applies 0% discount on 4 cases (below slab threshold)', () => {
      const res = calculateLineScheme({ sku: detergentSku, qtyCases: 4 });
      expect(res.discountPercent).toBe(0);
      expect(res.discountAmount).toBe(0);
      expect(res.grossAmount).toBe(8120.0); // 4 * 2030.00
      expect(res.netBaseAmount).toBe(8120.0);
      expect(res.explanation).toContain('add 1 more case to qualify');
    });

    it('applies exactly 3% discount on 5 cases (exact slab threshold)', () => {
      const res = calculateLineScheme({ sku: detergentSku, qtyCases: 5 });
      expect(res.discountPercent).toBe(3);
      expect(res.grossAmount).toBe(10150.0); // 5 * 2030.00
      expect(res.discountAmount).toBe(304.5); // 10150 * 0.03 = 304.50
      expect(res.netBaseAmount).toBe(9845.5); // 10150 - 304.50
      expect(res.gstAmount).toBe(1772.19); // 9845.50 * 0.18 = 1772.19
      expect(res.lineTotal).toBe(11617.69);
      expect(res.explanation).toContain('3% off on 5+ cases');
    });

    it('continues applying 3% discount on 8 cases', () => {
      const res = calculateLineScheme({ sku: detergentSku, qtyCases: 8 });
      expect(res.discountPercent).toBe(3);
      expect(res.grossAmount).toBe(16240.0); // 8 * 2030.00
      expect(res.discountAmount).toBe(487.2); // 16240 * 0.03
    });
  });

  describe('Stock & Out-of-Stock Validation', () => {
    it('flags tea leaf as out of stock (0 stock)', () => {
      const res = calculateLineScheme({ sku: teaSku, qtyCases: 1 });
      expect(res.stockSufficient).toBe(false);
      expect(res.stockWarning).toContain('Out of stock: Tea leaf 250 g, case of 40 currently has 0 cases');
    });

    it('flags insufficient stock when billed cases + free cases exceeds physical warehouse stock', () => {
      // Modify stock to only 10 cases available
      const lowStockBiscuit = { ...biscuitSku, stockCases: 10 };
      // Requesting 10 cases gives 1 free case -> 11 physical cases needed, but only 10 in warehouse
      const res = calculateLineScheme({ sku: lowStockBiscuit, qtyCases: 10 });
      expect(res.freeCases).toBe(1);
      expect(res.stockSufficient).toBe(false);
      expect(res.stockWarning).toContain('requested 11 cases (10 billed + 1 free), but only 10 available');
    });
  });

  describe('Paisa Precision & Rounding Consistency', () => {
    it('rounds numbers to exactly 2 decimals avoiding float precision bugs', () => {
      expect(roundPaisa(10.004)).toBe(10.0);
      expect(roundPaisa(10.005)).toBe(10.01);
      expect(roundPaisa(0.1 + 0.2)).toBe(0.3);
    });

    it('calculates order summary with credit limit check', () => {
      const line1 = calculateLineScheme({ sku: biscuitSku, qtyCases: 10 });
      const line2 = calculateLineScheme({ sku: detergentSku, qtyCases: 5 });

      const summary = calculateOrderSummary([line1, line2], 50000, 10000);
      // Available credit: 50,000 - 10,000 = 40,000
      expect(summary.creditAvailable).toBe(40000);
      expect(summary.grandTotal).toBe(roundPaisa(line1.lineTotal + line2.lineTotal));
      expect(summary.creditExceeded).toBe(false);
    });

    it('flags credit limit breach when order total exceeds available credit', () => {
      const line1 = calculateLineScheme({ sku: detergentSku, qtyCases: 30 }); // ~₹70,000
      const summary = calculateOrderSummary([line1], 50000, 0);
      expect(summary.creditExceeded).toBe(true);
      expect(summary.creditShortfall).toBeGreaterThan(0);
    });
  });
});
