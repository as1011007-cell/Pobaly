import { users, userPreferences, contactSubmissions, type User, type InsertUser, type UserPreferences } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { db } from "./db";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser, referralCode?: string): Promise<User>;
  // Updates the user's premium subscription state. Named for legacy
  // schema columns (stripeCustomerId, stripeSubscriptionId) that remain
  // in the table but are now only populated by RevenueCat sync.
  updateUserStripeInfo(userId: string, stripeInfo: {
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    isPremium?: boolean;
    premiumSince?: Date;
    subscriptionExpiry?: Date;
  }): Promise<User | undefined>;
  getUserPreferences(userId: string): Promise<UserPreferences | undefined>;
  saveUserPreferences(userId: string, prefs: Partial<UserPreferences>): Promise<UserPreferences>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(insertUser: InsertUser, referralCode?: string): Promise<User> {
    const [user] = await db.insert(users).values({
      ...insertUser,
      referredByCode: referralCode?.toUpperCase() || null,
    }).returning();
    return user;
  }

  async updateUserStripeInfo(userId: string, stripeInfo: {
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    isPremium?: boolean;
    premiumSince?: Date;
    subscriptionExpiry?: Date;
  }): Promise<User | undefined> {
    const [user] = await db.update(users).set(stripeInfo).where(eq(users.id, userId)).returning();
    return user;
  }

  async getUserPreferences(userId: string): Promise<UserPreferences | undefined> {
    const [prefs] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId));
    return prefs;
  }

  async saveUserPreferences(userId: string, prefs: Partial<UserPreferences>): Promise<UserPreferences> {
    const existing = await this.getUserPreferences(userId);
    
    if (existing) {
      const [updated] = await db
        .update(userPreferences)
        .set({ ...prefs, updatedAt: new Date() })
        .where(eq(userPreferences.userId, userId))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(userPreferences)
        .values({ userId, ...prefs })
        .returning();
      return created;
    }
  }

  async createContactSubmission(data: {
    name: string;
    email: string;
    subject: string;
    message: string;
  }) {
    const result = await db
      .insert(contactSubmissions)
      .values(data)
      .returning();
    return result[0];
  }

  async getContactSubmissions(status?: string) {
    if (status) {
      return db
        .select()
        .from(contactSubmissions)
        .where(eq(contactSubmissions.status, status))
        .orderBy(desc(contactSubmissions.createdAt));
    }
    return db
      .select()
      .from(contactSubmissions)
      .orderBy(desc(contactSubmissions.createdAt));
  }

  // Anonymize user data to satisfy Apple's account deletion requirement.
  // Keeps the row (preserving referential integrity with referrals/affiliates)
  // but scrubs all personal information and revokes access.
  async deleteUser(userId: string): Promise<void> {
    await db
      .update(users)
      .set({
        email: `deleted_${userId}@deleted.invalid`,
        password: "DELETED",
        name: null,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        isPremium: false,
        subscriptionExpiry: null,
      })
      .where(eq(users.id, userId));
  }
}

export const storage = new DatabaseStorage();
