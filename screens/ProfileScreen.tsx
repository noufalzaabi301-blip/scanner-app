// ---------------------------------------------------------------------------
// screens/ProfileScreen.tsx
// Profile & Settings hub.
//
// Sections:
//   1. Account card   – real name and email from the Supabase auth user
//   2. Preferences    – allergies, halal and product-submission consent
//                       (read from / saved to user_preferences)
//   3. Language       – English / Arabic, saved on the device
//      Appearance     – light / dark / system theme and text size
//   4. Admin          – only for approved admins
//   5. Support        – FAQs, Contact Us, About, Privacy Notice
//   6. Log out
// Tapping the account card opens ProfileSettings (edit name / password).
// ---------------------------------------------------------------------------

import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
} from "react-native";

import BottomNavigation from "../components/BottomNavigation";
import SettingsRow, {
  SettingsDivider,
  SettingsGroup,
  SettingsSectionTitle,
} from "../components/SettingsRow";
import { useIsAdmin } from "../lib/adminAccess";
import {
  APP_VERSION,
  COLORS,
  ROUTES,
  allergyLabelList,
  joinList,
} from "../lib/constants";
import { prepareAllergyLabels } from "../lib/foodTranslation";
import { LANGUAGES, useI18n, type Language, type TranslationKey } from "../lib/i18n";
import { FONT_SCALES, useAppTheme, type ThemeMode } from "../lib/theme";
import { supabase } from "../lib/supabase";
import { confirmAction, showMessage } from "../lib/ui/messages";
import {
  EMPTY_PREFERENCES,
  fetchPreferencesForUser,
  type UserPreferences,
} from "../lib/userPreferences";
import {
  Ionicons,
  SafeAreaView,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "../components/Themed";

type Account = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
};

type Banner = { kind: "success" | "error"; text: string } | null;

type ToggleField = "prefers_halal" | "submit_products_for_review";

const THEME_OPTIONS: {
  mode: ThemeMode;
  label: TranslationKey;
  icon: "sunny-outline" | "moon-outline" | "phone-portrait-outline";
}[] = [
  { mode: "light", label: "profile.themeLight", icon: "sunny-outline" },
  { mode: "dark", label: "profile.themeDark", icon: "moon-outline" },
  { mode: "system", label: "profile.themeSystem", icon: "phone-portrait-outline" },
];

const FONT_SCALE_LABELS: TranslationKey[] = [
  "profile.textSmall",
  "profile.textNormal",
  "profile.textLarge",
  "profile.textExtraLarge",
];

function initialsFor(account: Account): string {
  const letters = `${account.firstName.charAt(0)}${account.lastName.charAt(0)}`;
  return (letters || account.email.charAt(0) || "?").toUpperCase();
}

export default function ProfileScreen({ navigation }: any) {
  const { t, language, setLanguage } = useI18n();
  const { mode, setMode, fontScale, setFontScale } = useAppTheme();
  const { isAdmin } = useIsAdmin();

  const [account, setAccount] = useState<Account | null>(null);
  const [preferences, setPreferences] =
    useState<UserPreferences>(EMPTY_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [savingField, setSavingField] = useState<ToggleField | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [banner, setBanner] = useState<Banner>(null);

  // ----- Loading -----------------------------------------------------------

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const user = session?.user;

      if (!user) {
        setAccount(null);
        setPreferences(EMPTY_PREFERENCES);
        return;
      }

      setAccount({
        id: user.id,
        email: user.email ?? "",
        firstName: String(user.user_metadata?.first_name ?? "").trim(),
        lastName: String(user.user_metadata?.last_name ?? "").trim(),
      });

      const loaded = await fetchPreferencesForUser(user.id);

      // Lets allergies typed in either language be shown in the current one.
      await prepareAllergyLabels(loaded.allergies);
      setPreferences(loaded);
    } catch (error) {
      console.warn("Profile could not be loaded:", error);
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setBanner(null);
      void loadProfile();
    }, [loadProfile])
  );

  // ----- Inline preference switches -----------------------------------------

  async function toggleSetting(field: ToggleField, value: boolean) {
    if (!account || savingField) {
      return;
    }

    // Without a saved row there is nothing to update yet: first-time setup
    // must go through Preferences, which also asks the required questions.
    if (!preferences.exists) {
      navigation.navigate(ROUTES.Preferences);
      return;
    }

    const previous = preferences;
    const optimistic: UserPreferences =
      field === "prefers_halal"
        ? { ...preferences, prefersHalal: value }
        : { ...preferences, submitProducts: value };

    setPreferences(optimistic);
    setSavingField(field);
    setBanner(null);

    try {
      // Row Level Security limits this update to the user's own row.
      // .select() confirms that a row was really changed.
      const { data, error } = await supabase
        .from("user_preferences")
        .update({ [field]: value, updated_at: new Date().toISOString() })
        .eq("user_id", account.id)
        .select("user_id");

      if (error || !data || data.length === 0) {
        throw error ?? new Error("No row updated");
      }

      setBanner({ kind: "success", text: t("profile.savedSetting") });
    } catch (error) {
      console.warn("Setting could not be saved:", error);
      setPreferences(previous);
      setBanner({ kind: "error", text: t("profile.saveSettingFailed") });
    } finally {
      setSavingField(null);
    }
  }

  // ----- Language ------------------------------------------------------------

  async function chooseLanguage(code: Language) {
    if (code === language) {
      return;
    }

    await setLanguage(code);

    // Re-render the allergy summary in the newly selected language.
    await prepareAllergyLabels(preferences.allergies);
    setPreferences((current) => ({ ...current }));
  }

  // ----- Logout --------------------------------------------------------------

  async function logOut() {
    const confirmed = await confirmAction(
      t("profile.logoutConfirmTitle"),
      t("profile.logoutConfirmBody"),
      { confirmText: t("profile.logout"), destructive: true }
    );

    if (!confirmed) {
      return;
    }

    setLoggingOut(true);

    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }

      // Reset the stack so the back button cannot return to signed-in pages.
      navigation.reset({ index: 0, routes: [{ name: ROUTES.Login }] });
    } catch (error: any) {
      showMessage(t("profile.logoutFailed"), error?.message);
    } finally {
      setLoggingOut(false);
    }
  }

  // ----- Render --------------------------------------------------------------

  const fullName = account
    ? `${account.firstName} ${account.lastName}`.trim()
    : "";

  const allergySummary =
    preferences.allergies.length > 0
      ? joinList(allergyLabelList(preferences.allergies, t))
      : t("profile.noAllergies");

  const switchColors = {
    trackColor: { false: "#C9D4CC", true: "#8FC9A5" },
  };

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>{t("profile.heading")}</Text>

        {/* 1. Account card */}
        {loading && !account ? (
          <View style={[styles.profileCard, styles.centerCard]}>
            <ActivityIndicator color={COLORS.primary} />
          </View>
        ) : account ? (
          <TouchableOpacity
            style={styles.profileCard}
            onPress={() => navigation.navigate(ROUTES.ProfileSettings)}
            accessibilityRole="button"
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initialsFor(account)}</Text>
            </View>

            <View style={styles.profileText}>
              <Text style={[styles.name, !fullName && styles.placeholderName]}>
                {fullName || t("profile.noName")}
              </Text>

              {/* Email is LTR content; keep it readable in Arabic too. */}
              <Text style={styles.email} numberOfLines={1}>
                {account.email}
              </Text>
            </View>
          </TouchableOpacity>
        ) : (
          <View style={styles.profileCard}>
            <View style={styles.avatar}>
              <Ionicons name="person-outline" size={22} color="#176B43" />
            </View>

            <View style={styles.profileText}>
              <Text style={styles.name}>{t("profile.guestName")}</Text>
              <Text style={styles.email}>{t("profile.guestBody")}</Text>
            </View>

            <TouchableOpacity
              style={styles.signInButton}
              onPress={() => navigation.navigate(ROUTES.Login)}
            >
              <Text style={styles.signInButtonText}>{t("common.signIn")}</Text>
            </TouchableOpacity>
          </View>
        )}

        {loadFailed && (
          <TouchableOpacity style={styles.errorBanner} onPress={loadProfile}>
            <Text style={styles.errorBannerText}>{t("profile.loadFailed")}</Text>
            <Text style={styles.retryText}>{t("common.retry")}</Text>
          </TouchableOpacity>
        )}

        {banner && (
          <View
            style={[
              styles.banner,
              banner.kind === "success" ? styles.successBanner : styles.errorBanner,
            ]}
          >
            <Text
              style={
                banner.kind === "success"
                  ? styles.successBannerText
                  : styles.errorBannerText
              }
            >
              {banner.text}
            </Text>
          </View>
        )}

        {/* 2. Preferences (signed-in users only) */}
        {account && (
          <>
            <SettingsSectionTitle>
              {t("profile.sectionPreferences")}
            </SettingsSectionTitle>

            <SettingsGroup>
              <SettingsRow
                icon="options-outline"
                title={t("profile.editPreferences")}
                subtitle={
                  preferences.exists
                    ? `${t("profile.allergies")}: ${allergySummary}`
                    : t("profile.setupPreferences")
                }
                onPress={() =>
                  navigation.navigate(
                    ROUTES.Preferences,
                    preferences.exists ? { mode: "edit" } : undefined
                  )
                }
              />

              <SettingsDivider />

              <SettingsRow
                icon="restaurant-outline"
                title={t("profile.halal")}
                right={
                  savingField === "prefers_halal" ? (
                    <ActivityIndicator color={COLORS.primary} />
                  ) : (
                    <Switch
                      {...switchColors}
                      thumbColor={preferences.prefersHalal ? "#176B43" : "#F4F6F5"}
                      value={preferences.prefersHalal}
                      onValueChange={(value) =>
                        toggleSetting("prefers_halal", value)
                      }
                      disabled={loading || savingField !== null}
                      accessibilityLabel={t("profile.halal")}
                    />
                  )
                }
              />

              <SettingsDivider />

              {/* Product submission consent: explicit opt-in, saved to
                  user_preferences, which HomeScreen reads before any
                  submission is sent. */}
              <SettingsRow
                icon="cloud-upload-outline"
                title={t("profile.submissions")}
                subtitle={t("profile.submissionsHint")}
                right={
                  savingField === "submit_products_for_review" ? (
                    <ActivityIndicator color={COLORS.primary} />
                  ) : (
                    <Switch
                      {...switchColors}
                      thumbColor={preferences.submitProducts ? "#176B43" : "#F4F6F5"}
                      value={preferences.submitProducts}
                      onValueChange={(value) =>
                        toggleSetting("submit_products_for_review", value)
                      }
                      disabled={loading || savingField !== null}
                      accessibilityLabel={t("prefs.submitA11y")}
                    />
                  )
                }
              />
            </SettingsGroup>

          </>
        )}

        {/* 3. Language (available to guests too) */}
        <SettingsSectionTitle>{t("profile.sectionLanguage")}</SettingsSectionTitle>

        <SettingsGroup>
          {LANGUAGES.map((item, index) => (
            <View key={item.code}>
              {index > 0 && <SettingsDivider />}
              <SettingsRow
                icon="language-outline"
                title={item.nativeName}
                onPress={() => chooseLanguage(item.code)}
                right={
                  language === item.code ? (
                    <Ionicons
                      name="checkmark-circle"
                      size={22}
                      color={COLORS.primary}
                    />
                  ) : (
                    <View style={styles.emptyRadio} />
                  )
                }
              />
            </View>
          ))}
        </SettingsGroup>

        {/* Appearance: theme and text size (saved on this device) */}
        <SettingsSectionTitle>{t("profile.sectionAppearance")}</SettingsSectionTitle>

        <SettingsGroup>
          {THEME_OPTIONS.map((option, index) => (
            <View key={option.mode}>
              {index > 0 && <SettingsDivider />}
              <SettingsRow
                icon={option.icon}
                title={t(option.label)}
                onPress={() => void setMode(option.mode)}
                right={
                  mode === option.mode ? (
                    <Ionicons
                      name="checkmark-circle"
                      size={22}
                      color={COLORS.primary}
                    />
                  ) : (
                    <View style={styles.emptyRadio} />
                  )
                }
              />
            </View>
          ))}

          <SettingsDivider />

          <SettingsRow
            icon="text-outline"
            title={t("profile.textSize")}
            subtitle={t(FONT_SCALE_LABELS[FONT_SCALES.indexOf(fontScale)])}
            right={
              <View style={styles.sizeButtons}>
                <TouchableOpacity
                  style={[
                    styles.sizeButton,
                    fontScale === FONT_SCALES[0] && styles.disabled,
                  ]}
                  disabled={fontScale === FONT_SCALES[0]}
                  onPress={() =>
                    void setFontScale(
                      FONT_SCALES[Math.max(0, FONT_SCALES.indexOf(fontScale) - 1)]
                    )
                  }
                  accessibilityLabel={t("profile.textSmaller")}
                >
                  <Text style={styles.sizeButtonSmall}>A−</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.sizeButton,
                    fontScale === FONT_SCALES[FONT_SCALES.length - 1] &&
                      styles.disabled,
                  ]}
                  disabled={fontScale === FONT_SCALES[FONT_SCALES.length - 1]}
                  onPress={() =>
                    void setFontScale(
                      FONT_SCALES[
                        Math.min(
                          FONT_SCALES.length - 1,
                          FONT_SCALES.indexOf(fontScale) + 1
                        )
                      ]
                    )
                  }
                  accessibilityLabel={t("profile.textBigger")}
                >
                  <Text style={styles.sizeButtonLarge}>A+</Text>
                </TouchableOpacity>
              </View>
            }
          />
        </SettingsGroup>

        {/* 4. Admin (UI convenience only; RLS + Edge Functions enforce it) */}
        {account && isAdmin && (
          <>
            <SettingsSectionTitle>{t("profile.sectionAdmin")}</SettingsSectionTitle>

            <SettingsGroup>
              <SettingsRow
                icon="shield-checkmark-outline"
                title={t("profile.reviewSubmissions")}
                onPress={() =>
                  navigation.navigate(ROUTES.AdminProductSubmissions)
                }
              />
            </SettingsGroup>
          </>
        )}

        {/* 5. Support */}
        <SettingsSectionTitle>{t("profile.sectionSupport")}</SettingsSectionTitle>

        <SettingsGroup>
          <SettingsRow
            icon="help-circle-outline"
            title={t("title.faqs")}
            onPress={() => navigation.navigate(ROUTES.FAQs)}
          />

          <SettingsDivider />

          <SettingsRow
            icon="mail-outline"
            title={t("title.contactUs")}
            onPress={() => navigation.navigate(ROUTES.ContactUs)}
          />

          <SettingsDivider />

          <SettingsRow
            icon="information-circle-outline"
            title={t("title.about")}
            value={`v${APP_VERSION}`}
            onPress={() => navigation.navigate(ROUTES.AboutLabelLens)}
          />

          <SettingsDivider />

          <SettingsRow
            icon="shield-outline"
            title={t("profile.privacy")}
            onPress={() =>
              navigation.navigate(ROUTES.PrivacyNotice, { readOnly: true })
            }
          />
        </SettingsGroup>

        {/* 6. Log out */}
        {account && (
          <TouchableOpacity
            style={[styles.logoutButton, loggingOut && styles.disabled]}
            onPress={logOut}
            disabled={loggingOut}
            accessibilityRole="button"
          >
            {loggingOut ? (
              <ActivityIndicator color={COLORS.danger} />
            ) : (
              <>
                <Ionicons name="log-out-outline" size={20} color={COLORS.danger} />
                <Text style={styles.logoutText}>{t("profile.logout")}</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>

      <BottomNavigation navigation={navigation} activeTab="Profile" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: COLORS.page,
  },

  scroll: {
    flex: 1,
  },

  content: {
    padding: 18,
    paddingBottom: 32,
  },

  title: {
    color: "#17452F",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 18,
  },

  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  centerCard: {
    minHeight: 80,
    justifyContent: "center",
  },

  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#E8F5E9",
    alignItems: "center",
    justifyContent: "center",
  },

  avatarText: {
    color: "#176B43",
    fontSize: 19,
    fontWeight: "700",
  },

  profileText: {
    flex: 1,
  },

  name: {
    color: "#17452F",
    fontSize: 15,
    fontWeight: "700",
  },

  placeholderName: {
    color: COLORS.muted,
    fontStyle: "italic",
  },

  email: {
    color: "#62756A",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },

  signInButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginStart: 10,
  },

  signInButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },

  banner: {
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },

  successBanner: {
    backgroundColor: COLORS.primarySoft,
  },

  successBannerText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: "600",
  },

  errorBanner: {
    backgroundColor: COLORS.dangerSoft,
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },

  errorBannerText: {
    color: COLORS.danger,
    fontSize: 13,
    lineHeight: 19,
  },

  retryText: {
    color: COLORS.danger,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 6,
  },

  sizeButtons: {
    flexDirection: "row",
    gap: 8,
  },

  sizeButton: {
    minWidth: 42,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },

  sizeButtonSmall: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
  },

  sizeButtonLarge: {
    color: COLORS.primary,
    fontSize: 17,
    fontWeight: "800",
    textAlign: "center",
  },

  emptyRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#C9D4CC",
  },

  logoutButton: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#F3C5C0",
    marginTop: 24,
  },

  logoutText: {
    color: COLORS.danger,
    fontSize: 15,
    fontWeight: "700",
  },

  disabled: {
    opacity: 0.6,
  },
});
