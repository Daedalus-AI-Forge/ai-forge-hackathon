// Floating tab bar geometry, shared by the bar and by screens that must scroll clear of it.
export const TAB_BAR_HEIGHT = 62;

/** Distance from the screen bottom to the bar: just above the home indicator, never flush. */
export function tabBarBottom(insetBottom: number) {
  return Math.max(insetBottom - 8, 14);
}

/** Bottom padding for a scrolling tab screen. */
export function tabClearance(insetBottom: number) {
  return tabBarBottom(insetBottom) + TAB_BAR_HEIGHT + 28;
}
