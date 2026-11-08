import { describe, it, expect } from 'vitest';
import { parseOrderTextFallback } from './parser.js';
import { SkuItem } from '../types.js';

describe('AI Order Capture Parser Unit Tests', () => {
  const sampleCatalog: SkuItem[] = [
    {
      code: 'SKU-BS-075',
      name: 'Glucose biscuit 75 g, case of 96',
      brand: 'Parle',
      category: 'Biscuits',
      unitLabel: 'case of 96',
      piecesPerCase: 96,
      dealerPricePerPiece: 8.1,
      dealerPricePerCase: 777.6,
      gstIncluded: false,
      gstRate: 18,
      stockCases: 340,
    },
    {
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
    },
    {
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
      stockCases: 0, // Stock-out
    },
  ];

  it('correctly parses the sample Hindi/Hinglish message from the brief', () => {
    const rawMessage = 'bhaiya 5 peti biscuit chhota, 2 peti washing powder 1 kilo, chai patti 250 wala 1 peti';
    const result = parseOrderTextFallback(rawMessage, sampleCatalog);

    expect(result.items.length).toBe(3);

    // Item 1: Biscuit
    const item1 = result.items[0];
    expect(item1.skuCode).toBe('SKU-BS-075');
    expect(item1.requestedQty).toBe(5);
    expect(item1.detectedUnit).toBe('case');
    expect(item1.confidence).toBeGreaterThan(0.85);
    expect(item1.stockStatus).toBe('IN_STOCK');
    expect(item1.alternativeSkus.length).toBe(2);

    // Item 2: Washing powder
    const item2 = result.items[1];
    expect(item2.skuCode).toBe('SKU-DT-1KG');
    expect(item2.requestedQty).toBe(2);
    expect(item2.detectedUnit).toBe('case');
    expect(item2.confidence).toBeGreaterThan(0.85);
    expect(item2.stockStatus).toBe('IN_STOCK');

    // Item 3: Tea leaf (Out of stock)
    const item3 = result.items[2];
    expect(item3.skuCode).toBe('SKU-TE-250');
    expect(item3.requestedQty).toBe(1);
    expect(item3.detectedUnit).toBe('case');
    expect(item3.stockStatus).toBe('OUT_OF_STOCK');
    expect(item3.warning).toContain('out of stock');

    // Order flags out-of-stock item
    expect(result.needsClarification).toBe(true);
  });

  it('asks a question when the unit is unclear (never guesses)', () => {
    // Missing unit: "5 biscuit chhota" instead of "5 peti"
    const raw = '5 biscuit chhota';
    const result = parseOrderTextFallback(raw, sampleCatalog);

    expect(result.items.length).toBe(1);
    const item = result.items[0];
    expect(item.detectedUnit).toBe('unclear');
    expect(item.clarificationQuestion).toBeDefined();
    expect(item.clarificationQuestion).toContain('Did you mean 5 case(s)');
    expect(result.needsClarification).toBe(true);
  });

  it('learns and applies retailer-specific aliases from desk corrections', () => {
    // Custom slang not in standard vocabulary
    const customSlang = '2 peti chamak special';

    // Before alias: fails to find detergent
    const beforeResult = parseOrderTextFallback(customSlang, sampleCatalog, []);
    expect(beforeResult.items[0].skuCode).toBeNull();

    // After alias is learned from desk correction
    const learnedAliases = [
      {
        retailerId: 'RET-001',
        phrase: 'chamak special',
        skuCode: 'SKU-DT-1KG',
      },
    ];

    const afterResult = parseOrderTextFallback(customSlang, sampleCatalog, learnedAliases);
    expect(afterResult.items[0].skuCode).toBe('SKU-DT-1KG');
    expect(afterResult.items[0].confidence).toBe(0.98);
  });

  it('correctly handles zero quantity strings like "chai patti 250 wala 0 peti"', () => {
    const raw = 'bhaiya 5 peti biscuit chhota, 2 peti washing powder 1 kilo, chai patti 250 wala 0 peti';
    const result = parseOrderTextFallback(raw, sampleCatalog);

    expect(result.items.length).toBe(3);

    const teaItem = result.items[2];
    expect(teaItem.skuCode).toBe('SKU-TE-250');
    expect(teaItem.requestedQty).toBe(0);
    expect(teaItem.resolvedCases).toBe(0);
    expect(teaItem.detectedUnit).toBe('case');
    expect(teaItem.warning).toContain('Requested quantity is 0 cases');
  });
});
