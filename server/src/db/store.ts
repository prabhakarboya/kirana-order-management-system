import {
  SkuItem,
  RetailerProfile,
  OrderRecord,
  OrderStatus,
  OrderSource,
  Role,
} from '../types.js';
import { calculateLineScheme, calculateOrderSummary } from '../schemeEngine/index.js';

export interface UserRecord {
  id: string;
  phone: string;
  name: string;
  role: Role;
  retailerId?: string;
}

export interface AliasRecord {
  id: string;
  retailerId?: string | null;
  phrase: string;
  skuCode: string;
}

export interface AuditRecord {
  id: string;
  orderId: string;
  userName: string;
  action: string;
  details: string;
  timestamp: string;
}

class DatabaseStore {
  public users: UserRecord[] = [];
  public retailers: RetailerProfile[] = [];
  public catalog: SkuItem[] = [];
  public orders: OrderRecord[] = [];
  public aliases: AliasRecord[] = [];
  public auditLogs: AuditRecord[] = [];

  constructor() {
    this.seed();
  }

  private seed() {
    // 1. Seed SKUs from the brief
    this.catalog = [
      {
        code: 'SKU-BS-075',
        name: 'Glucose biscuit 75 g, case of 96',
        brand: 'Parle',
        category: 'Biscuits',
        unitLabel: 'case of 96',
        piecesPerCase: 96,
        dealerPricePerPiece: 8.1,
        dealerPricePerCase: 777.6, // 8.10 * 96 pieces
        gstIncluded: false,
        gstRate: 18,
        stockCases: 340,
        imageUrl: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400&q=80',
        scheme: {
          id: 'SCH-001',
          skuCode: 'SKU-BS-075',
          type: 'FREE_GOODS',
          title: 'Buy 10 cases get 1 free',
          description: 'For every 10 cases ordered, receive 1 additional case free of charge.',
          config: { buyQty: 10, freeQty: 1 },
          isActive: true,
        },
      },
      {
        code: 'SKU-DT-1KG',
        name: 'Detergent powder 1 kg, case of 20',
        brand: 'Wheel Active',
        category: 'Home Care',
        unitLabel: 'case of 20',
        piecesPerCase: 20,
        dealerPricePerPiece: 101.5,
        dealerPricePerCase: 2030.0, // 101.50 * 20 pieces
        gstIncluded: false,
        gstRate: 18,
        stockCases: 85,
        imageUrl: 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=400&q=80',
        scheme: {
          id: 'SCH-002',
          skuCode: 'SKU-DT-1KG',
          type: 'SLAB_PERCENT',
          title: '3% off on 5 or more cases',
          description: 'Flat 3% slab discount applied on bill when ordering 5 or more cases.',
          config: { minQty: 5, discountPercent: 3 },
          isActive: true,
        },
      },
      {
        code: 'SKU-TE-250',
        name: 'Tea leaf 250 g, case of 40',
        brand: 'Red Label',
        category: 'Beverages',
        unitLabel: 'case of 40',
        piecesPerCase: 40,
        dealerPricePerPiece: 118.0,
        dealerPricePerCase: 4720.0, // 118.00 * 40 pieces
        gstIncluded: false,
        gstRate: 5,
        stockCases: 0, // Stock-out as per sample data
        imageUrl: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=400&q=80',
        scheme: undefined,
      },
    ];

    // 2. Seed Users & Retailers
    this.retailers = [
      {
        id: 'RET-001',
        userId: 'USR-RET-1',
        shopName: 'Sharma General Store',
        ownerName: 'Ramesh Sharma',
        phone: '9826011111',
        address: 'Shop 12, Gorakhpur Main Road, Jabalpur, MP',
        creditLimit: 75000,
        creditUsed: 12500,
        salesmanName: 'Rajesh Sharma',
        lastOrderDate: '2026-11-03T10:15:00.000Z',
      },
      {
        id: 'RET-002',
        userId: 'USR-RET-2',
        shopName: 'Gupta Kirana & Provisions',
        ownerName: 'Sunil Gupta',
        phone: '9826022222',
        address: '44 Sadar Bazar, Cantt, Jabalpur, MP',
        creditLimit: 50000,
        creditUsed: 46800, // Near limit
        salesmanName: 'Rajesh Sharma',
        lastOrderDate: '2026-10-31T14:30:00.000Z',
      },
      {
        id: 'RET-003',
        userId: 'USR-RET-3',
        shopName: 'Mahakaushal Traders',
        ownerName: 'Anand Agrawal',
        phone: '9826033333',
        address: '7 Wright Town, Near Stadium, Jabalpur, MP',
        creditLimit: 100000,
        creditUsed: 15000,
        salesmanName: 'Vikas Tiwari',
        lastOrderDate: '2026-11-04T09:45:00.000Z',
      },
      {
        id: 'RET-004',
        userId: 'USR-RET-4',
        shopName: 'Janta Daily Needs',
        ownerName: 'Mohan Yadav',
        phone: '9826044444',
        address: 'Near Old Bus Stand, Adhartal, Jabalpur, MP',
        creditLimit: 30000,
        creditUsed: 0,
        salesmanName: 'Rajesh Sharma',
        lastOrderDate: '2026-10-18T11:00:00.000Z', // 19 days ago (inactivity > 14 days alert)
      },
    ];

    this.users = [
      {
        id: 'USR-DESK-1',
        phone: '9826099999',
        name: 'Priya Jain (Order Desk)',
        role: 'DESK',
      },
      {
        id: 'USR-RET-1',
        phone: '9826011111',
        name: 'Ramesh Sharma',
        role: 'RETAILER',
        retailerId: 'RET-001',
      },
      {
        id: 'USR-RET-2',
        phone: '9826022222',
        name: 'Sunil Gupta',
        role: 'RETAILER',
        retailerId: 'RET-002',
      },
      {
        id: 'USR-RET-3',
        phone: '9826033333',
        name: 'Anand Agrawal',
        role: 'RETAILER',
        retailerId: 'RET-003',
      },
      {
        id: 'USR-RET-4',
        phone: '9826044444',
        name: 'Mohan Yadav',
        role: 'RETAILER',
        retailerId: 'RET-004',
      },
    ];

    // 3. Seed Base Aliases
    this.aliases = [
      {
        id: 'AL-001',
        retailerId: null, // Global
        phrase: 'biscuit chhota',
        skuCode: 'SKU-BS-075',
      },
      {
        id: 'AL-002',
        retailerId: null,
        phrase: 'washing powder 1 kilo',
        skuCode: 'SKU-DT-1KG',
      },
      {
        id: 'AL-003',
        retailerId: null,
        phrase: 'chai patti 250 wala',
        skuCode: 'SKU-TE-250',
      },
      {
        id: 'AL-004',
        retailerId: 'RET-001',
        phrase: 'parle 5 wala',
        skuCode: 'SKU-BS-075',
      },
    ];

    // 4. Seed sample past orders (one approved, one pending desk review)
    const lineB1 = calculateLineScheme({ sku: this.catalog[0], qtyCases: 10 });
    const lineB2 = calculateLineScheme({ sku: this.catalog[1], qtyCases: 5 });
    const orderSum1 = calculateOrderSummary([lineB1, lineB2]);

    this.orders.push({
      id: 'ORD-2026-0001',
      orderNumber: 'ORD-2026-0001',
      retailerId: 'RET-001',
      retailerName: 'Sharma General Store',
      status: 'APPROVED',
      source: 'APP',
      subtotal: orderSum1.subtotal,
      discountTotal: orderSum1.discountTotal,
      gstTotal: orderSum1.gstTotal,
      grandTotal: orderSum1.grandTotal,
      totalSavings: orderSum1.totalSavings,
      creditApproved: true,
      tallyExported: true,
      tallyVoucherNo: 'JBP-SALES-2026-8801',
      createdAt: '2026-11-03T10:15:00.000Z',
      updatedAt: '2026-11-03T11:00:00.000Z',
      lines: [
        {
          id: 'LN-001',
          skuCode: this.catalog[0].code,
          skuName: this.catalog[0].name,
          qtyCases: lineB1.qtyCases,
          freeCases: lineB1.freeCases,
          unitPrice: lineB1.unitCasePrice,
          discountAmount: lineB1.discountAmount,
          gstRate: lineB1.gstRate,
          gstAmount: lineB1.gstAmount,
          lineTotal: lineB1.lineTotal,
          schemeApplied: lineB1.explanation,
        },
        {
          id: 'LN-002',
          skuCode: this.catalog[1].code,
          skuName: this.catalog[1].name,
          qtyCases: lineB2.qtyCases,
          freeCases: lineB2.freeCases,
          unitPrice: lineB2.unitCasePrice,
          discountAmount: lineB2.discountAmount,
          gstRate: lineB2.gstRate,
          gstAmount: lineB2.gstAmount,
          lineTotal: lineB2.lineTotal,
          schemeApplied: lineB2.explanation,
        },
      ],
    });

    // Seed pending AI captured order from the exact sample message in the brief
    const lineAi1 = calculateLineScheme({ sku: this.catalog[0], qtyCases: 5 });
    const lineAi2 = calculateLineScheme({ sku: this.catalog[1], qtyCases: 2 });
    const orderSumAi = calculateOrderSummary([lineAi1, lineAi2]);

    this.orders.push({
      id: 'ORD-2026-0002',
      orderNumber: 'ORD-2026-0002',
      retailerId: 'RET-001',
      retailerName: 'Sharma General Store',
      status: 'PENDING_DESK_REVIEW',
      source: 'AI_TEXT',
      rawMessage: 'bhaiya 5 peti biscuit chhota, 2 peti washing powder 1 kilo, chai patti 250 wala 1 peti',
      subtotal: orderSumAi.subtotal,
      discountTotal: orderSumAi.discountTotal,
      gstTotal: orderSumAi.gstTotal,
      grandTotal: orderSumAi.grandTotal,
      totalSavings: orderSumAi.totalSavings,
      creditApproved: true,
      tallyExported: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lines: [
        {
          id: 'LN-003',
          skuCode: this.catalog[0].code,
          skuName: this.catalog[0].name,
          qtyCases: lineAi1.qtyCases,
          freeCases: lineAi1.freeCases,
          unitPrice: lineAi1.unitCasePrice,
          discountAmount: lineAi1.discountAmount,
          gstRate: lineAi1.gstRate,
          gstAmount: lineAi1.gstAmount,
          lineTotal: lineAi1.lineTotal,
          schemeApplied: lineAi1.explanation,
        },
        {
          id: 'LN-004',
          skuCode: this.catalog[1].code,
          skuName: this.catalog[1].name,
          qtyCases: lineAi2.qtyCases,
          freeCases: lineAi2.freeCases,
          unitPrice: lineAi2.unitCasePrice,
          discountAmount: lineAi2.discountAmount,
          gstRate: lineAi2.gstRate,
          gstAmount: lineAi2.gstAmount,
          lineTotal: lineAi2.lineTotal,
          schemeApplied: lineAi2.explanation,
        },
      ],
    });
  }

  public getRetailer(id: string): RetailerProfile | undefined {
    return this.retailers.find((r) => r.id === id);
  }

  public getRetailerByUserId(userId: string): RetailerProfile | undefined {
    return this.retailers.find((r) => r.userId === userId);
  }

  public getSku(code: string): SkuItem | undefined {
    return this.catalog.find((s) => s.code === code);
  }

  public addAlias(retailerId: string | null, phrase: string, skuCode: string): AliasRecord {
    const existing = this.aliases.find(
      (a) => a.retailerId === retailerId && a.phrase.toLowerCase() === phrase.toLowerCase()
    );
    if (existing) {
      existing.skuCode = skuCode;
      return existing;
    }
    const newAlias: AliasRecord = {
      id: `AL-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      retailerId,
      phrase: phrase.toLowerCase().trim(),
      skuCode,
    };
    this.aliases.push(newAlias);
    return newAlias;
  }

  public logAudit(orderId: string, userName: string, action: string, details: string) {
    this.auditLogs.unshift({
      id: `AUD-${Date.now()}`,
      orderId,
      userName,
      action,
      details,
      timestamp: new Date().toISOString(),
    });
  }
}

export const dbStore = new DatabaseStore();
