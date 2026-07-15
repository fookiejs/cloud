import { randomUUID } from "node:crypto";
import {
  findPublishedListingForTemplate,
  findTemplatePurchase,
  insertMarketplaceListingRow,
  insertTemplatePurchaseRow,
  listMarketplaceListingRows,
  listSellerTemplatePurchaseRows,
  listTemplatePurchaseRows,
  PLATFORM_SELLER_ID,
  removePlatformMarketplaceListings,
  updateMarketplaceListingRow,
  updateMarketplaceListingStatus,
  type MarketplaceListingRow,
} from "../db/marketplace-db.js";
import { getWorkflowTemplateOwner } from "../db/workflow-template-db.js";
import { listUserRows } from "../db/users-db.js";
import { AppError } from "../errors/app-error.js";
import {
  ensureDefaultWorkflowTemplates,
  getWorkflowTemplate,
  importWorkflowTemplate,
  listOwnedWorkflowTemplates,
} from "./workflow-template-service.js";
import type { WorkflowStage } from "./workflow-service.js";

export type MarketplaceListingSummary = {
  id: string;
  sellerUserId: string;
  sellerName: string;
  sourceTemplateId: string;
  title: string;
  description: string;
  category: string;
  priceCents: number;
  stageCount: number;
  owned: boolean;
  isOwnListing: boolean;
  purchasedTemplateId: string | null;
  publishedAt: string | null;
};

export type MarketplaceListingDetail = MarketplaceListingSummary & {
  stages: WorkflowStage[];
};

const sellerNameCache = new Map<string, string>();

function resolveSellerName(sellerUserId: string): string {
  const cached = sellerNameCache.get(sellerUserId);
  if (cached) return cached;
  const rows = listUserRows({ id: sellerUserId, email: "", token: "" });
  const row = rows[0];
  const name = row?.name ?? "Community";
  sellerNameCache.set(sellerUserId, name);
  return name;
}

function parseStagesJson(stagesJson: string): WorkflowStage[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stagesJson);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.map((row, index) => {
    const item = row as Record<string, unknown>;
    const taskTemplatesJson =
      typeof item.task_templates_json === "string" ? item.task_templates_json : "[]";
    let taskTemplates = [];
    try {
      taskTemplates = JSON.parse(taskTemplatesJson);
    } catch {
      taskTemplates = [];
    }
    return {
      id: String(item.id ?? `stage-${index}`),
      title: String(item.title ?? ""),
      description: String(item.description ?? ""),
      position: Number(item.position ?? index),
      autoAssignRole: null,
      layoutX: typeof item.layout_x === "number" ? item.layout_x : null,
      layoutY: typeof item.layout_y === "number" ? item.layout_y : null,
      spawnTaskCount: Array.isArray(taskTemplates) ? taskTemplates.length : 0,
      taskTemplates: Array.isArray(taskTemplates) ? taskTemplates : [],
      activeTaskCount: null,
    } as WorkflowStage;
  });
}

function rowToSummary(row: MarketplaceListingRow, viewerUserId: string): MarketplaceListingSummary {
  const purchase = viewerUserId !== "" ? findTemplatePurchase(viewerUserId, row.id) : null;
  const stages = parseStagesJson(row.stages_json);
  return {
    id: row.id,
    sellerUserId: row.seller_user_id,
    sellerName: resolveSellerName(row.seller_user_id),
    sourceTemplateId: row.source_template_id,
    title: row.title,
    description: row.description,
    category: row.category,
    priceCents: row.price_cents,
    stageCount: stages.length,
    owned: purchase !== null,
    isOwnListing: row.seller_user_id === viewerUserId,
    purchasedTemplateId: purchase?.purchased_template_id ?? null,
    publishedAt: row.published_at,
  };
}

function buildStagesSnapshot(templateId: string): string {
  const template = getWorkflowTemplate(templateId);
  if (!template) return "[]";
  return JSON.stringify(
    template.stages.map((stage) => ({
      id: stage.id,
      title: stage.title,
      description: stage.description,
      purpose: "",
      rules_json: "[]",
      position: stage.position,
      layout_x: stage.layoutX,
      layout_y: stage.layoutY,
      task_templates_json: JSON.stringify(stage.taskTemplates),
    })),
  );
}

export function ensureMarketplaceReady(): void {
  ensureDefaultWorkflowTemplates();
  removePlatformMarketplaceListings();
}

export function listMarketplaceListings(viewerUserId: string): MarketplaceListingSummary[] {
  ensureMarketplaceReady();
  return listMarketplaceListingRows({ id: "", status: "published", sellerUserId: "" }).map(
    (row) => rowToSummary(row, viewerUserId),
  );
}

export function listSellerMarketplaceListings(sellerUserId: string): MarketplaceListingSummary[] {
  ensureMarketplaceReady();
  return listMarketplaceListingRows({ id: "", status: "", sellerUserId })
    .filter((row) => row.status === "published")
    .map((row) => rowToSummary(row, sellerUserId));
}

export function getMarketplaceListing(
  listingId: string,
  viewerUserId: string,
): MarketplaceListingDetail | null {
  ensureMarketplaceReady();
  const rows = listMarketplaceListingRows({ id: listingId, status: "", sellerUserId: "" });
  const row = rows[0];
  if (!row || row.status !== "published" || row.seller_user_id === PLATFORM_SELLER_ID) return null;
  const summary = rowToSummary(row, viewerUserId);
  return {
    ...summary,
    stages: parseStagesJson(row.stages_json),
  };
}

function assertCanPublishTemplate(sellerUserId: string, sourceTemplateId: string) {
  const owner = getWorkflowTemplateOwner(sourceTemplateId);
  if (owner === null) {
    throw new AppError("Built-in templates cannot be published. Create or duplicate your own first.", 403);
  }
  if (owner !== sellerUserId) {
    throw new AppError("You can only publish templates you own", 403);
  }
  const existing = findPublishedListingForTemplate(sellerUserId, sourceTemplateId);
  if (existing) {
    throw new AppError("This template is already listed on the marketplace", 409);
  }
}

export function publishMarketplaceListing(input: {
  sellerUserId: string;
  sourceTemplateId: string;
  title: string;
  description: string;
  category: string;
  priceCents: number;
}): MarketplaceListingSummary {
  ensureMarketplaceReady();
  const template = getWorkflowTemplate(input.sourceTemplateId);
  if (!template) {
    throw new AppError("Workflow template not found", 404);
  }
  if (input.priceCents < 0) {
    throw new AppError("Price cannot be negative", 400);
  }
  assertCanPublishTemplate(input.sellerUserId, input.sourceTemplateId);
  const row = insertMarketplaceListingRow({
    sellerUserId: input.sellerUserId,
    sourceTemplateId: input.sourceTemplateId,
    title: input.title.trim() || template.title,
    description: input.description.trim() || template.description,
    category: input.category.trim() || "general",
    priceCents: input.priceCents,
    stagesJson: buildStagesSnapshot(input.sourceTemplateId),
  });
  return rowToSummary(row, input.sellerUserId);
}

export function updateMarketplaceListing(input: {
  listingId: string;
  sellerUserId: string;
  title: string;
  description: string;
  category: string;
  priceCents: number;
}): MarketplaceListingSummary {
  const rows = listMarketplaceListingRows({ id: input.listingId, status: "", sellerUserId: "" });
  const row = rows[0];
  if (!row || row.status !== "published") {
    throw new AppError("Listing not found", 404);
  }
  if (row.seller_user_id !== input.sellerUserId) {
    throw new AppError("Not allowed to edit this listing", 403);
  }
  if (input.priceCents < 0) {
    throw new AppError("Price cannot be negative", 400);
  }
  updateMarketplaceListingRow(input.listingId, {
    title: input.title.trim() || row.title,
    description: input.description.trim(),
    category: input.category.trim() || row.category,
    priceCents: input.priceCents,
  });
  const updated = listMarketplaceListingRows({ id: input.listingId, status: "", sellerUserId: "" })[0];
  if (!updated) throw new AppError("Listing not found", 404);
  return rowToSummary(updated, input.sellerUserId);
}

export function unlistMarketplaceListing(listingId: string, sellerUserId: string): void {
  const rows = listMarketplaceListingRows({ id: listingId, status: "", sellerUserId: "" });
  const row = rows[0];
  if (!row) throw new AppError("Listing not found", 404);
  if (row.seller_user_id !== sellerUserId) {
    throw new AppError("Not allowed to unlist this listing", 403);
  }
  updateMarketplaceListingStatus(listingId, "unlisted");
}

function cloneListingTemplate(
  row: MarketplaceListingRow,
  buyerUserId: string,
): string {
  const stages = parseStagesJson(row.stages_json);
  const imported = importWorkflowTemplate({
    id: `purchased-${row.id.slice(0, 8)}-${randomUUID().slice(0, 8)}`,
    title: row.title,
    description: row.description,
    stages,
    ownerUserId: buyerUserId,
  });
  return imported.id;
}

export function purchaseMarketplaceListing(
  listingId: string,
  buyerUserId: string,
): { purchasedTemplateId: string; listing: MarketplaceListingSummary } {
  ensureMarketplaceReady();
  const rows = listMarketplaceListingRows({ id: listingId, status: "", sellerUserId: "" });
  const row = rows[0];
  if (!row || row.status !== "published") {
    throw new AppError("Listing not found", 404);
  }
  if (row.seller_user_id === PLATFORM_SELLER_ID) {
    throw new AppError("Listing not found", 404);
  }
  const existing = findTemplatePurchase(buyerUserId, listingId);
  if (existing) {
    return {
      purchasedTemplateId: existing.purchased_template_id,
      listing: rowToSummary(row, buyerUserId),
    };
  }
  if (row.seller_user_id === buyerUserId) {
    throw new AppError("Cannot purchase your own listing", 400);
  }

  const purchasedTemplateId = cloneListingTemplate(row, buyerUserId);

  insertTemplatePurchaseRow({
    buyerUserId,
    listingId,
    amountCents: row.price_cents,
    purchasedTemplateId,
  });

  return {
    purchasedTemplateId,
    listing: rowToSummary(row, buyerUserId),
  };
}

export function listUserPurchases(buyerUserId: string) {
  return listTemplatePurchaseRows(buyerUserId).map((purchase) => {
    const listingRows = listMarketplaceListingRows({
      id: purchase.listing_id,
      status: "",
      sellerUserId: "",
    });
    const listing = listingRows[0];
    return {
      id: purchase.id,
      listingId: purchase.listing_id,
      amountCents: purchase.amount_cents,
      purchasedTemplateId: purchase.purchased_template_id,
      createdAt: purchase.created_at,
      listingTitle: listing?.title ?? "",
      sellerName: listing ? resolveSellerName(listing.seller_user_id) : "",
    };
  });
}

export function listSellerSales(sellerUserId: string) {
  return listSellerTemplatePurchaseRows(sellerUserId).map((purchase) => ({
    id: purchase.id,
    listingId: purchase.listing_id,
    listingTitle: purchase.listing_title,
    buyerName: resolveSellerName(purchase.buyer_user_id),
    amountCents: purchase.amount_cents,
    createdAt: purchase.created_at,
  }));
}

export function listPublishableTemplates(userId: string) {
  return listOwnedWorkflowTemplates(userId);
}
