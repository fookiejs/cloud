import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { assertAuth } from "../middleware/auth.js";
import {
  getMarketplaceListing,
  listMarketplaceListings,
  listPublishableTemplates,
  listSellerMarketplaceListings,
  listSellerSales,
  listUserPurchases,
  publishMarketplaceListing,
  purchaseMarketplaceListing,
  unlistMarketplaceListing,
  updateMarketplaceListing,
} from "../services/marketplace-service.js";

const listingIdParamsSchema = z.object({
  listingId: z.string().trim().min(1),
});

const publishSchema = z.object({
  sourceTemplateId: z.string().trim().min(1),
  title: z.string().trim().optional().default(""),
  description: z.string().trim().optional().default(""),
  category: z.string().trim().optional().default("general"),
  priceCents: z.number().int().nonnegative(),
});

const updateListingSchema = z.object({
  title: z.string().trim().optional().default(""),
  description: z.string().trim().optional().default(""),
  category: z.string().trim().optional().default("general"),
  priceCents: z.number().int().nonnegative(),
});

export function marketplaceRoutes(app: FastifyInstance) {
  app.get("/marketplace/listings", async (request) => {
    const user = await assertAuth(request);
    return { items: listMarketplaceListings(user.id) };
  });

  app.get("/marketplace/my-listings", async (request) => {
    const user = await assertAuth(request);
    return { items: listSellerMarketplaceListings(user.id) };
  });

  app.get("/marketplace/listings/:listingId", async (request) => {
    const user = await assertAuth(request);
    const params = listingIdParamsSchema.parse(request.params);
    const listing = getMarketplaceListing(params.listingId, user.id);
    if (!listing) {
      return { listing: null };
    }
    return { listing };
  });

  app.post("/marketplace/listings", async (request, reply) => {
    const user = await assertAuth(request);
    const body = publishSchema.parse(request.body);
    const listing = publishMarketplaceListing({
      sellerUserId: user.id,
      sourceTemplateId: body.sourceTemplateId,
      title: body.title,
      description: body.description,
      category: body.category,
      priceCents: body.priceCents,
    });
    return reply.status(201).send({ listing });
  });

  app.patch("/marketplace/listings/:listingId", async (request) => {
    const user = await assertAuth(request);
    const params = listingIdParamsSchema.parse(request.params);
    const body = updateListingSchema.parse(request.body);
    const listing = updateMarketplaceListing({
      listingId: params.listingId,
      sellerUserId: user.id,
      title: body.title,
      description: body.description,
      category: body.category,
      priceCents: body.priceCents,
    });
    return { listing };
  });

  app.delete("/marketplace/listings/:listingId", async (request, reply) => {
    const user = await assertAuth(request);
    const params = listingIdParamsSchema.parse(request.params);
    unlistMarketplaceListing(params.listingId, user.id);
    return reply.status(204).send();
  });

  app.post("/marketplace/listings/:listingId/purchase", async (request) => {
    const user = await assertAuth(request);
    const params = listingIdParamsSchema.parse(request.params);
    return purchaseMarketplaceListing(params.listingId, user.id);
  });

  app.get("/marketplace/purchases", async (request) => {
    const user = await assertAuth(request);
    return { items: listUserPurchases(user.id) };
  });

  app.get("/marketplace/sales", async (request) => {
    const user = await assertAuth(request);
    return { items: listSellerSales(user.id) };
  });

  app.get("/marketplace/publishable-templates", async (request) => {
    const user = await assertAuth(request);
    return { items: listPublishableTemplates(user.id) };
  });
}
