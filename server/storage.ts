import { db, pool } from "./db";
import { users, posts, invoices, coupons, type User, type InsertUser, type Post, type InsertPost, type Invoice, type InsertInvoice, type Coupon, type InsertCoupon } from "@shared/schema";
import { eq } from "drizzle-orm";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createPost(post: InsertPost): Promise<Post>;
  searchUsersVulnerable(query: string): Promise<any[]>;
  getInvoice(id: number): Promise<Invoice | undefined>;
  createInvoice(invoice: InsertInvoice): Promise<Invoice>;
  deactivateUser(id: number): Promise<User>;
  getCoupon(code: string): Promise<Coupon | undefined>;
  getAllCoupons(): Promise<Coupon[]>;
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

  async createInvoice(insertInvoice: InsertInvoice): Promise<Invoice> {
    const [invoice] = await db.insert(invoices).values(insertInvoice).returning();
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

  async getAllCoupons(): Promise<Coupon[]> {
    return await db.select().from(coupons);
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
