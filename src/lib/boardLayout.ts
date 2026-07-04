// The board home screen is a grid of cards the family can rearrange
// (drag-and-drop in the PIN-gated edit mode) and resize. The layout is
// stored per family in families.board_layout.

export type CardId = "calendar" | "chores" | "meals" | "announcements";
export type CardSize = "sm" | "md" | "lg";

export type BoardLayout = {
  order: CardId[]; // visible cards, in grid order
  sizes: Record<CardId, CardSize>;
  hidden: CardId[];
  scale: number; // overall board zoom (root font multiplier), e.g. 2 = 200%
};

// How big the whole board renders. It's a wall display read from across the
// room, so it starts at 2× and is tunable in the PIN-gated Customize mode.
export const MIN_SCALE = 1.25;
export const MAX_SCALE = 3;
export const SCALE_STEP = 0.25;
export const DEFAULT_SCALE = 2;

export function clampScale(n: unknown): number {
  const v = typeof n === "number" && Number.isFinite(n) ? n : DEFAULT_SCALE;
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.round(v / SCALE_STEP) * SCALE_STEP));
}

export const ALL_CARDS: CardId[] = ["chores", "calendar", "meals", "announcements"];

export const CARD_META: Record<CardId, { title: string; emoji: string }> = {
  calendar: { title: "Calendar", emoji: "📅" },
  chores: { title: "Jobs", emoji: "⭐" },
  meals: { title: "Dinner", emoji: "🍽️" },
  announcements: { title: "News", emoji: "📣" },
};

// Default: chores on the side, calendar front and center, extras stacked.
export const DEFAULT_LAYOUT: BoardLayout = {
  order: ["chores", "calendar", "meals", "announcements"],
  sizes: { chores: "md", calendar: "lg", meals: "sm", announcements: "sm" },
  hidden: [],
  scale: DEFAULT_SCALE,
};

const SIZES: CardSize[] = ["sm", "md", "lg"];

export function nextSize(size: CardSize): CardSize {
  return SIZES[(SIZES.indexOf(size) + 1) % SIZES.length];
}

// Accepts anything (old versions, hand-edited JSON, null) and returns a
// valid layout in which every card appears exactly once.
export function sanitizeLayout(input: unknown): BoardLayout {
  const raw = (input ?? {}) as Partial<BoardLayout>;
  const isCard = (v: unknown): v is CardId => ALL_CARDS.includes(v as CardId);

  const order: CardId[] = [];
  for (const id of Array.isArray(raw.order) ? raw.order : []) {
    if (isCard(id) && !order.includes(id)) order.push(id);
  }
  const hidden: CardId[] = [];
  for (const id of Array.isArray(raw.hidden) ? raw.hidden : []) {
    if (isCard(id) && !order.includes(id) && !hidden.includes(id)) hidden.push(id);
  }
  for (const id of ALL_CARDS) {
    if (!order.includes(id) && !hidden.includes(id)) order.push(id);
  }
  const scale = clampScale((raw as { scale?: unknown }).scale);

  // Nothing visible is a broken board — fall back to the default order.
  if (order.length === 0) return { ...DEFAULT_LAYOUT, hidden: [], scale };

  const sizes = {} as Record<CardId, CardSize>;
  for (const id of ALL_CARDS) {
    const s = raw.sizes?.[id];
    sizes[id] = s === "sm" || s === "md" || s === "lg" ? s : DEFAULT_LAYOUT.sizes[id];
  }
  return { order, sizes, hidden, scale };
}
