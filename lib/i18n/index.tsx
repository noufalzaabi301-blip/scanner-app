// ---------------------------------------------------------------------------
// lib/i18n/index.tsx
// Centralized English/Arabic translations.
//
// - English is the default and the fallback for any missing Arabic key.
// - The chosen language is saved in AsyncStorage so it survives restarts.
// - Only UI text is translated. Product names, brands, ingredients,
//   barcodes and other database content are always shown as stored.
//
// RTL approach (why no app reload is needed):
// React Native's I18nManager.forceRTL() only takes effect after a full
// native restart, and Expo's `supportsRTL`/`forcesRTL` settings require a
// new native build. Instead, App.tsx wraps the whole navigator in a View
// set to right-to-left when Arabic is selected (lib/rtl.ts: Yoga
// `direction` on phones, writingDirection + dir="rtl" on the web). Yoga and
// react-native-web apply that direction to every child, so rows, text
// alignment and start/end spacing flip immediately, with no reload, in
// Expo Go, development builds and on the web. We pin the native I18nManager
// to LTR so the device language can never cause a second, double flip.
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
import { I18nManager } from "react-native";

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

function pinNativeLayoutToLTR() {
  try {
    I18nManager.allowRTL(false);
    I18nManager.forceRTL(false);
  } catch {
    // Not available on every platform (e.g. some web builds).
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    pinNativeLayoutToLTR();

    let active = true;

    AsyncStorage.getItem(STORAGE_KEYS.language)
      .then((stored) => {
        if (active && (stored === "en" || stored === "ar")) {
          setCurrentLanguage(stored);
          setLanguageState(stored);
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
