// ---------------------------------------------------------------------------
// lib/foodTranslation.ts
// Translates label text (ingredients, Contains, May contain, allergy names)
// between English and Arabic.
//
// Order: saved cache → built-in glossary (offline) → AI translation via the
// translate-food-text Edge Function. The AI key lives only in that Edge
// Function's secrets, never in the app. If the function is not deployed or
// the user is offline, the glossary result is used, so nothing breaks.
//
// Only the DISPLAY is translated. Screening still runs on the original
// label text, so allergy and halal results are never affected by a
// translation mistake.
// ---------------------------------------------------------------------------

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo, useState } from "react";

import { STORAGE_KEYS } from "./constants";
import {
  arabicToEnglishTerm,
  containsArabic,
  glossaryTranslate,
  englishToArabicTerm,
  learnedEnglishTerm,
  rememberArabicTerm,
  rememberEnglishTerm,
} from "./i18n/foodGlossary";
import { getCurrentLanguage, useI18n } from "./i18n";
import { supabase } from "./supabase";

type Target = "ar" | "en";

const FUNCTION_NAME = "translate-food-text";
const REMOTE_TIMEOUT_MS = 12000;
const MAX_CACHE_ENTRIES = 3000;

let cache: Record<string, string> | null = null;
let remoteUnavailable = false;

function cacheKey(target: Target, text: string): string {
  return `${target}|${text.trim().toLowerCase()}`;
}

async function loadCache(): Promise<Record<string, string>> {
  if (cache) {
    return cache;
  }

  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.foodTranslations);
    cache = stored ? JSON.parse(stored) : {};
  } catch {
    cache = {};
  }

  // Make earlier Arabic → English allergy translations available to the
  // synchronous display helper (allergyLabel).
  for (const [key, value] of Object.entries(cache!)) {
    if (key.startsWith("en|")) {
      rememberEnglishTerm(key.slice(3), value);
    } else if (key.startsWith("ar|")) {
      rememberArabicTerm(key.slice(3), value);
    }
  }

  return cache!;
}

async function saveCache() {
  if (!cache) {
    return;
  }

  const keys = Object.keys(cache);

  if (keys.length > MAX_CACHE_ENTRIES) {
    keys
      .slice(0, keys.length - MAX_CACHE_ENTRIES)
      .forEach((key) => delete cache![key]);
  }

  await AsyncStorage.setItem(
    STORAGE_KEYS.foodTranslations,
    JSON.stringify(cache)
  ).catch(() => {});
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

async function translateRemote(
  texts: string[],
  target: Target
): Promise<string[] | null> {
  if (remoteUnavailable || texts.length === 0) {
    return null;
  }

  try {
    const { data, error } = await withTimeout(
      supabase.functions.invoke(FUNCTION_NAME, { body: { texts, target } }),
      REMOTE_TIMEOUT_MS
    );

    const translations = (data as any)?.translations;

    if (error || !Array.isArray(translations) || translations.length !== texts.length) {
      // 404 = function not deployed: stop asking for this session.
      if ((error as any)?.context?.status === 404) {
        remoteUnavailable = true;
      }
      return null;
    }

    return translations.map((value: unknown, index: number) =>
      typeof value === "string" && value.trim() ? value.trim() : texts[index]
    );
  } catch {
    return null;
  }
}

// Translates many English label texts to Arabic. Returns original → Arabic.
export async function translateFoodTexts(
  texts: string[]
): Promise<Map<string, string>> {
  const store = await loadCache();
  const result = new Map<string, string>();
  const pending: string[] = [];

  for (const text of new Set(texts.map((t) => t.trim()).filter(Boolean))) {
    const cached = store[cacheKey("ar", text)];

    if (cached) {
      result.set(text, cached);
      continue;
    }

    if (containsArabic(text)) {
      result.set(text, text);
      continue;
    }

    const local = glossaryTranslate(text);
    result.set(text, local.text);

    if (local.complete) {
      store[cacheKey("ar", text)] = local.text;
    } else {
      pending.push(text);
    }
  }

  const remote = await translateRemote(pending, "ar");

  if (remote) {
    pending.forEach((text, index) => {
      result.set(text, remote[index]);
      store[cacheKey("ar", text)] = remote[index];
      rememberArabicTerm(text, remote[index]);
    });
  }

  void saveCache();
  return result;
}

// Allergies typed in Arabic are converted to English for screening, because
// the engine compares against English label text. English ones stay as-is.
export async function allergiesForScreening(
  allergies: string[]
): Promise<string[]> {
  const store = await loadCache();
  const output: string[] = [];
  const unknown: string[] = [];

  for (const allergy of allergies) {
    if (!containsArabic(allergy)) {
      output.push(allergy);
      continue;
    }

    const known =
      arabicToEnglishTerm(allergy) ??
      learnedEnglishTerm(allergy) ??
      store[cacheKey("en", allergy)];

    if (known) {
      output.push(known);
    } else {
      unknown.push(allergy);
    }
  }

  const remote = await translateRemote(unknown, "en");

  unknown.forEach((allergy, index) => {
    const english = remote?.[index];

    if (english && !containsArabic(english)) {
      store[cacheKey("en", allergy)] = english;
      rememberEnglishTerm(allergy, english);
      output.push(english);
    } else {
      // Keep it: it can still match Arabic label text.
      output.push(allergy);
    }
  });

  if (unknown.length > 0) {
    void saveCache();
  }

  return [...new Set(output)];
}

// Makes sure every allergy name can be shown in the selected language:
// Arabic names get their English form (also used for screening), and in
// Arabic mode unknown English names get an Arabic form. Call before
// rendering a list with allergyLabel(); it never throws.
export async function prepareAllergyLabels(allergies: string[]): Promise<void> {
  try {
    const english = await allergiesForScreening(allergies);

    if (getCurrentLanguage() === "ar") {
      const unknown = english.filter(
        (name) => !containsArabic(name) && !englishToArabicTerm(name)
      );

      if (unknown.length > 0) {
        await translateFoodTexts(unknown);
      }
    }
  } catch {
    // Display falls back to the names as typed.
  }
}

// React hook: returns tr(text) that shows label text in the app language.
// English → original text. Arabic → glossary at once, AI result when ready.
export function useFoodTranslator(texts: string[]): (text: string) => string {
  const { language } = useI18n();
  const [map, setMap] = useState<Map<string, string>>(new Map());
  const key = texts.join("\u0001");

  useEffect(() => {
    if (language !== "ar" || texts.length === 0) {
      return;
    }

    let active = true;

    // Show the instant glossary version first.
    setMap(new Map(texts.map((text) => [text.trim(), glossaryTranslate(text).text])));

    translateFoodTexts(texts).then((translated) => {
      if (active) {
        setMap(translated);
      }
    });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, key]);

  return useMemo(
    () => (text: string) =>
      language === "ar" ? map.get(text.trim()) ?? glossaryTranslate(text).text : text,
    [language, map]
  );
}
