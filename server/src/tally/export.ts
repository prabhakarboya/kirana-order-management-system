import { OrderRecord } from '../types.js';

/**
 * Generates Tally ERP 9 / TallyPrime XML standard import payload for sales vouchers.
 */
export function generateTallyXml(order: OrderRecord): string {
  const dateStr = new Date(order.createdAt).toISOString().slice(0, 10).replace(/-/g, '');
  const partyLedger = order.retailerName.replace(/&/g, '&amp;');

  const inventoryEntries = order.lines
    .map((line) => {
      const billedCases = line.qtyCases;
      const billedRate = line.unitPrice;
      const amount = (line.unitPrice * line.qtyCases - line.discountAmount).toFixed(2);

      return `        <ALLINVENTORYENTRIES.LIST>
          <STOCKITEMNAME>${escapeXml(line.skuName)}</STOCKITEMNAME>
          <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
          <RATE>${billedRate.toFixed(2)}/case</RATE>
          <ACTUALQTY>${billedCases + line.freeCases} cases</ACTUALQTY>
          <BILLEDQTY>${billedCases} cases</BILLEDQTY>
          <AMOUNT>${amount}</AMOUNT>
          <DISCOUNT>${line.discountAmount > 0 ? ((line.discountAmount / (line.unitPrice * line.qtyCases)) * 100).toFixed(2) : '0'}</DISCOUNT>
          <BATCHALLOCATIONS.LIST>
            <GODOWNNAME>Jabalpur Main Depot</GODOWNNAME>
            <BATCHNAME>Primary</BATCHNAME>
            <ACTUALQTY>${billedCases + line.freeCases} cases</ACTUALQTY>
            <BILLEDQTY>${billedCases} cases</BILLEDQTY>
            <AMOUNT>${amount}</AMOUNT>
          </BATCHALLOCATIONS.LIST>
        </ALLINVENTORYENTRIES.LIST>`;
    })
    .join('\n');

  // Split GST 50/50 for CGST & SGST (Intra-state MP / Jabalpur)
  const halfGst = (order.gstTotal / 2).toFixed(2);

  return `<?xml version="1.0" encoding="utf-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Sales" ACTION="Create" OBJVIEW="Invoice Voucher View">
            <DATE>${dateStr}</DATE>
            <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
            <VOUCHERNUMBER>${escapeXml(order.orderNumber)}</VOUCHERNUMBER>
            <REFERENCE>${escapeXml(order.id)}</REFERENCE>
            <PARTYLEDGERNAME>${partyLedger}</PARTYLEDGERNAME>
            <PARTYNAME>${partyLedger}</PARTYNAME>
            <BASICBUYERNAME>${partyLedger}</BASICBUYERNAME>
            <ISINVOICE>Yes</ISINVOICE>
            <NARRATION>Kirana Ordering App AI Capture. Source: ${order.source}</NARRATION>

            <!-- Party Ledger Debit -->
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${partyLedger}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-${order.grandTotal.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>

            <!-- Sales Account Credit -->
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>FMCG Sales Account</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${(order.subtotal - order.discountTotal).toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>

            <!-- Output CGST Ledger -->
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Output CGST</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${halfGst}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>

            <!-- Output SGST Ledger -->
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Output SGST</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${halfGst}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>

            <!-- Item Inventory Details -->
${inventoryEntries}
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}

/**
 * Generates CSV Export for Tally / Excel / ERP bulk import.
 */
export function generateTallyCsv(order: OrderRecord): string {
  const headers = [
    'OrderNumber',
    'Date',
    'RetailerName',
    'SkuCode',
    'SkuName',
    'BilledCases',
    'FreeCases',
    'RatePerCase',
    'DiscountAmount',
    'GstRate',
    'GstAmount',
    'LineTotal',
    'SchemeApplied',
    'GrandTotal',
  ];

  const rows = order.lines.map((line) => [
    `"${order.orderNumber}"`,
    `"${new Date(order.createdAt).toISOString().slice(0, 10)}"`,
    `"${order.retailerName.replace(/"/g, '""')}"`,
    `"${line.skuCode}"`,
    `"${line.skuName.replace(/"/g, '""')}"`,
    line.qtyCases,
    line.freeCases,
    line.unitPrice.toFixed(2),
    line.discountAmount.toFixed(2),
    `${line.gstRate}%`,
    line.gstAmount.toFixed(2),
    line.lineTotal.toFixed(2),
    `"${(line.schemeApplied || '').replace(/"/g, '""')}"`,
    order.grandTotal.toFixed(2),
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
