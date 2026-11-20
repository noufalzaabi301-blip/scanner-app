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
import { FORM_TOKENS } from "./formTokens";

const FORM_TOKENS_LIGHT = FORM_TOKENS.light;
const FORM_TOKENS_DARK = FORM_TOKENS.dark;

export type ThemeMode = "light" | "dark" | "system";

// Text-size steps offered in Profile.
export const FONT_SCALES = [0.9, 1, 1.15, 1.3] as const;
export type FontScale = (typeof FONT_SCALES)[number];

// The colour conversion lives in lib/colorRemap.ts (pure, testable).
import { remapColor, type ColorKind } from "./colorRemap";
export { remapColor, type ColorKind };

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
export { INPUT_TOKENS, type InputTokens } from "./inputColors";
export { FORM_TOKENS, formTokens, type FormTokens } from "./formTokens";

// Form-control colours (lib/formTokens.ts) for the current theme.
export function useFormTokens() {
  const { isDark } = useAppTheme();
  return isDark ? FORM_TOKENS_DARK : FORM_TOKENS_LIGHT;
}
