import type { SupabaseClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { createAdminClient } from "./supabase/admin";

export type BoardContext = {
  admin: SupabaseClient;
  boardId: string;
  familyId: string;
};

// All /api/board/* routes authenticate the kiosk with a long-lived device
// token issued at pairing time, sent in the x-board-token header.
export async function authBoard(req: NextRequest): Promise<BoardContext | null> {
  const token = req.headers.get("x-board-token");
  if (!token) return null;
  const admin = createAdminClient();
  const { data: board } = await admin
    .from("boards")
    .select("id, family_id")
    .eq("token", token)
    .maybeSingle();
  if (!board) return null;
  admin
    .from("boards")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", board.id)
    .then(() => {});
  return { admin, boardId: board.id, familyId: board.family_id };
}

// Parent-mode actions on the board additionally require the family PIN,
// sent in the x-parent-pin header and verified per request.
export async function verifyParentPin(
  admin: SupabaseClient,
  familyId: string,
  pin: string | null
): Promise<boolean> {
  if (!pin) return false;
  const { data: family } = await admin
    .from("families")
    .select("parent_pin_hash")
    .eq("id", familyId)
    .single();
  if (!family?.parent_pin_hash) return false;
  return bcrypt.compare(pin, family.parent_pin_hash);
}
