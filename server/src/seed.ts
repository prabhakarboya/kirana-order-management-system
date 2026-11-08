import { prisma } from './db/prisma.js';

export async function seedDatabase() {
  console.log('Seeding FMCG database for Company A, Jabalpur...');

  // Clear existing records to ensure clean idempotent seed
  await prisma.offlineSyncQueue.deleteMany();
  await prisma.exportHistory.deleteMany();
  await prisma.aiOrderCaptureRecord.deleteMany();
  await prisma.orderStatusHistory.deleteMany();
  await prisma.schemeRule.deleteMany();
  await prisma.creditAccount.deleteMany();
  await prisma.retailerSalesmanAssignment.deleteMany();
  await prisma.salesman.deleteMany();
  await prisma.productImage.deleteMany();
  await prisma.category.deleteMany();
  await prisma.brand.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.orderLine.deleteMany();
  await prisma.order.deleteMany();
  await prisma.alias.deleteMany();
  await prisma.scheme.deleteMany();
  await prisma.retailerPrice.deleteMany();
  await prisma.retailer.deleteMany();
  await prisma.user.deleteMany();
  await prisma.sku.deleteMany();

  // 1. Seed Brands & Categories (Distributor for 4 packaged food and home-care brands)
  await prisma.brand.createMany({
    data: [
      { id: 'BRD-001', code: 'PARLE', name: 'Parle Products', description: 'Packaged Biscuits and Snacks' },
      { id: 'BRD-002', code: 'HUL', name: 'Hindustan Unilever', description: 'Home and Fabric Care' },
      { id: 'BRD-003', code: 'TATA', name: 'Tata Consumer Products', description: 'Tea, Coffee and Food Essentials' },
      { id: 'BRD-004', code: 'ITC', name: 'ITC Foods', description: 'Packaged Foods and Confectionery' },
    ],
  });

  await prisma.category.createMany({
    data: [
      { id: 'CAT-001', name: 'Biscuits', description: 'Glucose, Marie, Cream and Sweet biscuits' },
      { id: 'CAT-002', name: 'Home Care', description: 'Detergent powders, soaps, dishwash and cleaners' },
      { id: 'CAT-003', name: 'Beverages', description: 'Tea leaf, tea dust, coffee and beverage mixes' },
    ],
  });

  // 2. Seed SKUs from the brief
  const skus = [
    {
      code: 'SKU-BS-075',
      name: 'Glucose biscuit 75 g, case of 96',
      brand: 'Parle',
      category: 'Biscuits',
      unitLabel: 'case of 96',
      piecesPerCase: 96,
      dealerPrice: 8.1,
      casePrice: 777.6, // 8.10 * 96
      gstIncluded: false,
      gstRate: 18.0,
      stockCases: 340,
      imageUrl: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400&q=80',
    },
    {
      code: 'SKU-DT-1KG',
      name: 'Detergent powder 1 kg, case of 20',
      brand: 'Wheel Active',
      category: 'Home Care',
      unitLabel: 'case of 20',
      piecesPerCase: 20,
      dealerPrice: 101.5,
      casePrice: 2030.0, // 101.50 * 20
      gstIncluded: false,
      gstRate: 18.0,
      stockCases: 85,
      imageUrl: 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=400&q=80',
    },
    {
      code: 'SKU-TE-250',
      name: 'Tea leaf 250 g, case of 40',
      brand: 'Red Label',
      category: 'Beverages',
      unitLabel: 'case of 40',
      piecesPerCase: 40,
      dealerPrice: 118.0,
      casePrice: 4720.0, // 118.00 * 40
      gstIncluded: false,
      gstRate: 5.0,
      stockCases: 0, // Stock-out as per sample data
      imageUrl: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=400&q=80',
    },
  ];

  for (const s of skus) {
    await prisma.sku.create({ data: s });
  }

  // 3. Seed Trade Schemes and Scheme Rules
  await prisma.scheme.create({
    data: {
      id: 'SCH-001',
      skuCode: 'SKU-BS-075',
      type: 'FREE_GOODS',
      title: 'Buy 10 cases get 1 free',
      description: 'Buy 10 cases get 1 free case. Repeats per complete batch of 10 cases.',
      configJson: JSON.stringify({ buyQty: 10, freeQty: 1 }),
      isActive: true,
    },
  });

  await prisma.scheme.create({
    data: {
      id: 'SCH-002',
      skuCode: 'SKU-DT-1KG',
      type: 'SLAB_PERCENT',
      title: '3% off on 5 or more cases',
      description: '3% slab discount on ordering 5 or more cases.',
      configJson: JSON.stringify({ minQty: 5, discountPercent: 3 }),
      isActive: true,
    },
  });

  await prisma.schemeRule.createMany({
    data: [
      {
        id: 'RULE-001',
        schemeId: 'SCH-001',
        ruleType: 'FREE_GOODS',
        minQty: 10,
        discountPercent: 0,
        freeSkuCode: 'SKU-BS-075',
        freeQty: 1,
      },
      {
        id: 'RULE-002',
        schemeId: 'SCH-002',
        ruleType: 'SLAB_PERCENT',
        minQty: 5,
        discountPercent: 3.0,
        freeSkuCode: null,
        freeQty: 0,
      },
    ],
  });

  // 4. Seed Users, Salesmen & Retailers
  // Desk User
  await prisma.user.create({
    data: {
      id: 'USR-DESK-1',
      phone: '9826099999',
      name: 'Priya Jain (Order Desk)',
      role: 'DESK',
      otpCode: '123456',
      otpExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
  });

  // Salesmen
  const sm1User = await prisma.user.create({
    data: {
      id: 'USR-SM-1',
      phone: '9826077777',
      name: 'Rajesh Sharma (Salesman)',
      role: 'SALESMAN',
      otpCode: '123456',
      otpExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
  });
  const sm1 = await prisma.salesman.create({
    data: {
      id: 'SM-001',
      userId: sm1User.id,
      name: 'Rajesh Sharma',
      phone: '9826077777',
      territory: 'Jabalpur Central & Gorakhpur',
      isActive: true,
    },
  });

  const sm2User = await prisma.user.create({
    data: {
      id: 'USR-SM-2',
      phone: '9826088888',
      name: 'Vikas Tiwari (Salesman)',
      role: 'SALESMAN',
      otpCode: '123456',
      otpExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
  });
  const sm2 = await prisma.salesman.create({
    data: {
      id: 'SM-002',
      userId: sm2User.id,
      name: 'Vikas Tiwari',
      phone: '9826088888',
      territory: 'Jabalpur North & Wright Town',
      isActive: true,
    },
  });

  // Retailer 1
  const u1 = await prisma.user.create({
    data: {
      id: 'USR-RET-1',
      phone: '9826011111',
      name: 'Ramesh Sharma',
      role: 'RETAILER',
      otpCode: '123456',
      otpExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
  });
  const ret1 = await prisma.retailer.create({
    data: {
      id: 'RET-001',
      userId: u1.id,
      shopName: 'Sharma General Store',
      ownerName: 'Ramesh Sharma',
      phone: '9826011111',
      address: 'Shop 12, Gorakhpur Main Road, Jabalpur, MP',
      creditLimit: 75000.0,
      creditUsed: 12500.0,
      salesmanName: 'Rajesh Sharma',
      lastOrderAt: new Date('2026-11-03T10:15:00.000Z'),
    },
  });

  // Retailer 2
  const u2 = await prisma.user.create({
    data: {
      id: 'USR-RET-2',
      phone: '9826022222',
      name: 'Sunil Gupta',
      role: 'RETAILER',
      otpCode: '123456',
      otpExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
  });
  await prisma.retailer.create({
    data: {
      id: 'RET-002',
      userId: u2.id,
      shopName: 'Gupta Kirana & Provisions',
      ownerName: 'Sunil Gupta',
      phone: '9826022222',
      address: '44 Sadar Bazar, Cantt, Jabalpur, MP',
      creditLimit: 50000.0,
      creditUsed: 46800.0, // Near limit
      salesmanName: 'Rajesh Sharma',
      lastOrderAt: new Date('2026-10-31T14:30:00.000Z'),
    },
  });

  // Retailer 3 (Negotiated custom price)
  const u3 = await prisma.user.create({
    data: {
      id: 'USR-RET-3',
      phone: '9826033333',
      name: 'Anand Agrawal',
      role: 'RETAILER',
      otpCode: '123456',
      otpExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
  });
  const ret3 = await prisma.retailer.create({
    data: {
      id: 'RET-003',
      userId: u3.id,
      shopName: 'Mahakaushal Traders',
      ownerName: 'Anand Agrawal',
      phone: '9826033333',
      address: '7 Wright Town, Near Stadium, Jabalpur, MP',
      creditLimit: 100000.0,
      creditUsed: 15000.0,
      salesmanName: 'Vikas Tiwari',
      lastOrderAt: new Date('2026-11-04T09:45:00.000Z'),
    },
  });
  // Custom negotiated price for Ret 3: ₹98/piece = ₹1960/case for Detergent
  await prisma.retailerPrice.create({
    data: {
      retailerId: ret3.id,
      skuCode: 'SKU-DT-1KG',
      dealerPrice: 98.0,
      casePrice: 1960.0,
    },
  });

  // Retailer 4 (Inactive > 14 days)
  const u4 = await prisma.user.create({
    data: {
      id: 'USR-RET-4',
      phone: '9826044444',
      name: 'Mohan Yadav',
      role: 'RETAILER',
      otpCode: '123456',
      otpExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
  });
  await prisma.retailer.create({
    data: {
      id: 'RET-004',
      userId: u4.id,
      shopName: 'Janta Daily Needs',
      ownerName: 'Mohan Yadav',
      phone: '9826044444',
      address: 'Near Old Bus Stand, Adhartal, Jabalpur, MP',
      creditLimit: 30000.0,
      creditUsed: 0.0,
      salesmanName: 'Rajesh Sharma',
      lastOrderAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), // 20 days ago
    },
  });

  // Seed Retailer Credit Accounts & Sanctioned Limits
  await prisma.creditAccount.createMany({
    data: [
      { retailerId: ret1.id, creditLimit: 75000.0, creditUsed: 12500.0, creditAvailable: 62500.0, status: 'ACTIVE', paymentTermsDays: 7 },
      { retailerId: 'RET-002', creditLimit: 50000.0, creditUsed: 46800.0, creditAvailable: 3200.0, status: 'ACTIVE', paymentTermsDays: 7 },
      { retailerId: ret3.id, creditLimit: 100000.0, creditUsed: 15000.0, creditAvailable: 85000.0, status: 'ACTIVE', paymentTermsDays: 14 },
      { retailerId: 'RET-004', creditLimit: 30000.0, creditUsed: 0.0, creditAvailable: 30000.0, status: 'ACTIVE', paymentTermsDays: 7 },
    ],
  });

  // Seed Salesman Territory Route Assignments
  await prisma.retailerSalesmanAssignment.createMany({
    data: [
      { retailerId: ret1.id, salesmanId: sm1.id, isPrimary: true },
      { retailerId: 'RET-002', salesmanId: sm1.id, isPrimary: true },
      { retailerId: ret3.id, salesmanId: sm2.id, isPrimary: true },
      { retailerId: 'RET-004', salesmanId: sm1.id, isPrimary: true },
    ],
  });

  // 5. Seed Aliases (Global & Retailer-specific)
  await prisma.alias.createMany({
    data: [
      { phrase: 'biscuit chhota', skuCode: 'SKU-BS-075', confidence: 0.95 },
      { phrase: 'washing powder 1 kilo', skuCode: 'SKU-DT-1KG', confidence: 0.95 },
      { phrase: 'chai patti 250 wala', skuCode: 'SKU-TE-250', confidence: 0.95 },
      { retailerId: ret1.id, phrase: 'parle 5 wala', skuCode: 'SKU-BS-075', confidence: 0.98 },
    ],
  });

  // 5. Seed Past Approved Order for Retailer 1
  const ord1 = await prisma.order.create({
    data: {
      id: 'ORD-2026-0001',
      orderNumber: 'ORD-2026-0001',
      retailerId: ret1.id,
      status: 'APPROVED',
      source: 'APP',
      subtotal: 17926.0,
      discountTotal: 304.5,
      gstTotal: 3171.87,
      grandTotal: 20793.37,
      totalSavings: 1082.1,
      creditApproved: true,
      stockDeducted: true,
      tallyExported: true,
      tallyVoucherNo: 'JBP-SALES-2026-8801',
      createdAt: new Date('2026-11-03T10:15:00.000Z'),
      lines: {
        create: [
          {
            skuCode: 'SKU-BS-075',
            qtyCases: 10,
            freeCases: 1,
            unitPrice: 777.6,
            discountAmount: 0.0,
            gstRate: 18.0,
            gstAmount: 1399.68,
            lineTotal: 9175.68,
            schemeApplied: 'Buy 10 get 1 free applied: 10 cases ordered → 1 free case',
          },
          {
            skuCode: 'SKU-DT-1KG',
            qtyCases: 5,
            freeCases: 0,
            unitPrice: 2030.0,
            discountAmount: 304.5,
            gstRate: 18.0,
            gstAmount: 1772.19,
            lineTotal: 11617.69,
            schemeApplied: 'Slab discount applied: 3% off on 5+ cases',
          },
        ],
      },
      auditLogs: {
        create: [
          {
            userName: 'Ramesh Sharma',
            action: 'ORDER_CREATED',
            details: 'Order placed via APP for ₹20,793.37',
          },
          {
            userName: 'Priya Jain (Order Desk)',
            action: 'STATUS_APPROVED',
            details: 'Approved for dispatch and exported to Tally Voucher JBP-SALES-2026-8801',
          },
        ],
      },
    },
  });

  // 6. Seed Pending AI Captured Order from the exact raw message in the brief!
  await prisma.order.create({
    data: {
      id: 'ORD-2026-0002',
      orderNumber: 'ORD-2026-0002',
      retailerId: ret1.id,
      status: 'PENDING_DESK_REVIEW',
      source: 'AI_TEXT',
      rawMessage: 'bhaiya 5 peti biscuit chhota, 2 peti washing powder 1 kilo, chai patti 250 wala 1 peti',
      subtotal: 7948.0,
      discountTotal: 0.0,
      gstTotal: 1430.64,
      grandTotal: 9378.64,
      totalSavings: 0.0,
      creditApproved: true,
      stockDeducted: false,
      tallyExported: false,
      createdAt: new Date(),
      lines: {
        create: [
          {
            skuCode: 'SKU-BS-075',
            qtyCases: 5,
            freeCases: 0,
            unitPrice: 777.6,
            discountAmount: 0.0,
            gstRate: 18.0,
            gstAmount: 699.84,
            lineTotal: 4587.84,
            schemeApplied: 'Standard rate (no scheme threshold reached)',
          },
          {
            skuCode: 'SKU-DT-1KG',
            qtyCases: 2,
            freeCases: 0,
            unitPrice: 2030.0,
            discountAmount: 0.0,
            gstRate: 18.0,
            gstAmount: 730.8,
            lineTotal: 4790.8,
            schemeApplied: 'Standard rate (no scheme threshold reached)',
          },
        ],
      },
      auditLogs: {
        create: [
          {
            userName: 'AI Order Capture',
            action: 'ORDER_CAPTURED_AI',
            details: 'Captured from WhatsApp text. Tea Leaf omitted due to 0 warehouse stock.',
          },
        ],
      },
    },
  });

  // Seed Order Status History & AI Capture Records
  await prisma.orderStatusHistory.createMany({
    data: [
      {
        orderId: ord1.id,
        statusFrom: 'PENDING_DESK_REVIEW',
        statusTo: 'APPROVED',
        changedByName: 'Priya Jain (Order Desk)',
        reason: 'Order verified and approved for dispatch. Tally voucher generated.',
        timestamp: new Date('2026-11-03T10:15:00.000Z'),
      },
      {
        orderId: 'ORD-2026-0002',
        statusFrom: 'NEW_CAPTURE',
        statusTo: 'PENDING_DESK_REVIEW',
        changedByName: 'AI Capture Engine',
        reason: 'Raw text parsed and awaiting Order Desk confirmation.',
        timestamp: new Date(),
      },
    ],
  });

  await prisma.aiOrderCaptureRecord.create({
    data: {
      retailerId: ret1.id,
      channel: 'TEXT',
      rawInput: 'bhaiya 5 peti biscuit chhota, 2 peti washing powder 1 kilo, chai patti 250 wala 1 peti',
      parsedOutputJson: JSON.stringify({
        lines: [
          { skuCode: 'SKU-BS-075', qty: 5, confidence: 0.98 },
          { skuCode: 'SKU-DT-1KG', qty: 2, confidence: 0.95 },
        ],
        warnings: ['Tea leaf 250 g is currently out of stock (0 cases available). Omitted from draft.'],
      }),
      confidenceScore: 0.95,
      reviewStatus: 'REVIEWED',
    },
  });

  console.log('Database seeded successfully with all models and seed records!');
}

// Execute if run directly
if (process.argv[1]?.includes('seed')) {
  seedDatabase()
    .catch((err) => {
      console.error('Seed error:', err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
