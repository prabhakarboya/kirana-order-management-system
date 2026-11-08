// Pure MySQL 8 Database Re-export
// Prisma runtime has been completely replaced with pure native MySQL 8 (mysql2/promise)
import { db } from './mysql.js';

export const prisma = db;
export { db };
