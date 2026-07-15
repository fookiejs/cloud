import { randomBytes } from "node:crypto";
import { getProjectsDb } from "./projects-db.js";

export type MarketplaceListingRow = {
  id: string;
  seller_user_id: string;
  source_template_id: string;
  title: string;
  description: string;
  category: string;
  price_cents: number;
  status: string;
  stages_json: string;
  created_at: string;
  updated_at: string;
  published_at: string | null;
};

export type UserWalletRow = {
  user_id: string;
  balance_cents: number;
  updated_at: string;
};

export type WalletTransactionRow = {
  id: string;
  user_id: string;
  type: string;
  amount_cents: number;
  balance_after: number;
  reference_type: string | null;
  reference_id: string | null;
  created_at: string;
};

export type TemplatePurchaseRow = {
  id: string;
  buyer_user_id: string;
  listing_id: string;
  amount_cents: number;
  purchased_template_id: string;
  created_at: string;
};

const PLATFORM_SELLER_ID = "platform";

export function migrateMarketplaceTables() {
  const db = getProjectsDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS marketplace_listings (
      id TEXT PRIMARY KEY,
      seller_user_id TEXT NOT NULL,
      source_template_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT 'general',
      price_cents INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'published',
      stages_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      published_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_marketplace_listings_status
      ON marketplace_listings(status);

    CREATE TABLE IF NOT EXISTS user_wallets (
      user_id TEXT PRIMARY KEY,
      balance_cents INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS wallet_transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      balance_after INTEGER NOT NULL,
      reference_type TEXT,
      reference_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user
      ON wallet_transactions(user_id);

    CREATE TABLE IF NOT EXISTS template_purchases (
      id TEXT PRIMARY KEY,
      buyer_user_id TEXT NOT NULL,
      listing_id TEXT NOT NULL,
      amount_cents INTEGER NOT NULL DEFAULT 0,
      purchased_template_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(buyer_user_id, listing_id)
    );

    CREATE INDEX IF NOT EXISTS idx_template_purchases_buyer
      ON template_purchases(buyer_user_id);
  `);
}

function newId(): string {
  return randomBytes(8).toString("hex");
}

export function listMarketplaceListingRows(filter: {
  id: string;
  status: string;
  sellerUserId: string;
}): MarketplaceListingRow[] {
  migrateMarketplaceTables();
  const db = getProjectsDb();
  if (filter.id !== "") {
    return db
      .prepare("SELECT * FROM marketplace_listings WHERE id = ?")
      .all(filter.id) as MarketplaceListingRow[];
  }
  if (filter.sellerUserId !== "") {
    return db
      .prepare(
        "SELECT * FROM marketplace_listings WHERE seller_user_id = ? ORDER BY created_at DESC",
      )
      .all(filter.sellerUserId) as MarketplaceListingRow[];
  }
  const status = filter.status !== "" ? filter.status : "published";
  return db
    .prepare(
      `SELECT * FROM marketplace_listings
       WHERE status = ? AND seller_user_id != ?
       ORDER BY published_at DESC, title COLLATE NOCASE ASC`,
    )
    .all(status, PLATFORM_SELLER_ID) as MarketplaceListingRow[];
}

export function insertMarketplaceListingRow(row: {
  sellerUserId: string;
  sourceTemplateId: string;
  title: string;
  description: string;
  category: string;
  priceCents: number;
  stagesJson: string;
}): MarketplaceListingRow {
  migrateMarketplaceTables();
  const db = getProjectsDb();
  const id = newId();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO marketplace_listings
      (id, seller_user_id, source_template_id, title, description, category, price_cents, status, stages_json, created_at, updated_at, published_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'published', ?, ?, ?, ?)`,
  ).run(
    id,
    row.sellerUserId,
    row.sourceTemplateId,
    row.title,
    row.description,
    row.category,
    row.priceCents,
    row.stagesJson,
    now,
    now,
    now,
  );
  const rows = listMarketplaceListingRows({ id, status: "", sellerUserId: "" });
  const first = rows[0];
  if (!first) throw new Error("Failed to create marketplace listing");
  return first;
}

export function updateMarketplaceListingStatus(listingId: string, status: string) {
  migrateMarketplaceTables();
  getProjectsDb()
    .prepare(
      "UPDATE marketplace_listings SET status = ?, updated_at = datetime('now') WHERE id = ?",
    )
    .run(status, listingId);
}

export function updateMarketplaceListingRow(
  listingId: string,
  row: {
    title: string;
    description: string;
    category: string;
    priceCents: number;
  },
) {
  migrateMarketplaceTables();
  getProjectsDb()
    .prepare(
      `UPDATE marketplace_listings
       SET title = ?, description = ?, category = ?, price_cents = ?, updated_at = datetime('now')
       WHERE id = ?`,
    )
    .run(row.title, row.description, row.category, row.priceCents, listingId);
}

export function findPublishedListingForTemplate(
  sellerUserId: string,
  sourceTemplateId: string,
): MarketplaceListingRow | null {
  migrateMarketplaceTables();
  const row = getProjectsDb()
    .prepare(
      `SELECT * FROM marketplace_listings
       WHERE seller_user_id = ? AND source_template_id = ? AND status = 'published'`,
    )
    .get(sellerUserId, sourceTemplateId) as MarketplaceListingRow | undefined;
  return row ?? null;
}

export function ensureUserWallet(userId: string): UserWalletRow {
  migrateMarketplaceTables();
  const db = getProjectsDb();
  const existing = db
    .prepare("SELECT user_id, balance_cents, updated_at FROM user_wallets WHERE user_id = ?")
    .get(userId) as UserWalletRow | undefined;
  if (existing) return existing;
  const now = new Date().toISOString();
  db.prepare(
    "INSERT INTO user_wallets (user_id, balance_cents, updated_at) VALUES (?, 0, ?)",
  ).run(userId, now);
  return { user_id: userId, balance_cents: 0, updated_at: now };
}

export function getUserWalletRow(userId: string): UserWalletRow {
  return ensureUserWallet(userId);
}

export function setUserWalletBalance(userId: string, balanceCents: number) {
  migrateMarketplaceTables();
  ensureUserWallet(userId);
  getProjectsDb()
    .prepare(
      "UPDATE user_wallets SET balance_cents = ?, updated_at = datetime('now') WHERE user_id = ?",
    )
    .run(balanceCents, userId);
}

export function insertWalletTransactionRow(row: {
  userId: string;
  type: string;
  amountCents: number;
  balanceAfter: number;
  referenceType: string | null;
  referenceId: string | null;
}): WalletTransactionRow {
  migrateMarketplaceTables();
  const id = newId();
  const db = getProjectsDb();
  db.prepare(
    `INSERT INTO wallet_transactions
      (id, user_id, type, amount_cents, balance_after, reference_type, reference_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    row.userId,
    row.type,
    row.amountCents,
    row.balanceAfter,
    row.referenceType,
    row.referenceId,
  );
  const created = db
    .prepare("SELECT * FROM wallet_transactions WHERE id = ?")
    .get(id) as WalletTransactionRow;
  return created;
}

export function listWalletTransactionRows(userId: string): WalletTransactionRow[] {
  migrateMarketplaceTables();
  return getProjectsDb()
    .prepare(
      "SELECT * FROM wallet_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 100",
    )
    .all(userId) as WalletTransactionRow[];
}

export function findTemplatePurchase(
  buyerUserId: string,
  listingId: string,
): TemplatePurchaseRow | null {
  migrateMarketplaceTables();
  const row = getProjectsDb()
    .prepare(
      "SELECT * FROM template_purchases WHERE buyer_user_id = ? AND listing_id = ?",
    )
    .get(buyerUserId, listingId) as TemplatePurchaseRow | undefined;
  return row ?? null;
}

export function listTemplatePurchaseRows(buyerUserId: string): TemplatePurchaseRow[] {
  migrateMarketplaceTables();
  if (buyerUserId === "") {
    return getProjectsDb()
      .prepare("SELECT * FROM template_purchases ORDER BY created_at DESC")
      .all() as TemplatePurchaseRow[];
  }
  return getProjectsDb()
    .prepare(
      "SELECT * FROM template_purchases WHERE buyer_user_id = ? ORDER BY created_at DESC",
    )
    .all(buyerUserId) as TemplatePurchaseRow[];
}

export type SellerTemplatePurchaseRow = TemplatePurchaseRow & {
  listing_title: string;
};

export function listSellerTemplatePurchaseRows(
  sellerUserId: string,
): SellerTemplatePurchaseRow[] {
  migrateMarketplaceTables();
  return getProjectsDb()
    .prepare(
      `SELECT tp.*, ml.title AS listing_title
       FROM template_purchases tp
       INNER JOIN marketplace_listings ml ON ml.id = tp.listing_id
       WHERE ml.seller_user_id = ?
       ORDER BY tp.created_at DESC`,
    )
    .all(sellerUserId) as SellerTemplatePurchaseRow[];
}

export function insertTemplatePurchaseRow(row: {
  buyerUserId: string;
  listingId: string;
  amountCents: number;
  purchasedTemplateId: string;
}): TemplatePurchaseRow {
  migrateMarketplaceTables();
  const id = newId();
  getProjectsDb()
    .prepare(
      `INSERT INTO template_purchases
        (id, buyer_user_id, listing_id, amount_cents, purchased_template_id)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(id, row.buyerUserId, row.listingId, row.amountCents, row.purchasedTemplateId);
  const created = findTemplatePurchase(row.buyerUserId, row.listingId);
  if (!created) throw new Error("Failed to record purchase");
  return created;
}

export function removePlatformMarketplaceListings() {
  migrateMarketplaceTables();
  getProjectsDb()
    .prepare("DELETE FROM marketplace_listings WHERE seller_user_id = ?")
    .run(PLATFORM_SELLER_ID);
}

export { PLATFORM_SELLER_ID };
