/** Admin-managed Pinterest board (safe for client + server). */
export type PinterestBoard = {
  id: string;
  label: string;
  board_id: string;
  sort_order: number;
};
