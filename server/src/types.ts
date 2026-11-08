export type Role = 'RETAILER' | 'SALESMAN' | 'DESK' | 'ADMIN';

export type OrderStatus =
  | 'DRAFT'
  | 'PENDING_CONFIRMATION'
  | 'PENDING_DESK_REVIEW'
  | 'CREDIT_HOLD'
  | 'APPROVED'
  | 'REJECTED'
  | 'DISPATCHED';

export type OrderSource = 'APP' | 'AI_TEXT' | 'AI_VOICE' | 'AI_PHOTO' | 'SALESMAN_OFFLINE';

export type SchemeType = 'FREE_GOODS' | 'SLAB_PERCENT' | 'NONE';

export interface SchemeConfig {
  buyQty?: number;
  freeQty?: number;
  minQty?: number;
  discountPercent?: number;
}

export interface SchemeDefinition {
  id: string;
  skuCode: string;
  type: SchemeType;
  title: string;
  description: string;
  config: SchemeConfig;
  isActive: boolean;
}

export interface SkuItem {
  code: string;
  name: string;
  brand: string;
  category: string;
  unitLabel: string;
  piecesPerCase: number;
  dealerPricePerPiece: number;
  dealerPricePerCase: number;
  gstIncluded: boolean;
  gstRate: number; // e.g. 18 for 18%
  stockCases: number;
  imageUrl?: string;
  scheme?: SchemeDefinition;
}

export interface RetailerProfile {
  id: string;
  userId: string;
  shopName: string;
  ownerName: string;
  phone: string;
  address: string;
  creditLimit: number;
  creditUsed: number;
  salesmanName: string;
  lastOrderDate?: string;
}

export interface SchemeCalculationResult {
  skuCode: string;
  qtyCases: number;
  unitCasePrice: number;
  grossAmount: number;
  freeCases: number;
  discountPercent: number;
  discountAmount: number;
  netBaseAmount: number;
  gstRate: number;
  gstAmount: number;
  lineTotal: number;
  savingsAmount: number;
  explanation: string;
  stockWarning?: string;
  stockSufficient: boolean;
}

export interface OrderCalculationSummary {
  items: SchemeCalculationResult[];
  subtotal: number;
  discountTotal: number;
  gstTotal: number;
  grandTotal: number;
  totalSavings: number;
  creditAvailable: number;
  creditExceeded: boolean;
  creditShortfall?: number;
}

export interface AiParsedItem {
  originalText: string;
  skuCode: string | null;
  skuName: string | null;
  requestedQty: number;
  detectedUnit: 'case' | 'piece' | 'unclear';
  resolvedCases: number;
  confidence: number; // 0.0 to 1.0
  alternativeSkus: Array<{
    skuCode: string;
    skuName: string;
    confidence: number;
  }>;
  clarificationQuestion?: string;
  stockStatus: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
  availableStock: number;
  warning?: string;
}

export interface AiParseResponse {
  rawMessage: string;
  items: AiParsedItem[];
  allResolved: boolean;
  needsClarification: boolean;
  parserMode: 'llm' | 'gemini_llm' | 'deterministic_fallback';
}

export interface OrderRecord {
  id: string;
  orderNumber: string;
  retailerId: string;
  retailerName: string;
  status: OrderStatus;
  source: OrderSource;
  rawMessage?: string;
  subtotal: number;
  discountTotal: number;
  gstTotal: number;
  grandTotal: number;
  totalSavings: number;
  creditApproved: boolean;
  rejectionReason?: string;
  tallyExported: boolean;
  tallyVoucherNo?: string;
  createdAt: string;
  updatedAt: string;
  lines: Array<{
    id: string;
    skuCode: string;
    skuName: string;
    qtyCases: number;
    freeCases: number;
    unitPrice: number;
    discountAmount: number;
    gstRate: number;
    gstAmount: number;
    lineTotal: number;
    schemeApplied: string;
  }>;
}
