import {
  SkuItem,
  SchemeDefinition,
  SchemeCalculationResult,
  OrderCalculationSummary,
} from '../types.js';

/**
 * Utility: Rounds currency amount to exactly 2 decimal places (paisa precision)
 * avoiding IEEE 754 floating point drift.
 */
export function roundPaisa(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

export interface CalculateLineItemParams {
  sku: SkuItem;
  qtyCases: number;
  customCasePrice?: number;
  schemeOverride?: SchemeDefinition | null;
}

/**
 * Pure, deterministic function to calculate scheme benefits, discounts, GST, and totals for a single order line.
 */
export function calculateLineScheme(params: CalculateLineItemParams): SchemeCalculationResult {
  const { sku, qtyCases, customCasePrice, schemeOverride } = params;

  if (qtyCases < 0 || !Number.isInteger(qtyCases)) {
    throw new Error(`Quantity must be a non-negative integer. Received: ${qtyCases}`);
  }

  const unitCasePrice = customCasePrice !== undefined ? customCasePrice : sku.dealerPricePerCase;
  const grossAmount = roundPaisa(qtyCases * unitCasePrice);
  const scheme = schemeOverride !== undefined ? schemeOverride : sku.scheme;

  let freeCases = 0;
  let discountPercent = 0;
  let discountAmount = 0;
  let explanation = 'Standard rate (no scheme applied)';

  if (scheme && scheme.isActive && qtyCases > 0) {
    if (scheme.type === 'FREE_GOODS') {
      const buyQty = scheme.config.buyQty || 10;
      const freeQty = scheme.config.freeQty || 1;

      // Repeats per batch: e.g. 20 cases / 10 = 2 batches * 1 free = 2 free cases
      const batches = Math.floor(qtyCases / buyQty);
      freeCases = batches * freeQty;

      if (freeCases > 0) {
        explanation = `Buy ${buyQty} get ${freeQty} free applied: ${qtyCases} cases ordered → ${freeCases} free ${
          freeCases === 1 ? 'case' : 'cases'
        }`;
      } else {
        const remainingToNext = buyQty - (qtyCases % buyQty);
        explanation = `Scheme available: Buy ${buyQty} get ${freeQty} free (add ${remainingToNext} more ${
          remainingToNext === 1 ? 'case' : 'cases'
        } to qualify)`;
      }
    } else if (scheme.type === 'SLAB_PERCENT') {
      const minQty = scheme.config.minQty || 5;
      const percent = scheme.config.discountPercent || 3;

      if (qtyCases >= minQty) {
        discountPercent = percent;
        discountAmount = roundPaisa(grossAmount * (percent / 100));
        explanation = `Slab discount applied: ${percent}% off on ${minQty}+ cases (saved ₹${discountAmount.toFixed(
          2
        )})`;
      } else {
        const remainingToSlab = minQty - qtyCases;
        explanation = `Scheme available: ${percent}% off on ${minQty}+ cases (add ${remainingToSlab} more ${
          remainingToSlab === 1 ? 'case' : 'cases'
        } to qualify)`;
      }
    }
  }

  // Net taxable base
  const netBaseAmount = roundPaisa(grossAmount - discountAmount);

  // GST calculation (prices are exclusive of GST as standard B2B FMCG invoice)
  const gstRate = sku.gstRate || 0;
  const gstAmount = roundPaisa(netBaseAmount * (gstRate / 100));
  const lineTotal = roundPaisa(netBaseAmount + gstAmount);

  // Savings include direct cash discount + value of free goods
  const freeGoodsValue = roundPaisa(freeCases * unitCasePrice);
  const savingsAmount = roundPaisa(discountAmount + freeGoodsValue);

  // Stock sufficiency check: total cases to dispatch = billed cases + free cases
  const totalPhysicalCasesNeeded = qtyCases + freeCases;
  let stockSufficient = true;
  let stockWarning: string | undefined;

  if (sku.stockCases <= 0) {
    stockSufficient = false;
    stockWarning = `Out of stock: ${sku.name} currently has 0 cases in warehouse`;
  } else if (totalPhysicalCasesNeeded > sku.stockCases) {
    stockSufficient = false;
    stockWarning = `Insufficient stock: requested ${totalPhysicalCasesNeeded} cases (${qtyCases} billed + ${freeCases} free), but only ${sku.stockCases} available`;
  }

  return {
    skuCode: sku.code,
    skuName: sku.name,
    qtyCases,
    unitCasePrice,
    grossAmount,
    freeCases,
    discountPercent,
    discountAmount,
    netBaseAmount,
    gstRate,
    gstAmount,
    lineTotal,
    savingsAmount,
    explanation,
    stockWarning,
    stockSufficient,
  };
}

/**
 * Calculates order totals, tax breakup, total savings, and evaluates credit limits.
 */
export function calculateOrderSummary(
  lines: SchemeCalculationResult[],
  creditLimit: number = 50000,
  creditUsed: number = 0
): OrderCalculationSummary {
  let subtotal = 0;
  let discountTotal = 0;
  let gstTotal = 0;
  let grandTotal = 0;
  let totalSavings = 0;

  for (const line of lines) {
    subtotal = roundPaisa(subtotal + line.grossAmount);
    discountTotal = roundPaisa(discountTotal + line.discountAmount);
    gstTotal = roundPaisa(gstTotal + line.gstAmount);
    grandTotal = roundPaisa(grandTotal + line.lineTotal);
    totalSavings = roundPaisa(totalSavings + line.savingsAmount);
  }

  const creditAvailable = roundPaisa(creditLimit - creditUsed);
  const creditExceeded = grandTotal > creditAvailable;
  const creditShortfall = creditExceeded ? roundPaisa(grandTotal - creditAvailable) : 0;

  return {
    items: lines,
    subtotal,
    discountTotal,
    gstTotal,
    grandTotal,
    totalSavings,
    creditAvailable,
    creditExceeded,
    creditShortfall,
  };
}
