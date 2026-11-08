# FMCG Ordering Platform — Business, Accounting & Architectural Assumptions
**Client:** Company A, Jabalpur (Madhya Pradesh)  
**Distributor Profile:** 4 brands, 1,800 kirana shops, 18 salesmen, ₹85–100 Cr annual revenue  

---

## 1. Unit of Measurement & Pricing Hierarchy
- **Per-Piece Dealer Price vs. Case Billed Price:**  
  The dealer prices specified in the master catalog (e.g., ₹8.10 for Glucose biscuit 75 g, ₹101.50 for Detergent powder 1 kg, and ₹118.00 for Tea leaf 250 g) represent the **per-piece wholesale price**.  
  In FMCG distribution, kirana retailers place orders in wholesale **cases** (or cartons/peti). The billed case rate is deterministically calculated as:
  $$\text{Case Price} = \text{Dealer Price per Piece} \times \text{Pieces per Case}$$
  - *Glucose biscuit 75 g:* ₹8.10 × 96 = **₹777.60 per case**
  - *Detergent powder 1 kg:* ₹101.50 × 20 = **₹2,030.00 per case**
  - *Tea leaf 250 g:* ₹118.00 × 40 = **₹4,720.00 per case**
- **Retailer-Specific Negotiated Pricing:**  
  Where a special contract rate is entered in `retailer_prices`, that negotiated case price overrides the standard dealer case price for that retailer only.

---

## 2. Deterministic Trade Scheme Repetition
- **Batch Repetition:**  
  Free goods schemes (e.g., "Buy 10 cases get 1 free case") repeat for every complete integer multiple of the qualifying quantity:
  $$\text{Free Cases} = \left\lfloor \frac{\text{Ordered Cases}}{\text{Buy Threshold}} \right\rfloor \times \text{Free Units}$$
  - 9 cases: 0 free cases
  - 10 cases: 1 free case
  - 19 cases: 1 free case
  - 20 cases: 2 free cases
- **No Fractional Free Goods:**  
  Partial multiples do not earn fractional cases.
- **Slab Percentage Discount:**  
  Applies to the entire qualifying line quantity once the threshold is met (e.g., 3% off on 5 or more cases of Detergent).

---

## 3. GST & Tax Base Calculation
- **Net Taxable Base:**  
  Dealer prices are quoted exclusive of Goods and Services Tax (GST).  
  In accordance with Indian GST laws, trade discounts (slab discounts) are deducted from the line subtotal *before* applying GST:
  $$\text{Taxable Subtotal} = (\text{Case Price} \times \text{Ordered Cases}) - \text{Line Discount}$$
  $$\text{GST Amount} = \text{Taxable Subtotal} \times \left( \frac{\text{GST Rate}}{100} \right)$$
- **GST Rates:**
  - Biscuits (`SKU-BS-075`): 18.0% GST (9% CGST + 9% SGST for intra-state MP supplies)
  - Detergent (`SKU-DT-1KG`): 18.0% GST (9% CGST + 9% SGST)
  - Tea Leaf (`SKU-TE-250`): 5.0% GST (2.5% CGST + 2.5% SGST)
- **Free Goods GST Treatment:**  
  Free trade promotion cases are invoiced at ₹0 billing value with 100% discount, yielding ₹0 net tax liability for the retailer on the free incentive units.

---

## 4. Currency Precision & Rounding
- All sub-calculations (unit price, discount amount, taxable value, GST amount, and grand totals) are rounded to **2 decimal places** (Indian Paise precision) using banker's half-up rounding:
  $$\text{Round}(x) = \frac{\lfloor x \times 100 + 0.5 \rfloor}{100}$$

---

## 5. Warehouse Inventory & Stock-Out Guards
- Orders cannot be placed for SKUs having `0` warehouse stock cases (e.g., Tea leaf 250 g).
- In AI Order Capture (WhatsApp text, handwritten slip photo, or voice note), out-of-stock SKUs are flagged with a prominent warning banner and excluded from draft orders to prevent delivery commitments that cannot be fulfilled.
- **Two-Phase Inventory Reservation Architecture (`stockDeducted`):**  
  To prevent stock overselling between multiple concurrent retailers and field salesmen, inventory is atomically reserved upon order placement inside an ACID transaction with row-level locks (`stockCases = stockCases - ?`). If an order is subsequently rejected or revised by the Order Desk, the reserved inventory is restored idempotently using the boolean guard.

---

## 6. Credit Limit Enforcement & Managerial Override
- Each retailer has a sanctioned `creditLimit` and current `creditUsed`.
- If an order's `grandTotal + creditUsed > creditLimit`, the system automatically flags the order as **`CREDIT_HOLD`**.
- An order on `CREDIT_HOLD` cannot be dispatched or exported to Tally until an Order Desk supervisor explicitly executes a manager override with an audit trail rationale.

---

## 7. Tally ERP 9 / TallyPrime Accounting Integration
- Export format complies with Tally's standard XML `VOUCHER` schema with ledger postings for `Sundry Debtors`, `Sales Account`, and `Output GST` ledgers.
- **Voucher Approval Guard:** Only vouchers in status **`APPROVED`** are exported. Draft, pending, credit-held, or rejected orders are strictly excluded from Tally export files.

---

## 8. Offline Field Sales Sync & Native IndexedDB
- When salesmen visit kirana stores in low-connectivity areas around Jabalpur, orders are queued locally in browser **`IndexedDB`** (`KiranaOfflineDB`) with localStorage fallback.
- Every offline order generates a client-side UUIDv4 (`clientOrderId`).
- Upon reconnection, background sync submits queued orders. The server enforces a **unique database constraint on `clientOrderId`**, preventing double-billing on network timeouts.

---

## 9. Multimodal AI Processing & Honest Error Boundaries
- **WhatsApp Text Parsing:** Powered by Gemini 2.5 Flash with prompt engineering incorporating the retailer's past purchase history. If `GEMINI_API_KEY` is not configured, the system transparently falls back to a deterministic rule-based Hinglish parser.
- **Handwritten Slip OCR & Audio Voice Notes:** Multimodal Vision and Audio capabilities natively utilize Gemini 2.5 Flash. If `GEMINI_API_KEY` is unconfigured, the system returns an honest notification requiring the API key or text input, avoiding fabricated or simulated outputs.
- **Illustrative Data Disclosures:** The 4 distributor brand names (Parle, HUL, Tata, ITC) and specific GST rates are illustrative assumptions matching standard FMCG distributor operations in Madhya Pradesh.
