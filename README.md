# FMCG Kirana Retailer Ordering App with AI Order Capture

**Client:** Company A, Jabalpur, Madhya Pradesh  
**Annual Revenue:** ₹85–100 Crore | **Retail Network:** 1,800 Kirana Stores  

A full-stack ordering platform built for FMCG distributors and kirana merchants, featuring deterministic trade schemes, multimodal AI order transcription (WhatsApp text, voice notes, photo lists), human-in-the-loop verification, and Tally ERP 9 / TallyPrime XML & CSV export.

---

## Key Features

1. **Retailer PWA (Mobile-First):**
   - Live distributor pricing, stock status indicators (In Stock, Low Stock, Out of Stock), and active trade schemes.
   - Clear GST tax breakdown on every SKU.
   - Dynamic cart with scheme calculation, working breakdown (*"20 cases → 2 free"*), and *"You saved ₹X"* summary.
   - 1-tap past order repeat.
   - Bilingual support: Instant toggle between **Hindi (हिंदी)** and **English**.

2. **Scheme Calculation Engine:**
   - Free goods calculation: *"Buy 10 cases get 1 free"* (repeats per batch).
   - Slab percentage discounts: *"3% off on 5 or more cases"*.
   - Paisa precision rounding with zero floating point drift.
   - Comprehensive Vitest unit test suite (15/15 tests passing).

3. **Multimodal AI Order Capture:**
   - Transcribes unstructured Hindi/Hinglish text (e.g. *"bhaiya 5 peti biscuit chhota, 2 peti washing powder 1 kilo, chai patti 250 wala 1 peti"*).
   - Line-by-line confidence scoring and 2 alternative SKU suggestions.
   - Unit clarification prompt when unit (peti vs piece) is ambiguous—never guesses.
   - Stock-out alerts (tea leaf has 0 cases).
   - Human-in-the-loop confirmation before any order commitment.
   - Self-learning alias loop: desk corrections automatically become aliases for that retailer.

4. **Order Desk & Tally ERP Export:**
   - Review queue with status and retailer filters.
   - Line editing and credit limit checks.
   - 1-click XML and CSV export formatted for Tally ERP 9 and TallyPrime sales vouchers.
   - Operations dashboard: Inactive retailers (>14 days without order) and dispatch van loading summaries.

---

## Tech Stack

- **Frontend:** React 18, Vite, TypeScript, Tailwind CSS, Lucide Icons, react-i18next, PWA
- **Backend:** Node.js, Express, TypeScript, Zod, JWT auth, cookie-parser
- **Database & ORM:** MySQL 8, Prisma ORM (with zero-config resilient in-memory fallback store)
- **Testing:** Vitest

---

## Quick Start

```bash
# Install dependencies
npm install

# Run unit tests
npm test

# Start frontend (port 5173) and backend (port 5000)
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

Demo logins are pre-configured:
- **Retailer Demo:** Phone `9826011111`, OTP `123456` (Sharma General Store)
- **Order Desk Demo:** Phone `9826099999`, OTP `123456` (Priya Jain)
- Or click the **"Switch to Desk / Switch to Retailer"** button in the header for 1-tap role switching.
