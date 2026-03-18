import { db, pool } from "./db";
import {
  users, posts, invoices, walletTransactions, products, ragDocuments, ragChunks,
  type User, type InsertUser, type Post, type InsertPost,
  type Invoice, type WalletTransaction, type Product, type InsertProduct,
  type RagDocument, type RagChunk, type PlanKey
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
  setFullName(userId: number, fullName: string): Promise<User>;
  logWalletTransaction(userId: number, amount: number, type: string, description: string): Promise<WalletTransaction>;
  // Products
  getProducts(category?: string): Promise<Product[]>;
  getFeaturedProducts(): Promise<Product[]>;
  getProduct(id: number): Promise<Product | undefined>;
  getProductBySlug(slug: string): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  searchProducts(query: string): Promise<Product[]>;
  // RAG Knowledge Base
  createRagDocument(data: { userId: number; filename: string; contentType: string }): Promise<RagDocument>;
  updateRagDocumentStatus(id: number, status: string, chunkCount?: number): Promise<RagDocument>;
  getRagDocumentsByUser(userId: number): Promise<RagDocument[]>;
  getRagDocument(id: number): Promise<RagDocument | undefined>;
  deleteRagDocument(id: number): Promise<void>;
  // VULN: no tenant filter param — all implementations fetch ALL chunks across all users
  createRagChunk(data: { documentId: number; userId: number; uploaderUsername: string; filename: string; content: string; embedding: string; chunkIndex: number }): Promise<RagChunk>;
  getAllRagChunks(): Promise<RagChunk[]>;
  deleteRagChunksByDocument(documentId: number): Promise<void>;
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

  async setFullName(userId: number, fullName: string): Promise<User> {
    const [user] = await db.update(users).set({ fullName }).where(eq(users.id, userId)).returning();
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

  // Fixed: Using parameterized query with Drizzle ORM
  async searchUsersVulnerable(query: string): Promise<any[]> {
    return await db.select({ id: users.id, username: users.username, role: users.role })
      .from(users)
      .where(ilike(users.username, `%${query}%`));
  }

  // ── RAG Knowledge Base ────────────────────────────────────────────────────

  async createRagDocument(data: { userId: number; filename: string; contentType: string }): Promise<RagDocument> {
    const [doc] = await db.insert(ragDocuments).values({
      userId: data.userId,
      filename: data.filename,
      contentType: data.contentType,
      status: "processing",
    }).returning();
    return doc;
  }

  async updateRagDocumentStatus(id: number, status: string, chunkCount?: number): Promise<RagDocument> {
    const updates: any = { status };
    if (chunkCount !== undefined) updates.chunkCount = chunkCount;
    const [doc] = await db.update(ragDocuments).set(updates).where(eq(ragDocuments.id, id)).returning();
    return doc;
  }

  async getRagDocumentsByUser(userId: number): Promise<RagDocument[]> {
    return await db.select().from(ragDocuments).where(eq(ragDocuments.userId, userId));
  }

  async getRagDocument(id: number): Promise<RagDocument | undefined> {
    const [doc] = await db.select().from(ragDocuments).where(eq(ragDocuments.id, id));
    return doc;
  }

  async deleteRagDocument(id: number): Promise<void> {
    await db.delete(ragDocuments).where(eq(ragDocuments.id, id));
  }

  async createRagChunk(data: {
    documentId: number; userId: number; uploaderUsername: string;
    filename: string; content: string; embedding: string; chunkIndex: number;
  }): Promise<RagChunk> {
    const [chunk] = await db.insert(ragChunks).values(data).returning();
    return chunk;
  }

  // VULN: fetches ALL chunks — no WHERE userId = ? — cross-tenant data exposure
  async getAllRagChunks(): Promise<RagChunk[]> {
    return await db.select().from(ragChunks);
  }

  async deleteRagChunksByDocument(documentId: number): Promise<void> {
    await db.delete(ragChunks).where(eq(ragChunks.documentId, documentId));
  }
}

export const storage = new DatabaseStorage();
