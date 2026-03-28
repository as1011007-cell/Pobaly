import * as bcrypt from "bcryptjs";
import { db } from "./db";
import { users } from "../shared/schema";
import { eq } from "drizzle-orm";

const TEST_EMAIL = "test@probaly.app";
const TEST_PASSWORD = "testpass123";

async function seedTestUser() {
  try {
    // Check if test user already exists
    const existing = await db.select().from(users).where(eq(users.email, TEST_EMAIL)).limit(1);

    if (existing.length > 0) {
      console.log("Test user already exists:", TEST_EMAIL);
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(TEST_PASSWORD, 10);

    // Create test user
    await db.insert(users).values({
      email: TEST_EMAIL,
      password: hashedPassword,
      name: "Test User",
      isPremium: false,
    });

    console.log(`✓ Test user created: ${TEST_EMAIL} / ${TEST_PASSWORD}`);
  } catch (error) {
    console.error("Failed to seed test user:", error);
    throw error;
  }
}

seedTestUser().then(() => {
  console.log("Test user seed completed");
  process.exit(0);
});
