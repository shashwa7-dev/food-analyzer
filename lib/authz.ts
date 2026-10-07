import { and, eq, isNull, or, sql, type SQL } from "drizzle-orm";
import { food } from "@/lib/db/schema";

export function visibleFoodWhere(userId: string): SQL {
  return and(isNull(food.deletedAt), or(sql`${food.source} <> 'custom'`, eq(food.ownerId, userId)))!;
}
