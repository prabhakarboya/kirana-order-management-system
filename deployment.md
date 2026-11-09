# FMCG Kirana Retailer Ordering App - Deployment & Environment Guide
**GitHub Repository:** `https://github.com/prabhakarboya/kirana-order-management-system`  
**Client:** Company A, Jabalpur  
**Solution:** FMCG Distributor Retailer Ordering App with Pure Native MySQL 8 & Multimodal AI Order Capture  
**Database:** Pure Native MySQL 8.0+ (No Prisma, No SQLite)  
**Target Region:** Jabalpur & Mahakaushal Region, Madhya Pradesh  

---

## 1. Quick Start / Local Setup

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **Database**: MySQL 8.0+ running on `localhost:3306`

### Installation & Launch Steps
From the root repository directory:

```bash
# 1. Install dependencies for all workspaces (client and server)
npm install

# 2. Configure MySQL Database
# Create the database in MySQL:
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS kirana_order CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# Apply the pure native SQL schema (DDL):
# On Windows PowerShell:
Get-Content server/src/db/schema.sql -Raw | mysql -u root -p kirana_order
# On Linux / macOS:
mysql -u root -p kirana_order < server/src/db/schema.sql

# 3. Run automated verification test suite (28/28 Tests Passing)
npm test --workspace=server

# 4. Start development servers (Frontend on port 5173, Backend API on port 5000)
npm run dev
# - Retailer Catalogue & AI Order Capture: http://localhost:5173/
# - Salesman Beat Visits & Offline Ordering: http://localhost:5173/salesman
# - Order Desk Queue & Tally Export: http://localhost:5173/desk
```

---

## 2. Environment Variables Specification

Configure the following environment variable names in `server/.env`:

| Environment Variable Name | Required | Functional Purpose |
|---|---|---|
| `PORT` | Optional | Port on which the Express backend HTTP server listens (default: `5000`) |
| `NODE_ENV` | Optional | Runtime environment mode (`development`, `production`, `test`) |
| `DATABASE_URL` | **Required** | Pure MySQL connection URI (`mysql://user:password@host:port/database`) |
| `DB_HOST` | Optional | Database host (fallback if `DATABASE_URL` not set, default: `127.0.0.1`) |
| `DB_PORT` | Optional | Database port (default: `3306`) |
| `DB_USER` | Optional | MySQL username (default: `root`) |
| `DB_PASSWORD` | Optional | MySQL password |
| `DB_NAME` | Optional | MySQL database name (default: `kirana_order`) |
| `JWT_SECRET` | Required | Cryptographic secret key used for signing and verifying JSON Web Tokens |
| `OTP_DEMO_CODE` | Optional | Fixed OTP bypass code for rapid test evaluation in non-production environments (`123456`) |
| `GEMINI_API_KEY` | Optional | Google Gemini API key for multimodal AI order transcription and vision OCR |
| `CLIENT_ORIGIN` | Required | Allowed CORS origin for frontend client requests (`http://localhost:5173`) |

---

## 3. Demo Login Credentials (Non-Production Testing)

The system includes 1-tap demo switching in the top navigation bar, as well as OTP authentication:

- **Retailer Account:**
  - Phone: `9826011111`
  - Demo OTP: `123456`
  - Shop: *Sharma General Store, Gorakhpur Market, Jabalpur*
  - Sanctioned Credit: ₹75,000.00
- **Order Desk Lead:**
  - Phone: `9826099999`
  - Demo OTP: `123456`
  - Staff: *Priya Jain (Order Desk Lead)*
  - Privileges: Review queue, managerial credit override, line editing, Tally XML & CSV exports, operations dashboard.
- **Salesman Account:**
  - Phone: `9826077777`
  - Demo OTP: `123456`
  - Staff: *Rajesh Sharma (Salesman - Jabalpur Central)*
  - Privileges: Mobile PWA, offline order entry, store route orders.

---

## 4. Production Deployment Topology

### Frontend Hosting (Vercel / Netlify / Cloudflare Pages)
- **Framework Preset:** Vite
- **Root Directory:** `client`
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **PWA Features:** Precached assets, service worker (`dist/sw.js`), web manifest (`manifest.webmanifest`).

### Backend API Hosting (Render / Railway / Fly.io / AWS ECS)
- **Root Directory:** `server`
- **Build Command:** `npm run build`
- **Start Command:** `npm start`
- **Database Engine:** Managed MySQL 8 (AWS RDS, PlanetScale, Railway, or self-hosted MySQL 8).
