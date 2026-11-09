import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { PinterestBoard } from "@/lib/social/pinterest-boards-types";

export type { PinterestBoard } from "@/lib/social/pinterest-boards-types";

/** Load admin-managed Pinterest boards (empty if table missing / error). */
export async function listPinterestBoards(
  supabase: SupabaseClient,
): Promise<PinterestBoard[]> {
  const { data, error } = await supabase
    .from("pinterest_boards")
    .select("id, label, board_id, sort_order")
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true });

  if (error) {
    if (/pinterest_boards|relation|does not exist/i.test(error.message)) {
      return [];
    }
    console.error("[pinterest-boards] list failed", error.message);
    return [];
  }

  return (data ?? [])
    .map((row) => ({
      id: String(row.id),
      label: String(row.label ?? "").trim(),
      board_id: String(row.board_id ?? "").trim(),
      sort_order: Number(row.sort_order ?? 0),
    }))
    .filter((row) => row.label && row.board_id);
}

/** Default board id when a draft has none selected. */
export function defaultPinterestBoardId(
  boards: PinterestBoard[],
): string | null {
  const envDefault =
    process.env.POSTFORME_PINTEREST_DEFAULT_BOARD_ID?.trim() ?? "";
  if (envDefault && boards.some((b) => b.board_id === envDefault)) {
    return envDefault;
  }
  return boards[0]?.board_id ?? null;
}
