// ---------------------------------------------------------------------------
// lib/theme.tsx
// Appearance settings: light / dark / system theme and text size.
// Both are saved on the device (AsyncStorage) and apply to the whole app.
//
// How dark mode works without rewriting every StyleSheet:
// the themed components in components/Themed.tsx pass each style colour
// through remapColor(). In dark mode, light backgrounds become dark
// surfaces (keeping a hint of their tint), light borders become dark
// borders, and dark text becomes light text. Accent colours (green, red,
// amber) keep their hue so warnings still look like warnings.
// ---------------------------------------------------------------------------

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useColorScheme } from "react-native";

import { STORAGE_KEYS } from "./constants";

export type ThemeMode = "light" | "dark" | "system";
export type ColorKind = "background" | "border" | "text";

// Text-size steps offered in Profile.
export const FONT_SCALES = [0.9, 1, 1.15, 1.3] as const;
export type FontScale = (typeof FONT_SCALES)[number];

// Dark surface every light background is blended onto.
const DARK_BASE: RGB = [16, 24, 20]; // #101814
const WHITE: RGB = [255, 255, 255];

type RGB = [number, number, number];

function parseColor(value: string): { rgb: RGB; alpha: string } | null {
  const named: Record<string, string> = { white: "#FFFFFF", black: "#000000" };
  const color = named[value.toLowerCase()] ?? value;
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(color);

  if (!hex) {
    return null; // rgba(), transparent, etc. are left unchanged
  }

  let digits = hex[1];

  if (digits.length === 3) {
    digits = digits
      .split("")
      .map((d) => d + d)
      .join("");
  }

  return {
    rgb: [
      parseInt(digits.slice(0, 2), 16),
      parseInt(digits.slice(2, 4), 16),
      parseInt(digits.slice(4, 6), 16),
    ],
    alpha: digits.slice(6),
  };
}

function toHex([r, g, b]: RGB, alpha = ""): string {
  return `#${[r, g, b]
    .map((v) => Math.round(v).toString(16).padStart(2, "0"))
    .join("")}${alpha}`.toUpperCase();
}

function mix(a: RGB, b: RGB, amount: number): RGB {
  return [
    a[0] + (b[0] - a[0]) * amount,
    a[1] + (b[1] - a[1]) * amount,
    a[2] + (b[2] - a[2]) * amount,
  ];
}

function luminance([r, g, b]: RGB): number {
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };

  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function saturation([r, g, b]: RGB): number {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const light = (max + min) / 2;

  if (max === min) {
    return 0;
  }

  return light > 0.5
    ? (max - min) / (2 - max - min)
    : (max - min) / (max + min);
}

const cache = new Map<string, string>();

// Returns the dark-mode version of a style colour.
export function remapColor(value: unknown, kind: ColorKind): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const key = `${kind}:${value}`;
  const cached = cache.get(key);

  if (cached) {
    return cached;
  }

  const parsed = parseColor(value);

  if (!parsed) {
    return value;
  }

  const { rgb, alpha } = parsed;
  const lum = luminance(rgb);
  let result = rgb;

  if (kind === "background") {
    if (lum > 0.7) {
      result = mix(DARK_BASE, rgb, 0.09);
    } else if (lum > 0.35) {
      result = mix(DARK_BASE, rgb, 0.3);
    }
  } else if (kind === "border") {
    if (lum > 0.45) {
      result = mix(DARK_BASE, rgb, 0.22);
    }
  } else if (lum < 0.4) {
    // Text and icons: keep accent hues readable, make neutral text light.
    result =
      saturation(rgb) > 0.45 ? mix(rgb, WHITE, 0.5) : mix(rgb, WHITE, 0.82);
  }

  const output = toHex(result, alpha);
  cache.set(key, output);
  return output;
}

type ThemeContextValue = {
  mode: ThemeMode;
  isDark: boolean;
  fontScale: FontScale;
  setMode: (mode: ThemeMode) => Promise<void>;
  setFontScale: (scale: FontScale) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue>({
  mode: "light",
  isDark: false,
  fontScale: 1,
  setMode: async () => {},
  setFontScale: async () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("light");
  const [fontScale, setFontScaleState] = useState<FontScale>(1);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    Promise.all([
      AsyncStorage.getItem(STORAGE_KEYS.themeMode).catch(() => null),
      AsyncStorage.getItem(STORAGE_KEYS.fontScale).catch(() => null),
    ]).then(([storedMode, storedScale]) => {
      if (!active) {
        return;
      }

      if (storedMode === "light" || storedMode === "dark" || storedMode === "system") {
        setModeState(storedMode);
      }

      const scale = Number(storedScale);

      if ((FONT_SCALES as readonly number[]).includes(scale)) {
        setFontScaleState(scale as FontScale);
      }

      setReady(true);
    });

    return () => {
      active = false;
    };
  }, []);

  const setMode = useCallback(async (next: ThemeMode) => {
    setModeState(next);
    await AsyncStorage.setItem(STORAGE_KEYS.themeMode, next).catch(() => {});
  }, []);

  const setFontScale = useCallback(async (next: FontScale) => {
    setFontScaleState(next);
    await AsyncStorage.setItem(STORAGE_KEYS.fontScale, String(next)).catch(
      () => {}
    );
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      isDark: mode === "dark" || (mode === "system" && systemScheme === "dark"),
      fontScale,
      setMode,
      setFontScale,
    }),
    [mode, systemScheme, fontScale, setMode, setFontScale]
  );

  if (!ready) {
    return null;
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
