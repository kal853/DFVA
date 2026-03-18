import { pgTable, serial, text, timestamp, integer, boolean, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name"),
  role: text("role").default("user").notNull(),
  email: text("email"),
  isActive: boolean("is_active").default(true),
  plan: text("plan").default("free").notNull(),
  walletBalance: decimal("wallet_balance", { precision: 10, scale: 2 }).default("0.00").notNull(),
  planStartDate: timestamp("plan_start_date").defaultNow(),
});

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description").notNull(),
  longDescription: text("long_description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  category: text("category").notNull(),
  badge: text("badge"),
  stock: integer("stock").default(100),
  rating: decimal("rating", { precision: 3, scale: 1 }).default("4.5"),
  reviewCount: integer("review_count").default(0),
  featured: boolean("featured").default(false),
  specs: text("specs"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  authorId: serial("author_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  userId: serial("user_id").references(() => users.id).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  status: text("status").default("unpaid"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const coupons = pgTable("coupons", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  type: text("type").notNull(),
  value: decimal("value", { precision: 10, scale: 2 }).notNull(),
  maxUses: integer("max_uses"),
  timesUsed: integer("times_used").default(0),
});

export const walletTransactions = pgTable("wallet_transactions", {
  id: serial("id").primaryKey(),
  userId: serial("user_id").references(() => users.id).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  type: text("type").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

// RAG Knowledge Base tables
export const ragDocuments = pgTable("rag_documents", {
  id: serial("id").primaryKey(),
  // VULN: userId trusted from request body — no server-side session verification
  userId: integer("user_id").references(() => users.id).notNull(),
  filename: text("filename").notNull(),
  contentType: text("content_type").notNull(),
  chunkCount: integer("chunk_count").default(0),
  status: text("status").default("processing").notNull(), // processing | ready | error
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

export const ragChunks = pgTable("rag_chunks", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").references(() => ragDocuments.id).notNull(),
  // VULN: uploader identity stored verbatim in every chunk — leaks to all retrieval consumers
  userId: integer("user_id").notNull(),
  uploaderUsername: text("uploader_username").notNull(),
  filename: text("filename").notNull(),
  content: text("content").notNull(),
  // Embedding stored as JSON float array — no pgvector, similarity computed in JS
  embedding: text("embedding"),
  chunkIndex: integer("chunk_index").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type RagDocument = typeof ragDocuments.$inferSelect;
export type RagChunk = typeof ragChunks.$inferSelect;
export const insertRagDocumentSchema = createInsertSchema(ragDocuments).omit({ id: true, uploadedAt: true });
export const insertRagChunkSchema = createInsertSchema(ragChunks).omit({ id: true, createdAt: true });

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertProductSchema = createInsertSchema(products).omit({ id: true, createdAt: true });
export const insertPostSchema = createInsertSchema(posts).omit({ id: true, createdAt: true });
export const insertInvoiceSchema = createInsertSchema(invoices).omit({ id: true, createdAt: true });
export const insertWalletTxSchema = createInsertSchema(walletTransactions).omit({ id: true, createdAt: true });

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type InsertPost = z.infer<typeof insertPostSchema>;
export type Post = typeof posts.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type Coupon = typeof coupons.$inferSelect;
export type WalletTransaction = typeof walletTransactions.$inferSelect;

export const PLANS = {
  free:       { name: "Explorer",    price: 0,   perks: "Standard shipping, 30-day returns" },
  pro:        { name: "Member",      price: 9,   perks: "Free shipping, priority support, 5% off" },
  enterprise: { name: "Elite",       price: 29,  perks: "Free express shipping, 15% off, early access" },
} as const;

export type PlanKey = keyof typeof PLANS;
