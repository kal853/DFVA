import { db, pool } from "./db";
import {
  users, posts, invoices, walletTransactions, products,
  type User, type InsertUser, type Post, type InsertPost,
  type Invoice, type WalletTransaction, type Product, type InsertProduct,
  type PlanKey
} from "@shared/schema";
import { eq, sql, ilike } from "drizzle-orm";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createPost(post: InsertPost): Promise<Post>;
  searchUsersVulnerable(query: string): Promise<any[]>;
  getInvoice(id: number): Promise<Invoice | undefined>;
  createInvoice(data: { userId: number; amount: string; status?: string }): Promise<Invoice>;
  deactivateUser(id: number): Promise<User>;
  getUserWallet(userId: number): Promise<{ balance: number; plan: string; planStartDate: Date | null }>;
  topupWallet(userId: number, amount: number): Promise<User>;
  deductWallet(userId: number, amount: number): Promise<User>;
  creditWallet(userId: number, amount: number, description: string): Promise<User>;
  setPlan(userId: number, plan: PlanKey): Promise<User>;
  logWalletTransaction(userId: number, amount: number, type: string, description: string): Promise<WalletTransaction>;
  // Products
  getProducts(category?: string): Promise<Product[]>;
  getFeaturedProducts(): Promise<Product[]>;
  getProduct(id: number): Promise<Product | undefined>;
  getProductBySlug(slug: string): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  searchProducts(query: string): Promise<Product[]>;
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

  async getUserWallet(userId: number): Promise<{ balance: number; plan: string; planStartDate: Date | null }> {
    const user = await this.getUser(userId);
    if (!user) throw new Error("User not found");
    return { balance: parseFloat(user.walletBalance), plan: user.plan, planStartDate: user.planStartDate };
  }

  async topupWallet(userId: number, amount: number): Promise<User> {
    const [user] = await db.update(users).set({ walletBalance: sql`wallet_balance + ${amount}` }).where(eq(users.id, userId)).returning();
    return user;
  }

  async deductWallet(userId: number, amount: number): Promise<User> {
    const user = await this.getUser(userId);
    if (!user) throw new Error("User not found");
    const newBalance = parseFloat(user.walletBalance) - amount;
    const [updated] = await db.update(users).set({ walletBalance: newBalance.toFixed(2) }).where(eq(users.id, userId)).returning();
    return updated;
  }

  async creditWallet(userId: number, amount: number, description: string): Promise<User> {
    const [user] = await db.update(users).set({ walletBalance: sql`wallet_balance + ${amount}` }).where(eq(users.id, userId)).returning();
    await this.logWalletTransaction(userId, amount, "credit", description);
    return user;
  }

  async setPlan(userId: number, plan: PlanKey): Promise<User> {
    const [user] = await db.update(users).set({ plan, planStartDate: new Date() }).where(eq(users.id, userId)).returning();
    return user;
  }

  async logWalletTransaction(userId: number, amount: number, type: string, description: string): Promise<WalletTransaction> {
    const [tx] = await db.insert(walletTransactions).values({ userId, amount: amount.toFixed(2), type, description }).returning();
    return tx;
  }

  async getProducts(category?: string): Promise<Product[]> {
    if (category && category !== "all") {
      return await db.select().from(products).where(eq(products.category, category));
    }
    return await db.select().from(products);
  }

  async getFeaturedProducts(): Promise<Product[]> {
    return await db.select().from(products).where(eq(products.featured, true));
  }

  async getProduct(id: number): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product;
  }

  async getProductBySlug(slug: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.slug, slug));
    return product;
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const [p] = await db.insert(products).values(product).returning();
    return p;
  }

  async searchProducts(query: string): Promise<Product[]> {
    return await db.select().from(products).where(ilike(products.name, `%${query}%`));
  }

  // VULNERABLE: SQL Injection
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
