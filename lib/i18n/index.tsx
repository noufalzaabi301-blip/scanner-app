// ---------------------------------------------------------------------------
// lib/i18n/index.tsx
// Centralized English/Arabic translations.
//
// - English is the default and the fallback for any missing Arabic key.
// - The chosen language is saved in AsyncStorage so it survives restarts.
// - Only UI text is translated. Product names, brands, ingredients,
//   barcodes and other database content are always shown as stored.
//
// RTL approach (two layers, so Arabic is right-to-left everywhere):
//
// 1. Immediately, without an app reload: App.tsx wraps the whole navigator
//    in a right-to-left container (lib/rtl.ts) and passes
//    direction="rtl" to the NavigationContainer, so screens, rows, text
//    alignment, start/end spacing, the header and its back button flip as
//    soon as Arabic is chosen, in Expo Go, development builds and on the
//    web. Modals use the same container (components/Themed.tsx →
//    DirectionView).
//
// 2. Native (iOS / Android) system parts: I18nManager.allowRTL(true) and
//    forceRTL(isArabic) are set whenever the language is loaded or changed.
//    React Native applies forceRTL at the next app start, after which
//    system alerts, the keyboard, swipe-back gestures and native scroll
//    views are also right-to-left. swapLeftAndRightInRTL(false) keeps
//    physical "left"/"right" styles physical, so layout is never flipped
//    twice. English always sets forceRTL(false).
//
// On the web I18nManager does nothing; react-native-web uses dir="rtl".
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
import { I18nManager, Platform } from "react-native";

import { STORAGE_KEYS } from "../constants";
import {
  setCurrentLanguage,
  translateIn,
  type Language,
  type TFunction,
} from "./translate";

export {
  getCurrentLanguage,
  translate,
  translateIn,
  type Language,
  type TFunction,
  type TranslationKey,
  type TranslationParams,
} from "./translate";

export const LANGUAGES: { code: Language; nativeName: string }[] = [
  { code: "en", nativeName: "English" },
  { code: "ar", nativeName: "العربية" },
];

type I18nContextValue = {
  language: Language;
  isRTL: boolean;
  t: TFunction;
  setLanguage: (language: Language) => Promise<void>;
};

const I18nContext = createContext<I18nContextValue>({
  language: "en",
  isRTL: false,
  t: (key, params) => translateIn("en", key, params),
  setLanguage: async () => {},
});

// Keeps the native RTL setting in line with the chosen language (takes
// full effect for system UI at the next app start; see the note above).
function applyNativeDirection(language: Language) {
  if (Platform.OS === "web") {
    return;
  }

  try {
    const rtl = language === "ar";
    I18nManager.allowRTL(true);
    I18nManager.swapLeftAndRightInRTL(false);

    if (I18nManager.isRTL !== rtl) {
      I18nManager.forceRTL(rtl);
    }
  } catch {
    // Not available on every platform.
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    AsyncStorage.getItem(STORAGE_KEYS.language)
      .then((stored) => {
        if (active && (stored === "en" || stored === "ar")) {
          setCurrentLanguage(stored);
          setLanguageState(stored);
          applyNativeDirection(stored);
        } else if (active) {
          applyNativeDirection("en");
        }
      })
      .catch(() => {
        // Storage unavailable: stay on English.
      })
      .finally(() => {
        if (active) {
          setReady(true);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const setLanguage = useCallback(async (next: Language) => {
    setCurrentLanguage(next);
    setLanguageState(next);
    applyNativeDirection(next);

    try {
      await AsyncStorage.setItem(STORAGE_KEYS.language, next);
    } catch {
      // The language still changes for this session.
    }
  }, []);

  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      isRTL: language === "ar",
      t: (key, params) => translateIn(language, key, params),
      setLanguage,
    }),
    [language, setLanguage]
  );

  // Wait for the stored language so the first screen does not flash in
  // English before switching to Arabic.
  if (!ready) {
    return null;
  }

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}
