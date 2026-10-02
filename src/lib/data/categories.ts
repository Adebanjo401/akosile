import { getDb } from "@/lib/db";
import { enqueueDelete, enqueueUpsert } from "@/lib/sync/engine";
import { createId, nowIso } from "@/lib/utils";
import { buildDefaultCategories } from "@/lib/categories/defaults";
import type { Category, CategoryModule } from "@/types";

export async function listCategories(
  userId: string,
  module?: CategoryModule,
): Promise<Category[]> {
  const db = getDb();
  let items = await db.categories.where({ userId }).toArray();
  items = items.filter((c) => !c.archived);
  if (module) items = items.filter((c) => c.module === module);
  return items.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

export async function createCategory(input: {
  userId: string;
  name: string;
  module: CategoryModule;
  color?: string;
  icon?: string;
}): Promise<Category> {
  const stamp = nowIso();
  const category: Category = {
    id: createId(),
    userId: input.userId,
    name: input.name.trim(),
    module: input.module,
    parentId: null,
    color: input.color ?? "#2D6A4F",
    icon: input.icon ?? "circle",
    archived: false,
    sortOrder: 999,
    createdAt: stamp,
    updatedAt: stamp,
  };
  const db = getDb();
  await db.categories.put(category);
  await enqueueUpsert("categories", category.id, category);
  return category;
}

export async function updateCategory(
  userId: string,
  id: string,
  patch: Partial<Pick<Category, "name" | "color" | "icon" | "archived">>,
): Promise<Category | null> {
  const db = getDb();
  const existing = await db.categories.get(id);
  if (!existing || existing.userId !== userId) return null;
  const updated = { ...existing, ...patch, updatedAt: nowIso() };
  await db.categories.put(updated);
  await enqueueUpsert("categories", updated.id, updated);
  return updated;
}

export async function reassignAndDeleteCategory(input: {
  userId: string;
  categoryId: string;
  replacementId: string | null;
  mode: "archive" | "reassign";
}): Promise<void> {
  const db = getDb();
  const cat = await db.categories.get(input.categoryId);
  if (!cat || cat.userId !== input.userId) return;

  if (input.mode === "archive") {
    await updateCategory(input.userId, input.categoryId, { archived: true });
    return;
  }

  if (!input.replacementId) {
    throw new Error("Choose a replacement category, or archive instead.");
  }

  const txs = await db.transactions
    .where({ categoryId: input.categoryId })
    .toArray();
  for (const tx of txs) {
    const updated = {
      ...tx,
      categoryId: input.replacementId,
      updatedAt: nowIso(),
    };
    await db.transactions.put(updated);
    await enqueueUpsert("transactions", updated.id, updated);
  }

  const tasks = await db.tasks.where({ categoryId: input.categoryId }).toArray();
  for (const task of tasks) {
    const updated = {
      ...task,
      categoryId: input.replacementId,
      updatedAt: nowIso(),
    };
    await db.tasks.put(updated);
    await enqueueUpsert("tasks", updated.id, updated);
  }

  const household = await db.householdItems
    .where({ userId: input.userId })
    .toArray();
  for (const item of household) {
    if (item.categoryId !== input.categoryId) continue;
    const updated = {
      ...item,
      categoryId: input.replacementId,
      updatedAt: nowIso(),
    };
    await db.householdItems.put(updated);
    await enqueueUpsert("householdItems", updated.id, updated);
  }

  const budgetRows = await db.budgets
    .where({ categoryId: input.categoryId })
    .toArray();
  for (const budget of budgetRows) {
    if (budget.userId !== input.userId) continue;
    const updated = {
      ...budget,
      categoryId: input.replacementId,
      updatedAt: nowIso(),
    };
    await db.budgets.put(updated);
    await enqueueUpsert("budgets", updated.id, updated);
  }

  await db.categories.delete(input.categoryId);
  await enqueueDelete("categories", input.categoryId);
}

/**
 * Adds any newly introduced default categories without touching ones the
 * user already has (matched by module + name).
 */
export async function seedMissingCategories(userId: string): Promise<void> {
  const db = getDb();
  const existing = await db.categories.where({ userId }).toArray();
  const have = new Set(existing.map((c) => `${c.module}:${c.name.toLowerCase()}`));
  const missing = buildDefaultCategories(userId).filter(
    (c) => !have.has(`${c.module}:${c.name.toLowerCase()}`),
  );
  if (missing.length === 0) return;
  await db.categories.bulkPut(missing);
  for (const cat of missing) {
    await enqueueUpsert("categories", cat.id, cat);
  }
}
