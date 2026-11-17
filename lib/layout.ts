// ---------------------------------------------------------------------------
// lib/layout.ts
// One responsive page layout for every screen (phones, tablets, website).
//
// - The whole app is one centred column: width 100%, at most
//   PAGE_MAX_WIDTH wide (App.tsx). On a desktop browser every page — Login,
//   Scan, Avoid List, Profile, developer pages — therefore has the same
//   width instead of some looking zoomed in and others tiny. On phones the
//   column is simply the screen width.
// - usePageInsets() gives each screen's scroll content the same
//   horizontal padding for the current width:
//     < 360 px → 14,  < 768 px → 20,  ≥ 768 px → 24.
// No fixed page widths or scale transforms are used anywhere.
// ---------------------------------------------------------------------------

import { useWindowDimensions, type ViewStyle } from "react-native";

export const PAGE_MAX_WIDTH = 720;

export function pageHorizontalPadding(windowWidth: number): number {
  const column = Math.min(windowWidth, PAGE_MAX_WIDTH);

  if (column < 360) {
    return 14;
  }

  return windowWidth < 768 ? 20 : 24;
}

// Horizontal padding for a screen's main scroll content.
export function usePageInsets(): ViewStyle {
  const { width } = useWindowDimensions();
  return { paddingHorizontal: pageHorizontalPadding(width) };
}

// The centred app column (used once, in App.tsx).
export const pageColumnStyle: ViewStyle = {
  flex: 1,
  width: "100%",
  maxWidth: PAGE_MAX_WIDTH,
  alignSelf: "center",
  overflow: "hidden",
};
