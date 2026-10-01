import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Toaster } from "@/components/ui/sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { InvitationForm } from "@/components/admin/InvitationForm";
import { BUCKET, signedPreviewUrls, type Invitation } from "@/lib/invitations";

export const Route = createFileRoute("/admin/")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/admin/login" });
    const { data: isAdmin } = await supabase.rpc("is_admin", { _user_id: data.user.id });
    if (!isAdmin) {
      await supabase.auth.signOut();
      throw redirect({ to: "/admin/login" });
    }
  },
  head: () => ({
    meta: [
      { title: "Admin Dashboard — Invitation Portfolio" },
      { name: "description", content: "Manage wedding invitation designs." },
      { property: "og:title", content: "Admin Dashboard — Invitation Portfolio" },
      { property: "og:description", content: "Manage wedding invitation designs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminDashboard,
});

const statusVariant: Record<string, "default" | "secondary" | "outline"> = {
  published: "default", draft: "secondary", archived: "outline",
};

function AdminDashboard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [collection, setCollection] = useState("all");
  const [editing, setEditing] = useState<Invitation | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Invitation | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-invitations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("invitations").select("*")
        .order("sort_order").order("created_at", { ascending: false });
      if (error) throw error;
      const urls = await signedPreviewUrls(data.map((d) => d.preview_image_path).filter(Boolean) as string[]);
      return { rows: data, urls };
    },
  });
  const rows = data?.rows ?? [];
  const urls = data?.urls ?? {};
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-invitations"] });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter((r) =>
      (status === "all" || r.status === status) &&
      (collection === "all" || r.collection === collection) &&
      (!q || [r.couple_name, r.design_name, r.category ?? "", ...(r.tags ?? [])].some((s) => s.toLowerCase().includes(q))),
    );
  }, [rows, search, status, collection]);

  const stats = [
    ["Total", rows.length],
    ["Published", rows.filter((r) => r.status === "published").length],
    ["Drafts", rows.filter((r) => r.status === "draft").length],
    ["Featured", rows.filter((r) => r.featured).length],
    ["Premium", rows.filter((r) => r.collection === "Premium").length],
  ] as const;

  async function togglePublish(r: Invitation) {
    const next = r.status === "published" ? "draft" : "published";
    const { error } = await supabase.from("invitations").update({ status: next }).eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    toast.success(next === "published" ? "Published" : "Unpublished");
    refresh();
  }

  async function confirmDelete() {
    if (!toDelete) return;
    const { error } = await supabase.from("invitations").delete().eq("id", toDelete.id);
    if (error) { toast.error(error.message); return; }
    if (toDelete.preview_image_path) await supabase.storage.from(BUCKET).remove([toDelete.preview_image_path]);
    toast.success("Invitation deleted");
    setToDelete(null);
    refresh();
  }

  async function logout() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/admin/login", replace: true });
  }

  return (
    <div className="min-h-screen bg-muted/40">
      <Toaster />
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <h1 className="text-lg font-semibold">Invitations Admin</h1>
          <Button variant="outline" size="sm" onClick={logout}>Log out</Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {stats.map(([label, n]) => (
            <Card key={label}>
              <CardHeader className="pb-1"><CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold">{n}</CardContent>
            </Card>
          ))}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Input placeholder="Search couple, design, category, tag…" value={search} onChange={(e) => setSearch(e.target.value)} className="sm:flex-1" />
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="sm:w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
          <Select value={collection} onValueChange={setCollection}>
            <SelectTrigger className="sm:w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All collections</SelectItem>
              <SelectItem value="Standard">Standard</SelectItem>
              <SelectItem value="Premium">Premium</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>Add invitation</Button>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="rounded-md border bg-background p-8 text-center text-sm text-muted-foreground">No invitations found.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((r) => (
              <Card key={r.id} className="overflow-hidden">
                <div className="aspect-[4/3] bg-muted">
                  {r.preview_image_path && urls[r.preview_image_path] ? (
                    <img src={urls[r.preview_image_path]} alt={r.design_name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No image</div>
                  )}
                </div>
                <CardContent className="space-y-3 p-4">
                  <div>
                    <p className="font-semibold">{r.design_name}</p>
                    <p className="text-sm text-muted-foreground">{r.couple_name} · {r.category}</p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant={statusVariant[r.status] ?? "secondary"} className="capitalize">{r.status}</Badge>
                    <Badge variant="outline">{r.collection}</Badge>
                    {r.featured && <Badge variant="outline">Featured</Badge>}
                    {r.starting_price != null && <Badge variant="outline">From {r.starting_price}</Badge>}
                    <Badge variant="outline">#{r.sort_order}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => { setEditing(r); setFormOpen(true); }}>Edit</Button>
                    <Button size="sm" variant="outline" onClick={() => togglePublish(r)}>
                      {r.status === "published" ? "Unpublish" : "Publish"}
                    </Button>
                    {r.invitation_url && (
                      <Button size="sm" variant="ghost" asChild><a href={r.invitation_url} target="_blank" rel="noreferrer">Open</a></Button>
                    )}
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setToDelete(r)}>Delete</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {formOpen && (
        <InvitationForm
          key={editing?.id ?? "new"}
          open={formOpen}
          onOpenChange={setFormOpen}
          invitation={editing}
          previewUrl={editing?.preview_image_path ? urls[editing.preview_image_path] : undefined}
          onSaved={refresh}
        />
      )}

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this invitation?</AlertDialogTitle>
            <AlertDialogDescription>
              "{toDelete?.design_name}" and its preview image will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
