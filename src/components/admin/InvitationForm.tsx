import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BUCKET, uniqueSlug, uploadPreview, type Invitation } from "@/lib/invitations";

const schema = z.object({
  couple_name: z.string().trim().min(1, "Couple name is required").max(150),
  design_name: z.string().trim().min(1, "Design name is required").max(150),
  category: z.string().trim().min(1, "Category is required").max(80),
  invitation_url: z.string().trim().url("Enter a valid URL (https://…)").max(500),
  description: z.string().trim().max(2000),
  starting_price: z.number().nonnegative().nullable(),
  sort_order: z.number().int(),
});

export function InvitationForm({
  open,
  onOpenChange,
  invitation,
  previewUrl,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  invitation: Invitation | null;
  previewUrl?: string | undefined;
  onSaved: () => void;
}) {
  const inv = invitation;
  const [f, setF] = useState({
    couple_name: inv?.couple_name ?? "",
    design_name: inv?.design_name ?? "",
    category: inv?.category ?? "",
    invitation_url: inv?.invitation_url ?? "",
    description: inv?.description ?? "",
    tags: (inv?.tags ?? []).join(", "),
    collection: inv?.collection ?? "Standard",
    starting_price: inv?.starting_price?.toString() ?? "",
    featured: inv?.featured ?? false,
    status: inv?.status ?? "draft",
    sort_order: inv?.sort_order?.toString() ?? "0",
  });
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({
      ...f,
      starting_price: f.starting_price.trim() === "" ? null : Number(f.starting_price),
      sort_order: Number(f.sort_order || 0),
    });
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Invalid form"); return; }
    if (file && !file.type.startsWith("image/")) { toast.error("Preview must be an image"); return; }
    if (file && file.size > 10 * 1024 * 1024) { toast.error("Image must be under 10MB"); return; }

    setSaving(true);
    try {
      let preview_image_path = inv?.preview_image_path ?? null;
      if (file) {
        const newPath = await uploadPreview(file);
        if (preview_image_path) await supabase.storage.from(BUCKET).remove([preview_image_path]);
        preview_image_path = newPath;
      }
      const nameChanged = !inv || inv.design_name !== parsed.data.design_name || inv.couple_name !== parsed.data.couple_name;
      const slug = nameChanged
        ? await uniqueSlug(`${parsed.data.design_name} ${parsed.data.couple_name}`, inv?.id)
        : inv!.slug;
      const payload = {
        ...parsed.data,
        slug,
        tags: f.tags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 30),
        collection: f.collection,
        featured: f.featured,
        status: f.status,
        preview_image_path,
      };
      const { error } = inv
        ? await supabase.from("invitations").update(payload).eq("id", inv.id)
        : await supabase.from("invitations").insert(payload);
      if (error) throw error;
      toast.success(inv ? "Invitation updated" : "Invitation added");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{inv ? "Edit invitation" : "Add invitation"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          <Field label="Couple name *"><Input value={f.couple_name} onChange={(e) => set("couple_name", e.target.value)} /></Field>
          <Field label="Design name *"><Input value={f.design_name} onChange={(e) => set("design_name", e.target.value)} /></Field>
          <Field label="Category *"><Input value={f.category} onChange={(e) => set("category", e.target.value)} placeholder="e.g. Floral" /></Field>
          <Field label="Invitation website URL *"><Input value={f.invitation_url} onChange={(e) => set("invitation_url", e.target.value)} placeholder="https://" /></Field>
          <Field label="Collection">
            <Select value={f.collection} onValueChange={(v) => set("collection", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="Standard">Standard</SelectItem><SelectItem value="Premium">Premium</SelectItem></SelectContent>
            </Select>
          </Field>
          <Field label="Status">
            <Select value={f.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Starting price"><Input type="number" min="0" step="0.01" value={f.starting_price} onChange={(e) => set("starting_price", e.target.value)} /></Field>
          <Field label="Sort order"><Input type="number" step="1" value={f.sort_order} onChange={(e) => set("sort_order", e.target.value)} /></Field>
          <div className="sm:col-span-2"><Field label="Tags (comma separated)"><Input value={f.tags} onChange={(e) => set("tags", e.target.value)} placeholder="minimal, gold, royal" /></Field></div>
          <div className="sm:col-span-2"><Field label="Description"><Textarea rows={3} value={f.description} onChange={(e) => set("description", e.target.value)} /></Field></div>
          <div className="sm:col-span-2 space-y-2">
            <Label>Preview image</Label>
            {(file || previewUrl) && (
              <img src={file ? URL.createObjectURL(file) : previewUrl} alt="Preview" className="h-32 rounded-md border object-cover" />
            )}
            <Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <div className="flex items-center gap-2 sm:col-span-2">
            <Switch id="featured" checked={f.featured} onCheckedChange={(v) => set("featured", v)} />
            <Label htmlFor="featured">Featured</Label>
          </div>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}
