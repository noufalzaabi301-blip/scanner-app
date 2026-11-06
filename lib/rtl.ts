// ---------------------------------------------------------------------------
// lib/rtl.ts
// Props that set the layout direction of a container (Arabic = RTL).
//
// Web (react-native-web): the style property "direction" is not supported
// and logs "Invalid style property of 'direction'. Did you mean
// 'writingDirection'?". On the web we therefore use writingDirection
// (react-native-web turns it into CSS `direction`, which also flips flex
// rows) plus the HTML `dir` attribute, which makes react-native-web resolve
// start/end spacing correctly for every child.
//
// iOS / Android: writingDirection only affects text, not layout. The
// layout direction there is the Yoga layout prop `direction`, which React
// Native supports natively, so it is used on phones only.
// ---------------------------------------------------------------------------

import { Platform, type ViewStyle } from "react-native";

type Direction = "rtl" | "ltr";

export function directionProps(direction: Direction): {
  dir?: Direction;
  style: ViewStyle;
} {
  if (Platform.OS === "web") {
    return {
      dir: direction,
      style: { writingDirection: direction } as ViewStyle,
    };
  }

  return { style: { direction } };
}
