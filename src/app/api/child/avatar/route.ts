import { NextRequest, NextResponse } from "next/server";
import { authChild } from "@/lib/childAuth";

export const dynamic = "force-dynamic";

// A child uploads their own profile picture. Children have no direct storage
// access (family_id NULL), so the upload goes through the service role here,
// scoped to their own member row.
export async function POST(req: NextRequest) {
  const ctx = await authChild();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No image provided" }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "That's not an image file" }, { status: 400 });
  }
  if (file.size > 8 * 1024 * 1024) {
    return NextResponse.json({ error: "Image is too big (max 8 MB)" }, { status: 400 });
  }

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${ctx.familyId}/${ctx.memberId}-${Date.now()}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error: upErr } = await ctx.admin.storage
    .from("avatars")
    .upload(path, bytes, { contentType: file.type, upsert: true });
  if (upErr) {
    return NextResponse.json({ error: "Couldn't upload the picture" }, { status: 400 });
  }

  const { data: pub } = ctx.admin.storage.from("avatars").getPublicUrl(path);
  await ctx.admin.from("members").update({ avatar_url: pub.publicUrl }).eq("id", ctx.memberId);

  return NextResponse.json({ url: pub.publicUrl });
}
