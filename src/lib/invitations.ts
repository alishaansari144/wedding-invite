import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Invitation = Database["public"]["Tables"]["invitations"]["Row"];
export const BUCKET = "invitation-previews";

export function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "invitation";
}

export async function uniqueSlug(base: string, excludeId?: string) {
  const root = slugify(base);
  const { data } = await supabase.from("invitations").select("id, slug").like("slug", `${root}%`);
  const taken = new Set((data ?? []).filter((r) => r.id !== excludeId).map((r) => r.slug));
  if (!taken.has(root)) return root;
  let i = 2;
  while (taken.has(`${root}-${i}`)) i++;
  return `${root}-${i}`;
}

export async function uploadPreview(file: File) {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `previews/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return path;
}

export async function signedPreviewUrls(paths: string[]) {
  if (!paths.length) return {} as Record<string, string>;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600);
  const map: Record<string, string> = {};
  (data ?? []).forEach((d) => d.path && d.signedUrl && (map[d.path] = d.signedUrl));
  return map;
}
