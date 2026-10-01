import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Heart, Search, Crown, Star, ExternalLink } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { signedPreviewUrls, type Invitation } from "@/lib/invitations";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Wedding Invite Muse — Digital Wedding Invitations" },
      {
        name: "description",
        content:
          "Browse our collection of handcrafted digital wedding invitations — Standard and Premium designs with live previews, RSVP and more.",
      },
      { property: "og:title", content: "Wedding Invite Muse — Digital Wedding Invitations" },
      {
        property: "og:description",
        content:
          "Browse our collection of handcrafted digital wedding invitations — Standard and Premium designs with live previews, RSVP and more.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PortfolioPage,
});

type InvitationWithUrl = Invitation & { previewUrl: string | null };

async function fetchPublishedInvitations(): Promise<InvitationWithUrl[]> {
  const { data, error } = await supabase
    .from("invitations")
    .select("*")
    .eq("status", "published")
    .order("featured", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) throw error;

  const rows = data ?? [];
  const paths = rows.map((r) => r.preview_image_path).filter((p): p is string => !!p);
  const urlMap = await signedPreviewUrls(paths);
  return rows.map((r) => ({
    ...r,
    previewUrl: r.preview_image_path ? (urlMap[r.preview_image_path] ?? null) : null,
  }));
}

function PortfolioPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [collection, setCollection] = useState<string>("all");

  const { data: invitations = [], isLoading } = useQuery({
    queryKey: ["published-invitations"],
    queryFn: fetchPublishedInvitations,
  });

  const categories = useMemo(() => {
    const set = new Set<string>();
    invitations.forEach((i) => i.category && set.add(i.category));
    return Array.from(set).sort();
  }, [invitations]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invitations.filter((i) => {
      if (category !== "all" && i.category !== category) return false;
      if (collection !== "all" && i.collection !== collection) return false;
      if (!q) return true;
      const haystack = [i.couple_name, i.design_name, i.category, ...(i.tags ?? [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [invitations, search, category, collection]);

  const featured = filtered.filter((i) => i.featured);
  const rest = filtered.filter((i) => !i.featured);

  return (
    <div className="min-h-screen bg-background font-body">
      {/* Header */}
      <header className="border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
          <div className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-primary" fill="currentColor" />
            <span className="font-display text-2xl font-semibold tracking-wide">
              Wedding Invite Muse
            </span>
          </div>
          <a
            href="#collection"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Browse Collection
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pb-12 pt-16 text-center">
        <p className="text-sm font-medium uppercase tracking-[0.3em] text-primary">
          Digital Wedding Invitations
        </p>
        <h1 className="mx-auto mt-4 max-w-3xl font-display text-5xl font-semibold leading-tight md:text-6xl">
          Invitations as beautiful as your big day
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
          Handcrafted, animated invitation websites your guests will love — with RSVP,
          itineraries, maps and more.
        </p>
      </section>

      {/* Filters */}
      <section id="collection" className="mx-auto max-w-6xl px-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search designs, couples, tags…"
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <FilterChip
              active={collection === "all"}
              onClick={() => setCollection("all")}
              label="All Collections"
            />
            <FilterChip
              active={collection === "Standard"}
              onClick={() => setCollection("Standard")}
              label="Standard"
            />
            <FilterChip
              active={collection === "Premium"}
              onClick={() => setCollection("Premium")}
              label="Premium"
            />
          </div>
        </div>
        {categories.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            <FilterChip
              active={category === "all"}
              onClick={() => setCategory("all")}
              label="All Categories"
            />
            {categories.map((c) => (
              <FilterChip
                key={c}
                active={category === c}
                onClick={() => setCategory(c)}
                label={c}
              />
            ))}
          </div>
        )}
      </section>

      {/* Grid */}
      <main className="mx-auto max-w-6xl px-4 py-10">
        {isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-80 w-full rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-24 text-center">
            <p className="font-display text-3xl">No invitations found</p>
            <p className="mt-2 text-muted-foreground">
              {invitations.length === 0
                ? "New designs are on their way — check back soon."
                : "Try a different search or filter."}
            </p>
          </div>
        ) : (
          <div className="space-y-12">
            {featured.length > 0 && (
              <section>
                <h2 className="mb-5 flex items-center gap-2 font-display text-3xl font-semibold">
                  <Star className="h-5 w-5 text-primary" fill="currentColor" /> Featured Designs
                </h2>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {featured.map((inv) => (
                    <InvitationCard key={inv.id} invitation={inv} />
                  ))}
                </div>
              </section>
            )}
            {rest.length > 0 && (
              <section>
                {featured.length > 0 && (
                  <h2 className="mb-5 font-display text-3xl font-semibold">All Designs</h2>
                )}
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {rest.map((inv) => (
                    <InvitationCard key={inv.id} invitation={inv} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/60 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-4 text-center">
          <div className="flex items-center gap-2">
            <Heart className="h-4 w-4 text-primary" fill="currentColor" />
            <span className="font-display text-lg font-semibold">Wedding Invite Muse</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Handcrafted digital wedding invitations.
          </p>
        </div>
      </footer>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function InvitationCard({ invitation: inv }: { invitation: InvitationWithUrl }) {
  return (
    <article className="group overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md">
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {inv.previewUrl ? (
          <img
            src={inv.previewUrl}
            alt={`${inv.design_name} preview`}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Heart className="h-10 w-10 text-muted-foreground/30" />
          </div>
        )}
        <div className="absolute left-3 top-3 flex gap-2">
          {inv.collection === "Premium" && (
            <Badge className="gap-1 bg-primary text-primary-foreground">
              <Crown className="h-3 w-3" /> Premium
            </Badge>
          )}
          {inv.featured && (
            <Badge variant="secondary" className="gap-1">
              <Star className="h-3 w-3" /> Featured
            </Badge>
          )}
        </div>
      </div>
      <div className="p-5">
        {inv.category && (
          <p className="text-xs font-medium uppercase tracking-widest text-primary">
            {inv.category}
          </p>
        )}
        <h3 className="mt-1 font-display text-2xl font-semibold leading-snug">
          {inv.design_name}
        </h3>
        <p className="mt-0.5 text-sm text-muted-foreground">{inv.couple_name}</p>
        {inv.description && (
          <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{inv.description}</p>
        )}
        {inv.tags && inv.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {inv.tags.slice(0, 4).map((t) => (
              <span
                key={t}
                className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-secondary-foreground"
              >
                {t}
              </span>
            ))}
          </div>
        )}
        <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
          <div>
            {inv.starting_price != null ? (
              <>
                <span className="text-xs text-muted-foreground">Starting at</span>
                <p className="font-semibold">₹{inv.starting_price.toLocaleString("en-IN")}</p>
              </>
            ) : (
              <span className="text-sm text-muted-foreground">Price on request</span>
            )}
          </div>
          {inv.invitation_url && (
            <Button asChild size="sm" className="gap-1.5">
              <a href={inv.invitation_url} target="_blank" rel="noopener noreferrer">
                View Live <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
