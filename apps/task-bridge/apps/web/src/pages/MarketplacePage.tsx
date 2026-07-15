import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, Pencil, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { useSession } from "@/hooks/useSession";
import {
  fetchMarketplaceListings,
  fetchMarketplacePurchases,
  fetchMarketplaceSales,
  fetchMyMarketplaceListings,
  fetchPublishableTemplates,
  publishMarketplaceListing,
  purchaseMarketplaceListing,
  unlistMarketplaceListing,
  updateMarketplaceListing,
  type MarketplaceListingSummary,
  type WorkflowTemplateSummary,
} from "@/lib/api";
import { cn } from "@/lib/utils";

type Tab = "browse" | "mine" | "purchases" | "sales";

function formatPrice(cents: number) {
  if (cents <= 0) return "Free";
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

type PublishFormProps = {
  templates: WorkflowTemplateSummary[];
  initialTemplateId: string;
  initialTitle: string;
  initialDescription: string;
  editing: MarketplaceListingSummary | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
};

function PublishForm({
  templates,
  initialTemplateId,
  initialTitle,
  initialDescription,
  editing,
  onClose,
  onSaved,
}: PublishFormProps) {
  const session = useSession();
  const [publishTemplateId, setPublishTemplateId] = useState(initialTemplateId);
  const [publishTitle, setPublishTitle] = useState(initialTitle);
  const [publishDescription, setPublishDescription] = useState(initialDescription);
  const [publishCategory, setPublishCategory] = useState(editing?.category ?? "general");
  const [pricingMode, setPricingMode] = useState<"free" | "paid">(
    editing && editing.priceCents > 0 ? "paid" : "free",
  );
  const [publishPrice, setPublishPrice] = useState(
    editing && editing.priceCents > 0 ? String(editing.priceCents / 100) : "9.99",
  );
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!session) return;
    const priceCents =
      pricingMode === "free" ? 0 : Math.round(Number(publishPrice) * 100);
    if (!Number.isFinite(priceCents) || priceCents < 0) {
      toast.error("Invalid price");
      return;
    }
    if (pricingMode === "paid" && priceCents === 0) {
      toast.error("Paid listings need a price greater than zero, or choose Free");
      return;
    }
    if (!editing && !publishTemplateId) {
      toast.error("Select a template");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateMarketplaceListing(session, editing.id, {
          title: publishTitle.trim(),
          description: publishDescription.trim(),
          category: publishCategory.trim() || "general",
          priceCents,
        });
        toast.success("Listing updated");
      } else {
        await publishMarketplaceListing(session, {
          sourceTemplateId: publishTemplateId,
          title: publishTitle.trim(),
          description: publishDescription.trim(),
          category: publishCategory.trim() || "general",
          priceCents,
        });
        toast.success(priceCents > 0 ? "Template listed for sale" : "Template shared for free");
      }
      await onSaved();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-xl border border-white/10 bg-[hsl(0,0%,6%)] p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-white">
          {editing ? "Edit listing" : "Share on marketplace"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {editing
            ? "Update price and details. Buyers keep the version they purchased."
            : "Publish a workflow template you own. Set price to free (0) or charge for it."}
        </p>
        <div className="mt-6 space-y-4">
          {!editing ? (
            <div className="space-y-2">
              <Label>Your template</Label>
              {templates.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No owned templates yet. Create one under Workflow templates first.
                </p>
              ) : (
                <select
                  value={publishTemplateId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setPublishTemplateId(id);
                    const item = templates.find((t) => t.id === id);
                    if (item) {
                      setPublishTitle(item.title);
                      setPublishDescription(item.description);
                    }
                  }}
                  className="flex h-10 w-full rounded-md border border-white/10 bg-white/[0.03] px-3 text-sm text-white"
                >
                  {templates.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ) : null}
          <div className="space-y-2">
            <Label>Listing title</Label>
            <Input value={publishTitle} onChange={(e) => setPublishTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={publishDescription}
              onChange={(e) => setPublishDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Input value={publishCategory} onChange={(e) => setPublishCategory(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Pricing</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPricingMode("free")}
                className={cn(
                  "flex-1 rounded-lg border px-3 py-2 text-sm transition-colors",
                  pricingMode === "free"
                    ? "border-primary bg-primary/10 text-white"
                    : "border-white/10 text-muted-foreground hover:border-white/20",
                )}
              >
                Free
              </button>
              <button
                type="button"
                onClick={() => setPricingMode("paid")}
                className={cn(
                  "flex-1 rounded-lg border px-3 py-2 text-sm transition-colors",
                  pricingMode === "paid"
                    ? "border-primary bg-primary/10 text-white"
                    : "border-white/10 text-muted-foreground hover:border-white/20",
                )}
              >
                Paid
              </button>
            </div>
            {pricingMode === "paid" ? (
              <div className="pt-1">
                <Label>Price (USD)</Label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={publishPrice}
                  onChange={(e) => setPublishPrice(e.target.value)}
                  className="mt-2"
                />
              </div>
            ) : null}
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleSave()}
            disabled={saving || (!editing && (templates.length === 0 || !publishTemplateId))}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? "Save" : "Publish"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ListingCard({
  listing,
  selectForProject,
  purchasingId,
  onPurchase,
  onSelectForProject,
  onEdit,
  onUnlist,
}: {
  listing: MarketplaceListingSummary;
  selectForProject: boolean;
  purchasingId: string | null;
  onPurchase: (listing: MarketplaceListingSummary) => void;
  onSelectForProject: (listing: MarketplaceListingSummary) => void;
  onEdit?: (listing: MarketplaceListingSummary) => void;
  onUnlist?: (listing: MarketplaceListingSummary) => void;
}) {
  return (
    <article className="flex flex-col rounded-xl border border-white/10 bg-white/[0.02] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">{listing.title}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            by {listing.sellerName} · {listing.category}
          </p>
        </div>
        <Badge variant={listing.priceCents > 0 ? "default" : "secondary"}>
          {formatPrice(listing.priceCents)}
        </Badge>
      </div>
      <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground line-clamp-4">
        {listing.description || "No description"}
      </p>
      <p className="mt-3 text-xs text-muted-foreground">
        {listing.stageCount} stage{listing.stageCount === 1 ? "" : "s"}
      </p>
      <div className="mt-4 flex gap-2">
        {onEdit || onUnlist ? (
          <>
            {onEdit ? (
              <Button size="sm" variant="outline" onClick={() => onEdit(listing)}>
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
            ) : null}
            {onUnlist ? (
              <Button size="sm" variant="outline" onClick={() => onUnlist(listing)}>
                <Trash2 className="h-4 w-4" />
                Unlist
              </Button>
            ) : null}
          </>
        ) : selectForProject ? (
          <Button
            className="flex-1"
            size="sm"
            onClick={() => onSelectForProject(listing)}
            disabled={purchasingId === listing.id || listing.isOwnListing}
          >
            {purchasingId === listing.id ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : listing.owned ? (
              "Use for project"
            ) : listing.priceCents > 0 ? (
              "Buy & use"
            ) : (
              "Get & use"
            )}
          </Button>
        ) : (
          <Button
            className="flex-1"
            size="sm"
            variant={listing.owned ? "secondary" : "default"}
            onClick={() => onPurchase(listing)}
            disabled={purchasingId === listing.id || listing.owned || listing.isOwnListing}
          >
            {purchasingId === listing.id ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : listing.isOwnListing ? (
              "Your listing"
            ) : listing.owned ? (
              "Owned"
            ) : listing.priceCents > 0 ? (
              <>
                <ShoppingBag className="h-4 w-4" />
                Buy
              </>
            ) : (
              "Get free"
            )}
          </Button>
        )}
      </div>
    </article>
  );
}

export function MarketplacePage() {
  const session = useSession();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectForProject = searchParams.get("selectFor") === "project";
  const publishTemplateFromUrl = searchParams.get("publish") ?? "";

  const [tab, setTab] = useState<Tab>("browse");
  const [loading, setLoading] = useState(true);
  const [listings, setListings] = useState<MarketplaceListingSummary[]>([]);
  const [myListings, setMyListings] = useState<MarketplaceListingSummary[]>([]);
  const [purchases, setPurchases] = useState<
    Array<{
      id: string;
      listingTitle: string;
      sellerName: string;
      amountCents: number;
      purchasedTemplateId: string;
      createdAt: string;
    }>
  >([]);
  const [sales, setSales] = useState<
    Array<{
      id: string;
      listingTitle: string;
      buyerName: string;
      amountCents: number;
      createdAt: string;
    }>
  >([]);
  const [search, setSearch] = useState("");
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [showPublish, setShowPublish] = useState(false);
  const [editingListing, setEditingListing] = useState<MarketplaceListingSummary | null>(null);
  const [publishableTemplates, setPublishableTemplates] = useState<WorkflowTemplateSummary[]>([]);
  const [publishSeed, setPublishSeed] = useState({
    templateId: "",
    title: "",
    description: "",
  });

  const reload = useCallback(
    async (silent = false) => {
      if (!session) return;
      if (!silent) setLoading(true);
      try {
        const [browse, mine, bought, sold] = await Promise.all([
          fetchMarketplaceListings(session),
          fetchMyMarketplaceListings(session),
          fetchMarketplacePurchases(session),
          fetchMarketplaceSales(session),
        ]);
        setListings(browse);
        setMyListings(mine);
        setPurchases(bought);
        setSales(sold);
      } catch (error) {
        if (!silent) {
          toast.error(error instanceof Error ? error.message : "Failed to load marketplace");
        }
      } finally {
        setLoading(false);
      }
    },
    [session],
  );

  useAutoRefresh(
    useCallback(
      (silent: boolean) => {
        void reload(silent);
      },
      [reload],
    ),
    { enabled: Boolean(session) && !showPublish },
  );

  useEffect(() => {
    if (!publishTemplateFromUrl || !session) return;
    void fetchPublishableTemplates(session)
      .then((items) => {
        setPublishableTemplates(items);
        const match = items.find((t) => t.id === publishTemplateFromUrl);
        if (match) {
          setPublishSeed({
            templateId: match.id,
            title: match.title,
            description: match.description,
          });
          setShowPublish(true);
          setTab("mine");
        } else {
          toast.error("Template not found or you do not own it");
        }
        setSearchParams((params) => {
          params.delete("publish");
          return params;
        });
      })
      .catch(() => undefined);
  }, [publishTemplateFromUrl, session, setSearchParams]);

  const filteredBrowse = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return listings;
    return listings.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.sellerName.toLowerCase().includes(q),
    );
  }, [listings, search]);

  async function openPublish() {
    if (!session) return;
    setEditingListing(null);
    try {
      const items = await fetchPublishableTemplates(session);
      setPublishableTemplates(items);
      const first = items[0];
      setPublishSeed({
        templateId: first?.id ?? "",
        title: first?.title ?? "",
        description: first?.description ?? "",
      });
      setShowPublish(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load templates");
    }
  }

  async function handlePurchase(listing: MarketplaceListingSummary) {
    if (!session) return;
    if (listing.owned && listing.purchasedTemplateId) {
      if (selectForProject) {
        navigate(`/projects?templateId=${encodeURIComponent(listing.purchasedTemplateId)}`);
      }
      return;
    }
    setPurchasingId(listing.id);
    try {
      const result = await purchaseMarketplaceListing(session, listing.id);
      toast.success(
        listing.priceCents > 0 ? "Template purchased" : "Template added to your library",
      );
      await reload();
      if (selectForProject) {
        navigate(`/projects?templateId=${encodeURIComponent(result.purchasedTemplateId)}`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Purchase failed");
    } finally {
      setPurchasingId(null);
    }
  }

  async function handleUnlist(listing: MarketplaceListingSummary) {
    if (!session) return;
    try {
      await unlistMarketplaceListing(session, listing.id);
      toast.success("Listing removed from marketplace");
      await reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unlist failed");
    }
  }

  function handleEdit(listing: MarketplaceListingSummary) {
    setEditingListing(listing);
    setPublishSeed({
      templateId: listing.sourceTemplateId,
      title: listing.title,
      description: listing.description,
    });
    setShowPublish(true);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Marketplace"
        subtitle="Community-published workflow templates only"
        actions={
          <Button size="sm" onClick={() => void openPublish()}>
            <Plus className="h-4 w-4" />
            Share template
          </Button>
        }
      />

      <div className="border-b border-white/[0.07] px-6">
        <div className="flex gap-1">
          {(
            [
              ["browse", "Browse"],
              ["mine", "My listings"],
              ["purchases", "Purchases"],
              ["sales", "Sales"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                "border-b-2 px-4 py-3 text-sm transition-colors",
                tab === id
                  ? "border-primary text-white"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 space-y-6 p-6">
        {tab === "browse" ? (
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates, categories, authors…"
            className="max-w-md"
          />
        ) : null}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : tab === "browse" ? (
          filteredBrowse.length === 0 ? (
            <EmptyState message="No community templates yet. Create a workflow template and share it here." actionLabel="Share template" onAction={() => void openPublish()} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredBrowse.map((listing) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  selectForProject={selectForProject}
                  purchasingId={purchasingId}
                  onPurchase={handlePurchase}
                  onSelectForProject={handlePurchase}
                />
              ))}
            </div>
          )
        ) : tab === "mine" ? (
          myListings.length === 0 ? (
            <EmptyState message="You have not shared any templates yet." actionLabel="Share template" onAction={() => void openPublish()} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {myListings.map((listing) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  selectForProject={false}
                  purchasingId={null}
                  onPurchase={handlePurchase}
                  onSelectForProject={handlePurchase}
                  onEdit={handleEdit}
                  onUnlist={handleUnlist}
                />
              ))}
            </div>
          )
        ) : tab === "purchases" ? (
          purchases.length === 0 ? (
            <EmptyState message="No purchases yet. Browse the marketplace to get started." />
          ) : (
            <div className="space-y-2">
              {purchases.map((purchase) => (
                <div
                  key={purchase.id}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-white">{purchase.listingTitle}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatPrice(purchase.amountCents)} · by {purchase.sellerName} ·{" "}
                      {formatDate(purchase.createdAt)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      navigate(`/projects?templateId=${encodeURIComponent(purchase.purchasedTemplateId)}`)
                    }
                  >
                    Use in project
                  </Button>
                </div>
              ))}
            </div>
          )
        ) : sales.length === 0 ? (
          <EmptyState message="No sales yet. Share a paid or free template to get started." actionLabel="Share template" onAction={() => void openPublish()} />
        ) : (
          <div className="space-y-2">
            {sales.map((sale) => (
              <div
                key={sale.id}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-white">{sale.listingTitle}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatPrice(sale.amountCents)} · sold to {sale.buyerName} ·{" "}
                    {formatDate(sale.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showPublish ? (
        <PublishForm
          templates={publishableTemplates}
          initialTemplateId={publishSeed.templateId}
          initialTitle={publishSeed.title}
          initialDescription={publishSeed.description}
          editing={editingListing}
          onClose={() => {
            setShowPublish(false);
            setEditingListing(null);
          }}
          onSaved={() => reload(true)}
        />
      ) : null}
    </div>
  );
}

function EmptyState({
  message,
  actionLabel,
  onAction,
}: {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="rounded-xl border border-dashed border-white/10 p-10 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
      {actionLabel && onAction ? (
        <Button className="mt-4" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
