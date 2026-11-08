# FMCG Kirana Retailer Ordering App - Deployment & Environment Guide

**Client:** Company A, Jabalpur  
**Solution:** FMCG Distributor Retailer Ordering App with Multimodal AI Order Capture  
**Target Region:** Jabalpur & Mahakaushal Region, Madhya Pradesh  

---

## 1. Quick Start / Local Setup

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **Database**: Prisma ORM with SQLite (zero-config, persistent `dev.db`) or MySQL 8.0+

### Installation & Launch Steps
From the root repository directory:

```bash
# 1. Install dependencies for all workspaces (client and server)
npm install

# 2. Run deterministic unit test suite (Scheme Engine & AI Parser)
npm test

# 3. Start development servers (Frontend on port 5173, Backend API on port 5000)
npm run dev
```

---

## 2. Environment Variables Specification

Configure the following environment variable names in your hosting environment (e.g., Render, Railway, Vercel, AWS ECS) or in `server/.env`.

> [!NOTE]
> Per security and assignment submission guidelines, only variable names and functional descriptions are listed below. Do not commit actual production credentials or passwords to version control.

| Environment Variable Name | Required | Functional Purpose |
|---|---|---|
| `PORT` | Optional | Port on which the Express backend HTTP server listens |
| `NODE_ENV` | Optional | Runtime environment mode (`development`, `production`, `test`) |
| `DATABASE_URL` | Required for MySQL | Database connection URI for Prisma ORM |
| `JWT_SECRET` | Required | Cryptographic secret key used for signing and verifying JSON Web Tokens |
| `OTP_DEMO_CODE` | Optional | Fixed OTP bypass code for rapid test evaluation in non-production environments |
| `GEMINI_API_KEY` | Optional | Google Gemini API key for multimodal AI order transcription and vision OCR |
| `LLM_API_KEY` | Optional | Alternative environment variable name for AI LLM API provider key |
| `CLIENT_ORIGIN` | Required | Allowed CORS origin for frontend client requests |

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
- **Database Engine:** Managed MySQL 8 (AWS RDS, PlanetScale, Railway, or Aiven) or persistent volume SQLite.
