# FMCG Kirana Retailer Ordering App - Deployment Guide

**Client:** Company A, Jabalpur  
**Solution:** FMCG Distributor Retailer Ordering App with AI Order Capture  
**Target Region:** Jabalpur & Mahakaushal Region, Madhya Pradesh  

---

## 1. Quick Start / Local Development

### Prerequisites
- **Node.js**: v18.0.0 or higher (Tested on Node v22.13.1)
- **npm**: v9.0.0 or higher
- **MySQL 8.0+** (Optional for local testing; the server includes a zero-config seeded store so you can test immediately without any database setup!)

### Installation
From the root `kirana-order` directory:

```bash
# 1. Install dependencies for all workspaces (client and server)
npm install

# 2. Run unit test suite (Scheme Engine + AI Parser)
npm test

# 3. Start both backend server (port 5000) and frontend client (port 5173)
npm run dev
```

- **Frontend Client**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:5000](http://localhost:5000)
- **API Health Check**: [http://localhost:5000/api/health](http://localhost:5000/api/health)

---

## 2. Environment Variables Specification

Create or configure `.env` in `kirana-order/server/.env`:

| Variable Name | Required | Default Value | Description |
|---|---|---|---|
| `PORT` | No | `5000` | Port for Express API server |
| `DATABASE_URL` | Yes (for MySQL) | `mysql://root:password@localhost:3306/kirana_order_db` | MySQL 8 connection string with Prisma |
| `JWT_SECRET` | Yes | `kirana_fmcg_distributor_jabalpur_secret_key_2026_xyz` | Secret key for signing session tokens |
| `OTP_DEMO_CODE` | Yes | `123456` | Fixed OTP for rapid testing and demo verification |
| `LLM_API_KEY` | Optional | `demo-gemini-key` | Google Gemini / OpenAI key for LLM order capture |
| `CLIENT_ORIGIN` | Yes | `http://localhost:5173` | Allowed CORS origin for frontend client |

---

## 3. Demo Credentials & Test Accounts

The platform includes 1-tap role switching in the top navigation bar, plus fixed OTP login:

### A. Retailer Account (Kirana Shop Owner)
- **Phone Number:** `9826011111`
- **Demo OTP:** `123456`
- **Shop Name:** *Sharma General Store, Gorakhpur Market, Jabalpur*
- **Credit Limit:** ₹75,000 (Available: ₹62,500)
- **Assigned Salesman:** Rajesh Sharma

### B. Order Desk Lead (Company A Office Staff)
- **Phone Number:** `9826099999`
- **Demo OTP:** `123456`
- **User:** *Priya Jain (Order Desk Lead)*
- **Capabilities:** Queue review, line edits, alias learning, order approval/rejection, Tally XML & CSV exports, inactive retailer dashboard.

---

## 4. Production Deployment

### Option A: Monolith / Unified Container (Railway / Render / Fly.io)
1. Build both client and server:
   ```bash
   npm run build
   ```
2. Serve static client build from `client/dist` inside Express server for single-URL hosting.
3. Attach MySQL 8 instance via Railway or Render Database addon.
4. Set environment variables in deployment dashboard.

### Option B: Decoupled (Vercel Frontend + Render/Railway Backend)
1. **Frontend (Vercel / Netlify):**
   - Root directory: `client`
   - Build command: `npm run build`
   - Output directory: `dist`
   - Set environment variable: `VITE_API_URL=https://your-api.onrender.com`
2. **Backend (Render / Railway):**
   - Root directory: `server`
   - Build command: `npm run build`
   - Start command: `npm start`
   - Database: Managed MySQL 8 (Aiven or Railway)
