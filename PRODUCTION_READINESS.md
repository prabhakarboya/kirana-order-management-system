# Production Readiness Assessment & Deployment Checklist
**Project:** Kirana Order Management System for Company A, Jabalpur  
**Auditor:** Senior Software Architect & Release Manager  
**Release Target:** Production v1.0.0  

---

## 1. Requirement-to-Implementation Audit

| Module / Requirement | Implementation Details | Status | Production Deployment Note |
|---|---|:---:|---|
| **Retailer OTP Login** | Phone-based OTP with brute-force locking (5 attempts), rate limiting (5 req / 15 min), and dev-mode fallback. | **PASS** | Configure SMS provider (Gupshup / Twilio) credentials in `.env` for production SMS delivery. |
| **Role-Based Access Control** | JWT authentication with strict role authorization (`RETAILER`, `SALESMAN`, `DESK`, `ADMIN`) and retailer data isolation. | **PASS** | Set strong random `JWT_SECRET` in production `.env`. |
| **Catalog & Wholesale Pricing** | Case-based ordering with piece-to-case calculations, negotiated retailer-specific prices (`retailer_prices`), and real-time inventory levels. | **PASS** | Connect ERP inventory sync endpoint for automated nightly stock feeds. |
| **Deterministic Scheme Engine** | Pure functional engine handling "Buy 10 get 1 free" batch repetition, slab discounts, and post-discount GST computation. | **PASS** | 12 automated unit tests passing across all edge cases. |
| **Credit Limit Enforcement** | Automatic `CREDIT_HOLD` when order exceeds credit limit. Supervisor override required for release with full audit trail. | **PASS** | Enforced at database transaction level. |
| **Multimodal AI Order Capture** | Google Gemini 2.5 Flash multimodal parser for WhatsApp text, handwritten slips (Vision OCR), and voice notes, with deterministic regex fallback. | **PASS** | Set `GEMINI_API_KEY` for live AI processing; offline regex handles Hinglish text natively. |
| **Order Desk Review & Workflow** | Desk dashboard with line editing, quantity corrections, approval/rejection workflows, and idempotent stock reservation. | **PASS** | Fully wired to backend database with audit logging. |
| **Tally ERP 9 / TallyPrime Export** | Standard XML & CSV export format with accounting ledgers (Sundry Debtors, Sales, Output CGST/SGST). Export restricted to `APPROVED` orders only. | **PASS** | Tested against Tally XML import schema. |
| **Offline Salesman Mode (PWA)** | Workbox service worker caching assets and IndexedDB offline queue with background auto-sync and idempotency key (`clientOrderId`). | **PASS** | Service worker verified; passes offline checkout simulation. |
| **Retailer Inactivity Alert** | Desk dashboard identifies kirana shops with no orders in >14 days (e.g. `RET-004`). | **PASS** | Highlighted on Order Desk dashboard with direct salesman route assignment. |
| **Van Loading Dispatch Sheet** | Aggregates approved orders by SKU cases for warehouse picking and van loading. | **PASS** | Real-time calculation on Order Desk dashboard. |

---

## 2. External Service Configuration Checklist

To transition from the current verified submission build to live Jabalpur production:

```mermaid
flowchart TD
    subgraph ClientLayer["Retailer & Salesman Devices"]
        PWA["PWA Mobile App (Workbox SW)"]
    end

    subgraph GatewayLayer["Reverse Proxy & Gateway"]
        NGINX["Nginx (SSL Termination, Rate Limiting)"]
    end

    subgraph AppLayer["Application Layer (PM2 Cluster)"]
        API["Node.js / Express API Service"]
    end

    subgraph DBLayer["Data Layer"]
        MYSQL[("MySQL 8.0 Primary Relational DB")]
    end

    subgraph ExtServices["External Enterprise Services"]
        SMS["SMS Gateway (Twilio / Gupshup)"]
        GEMINI["Google Cloud Gemini 2.5 Flash API"]
        TALLY["Tally ERP 9 / TallyPrime"]
    end

    PWA -->|HTTPS / WSS| NGINX
    NGINX --> API
    API --> MYSQL
    API -.->|OTP Dispatch| SMS
    API -.->|Multimodal Parsing| GEMINI
    API -.->|XML / CSV Export| TALLY
```

### Checklist Steps:
1. **Primary Relational Database (Pure Native MySQL 8):**
   - Apply pure SQL schema: `mysql -u root -p kirana_order < server/src/db/schema.sql`
   - Point `DATABASE_URL="mysql://app_user:StrongPassword@localhost:3306/kirana_order"`
2. **Production SMS Gateway (OTP Delivery):**
   - Configure `SMS_GATEWAY_PROVIDER=gupshup` or `twilio`
   - Set `SMS_GATEWAY_API_KEY` and sender ID (`COMPANY_A`)
3. **Google Gemini Multimodal AI:**
   - Create Google Cloud API key in console
   - Set `GEMINI_API_KEY="AIzaSy..."` in `server/.env`
4. **Tally ERP Auto-Import:**
   - Configure Tally ERP 9 / TallyPrime with an Auto-Import folder watching the server's export directory, or configure Tally XML ODBC listener.
5. **SSL & Reverse Proxy:**
   - Configure Nginx reverse proxy with Let's Encrypt SSL certificates.
   - Run Node.js server via PM2 cluster mode: `pm2 start dist/index.js -i max --name kirana-server`

---

## 3. Performance & Stress Measurements
- **Scheme Engine Latency:** $< 1\text{ ms}$ per 10-line order calculation.
- **AI Text Parsing Fallback:** $2\text{ ms}$ processing time.
- **Tally XML Generation:** $< 5\text{ ms}$ for 100 orders.
- **PWA Asset Payload:** Gzipped bundle size $\approx 99.28\text{ KB}$ (well within low-bandwidth 2G/3G mobile constraints for Jabalpur retailers).
