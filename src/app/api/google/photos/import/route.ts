import { NextRequest, NextResponse } from "next/server";
import { authParent } from "@/lib/parentAuth";
import {
  deletePickerSession,
  downloadPickedPhoto,
  getAccessToken,
  getPickerSession,
  listPickedPhotos,
} from "@/lib/google";
import type { GoogleConnection } from "@/lib/types";

export const dynamic = "force-dynamic";

const MAX_IMPORT = 200; // safety cap so one session can't fill the bucket

function extFor(mimeType: string): string {
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("gif")) return "gif";
  if (mimeType.includes("heic")) return "heic";
  return "jpg";
}

// Poll target: returns {status:"pending"} until the parent finishes picking,
// then downloads the selected photos into the screensaver bucket.
export async function POST(req: NextRequest) {
  const ctx = await authParent();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sessionId } = (await req.json()) as { sessionId?: string };
  if (!sessionId) return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });

  const { data: conns } = await ctx.admin
    .from("google_connections")
    .select("*")
    .eq("family_id", ctx.familyId);
  const list = (conns as GoogleConnection[] | null) ?? [];
  const conn = list.find((c) => c.profile_id === ctx.userId) ?? list[0];
  if (!conn) return NextResponse.json({ error: "No Google account connected." }, { status: 400 });

  try {
    const token = await getAccessToken(ctx.admin, conn);
    const session = await getPickerSession(token, sessionId);
    if (!session.mediaItemsSet) return NextResponse.json({ status: "pending" });

    const picked = (await listPickedPhotos(token, sessionId)).slice(0, MAX_IMPORT);
    let imported = 0;
    for (let i = 0; i < picked.length; i++) {
      const photo = picked[i];
      try {
        const bytes = await downloadPickedPhoto(token, photo.baseUrl);
        const path = `${ctx.familyId}/gphotos-${Date.now()}-${i}.${extFor(photo.mimeType)}`;
        const { error: upErr } = await ctx.admin.storage
          .from("photos")
          .upload(path, bytes, { contentType: photo.mimeType, upsert: false });
        if (upErr) {
          console.error(`Photo upload failed: ${upErr.message}`);
          continue;
        }
        const { data: pub } = ctx.admin.storage.from("photos").getPublicUrl(path);
        await ctx.admin.from("photos").insert({ family_id: ctx.familyId, url: pub.publicUrl });
        imported++;
      } catch (e) {
        console.error(`Skipped one photo: ${e instanceof Error ? e.message : e}`);
      }
    }

    await deletePickerSession(token, sessionId);
    return NextResponse.json({ status: "done", imported, selected: picked.length });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    console.error(`Photos import failed: ${detail}`);
    return NextResponse.json({ error: "Couldn't import from Google Photos." }, { status: 400 });
  }
}
