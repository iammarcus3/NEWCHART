import { db } from './index.ts';
import { users, customCharts } from './schema.ts';
import { eq } from 'drizzle-orm';

export async function getOrCreateUser(uid: string, email: string) {
  try {
    const result = await db.insert(users)
      .values({
        uid,
        email,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error("Database query failed in getOrCreateUser:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}

export async function getUsers() {
  try {
    return await db.select().from(users);
  } catch (error) {
    console.error("Database query failed in getUsers:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}

export async function getUserCustomCharts(uid: string) {
  try {
    const userList = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    if (!userList.length) return [];
    const user = userList[0];
    return await db.select().from(customCharts).where(eq(customCharts.userId, user.id));
  } catch (error) {
    console.error("Database query failed in getUserCustomCharts:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}
