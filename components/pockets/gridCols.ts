// Tailwind needs literal class names to find at build time, so a pocket
// grid's column count (driven by how many pockets are enabled) is looked
// up here rather than interpolated into a string.
export const GRID_COLS_CLASS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
};
