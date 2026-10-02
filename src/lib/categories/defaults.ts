import type { Category, CategoryModule } from "@/types";
import { createId, nowIso } from "@/lib/utils";

interface SeedCategory {
  name: string;
  module: CategoryModule;
  color: string;
  icon: string;
}

const SEEDS: SeedCategory[] = [
  // Money expense
  { name: "Housing", module: "money-expense", color: "#8B5E3C", icon: "home" },
  {
    name: "Food and groceries",
    module: "money-expense",
    color: "#2D6A4F",
    icon: "utensils",
  },
  {
    name: "Transport",
    module: "money-expense",
    color: "#1D3557",
    icon: "car",
  },
  {
    name: "Utilities and data",
    module: "money-expense",
    color: "#457B9D",
    icon: "zap",
  },
  { name: "Health", module: "money-expense", color: "#E63946", icon: "heart" },
  {
    name: "Education",
    module: "money-expense",
    color: "#6D597A",
    icon: "book",
  },
  {
    name: "Family and gifts",
    module: "money-expense",
    color: "#BC4749",
    icon: "gift",
  },
  {
    name: "Entertainment",
    module: "money-expense",
    color: "#F4A261",
    icon: "music",
  },
  {
    name: "Subscriptions",
    module: "money-expense",
    color: "#264653",
    icon: "repeat",
  },
  {
    name: "Savings and investments",
    module: "money-expense",
    color: "#40916C",
    icon: "piggy-bank",
  },
  {
    name: "Business",
    module: "money-expense",
    color: "#3A5A40",
    icon: "briefcase",
  },
  { name: "Giving", module: "money-expense", color: "#9B2226", icon: "hand-heart" },
  { name: "Other", module: "money-expense", color: "#6C757D", icon: "circle" },
  // Money income
  { name: "Salary", module: "money-income", color: "#2D6A4F", icon: "banknote" },
  {
    name: "Business",
    module: "money-income",
    color: "#3A5A40",
    icon: "briefcase",
  },
  {
    name: "Freelance",
    module: "money-income",
    color: "#1D3557",
    icon: "laptop",
  },
  { name: "Gifts", module: "money-income", color: "#BC4749", icon: "gift" },
  {
    name: "Interest",
    module: "money-income",
    color: "#40916C",
    icon: "trending-up",
  },
  { name: "Refunds", module: "money-income", color: "#457B9D", icon: "undo" },
  { name: "Other", module: "money-income", color: "#6C757D", icon: "circle" },
  // Tasks
  { name: "Personal", module: "task", color: "#2D6A4F", icon: "user" },
  { name: "Work", module: "task", color: "#1D3557", icon: "briefcase" },
  { name: "Errands", module: "task", color: "#F4A261", icon: "shopping-bag" },
  { name: "Bills", module: "task", color: "#E63946", icon: "receipt" },
  { name: "Family", module: "task", color: "#BC4749", icon: "users" },
  { name: "Learning", module: "task", color: "#6D597A", icon: "book" },
  // Health
  { name: "Water", module: "health", color: "#457B9D", icon: "droplet" },
  { name: "Sleep", module: "health", color: "#6D597A", icon: "moon" },
  { name: "Exercise", module: "health", color: "#2D6A4F", icon: "dumbbell" },
  {
    name: "Medication",
    module: "health",
    color: "#E63946",
    icon: "pill",
  },
  { name: "Nutrition", module: "health", color: "#40916C", icon: "apple" },
  { name: "Mood", module: "health", color: "#F4A261", icon: "smile" },
  {
    name: "Measurements",
    module: "health",
    color: "#1D3557",
    icon: "activity",
  },
  { name: "Workout", module: "health", color: "#2D6A4F", icon: "dumbbell" },
  { name: "Meals", module: "health", color: "#40916C", icon: "apple" },
  // Household
  {
    name: "Groceries",
    module: "household",
    color: "#2D6A4F",
    icon: "shopping-bag",
  },
  { name: "Market", module: "household", color: "#40916C", icon: "store" },
  {
    name: "Household supplies",
    module: "household",
    color: "#457B9D",
    icon: "spray-can",
  },
  { name: "Repairs", module: "household", color: "#8B5E3C", icon: "wrench" },
  { name: "Plumbing", module: "household", color: "#1D3557", icon: "droplet" },
  {
    name: "Electrical",
    module: "household",
    color: "#B7791F",
    icon: "zap",
  },
  { name: "Other", module: "household", color: "#6C757D", icon: "circle" },
];

export function buildDefaultCategories(userId: string): Category[] {
  const stamp = nowIso();
  return SEEDS.map((seed, index) => ({
    id: createId(),
    userId,
    name: seed.name,
    module: seed.module,
    parentId: null,
    color: seed.color,
    icon: seed.icon,
    archived: false,
    sortOrder: index,
    createdAt: stamp,
    updatedAt: stamp,
  }));
}
