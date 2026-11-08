// Pure MySQL 8 Database Client & Query Engine
// Company A, Jabalpur FMCG Ordering System
// 100% Native MySQL (mysql2/promise) - Zero Prisma Runtime Dependency

import mysql, { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

function parseDatabaseUrl(url?: string) {
  if (url && url.startsWith('mysql://')) {
    const u = new URL(url);
    return {
      host: u.hostname || '127.0.0.1',
      port: Number(u.port || 3306),
      user: decodeURIComponent(u.username || 'root'),
      password: decodeURIComponent(u.password || ''),
      database: u.pathname.replace(/^\//, '') || 'kirana_order',
    };
  }
  return {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'boya',
    database: process.env.DB_NAME || 'kirana_order',
  };
}

const config = parseDatabaseUrl(process.env.DATABASE_URL);

export const pool: Pool = mysql.createPool({
  ...config,
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
  queueLimit: 0,
  charset: 'utf8mb4',
});

// Helper for raw queries
export async function rawQuery<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const [rows] = await pool.query(sql, params);
  return rows as T[];
}

export async function rawExecute(sql: string, params: any[] = []): Promise<ResultSetHeader> {
  const [result] = await pool.execute(sql, params);
  return result as ResultSetHeader;
}

// Transaction execution helper
export async function withTransaction<T>(callback: (conn: PoolConnection) => Promise<T>): Promise<T> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await callback(conn);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

function generateId(): string {
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 9);
}

// Helper to construct dynamic SQL update clauses supporting atomic { increment: X } and { decrement: X }
function buildUpdateSetClause(data: any): { sets: string[]; values: any[] } {
  const sets: string[] = [];
  const values: any[] = [];
  for (const [k, v] of Object.entries(data)) {
    if (k === 'auditLogs' || k === 'lines') continue;
    if (v !== null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)) {
      if ('increment' in v && typeof (v as any).increment === 'number') {
        sets.push(`${k} = ${k} + ?`);
        values.push((v as any).increment);
        continue;
      }
      if ('decrement' in v && typeof (v as any).decrement === 'number') {
        sets.push(`${k} = ${k} - ?`);
        values.push((v as any).decrement);
        continue;
      }
    }
    sets.push(`${k} = ?`);
    values.push(v);
  }
  return { sets, values };
}

// -------------------------------------------------------------
// Pure MySQL Relational Repositories
// -------------------------------------------------------------

export const db = {
  rawQuery,
  rawExecute,
  pool,

  async $disconnect() {
    await pool.end();
  },

  async $transaction<T>(action: (tx: any) => Promise<T>): Promise<T> {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const tx = createTxAdapter(conn);
      const res = await action(tx);
      await conn.commit();
      return res;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },

  // Users Table
  user: {
    async findUnique(args: { where: { id?: string; phone?: string }; include?: any }): Promise<any> {
      let rows: any[] = [];
      if (args.where.id) {
        const [r] = await pool.query('SELECT * FROM users WHERE id = ? LIMIT 1', [args.where.id]);
        rows = r as any[];
      } else if (args.where.phone) {
        const [r] = await pool.query('SELECT * FROM users WHERE phone = ? LIMIT 1', [args.where.phone]);
        rows = r as any[];
      }
      if (!rows.length) return null;
      const user = rows[0];
      if (args.include?.retailer || user.role === 'RETAILER') {
        const [retRows] = await pool.query('SELECT * FROM retailers WHERE userId = ? LIMIT 1', [user.id]);
        user.retailer = (retRows as any[])[0] || null;
      }
      if (args.include?.salesman || user.role === 'SALESMAN') {
        const [salRows] = await pool.query('SELECT * FROM salesmen WHERE userId = ? LIMIT 1', [user.id]);
        user.salesman = (salRows as any[])[0] || null;
      }
      return user;
    },
    async findFirst(args: { where: { role?: string }; include?: any }): Promise<any> {
      const [rows] = await pool.query('SELECT * FROM users WHERE role = ? LIMIT 1', [args.where.role]);
      const list = rows as any[];
      if (!list.length) return null;
      const user = list[0];
      if (args.include?.retailer || user.role === 'RETAILER') {
        const [retRows] = await pool.query('SELECT * FROM retailers WHERE userId = ? LIMIT 1', [user.id]);
        user.retailer = (retRows as any[])[0] || null;
      }
      if (args.include?.salesman || user.role === 'SALESMAN') {
        const [salRows] = await pool.query('SELECT * FROM salesmen WHERE userId = ? LIMIT 1', [user.id]);
        user.salesman = (salRows as any[])[0] || null;
      }
      return user;
    },
    async create(args: { data: any }): Promise<any> {
      const id = args.data.id || generateId();
      const d = args.data;
      await pool.execute(
        `INSERT INTO users (id, phone, role, name, otpCode, otpExpiresAt, otpAttempts, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))`,
        [id, d.phone, d.role || 'RETAILER', d.name, d.otpCode || null, d.otpExpiresAt || null, d.otpAttempts || 0]
      );
      const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
      return (rows as any[])[0];
    },
    async update(args: { where: { id: string }; data: any }): Promise<any> {
      const { sets, values } = buildUpdateSetClause(args.data);
      if (sets.length > 0) {
        values.push(args.where.id);
        await pool.execute(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, values);
      }
      const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [args.where.id]);
      return (rows as any[])[0];
    },
    async deleteMany(): Promise<void> {
      await pool.execute('DELETE FROM users');
    },
    async count(): Promise<number> {
      const [rows] = await pool.query('SELECT COUNT(*) as cnt FROM users');
      return Number((rows as any[])[0]?.cnt || 0);
    },
  },

  // Retailers Table
  retailer: {
    async findUnique(args: { where: { id?: string; userId?: string } }): Promise<any> {
      let rows: any[] = [];
      if (args.where.id) {
        const [r] = await pool.query('SELECT * FROM retailers WHERE id = ? LIMIT 1', [args.where.id]);
        rows = r as any[];
      } else if (args.where.userId) {
        const [r] = await pool.query('SELECT * FROM retailers WHERE userId = ? LIMIT 1', [args.where.userId]);
        rows = r as any[];
      }
      return rows[0] || null;
    },
    async findMany(args?: { where?: any; orderBy?: any }): Promise<any[]> {
      if (args?.where?.OR) {
        // Inactivity query: lastOrderAt is null or < 14 days ago
        const orConditions = args.where.OR;
        const ltCondition = orConditions.find((c: any) => c.lastOrderAt?.lt);
        if (ltCondition) {
          const dt = ltCondition.lastOrderAt.lt;
          const [rows] = await pool.query(
            'SELECT * FROM retailers WHERE lastOrderAt IS NULL OR lastOrderAt < ?',
            [dt]
          );
          return rows as any[];
        }
      }
      const [rows] = await pool.query('SELECT * FROM retailers');
      return rows as any[];
    },
    async create(args: { data: any }): Promise<any> {
      const id = args.data.id || generateId();
      const d = args.data;
      await pool.execute(
        `INSERT INTO retailers (id, userId, shopName, ownerName, phone, address, creditLimit, creditUsed, lastOrderAt, salesmanName, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))`,
        [id, d.userId, d.shopName, d.ownerName, d.phone, d.address, d.creditLimit ?? 50000.0, d.creditUsed ?? 0.0, d.lastOrderAt || null, d.salesmanName || 'Rajesh Sharma']
      );
      const [rows] = await pool.query('SELECT * FROM retailers WHERE id = ?', [id]);
      return (rows as any[])[0];
    },
    async update(args: { where: { id: string }; data: any }): Promise<any> {
      const { sets, values } = buildUpdateSetClause(args.data);
      if (sets.length > 0) {
        values.push(args.where.id);
        await pool.execute(`UPDATE retailers SET ${sets.join(', ')} WHERE id = ?`, values);
      }
      const [rows] = await pool.query('SELECT * FROM retailers WHERE id = ?', [args.where.id]);
      return (rows as any[])[0];
    },
    async count(): Promise<number> {
      const [rows] = await pool.query('SELECT COUNT(*) as cnt FROM retailers');
      return Number((rows as any[])[0]?.cnt || 0);
    },
    async deleteMany(): Promise<void> {
      await pool.execute('DELETE FROM retailers');
    },
  },

  // SKUs / Products Table
  sku: {
    async findUnique(args: { where: { code: string }; include?: any }): Promise<any> {
      const [rows] = await pool.query('SELECT * FROM skus WHERE code = ? LIMIT 1', [args.where.code]);
      const list = rows as any[];
      if (!list.length) return null;
      const sku = list[0];
      if (args.include?.schemes) {
        const [schRows] = await pool.query('SELECT * FROM schemes WHERE skuCode = ? AND isActive = 1', [sku.code]);
        sku.schemes = schRows as any[];
      }
      return sku;
    },
    async findMany(args?: { where?: any; include?: any; orderBy?: any }): Promise<any[]> {
      let sql = 'SELECT * FROM skus';
      const params: any[] = [];
      if (args?.where?.isActive !== undefined) {
        sql += ' WHERE isActive = ?';
        params.push(args.where.isActive ? 1 : 0);
      }
      if (args?.orderBy?.code) {
        sql += ` ORDER BY code ${args.orderBy.code.toUpperCase()}`;
      }
      const [rows] = await pool.query(sql, params);
      const skus = rows as any[];
      if (args?.include?.schemes) {
        const [allSchemes] = await pool.query('SELECT * FROM schemes WHERE isActive = 1');
        const schList = allSchemes as any[];
        for (const sku of skus) {
          sku.schemes = schList.filter((s) => s.skuCode === sku.code);
        }
      }
      return skus;
    },
    async create(args: { data: any }): Promise<any> {
      const d = args.data;
      await pool.execute(
        `INSERT INTO skus (code, name, brand, category, unitLabel, piecesPerCase, dealerPrice, casePrice, gstIncluded, gstRate, stockCases, imageUrl, isActive, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))`,
        [d.code, d.name, d.brand, d.category, d.unitLabel, d.piecesPerCase ?? 1, d.dealerPrice, d.casePrice, d.gstIncluded ? 1 : 0, d.gstRate ?? 18.0, d.stockCases ?? 0, d.imageUrl || null, d.isActive !== false ? 1 : 0]
      );
      const [rows] = await pool.query('SELECT * FROM skus WHERE code = ?', [d.code]);
      return (rows as any[])[0];
    },
    async update(args: { where: { code: string }; data: any }): Promise<any> {
      const { sets, values } = buildUpdateSetClause(args.data);
      if (sets.length > 0) {
        values.push(args.where.code);
        await pool.execute(`UPDATE skus SET ${sets.join(', ')} WHERE code = ?`, values);
      }
      const [rows] = await pool.query('SELECT * FROM skus WHERE code = ?', [args.where.code]);
      return (rows as any[])[0];
    },
    async count(): Promise<number> {
      const [rows] = await pool.query('SELECT COUNT(*) as cnt FROM skus');
      return Number((rows as any[])[0]?.cnt || 0);
    },
    async deleteMany(): Promise<void> {
      await pool.execute('DELETE FROM skus');
    },
  },

  // Retailer Prices Table
  retailerPrice: {
    async findMany(args: { where: { retailerId: string } }): Promise<any[]> {
      const [rows] = await pool.query('SELECT * FROM retailer_prices WHERE retailerId = ?', [args.where.retailerId]);
      return rows as any[];
    },
    async create(args: { data: any }): Promise<any> {
      const id = args.data.id || generateId();
      const d = args.data;
      await pool.execute(
        `INSERT INTO retailer_prices (id, retailerId, skuCode, dealerPrice, casePrice) VALUES (?, ?, ?, ?, ?)`,
        [id, d.retailerId, d.skuCode, d.dealerPrice, d.casePrice]
      );
      const [rows] = await pool.query('SELECT * FROM retailer_prices WHERE id = ?', [id]);
      return (rows as any[])[0];
    },
    async deleteMany(): Promise<void> {
      await pool.execute('DELETE FROM retailer_prices');
    },
  },

  // Schemes Table
  scheme: {
    async findMany(args?: { where?: any }): Promise<any[]> {
      let sql = 'SELECT * FROM schemes';
      const params: any[] = [];
      if (args?.where?.isActive !== undefined) {
        sql += ' WHERE isActive = ?';
        params.push(args.where.isActive ? 1 : 0);
      }
      const [rows] = await pool.query(sql, params);
      return rows as any[];
    },
    async create(args: { data: any }): Promise<any> {
      const id = args.data.id || generateId();
      const d = args.data;
      await pool.execute(
        `INSERT INTO schemes (id, skuCode, type, title, description, configJson, isActive, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))`,
        [id, d.skuCode, d.type, d.title, d.description, d.configJson, d.isActive !== false ? 1 : 0]
      );
      const [rows] = await pool.query('SELECT * FROM schemes WHERE id = ?', [id]);
      return (rows as any[])[0];
    },
    async deleteMany(): Promise<void> {
      await pool.execute('DELETE FROM schemes');
    },
  },

  // Orders Table
  order: {
    async findUnique(args: { where: { id?: string; clientOrderId?: string }; include?: any }): Promise<any> {
      let rows: any[] = [];
      if (args.where.id) {
        const [r] = await pool.query('SELECT * FROM orders WHERE id = ? LIMIT 1', [args.where.id]);
        rows = r as any[];
      } else if (args.where.clientOrderId) {
        const [r] = await pool.query('SELECT * FROM orders WHERE clientOrderId = ? LIMIT 1', [args.where.clientOrderId]);
        rows = r as any[];
      }
      if (!rows.length) return null;
      const order = rows[0];
      await attachOrderRelations(order, args.include);
      return order;
    },
    async findMany(args?: { where?: any; include?: any; orderBy?: any }): Promise<any[]> {
      let sql = 'SELECT * FROM orders';
      const whereClauses: string[] = [];
      const params: any[] = [];

      if (args?.where?.retailerId) {
        whereClauses.push('retailerId = ?');
        params.push(args.where.retailerId);
      }
      if (args?.where?.status) {
        whereClauses.push('status = ?');
        params.push(args.where.status);
      }
      if (whereClauses.length) {
        sql += ' WHERE ' + whereClauses.join(' AND ');
      }
      if (args?.orderBy?.createdAt) {
        sql += ` ORDER BY createdAt ${args.orderBy.createdAt.toUpperCase()}`;
      }
      const [rows] = await pool.query(sql, params);
      const orders = rows as any[];
      if (args?.include) {
        for (const order of orders) {
          await attachOrderRelations(order, args.include);
        }
      }
      return orders;
    },
    async create(args: { data: any }): Promise<any> {
      return executeOrderCreation(pool, args.data);
    },
    async update(args: { where: { id: string }; data: any; include?: any }): Promise<any> {
      if (args.data.auditLogs?.create) {
        for (const log of args.data.auditLogs.create) {
          await pool.execute(
            `INSERT INTO audit_logs (id, orderId, userId, userName, action, details, timestamp)
             VALUES (?, ?, ?, ?, ?, ?, NOW(3))`,
            [generateId(), args.where.id, log.userId || null, log.userName, log.action, log.details || null]
          );
        }
      }
      const { sets, values } = buildUpdateSetClause(args.data);
      if (sets.length > 0) {
        values.push(args.where.id);
        await pool.execute(`UPDATE orders SET ${sets.join(', ')} WHERE id = ?`, values);
      }
      const [rows] = await pool.query('SELECT * FROM orders WHERE id = ?', [args.where.id]);
      const updated = (rows as any[])[0];
      if (args.include) {
        await attachOrderRelations(updated, args.include);
      }
      return updated;
    },
    async count(args?: { where?: any }): Promise<number> {
      let sql = 'SELECT COUNT(*) as cnt FROM orders';
      const params: any[] = [];
      if (args?.where?.status) {
        sql += ' WHERE status = ?';
        params.push(args.where.status);
      }
      const [rows] = await pool.query(sql, params);
      return Number((rows as any[])[0]?.cnt || 0);
    },
    async deleteMany(): Promise<void> {
      await pool.execute('DELETE FROM orders');
    },
  },

  // Order Lines Table
  orderLine: {
    async create(args: { data: any }): Promise<any> {
      const id = args.data.id || generateId();
      const d = args.data;
      await pool.execute(
        `INSERT INTO order_lines (id, orderId, skuCode, qtyCases, freeCases, unitPrice, discountAmount, gstRate, gstAmount, lineTotal, schemeApplied, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3))`,
        [id, d.orderId, d.skuCode, d.qtyCases, d.freeCases ?? 0, d.unitPrice, d.discountAmount ?? 0, d.gstRate, d.gstAmount, d.lineTotal, d.schemeApplied || null]
      );
      const [rows] = await pool.query('SELECT * FROM order_lines WHERE id = ?', [id]);
      return (rows as any[])[0];
    },
    async createMany(args: { data: any[] }): Promise<{ count: number }> {
      for (const d of args.data) {
        const id = d.id || generateId();
        await pool.execute(
          `INSERT INTO order_lines (id, orderId, skuCode, qtyCases, freeCases, unitPrice, discountAmount, gstRate, gstAmount, lineTotal, schemeApplied, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3))`,
          [id, d.orderId, d.skuCode, d.qtyCases, d.freeCases ?? 0, d.unitPrice, d.discountAmount ?? 0, d.gstRate, d.gstAmount, d.lineTotal, d.schemeApplied || null]
        );
      }
      return { count: args.data.length };
    },
    async deleteMany(args?: { where?: { orderId?: string } }): Promise<void> {
      if (args?.where?.orderId) {
        await pool.execute('DELETE FROM order_lines WHERE orderId = ?', [args.where.orderId]);
      } else {
        await pool.execute('DELETE FROM order_lines');
      }
    },
  },

  // Aliases Table
  alias: {
    async findMany(args?: { where?: any }): Promise<any[]> {
      if (args?.where?.OR) {
        const [rows] = await pool.query(
          'SELECT * FROM aliases WHERE retailerId IS NULL OR retailerId = ?',
          [args.where.OR.find((o: any) => o.retailerId)?.retailerId]
        );
        return rows as any[];
      }
      const [rows] = await pool.query('SELECT * FROM aliases');
      return rows as any[];
    },
    async findFirst(args: { where: { retailerId?: string | null; phrase: string } }): Promise<any> {
      const phrase = args.where.phrase.toLowerCase();
      let rows: any[] = [];
      if (args.where.retailerId) {
        const [r] = await pool.query('SELECT * FROM aliases WHERE retailerId = ? AND phrase = ? LIMIT 1', [args.where.retailerId, phrase]);
        rows = r as any[];
      } else {
        const [r] = await pool.query('SELECT * FROM aliases WHERE retailerId IS NULL AND phrase = ? LIMIT 1', [phrase]);
        rows = r as any[];
      }
      return rows[0] || null;
    },
    async create(args: { data: any }): Promise<any> {
      const id = args.data.id || generateId();
      const d = args.data;
      await pool.execute(
        `INSERT INTO aliases (id, retailerId, phrase, skuCode, confidence, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, NOW(3), NOW(3))`,
        [id, d.retailerId || null, d.phrase.toLowerCase(), d.skuCode, d.confidence ?? 1.0]
      );
      const [rows] = await pool.query('SELECT * FROM aliases WHERE id = ?', [id]);
      return (rows as any[])[0];
    },
    async createMany(args: { data: any[] }): Promise<{ count: number }> {
      for (const d of args.data) {
        const id = d.id || generateId();
        await pool.execute(
          `INSERT INTO aliases (id, retailerId, phrase, skuCode, confidence, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, NOW(3), NOW(3))`,
          [id, d.retailerId || null, d.phrase.toLowerCase(), d.skuCode, d.confidence ?? 1.0]
        );
      }
      return { count: args.data.length };
    },
    async update(args: { where: { id: string }; data: any }): Promise<any> {
      const { sets, values } = buildUpdateSetClause(args.data);
      if (sets.length > 0) {
        values.push(args.where.id);
        await pool.execute(`UPDATE aliases SET ${sets.join(', ')} WHERE id = ?`, values);
      }
      const [rows] = await pool.query('SELECT * FROM aliases WHERE id = ?', [args.where.id]);
      return (rows as any[])[0];
    },
    async deleteMany(): Promise<void> {
      await pool.execute('DELETE FROM aliases');
    },
  },

  // Audit Logs Table
  auditLog: {
    async create(args: { data: any }): Promise<any> {
      const id = args.data.id || generateId();
      const d = args.data;
      await pool.execute(
        `INSERT INTO audit_logs (id, orderId, userId, userName, action, details, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, NOW(3))`,
        [id, d.orderId || null, d.userId || null, d.userName, d.action, d.details || null]
      );
      const [rows] = await pool.query('SELECT * FROM audit_logs WHERE id = ?', [id]);
      return (rows as any[])[0];
    },
    async findMany(args?: { where?: any }): Promise<any[]> {
      let sql = 'SELECT * FROM audit_logs';
      const params: any[] = [];
      if (args?.where?.orderId) {
        sql += ' WHERE orderId = ?';
        params.push(args.where.orderId);
      }
      const [rows] = await pool.query(sql, params);
      return rows as any[];
    },
    async deleteMany(): Promise<void> {
      await pool.execute('DELETE FROM audit_logs');
    },
  },

  // Extended Models
  brand: {
    async findMany(): Promise<any[]> {
      const [rows] = await pool.query('SELECT * FROM brands');
      return rows as any[];
    },
    async createMany(args: { data: any[] }): Promise<void> {
      for (const d of args.data) {
        await pool.execute(
          'INSERT INTO brands (id, code, name, description, createdAt, updatedAt) VALUES (?, ?, ?, ?, NOW(3), NOW(3))',
          [d.id || generateId(), d.code, d.name, d.description || null]
        );
      }
    },
    async deleteMany(): Promise<void> {
      await pool.execute('DELETE FROM brands');
    },
  },

  category: {
    async findMany(): Promise<any[]> {
      const [rows] = await pool.query('SELECT * FROM categories');
      return rows as any[];
    },
    async createMany(args: { data: any[] }): Promise<void> {
      for (const d of args.data) {
        await pool.execute(
          'INSERT INTO categories (id, name, description, createdAt, updatedAt) VALUES (?, ?, ?, NOW(3), NOW(3))',
          [d.id || generateId(), d.name, d.description || null]
        );
      }
    },
    async deleteMany(): Promise<void> {
      await pool.execute('DELETE FROM categories');
    },
  },

  salesman: {
    async findUnique(args: { where: { id?: string; userId?: string } }): Promise<any> {
      let rows: any[] = [];
      if (args.where.id) {
        const [r] = await pool.query('SELECT * FROM salesmen WHERE id = ? LIMIT 1', [args.where.id]);
        rows = r as any[];
      } else if (args.where.userId) {
        const [r] = await pool.query('SELECT * FROM salesmen WHERE userId = ? LIMIT 1', [args.where.userId]);
        rows = r as any[];
      }
      return rows[0] || null;
    },
    async findMany(): Promise<any[]> {
      const [rows] = await pool.query('SELECT * FROM salesmen');
      return rows as any[];
    },
    async create(args: { data: any }): Promise<any> {
      const id = args.data.id || generateId();
      const d = args.data;
      await pool.execute(
        'INSERT INTO salesmen (id, userId, name, phone, territory, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, NOW(3), NOW(3))',
        [id, d.userId || null, d.name, d.phone, d.territory || 'Jabalpur City', d.isActive !== false ? 1 : 0]
      );
      const [rows] = await pool.query('SELECT * FROM salesmen WHERE id = ?', [id]);
      return (rows as any[])[0];
    },
    async deleteMany(): Promise<void> {
      await pool.execute('DELETE FROM salesmen');
    },
  },

  retailerSalesmanAssignment: {
    async findMany(): Promise<any[]> {
      const [rows] = await pool.query('SELECT * FROM retailer_salesman_assignments');
      return rows as any[];
    },
    async createMany(args: { data: any[] }): Promise<void> {
      for (const d of args.data) {
        await pool.execute(
          'INSERT INTO retailer_salesman_assignments (id, retailerId, salesmanId, isPrimary, assignedAt) VALUES (?, ?, ?, ?, NOW(3))',
          [d.id || generateId(), d.retailerId, d.salesmanId, d.isPrimary !== false ? 1 : 0]
        );
      }
    },
    async deleteMany(): Promise<void> {
      await pool.execute('DELETE FROM retailer_salesman_assignments');
    },
  },

  creditAccount: {
    async findMany(): Promise<any[]> {
      const [rows] = await pool.query('SELECT * FROM credit_accounts');
      return rows as any[];
    },
    async createMany(args: { data: any[] }): Promise<void> {
      for (const d of args.data) {
        await pool.execute(
          'INSERT INTO credit_accounts (id, retailerId, creditLimit, creditUsed, creditAvailable, status, paymentTermsDays, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))',
          [d.id || generateId(), d.retailerId, d.creditLimit ?? 50000.0, d.creditUsed ?? 0.0, d.creditAvailable ?? 50000.0, d.status || 'ACTIVE', d.paymentTermsDays ?? 7]
        );
      }
    },
    async deleteMany(): Promise<void> {
      await pool.execute('DELETE FROM credit_accounts');
    },
  },

  schemeRule: {
    async findMany(): Promise<any[]> {
      const [rows] = await pool.query('SELECT * FROM scheme_rules');
      return rows as any[];
    },
    async createMany(args: { data: any[] }): Promise<void> {
      for (const d of args.data) {
        await pool.execute(
          'INSERT INTO scheme_rules (id, schemeId, ruleType, minQty, discountPercent, freeSkuCode, freeQty, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(3))',
          [d.id || generateId(), d.schemeId, d.ruleType, d.minQty ?? 0, d.discountPercent ?? 0.0, d.freeSkuCode || null, d.freeQty ?? 0]
        );
      }
    },
    async deleteMany(): Promise<void> {
      await pool.execute('DELETE FROM scheme_rules');
    },
  },

  orderStatusHistory: {
    async findMany(): Promise<any[]> {
      const [rows] = await pool.query('SELECT * FROM order_status_history');
      return rows as any[];
    },
    async createMany(args: { data: any[] }): Promise<void> {
      for (const d of args.data) {
        await pool.execute(
          'INSERT INTO order_status_history (id, orderId, statusFrom, statusTo, changedByUserId, changedByName, reason, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(3))',
          [d.id || generateId(), d.orderId, d.statusFrom, d.statusTo, d.changedByUserId || null, d.changedByName || 'System', d.reason || null]
        );
      }
    },
    async deleteMany(): Promise<void> {
      await pool.execute('DELETE FROM order_status_history');
    },
  },

  aiOrderCaptureRecord: {
    async findMany(): Promise<any[]> {
      const [rows] = await pool.query('SELECT * FROM ai_order_capture_records');
      return rows as any[];
    },
    async create(args: { data: any }): Promise<any> {
      const id = args.data.id || generateId();
      const d = args.data;
      await pool.execute(
        'INSERT INTO ai_order_capture_records (id, retailerId, channel, rawInput, parsedOutputJson, confidenceScore, reviewStatus, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(3))',
        [id, d.retailerId || null, d.channel, d.rawInput, d.parsedOutputJson, d.confidenceScore ?? 0.0, d.reviewStatus || 'REVIEWED']
      );
      const [rows] = await pool.query('SELECT * FROM ai_order_capture_records WHERE id = ?', [id]);
      return (rows as any[])[0];
    },
    async deleteMany(): Promise<void> {
      await pool.execute('DELETE FROM ai_order_capture_records');
    },
  },

  exportHistory: {
    async findMany(): Promise<any[]> {
      const [rows] = await pool.query('SELECT * FROM export_history');
      return rows as any[];
    },
    async create(args: { data: any }): Promise<any> {
      const id = args.data.id || generateId();
      const d = args.data;
      await pool.execute(
        'INSERT INTO export_history (id, exportFormat, voucherCount, fileName, exportedByUserId, checksum, generatedAt) VALUES (?, ?, ?, ?, ?, ?, NOW(3))',
        [id, d.exportFormat, d.voucherCount, d.fileName, d.exportedByUserId || null, d.checksum || null]
      );
      const [rows] = await pool.query('SELECT * FROM export_history WHERE id = ?', [id]);
      return (rows as any[])[0];
    },
    async deleteMany(): Promise<void> {
      await pool.execute('DELETE FROM export_history');
    },
  },

  offlineSyncQueue: {
    async findMany(): Promise<any[]> {
      const [rows] = await pool.query('SELECT * FROM offline_sync_queue');
      return rows as any[];
    },
    async create(args: { data: any }): Promise<any> {
      const id = args.data.id || generateId();
      const d = args.data;
      await pool.execute(
        'INSERT INTO offline_sync_queue (id, clientOrderId, salesmanId, payloadJson, status, syncAttempts, errorDetails, syncedAt) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(3))',
        [id, d.clientOrderId, d.salesmanId || null, d.payloadJson, d.status || 'SYNCED', d.syncAttempts ?? 1, d.errorDetails || null]
      );
      const [rows] = await pool.query('SELECT * FROM offline_sync_queue WHERE id = ?', [id]);
      return (rows as any[])[0];
    },
    async deleteMany(): Promise<void> {
      await pool.execute('DELETE FROM offline_sync_queue');
    },
  },

  productImage: {
    async deleteMany(): Promise<void> {
      await pool.execute('DELETE FROM product_images');
    },
  },
};

// Helper to attach nested relations for orders
async function attachOrderRelations(order: any, include?: any, executor: any = pool) {
  if (!order) return;
  if (include?.lines) {
    const [lineRows] = await executor.query('SELECT * FROM order_lines WHERE orderId = ?', [order.id]);
    const lines = lineRows as any[];
    if (include.lines.include?.sku) {
      const [skuRows] = await executor.query('SELECT * FROM skus');
      const skus = skuRows as any[];
      for (const line of lines) {
        line.sku = skus.find((s) => s.code === line.skuCode) || null;
      }
    }
    order.lines = lines;
  }
  if (include?.auditLogs) {
    const [auditRows] = await executor.query('SELECT * FROM audit_logs WHERE orderId = ? ORDER BY timestamp ASC', [order.id]);
    order.auditLogs = auditRows as any[];
  }
  if (include?.retailer) {
    const [retRows] = await executor.query('SELECT * FROM retailers WHERE id = ? LIMIT 1', [order.retailerId]);
    order.retailer = (retRows as any[])[0] || null;
  }
}

// Order creation with nested lines and auditLogs
async function executeOrderCreation(executor: any, data: any) {
  const id = data.id || generateId();
  await executor.execute(
    `INSERT INTO orders (id, orderNumber, clientOrderId, retailerId, status, source, rawMessage, subtotal, discountTotal, gstTotal, grandTotal, totalSavings, creditApproved, stockDeducted, rejectionReason, tallyExported, tallyVoucherNo, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))`,
    [
      id,
      data.orderNumber,
      data.clientOrderId || null,
      data.retailerId,
      data.status || 'PENDING_DESK_REVIEW',
      data.source || 'APP',
      data.rawMessage || null,
      data.subtotal,
      data.discountTotal ?? 0.0,
      data.gstTotal,
      data.grandTotal,
      data.totalSavings ?? 0.0,
      data.creditApproved !== false ? 1 : 0,
      data.stockDeducted ? 1 : 0,
      data.rejectionReason || null,
      data.tallyExported ? 1 : 0,
      data.tallyVoucherNo || null,
    ]
  );

  if (data.lines?.create) {
    for (const line of data.lines.create) {
      const lineId = line.id || generateId();
      await executor.execute(
        `INSERT INTO order_lines (id, orderId, skuCode, qtyCases, freeCases, unitPrice, discountAmount, gstRate, gstAmount, lineTotal, schemeApplied, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3))`,
        [lineId, id, line.skuCode, line.qtyCases, line.freeCases ?? 0, line.unitPrice, line.discountAmount ?? 0, line.gstRate, line.gstAmount, line.lineTotal, line.schemeApplied || null]
      );
    }
  }

  if (data.auditLogs?.create) {
    for (const log of data.auditLogs.create) {
      const logId = log.id || generateId();
      await executor.execute(
        `INSERT INTO audit_logs (id, orderId, userId, userName, action, details, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, NOW(3))`,
        [logId, id, log.userId || null, log.userName, log.action, log.details || null]
      );
    }
  }

  const [rows] = await executor.query('SELECT * FROM orders WHERE id = ?', [id]);
  const created = (rows as any[])[0];
  await attachOrderRelations(created, { lines: true, auditLogs: true }, executor);
  return created;
}

// Transaction adapter
function createTxAdapter(conn: PoolConnection) {
  return {
    rawQuery: (sql: string, params: any[] = []) => conn.query(sql, params).then(([rows]) => rows),
    rawExecute: (sql: string, params: any[] = []) => conn.execute(sql, params).then(([res]) => res),
    order: {
      count: async (): Promise<number> => {
        const [rows] = await conn.query('SELECT COUNT(*) as cnt FROM orders');
        return Number((rows as any[])[0]?.cnt || 0);
      },
      create: (args: { data: any }) => executeOrderCreation(conn, args.data),
      update: async (args: { where: { id: string }; data: any; include?: any }) => {
        if (args.data.auditLogs?.create) {
          for (const log of args.data.auditLogs.create) {
            await conn.execute(
              `INSERT INTO audit_logs (id, orderId, userId, userName, action, details, timestamp)
               VALUES (?, ?, ?, ?, ?, ?, NOW(3))`,
              [generateId(), args.where.id, log.userId || null, log.userName, log.action, log.details || null]
            );
          }
        }
        const { sets, values } = buildUpdateSetClause(args.data);
        if (sets.length > 0) {
          values.push(args.where.id);
          await conn.execute(`UPDATE orders SET ${sets.join(', ')} WHERE id = ?`, values);
        }
        const [rows] = await conn.query('SELECT * FROM orders WHERE id = ?', [args.where.id]);
        return (rows as any[])[0];
      },
    },
    orderLine: {
      deleteMany: async (args: { where: { orderId: string } }) => {
        await conn.execute('DELETE FROM order_lines WHERE orderId = ?', [args.where.orderId]);
      },
      createMany: async (args: { data: any[] }) => {
        for (const d of args.data) {
          const id = d.id || generateId();
          await conn.execute(
            `INSERT INTO order_lines (id, orderId, skuCode, qtyCases, freeCases, unitPrice, discountAmount, gstRate, gstAmount, lineTotal, schemeApplied, createdAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3))`,
            [id, d.orderId, d.skuCode, d.qtyCases, d.freeCases ?? 0, d.unitPrice, d.discountAmount ?? 0, d.gstRate, d.gstAmount, d.lineTotal, d.schemeApplied || null]
          );
        }
      },
    },
    retailer: {
      findUnique: async (args: { where: { id: string } }) => {
        const [rows] = await conn.query('SELECT * FROM retailers WHERE id = ? FOR UPDATE', [args.where.id]);
        return (rows as any[])[0] || null;
      },
      update: async (args: { where: { id: string }; data: any }) => {
        const { sets, values } = buildUpdateSetClause(args.data);
        if (sets.length > 0) {
          values.push(args.where.id);
          await conn.execute(`UPDATE retailers SET ${sets.join(', ')} WHERE id = ?`, values);
        }
        const [rows] = await conn.query('SELECT * FROM retailers WHERE id = ?', [args.where.id]);
        return (rows as any[])[0];
      },
    },
    sku: {
      findUnique: async (args: { where: { code: string } }) => {
        const [rows] = await conn.query('SELECT * FROM skus WHERE code = ? FOR UPDATE', [args.where.code]);
        return (rows as any[])[0] || null;
      },
      update: async (args: { where: { code: string }; data: any }) => {
        const { sets, values } = buildUpdateSetClause(args.data);
        if (sets.length > 0) {
          values.push(args.where.code);
          await conn.execute(`UPDATE skus SET ${sets.join(', ')} WHERE code = ?`, values);
        }
        const [rows] = await conn.query('SELECT * FROM skus WHERE code = ?', [args.where.code]);
        return (rows as any[])[0];
      },
    },
    auditLog: {
      create: async (args: { data: any }) => {
        const id = args.data.id || generateId();
        const d = args.data;
        await conn.execute(
          `INSERT INTO audit_logs (id, orderId, userId, userName, action, details, timestamp)
           VALUES (?, ?, ?, ?, ?, ?, NOW(3))`,
          [id, d.orderId || null, d.userId || null, d.userName, d.action, d.details || null]
        );
      },
    },
    alias: {
      findFirst: async (args: { where: { retailerId?: string | null; phrase: string } }) => {
        const phrase = args.where.phrase.toLowerCase();
        let rows: any[] = [];
        if (args.where.retailerId) {
          const [r] = await conn.query('SELECT * FROM aliases WHERE retailerId = ? AND phrase = ? LIMIT 1', [args.where.retailerId, phrase]);
          rows = r as any[];
        } else {
          const [r] = await conn.query('SELECT * FROM aliases WHERE retailerId IS NULL AND phrase = ? LIMIT 1', [phrase]);
          rows = r as any[];
        }
        return rows[0] || null;
      },
      update: async (args: { where: { id: string }; data: any }) => {
        const { sets, values } = buildUpdateSetClause(args.data);
        if (sets.length > 0) {
          values.push(args.where.id);
          await conn.execute(`UPDATE aliases SET ${sets.join(', ')} WHERE id = ?`, values);
        }
        const [rows] = await conn.query('SELECT * FROM aliases WHERE id = ?', [args.where.id]);
        return (rows as any[])[0];
      },
      create: async (args: { data: any }) => {
        const id = args.data.id || generateId();
        const d = args.data;
        await conn.execute(
          `INSERT INTO aliases (id, retailerId, phrase, skuCode, confidence, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, NOW(3), NOW(3))`,
          [id, d.retailerId || null, d.phrase.toLowerCase(), d.skuCode, d.confidence ?? 1.0]
        );
        const [rows] = await conn.query('SELECT * FROM aliases WHERE id = ?', [id]);
        return (rows as any[])[0];
      },
    },
  };
}
