import { db, pool } from "./db";
import { users, posts, type User, type InsertUser, type Post, type InsertPost } from "@shared/schema";
import { eq } from "drizzle-orm";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createPost(post: InsertPost): Promise<Post>;
  searchUsersVulnerable(query: string): Promise<any[]>;
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

  // VULNERABLE to SQL Injection
  async searchUsersVulnerable(query: string): Promise<any[]> {
    // Deliberately concatenating user input directly into the query
    const sqlQuery = `SELECT id, username, role FROM users WHERE username LIKE '%${query}%'`;
    try {
      const res = await pool.query(sqlQuery);
      return res.rows;
    } catch (e: any) {
      console.error(e);
      // Return the error to the user to make SQLi exploitation easier for demo
      throw new Error(e.message);
    }
  }
}

export const storage = new DatabaseStorage();
