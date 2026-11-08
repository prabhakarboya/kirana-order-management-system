# FMCG Kirana Retailer Ordering App with Pure Native MySQL 8 & AI Order Capture

**Client:** Company A, Jabalpur, Madhya Pradesh  
**Annual Revenue:** ₹85–100 Crore | **Retail Network:** 1,800 Kirana Stores | **Sales Team:** 18 Salesmen  
**Financial Impact Solved:** **₹52.5 Lakh / Year** (₹31.5L wrong items/redelivery + ₹15.6L order-entry staff + ₹5.4L stock-out margin loss)  
**Database Architecture:** **100% Pure Native MySQL 8 (mysql2/promise)** — Zero Prisma, Zero SQLite.

A production-ready ordering platform built for FMCG distributors and kirana merchants, featuring deterministic trade schemes, multimodal AI order transcription (WhatsApp text, voice notes, photo lists), human-in-the-loop verification, credit hold management, and Tally ERP 9 / TallyPrime XML & CSV export.

---

## Key Features

1. **Retailer & Salesman PWA (Mobile-First):**
   - Live distributor wholesale pricing, case-based billing, stock status indicators (In Stock, Low Stock, Out of Stock), and active trade schemes.
   - Clear GST tax breakdown on every SKU.
   - Dynamic cart with scheme calculation, working breakdown (*"20 cases → 2 free"*), and *"You saved ₹X"* summary.
   - Workbox service worker (`sw.js`) with offline asset precaching and runtime caching.
   - Offline salesman order queue with `clientOrderId` idempotency key and background auto-sync.
   - 1-tap past order repeat.
   - Bilingual support: Instant toggle between **Hindi (हिंदी)** and **English**.

2. **Scheme Calculation Engine:**
   - Free goods calculation: *"Buy 10 cases get 1 free"* (repeats per batch of 10).
   - Slab percentage discounts: *"3% off on 5 or more cases"*.
   - GST computed strictly on post-discount net taxable base.
   - Paisa precision rounding with zero floating point drift.
   - Comprehensive Vitest automated test suite (**25/25 tests passing**).

3. **Multimodal AI Order Capture:**
   - Transcribes unstructured Hindi/Hinglish text (e.g. *"bhaiya 5 peti biscuit chhota, 2 peti washing powder 1 kilo, chai patti 250 wala 1 peti"*).
   - Multimodal Vision OCR for photos of handwritten kirana orders.
   - Voice note audio recording using the Web MediaRecorder API.
   - Line-by-line confidence scoring and 2 alternative SKU suggestions.
   - Unit clarification prompt when unit (peti vs piece) is ambiguous—never guesses.
   - Stock-out alerts (tea leaf has 0 cases) with automatic exclusion from draft order.
   - Human-in-the-loop confirmation before any order commitment.
   - Self-learning alias loop: desk corrections automatically update the retailer alias dictionary.
   - Deterministic rule-based fallback guarantees 100% uptime even without external API keys.

4. **Order Desk & Tally ERP Export:**
   - Review queue with status and retailer filters.
   - Line editing, quantity adjustment, and automatic order recalculation.
   - Sanctioned credit limit checks with automated `CREDIT_HOLD` and supervisor override workflow.
   - 1-click XML and CSV export formatted for Tally ERP 9 and TallyPrime sales vouchers (strictly restricted to `APPROVED` orders).
   - Operations dashboard: Inactive retailers (>14 days without order) and dispatch van loading summaries.

---

## Tech Stack

- **Frontend:** React 18, Vite, TypeScript, Tailwind CSS, Lucide Icons, react-i18next, Workbox PWA
- **Backend:** Node.js, Express, TypeScript, Zod, JWT auth, cookie-parser, express-rate-limit
- **Database:** **Pure Native MySQL 8.0+** with `mysql2/promise` connection pool, 20 relational tables, foreign keys, indexes, and ACID transactions (No Prisma, No SQLite)
- **AI Engine:** Google Gemini 2.5 Flash multimodal parser with deterministic regex fallback
- **Testing:** Vitest v2.1.9 (25/25 automated tests passing)

---

## Quick Start & Running the Application

### 1. Database Setup (MySQL 8)
Ensure MySQL is running on `localhost:3306`:

```bash
# Create the database:
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS kirana_order CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# Apply the relational DDL:
# PowerShell:
Get-Content server/src/db/schema.sql -Raw | mysql -u root -p kirana_order
# Bash:
mysql -u root -p kirana_order < server/src/db/schema.sql
```

### 2. Install & Run Tests
```bash
# Install dependencies
npm install

# Run automated verification tests
cd server
npm test
cd ..
```

### 3. Start Development Servers
```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

Demo logins are pre-configured:
- **Retailer Demo:** Phone `9826011111`, OTP `123456` (Sharma General Store, Gorakhpur Market)
- **Order Desk Demo:** Phone `9826099999`, OTP `123456` (Priya Jain, Order Desk Lead)
- **Salesman Demo:** Phone `9826077777`, OTP `123456` (Rajesh Sharma, Jabalpur Central)
- Or click the **"Switch to Desk / Switch to Retailer"** button in the header for 1-tap role switching.
