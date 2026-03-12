import { db, pool } from "./db";
import {
  users, posts, invoices, coupons, walletTransactions,
  type User, type InsertUser, type Post, type InsertPost,
  type Invoice, type Coupon, type WalletTransaction,
  type PlanKey, PLANS
} from "@shared/schema";
import { eq, sql } from "drizzle-orm";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createPost(post: InsertPost): Promise<Post>;
  searchUsersVulnerable(query: string): Promise<any[]>;
  getInvoice(id: number): Promise<Invoice | undefined>;
  createInvoice(data: { userId: number; amount: string; status?: string }): Promise<Invoice>;
  deactivateUser(id: number): Promise<User>;
  getCoupon(code: string): Promise<Coupon | undefined>;
  // Billing
  getUserWallet(userId: number): Promise<{ balance: number; plan: string; planStartDate: Date | null }>;
  topupWallet(userId: number, amount: number): Promise<User>;
  deductWallet(userId: number, amount: number): Promise<User>;
  creditWallet(userId: number, amount: number, description: string): Promise<User>;
  setPlan(userId: number, plan: PlanKey): Promise<User>;
  logWalletTransaction(userId: number, amount: number, type: string, description: string): Promise<WalletTransaction>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async createPost(insertPost: InsertPost): Promise<Post> {
    const [post] = await db.insert(posts).values(insertPost).returning();
    return post;
  }

  async getInvoice(id: number): Promise<Invoice | undefined> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id));
    return invoice;
  }

  async createInvoice(data: { userId: number; amount: string; status?: string }): Promise<Invoice> {
    const [invoice] = await db.insert(invoices).values({ userId: data.userId, amount: data.amount, status: data.status ?? "unpaid" }).returning();
    return invoice;
  }

  async deactivateUser(id: number): Promise<User> {
    const [user] = await db.update(users).set({ isActive: false }).where(eq(users.id, id)).returning();
    return user;
  }

  async getCoupon(code: string): Promise<Coupon | undefined> {
    const [coupon] = await db.select().from(coupons).where(eq(coupons.code, code));
    return coupon;
  }

  async getUserWallet(userId: number): Promise<{ balance: number; plan: string; planStartDate: Date | null }> {
    const user = await this.getUser(userId);
    if (!user) throw new Error("User not found");
    return {
      balance: parseFloat(user.walletBalance),
      plan: user.plan,
      planStartDate: user.planStartDate,
    };
  }

  async topupWallet(userId: number, amount: number): Promise<User> {
    const [user] = await db.update(users)
      .set({ walletBalance: sql`wallet_balance + ${amount}` })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  // VULNERABLE: No row lock or transaction — race condition exploitable
  async deductWallet(userId: number, amount: number): Promise<User> {
    const user = await this.getUser(userId);
    if (!user) throw new Error("User not found");
    const current = parseFloat(user.walletBalance);
    // No floor check — can go negative
    const newBalance = current - amount;
    const [updated] = await db.update(users)
      .set({ walletBalance: newBalance.toFixed(2) })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  async creditWallet(userId: number, amount: number, description: string): Promise<User> {
    const [user] = await db.update(users)
      .set({ walletBalance: sql`wallet_balance + ${amount}` })
      .where(eq(users.id, userId))
      .returning();
    await this.logWalletTransaction(userId, amount, "credit", description);
    return user;
  }

  async setPlan(userId: number, plan: PlanKey): Promise<User> {
    const [user] = await db.update(users)
      .set({ plan, planStartDate: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async logWalletTransaction(userId: number, amount: number, type: string, description: string): Promise<WalletTransaction> {
    const [tx] = await db.insert(walletTransactions).values({ userId, amount: amount.toFixed(2), type, description }).returning();
    return tx;
  }

  // VULNERABLE to SQL Injection
  async searchUsersVulnerable(query: string): Promise<any[]> {
    const sqlQuery = `SELECT id, username, role FROM users WHERE username LIKE '%${query}%'`;
    try {
      const res = await pool.query(sqlQuery);
      return res.rows;
    } catch (e: any) {
      throw new Error(e.message);
    }
  }
}

export const storage = new DatabaseStorage();
