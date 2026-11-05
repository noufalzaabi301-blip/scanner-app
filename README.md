# LabelLens

**Understand what's inside before you eat.**

LabelLens is a mobile app (iOS, Android and web) that scans food products and
checks them against a user's allergies and halal preference. It reads the
barcode, looks the product up, or reads the package photos with AI, then
highlights possible allergens and ingredients that need halal verification.
Products the user wants to avoid can be saved to an **Avoid List** and shared
as a compact PDF or text summary.

The app is fully available in **English and Arabic** (right-to-left), with
**light / dark themes** and **adjustable text size**.

> LabelLens provides screening information only. It is not medical, dietary,
> religious or legal advice and cannot guarantee that a product is safe.
> Always check the physical package.

Developed as a project at **United Arab Emirates University**.

---

## Contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
- [Supabase setup](#supabase-setup)
- [Edge Functions](#edge-functions)
- [Testing](#testing)
- [Languages and RTL](#languages-and-rtl)
- [Themes and text size](#themes-and-text-size)
- [Security notes](#security-notes)
- [Known limitations](#known-limitations)
- [Contact](#contact)

---

## Features

### Scanning and analysis
- Scan a barcode with the camera or type it in (EAN-8, UPC-A, EAN-13, GTIN-14,
  with check-digit validation).
- **Product lookup order**
  1. Approved **LabelLens food database** (verified products)
  2. **Open Food Facts** (shown as "not verified")
  3. **Package photos** – the ingredient label and front package are read by
     AI (`extract-label` Edge Function)
- A review page appears **only when something may need correcting**
  (unclear text, low confidence, uncertain ingredients), with photo zoom.
- **Allergy screening** of ingredients, "Contains", "May contain", product
  name and brand, with direct / possible / needs-checking levels and
  highlighted ingredients.
- **Halal screening** (optional) with links to look up flagged E-numbers on
  [HalalCodeCheck](https://halalcodecheck.com/).
- Allergies can be typed in **English or Arabic** (e.g. "سكر" is matched as
  "sugar").
- Product photos are shown for database products too (taken from Open Food
  Facts when the database has no photo).

### Avoid List
- Save a product with its photos, warnings and halal result.
- Search, view details, delete.
- Share selected products as:
  - a **compact PDF** – one table: `# | Photo | Product | Screening summary`
  - a **compact text summary** (WhatsApp-friendly, right-to-left in Arabic)
  - **Copy text** to the clipboard

### Account and profile
- Sign up, log in, forgot / reset password.
- **Privacy Notice must be accepted before an account is created.**
- After the first login or sign-up, the app opens directly on the **Scan**
  screen until the user logs out.
- Profile: real name and email, edit name and password, allergies, halal
  preference, optional product-submission consent, language, appearance,
  FAQs, Contact Us, About, Privacy Notice, log out.

### Product submissions and admin review
- Users can **opt in** (in Preferences / Profile, off by default) to send
  scanned products for verification.
- Admins review submissions in the app; approval copies the product into the
  food database through a secure Edge Function.

---

## Tech stack

| Area | Technology |
|---|---|
| App | Expo SDK 57, React Native 0.86, React 19, TypeScript (strict) |
| Navigation | React Navigation 7 (native stack) |
| Backend | Supabase (Auth, Postgres + RLS, Storage, Edge Functions) |
| Product data | LabelLens food database (Supabase) + Open Food Facts API v3 |
| AI | `extract-label` (package photos) and `translate-food-text` (Gemini) Edge Functions |
| Device features | expo-camera, expo-image-picker, expo-print, expo-sharing, expo-clipboard |
| Storage on device | AsyncStorage (session, language, theme, text size, translation cache) |

---

## Architecture

LabelLens uses **two separate Supabase projects**:

| Project | Holds | Access from the app |
|---|---|---|
| **User database** (`lib/supabase.ts`) | Accounts, `user_preferences`, `avoid_list`, `product_submissions`, `admin_users`, Storage buckets `avoid-products` and `product-submissions` | Publishable key + the user's session; every table protected by Row Level Security |
| **Food database** (`lib/productSupabase.ts`) | `products` (approved, verified products) | Publishable key, **read-only**, no user session |

Why two databases: personal data never reaches the product database, and
users can never write to it. New products only arrive through the
admin-approved Edge Function, which holds the food database's service-role
key on the server.

```
App ──(publishable key + user JWT)──► User DB  (RLS: own rows only)
App ──(publishable key, read only)──► Food DB  (approved products)
Admin ──► approve-product-submission (Edge Function, service-role keys as secrets) ──► Food DB
```

---

## Project structure

```
.env.example                 Environment variable names (copy to .env)
App.tsx                      Navigation, start screen, language + theme providers
components/
  BottomNavigation.tsx       Shared footer (Scan / Avoid / Profile)
  LanguageSwitch.tsx         English / العربية selector (Login, Register)
  SettingsRow.tsx            Rows used on the Profile screen
  Themed.tsx                 Themed Text, View, Switch, Ionicons… (dark mode,
                             text size, RTL alignment)
lib/
  supabase.ts                User database client
  productSupabase.ts         Food database client (read-only)
  productLookup.ts           Lookup order and timeouts
  productProviders.ts        LabelLens DB + Open Food Facts providers
  labelExtraction.ts         Sends package photos to the AI Edge Function
  screening.ts               Allergy + halal screening engine
  productSubmission.ts       Opt-in product submissions
  adminAccess.ts             Admin check + review function calls
  userPreferences.ts         Shared user_preferences access
  foodTranslation.ts         English ↔ Arabic label translation + cache
  barcode.ts, text.ts        Small helpers
  constants.ts               Colours, routes, storage keys, allergy options
  theme.tsx                  Light / dark / system theme + text size
  ui/messages.ts             Alerts and confirmations (web-safe)
  i18n/
    en.ts, ar.ts             UI text (Arabic falls back to English)
    index.tsx, translate.ts  Translation provider and helpers
    screeningText.ts         Shows screening results in Arabic
    foodGlossary.ts          Built-in English ↔ Arabic food dictionary
screens/                     One file per screen
supabase/functions/
  approve-product-submission/
  reject-product-submission/
  translate-food-text/
  _shared/review.ts
scripts/
  testScreening.ts           Screening engine tests
  testI18n.ts                Translation tests
```

---

## Getting started

### Requirements
- **Node.js 20 or newer** and npm
- **Expo Go** on your phone, an Android / iOS emulator, or a web browser
- Two Supabase projects (see [Supabase setup](#supabase-setup))
- For builds: a free [Expo account](https://expo.dev) and the EAS CLI
  (`npm install -g eas-cli`); iPhone builds also need an Apple Developer
  account

### 1. Install

```bash
git clone https://github.com/YOUR-USERNAME/LabelLens.git
cd LabelLens
npm install
```

### 2. Environment variables

Copy the example file and fill in your **publishable** keys:

```bash
cp .env.example .env
```

| Variable | What it is |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | URL of the **user** Supabase project |
| `EXPO_PUBLIC_SUPABASE_KEY` | Publishable (anon) key of the user project |
| `EXPO_PUBLIC_PRODUCT_SUPABASE_URL` | URL of the **food** Supabase project |
| `EXPO_PUBLIC_PRODUCT_SUPABASE_KEY` | Publishable (anon) key of the food project |

`EXPO_PUBLIC_` values are bundled into the app, so they must be public keys.
**Never** put a service-role / secret key, password or token in `.env`.
`.env` is ignored by git; only `.env.example` is committed.

### 3. Run the app with Expo

```bash
npx expo start -c
```

Then:
- **Phone:** scan the QR code with the Camera app (iPhone) or Expo Go
  (Android). Phone and computer must be on the same Wi-Fi, or use
  `npx expo start --tunnel`.
- **Android emulator:** press `a`
- **iOS simulator (macOS):** press `i`
- **Web browser:** press `w`

### 4. Build with EAS

Log in once and link the project:

```bash
eas login
eas init
```

Add the four `EXPO_PUBLIC_...` variables to your project on
[expo.dev](https://expo.dev) (**Environment variables**, for the `preview`
and `production` environments), because `.env` is not uploaded with builds.

| Goal | Command |
|---|---|
| Android APK to install directly | `eas build -p android --profile preview` |
| iPhone test build (register device first with `eas device:create`) | `eas build -p ios --profile preview` |
| Store builds | `eas build -p all --profile production` |
| Upload to App Store Connect / TestFlight | `eas submit -p ios --profile production` |
| Upload to Google Play | `eas submit -p android --profile production` |

For iOS, EAS asks for an app identifier (for example
`com.yourname.labellens`; you can also set it as `ios.bundleIdentifier` in
`app.json`) and for your Apple ID, then manages certificates for you. Apple
credentials are never stored in this repository.

---

## Supabase setup

### User database
Tables used by the app (all with Row Level Security so users can only reach
their own rows):

| Table | Purpose |
|---|---|
| `user_preferences` | `user_id`, `prefers_halal`, `has_allergies`, `allergies` (array), `other_allergy`, `submit_products_for_review`, `updated_at` – one row per user |
| `avoid_list` | Saved products: names, ingredients, Contains / May contain, `save_reason`, `halal_status`, `source`, photo paths |
| `product_submissions` | Opt-in submissions with `verification_status` (`pending` → `processing` → `approved` / `rejected`) |
| `admin_users` | User ids allowed to review submissions (`public.is_admin()`) |

Also required:
- Storage buckets `avoid-products` and `product-submissions` (private).
- RPC `is_registered_email(check_email)` used by Forgot Password.
- Auth: email / password sign-in. If email confirmation is on, set the
  project's Site URL (used by password-reset emails on phones).

### Food database
- Table `products`: `barcode`, `product_name`, `brand_name`,
  `ingredients_text`, `allergen_text`, `verification_status`.
- Optional photo column (`image_url`, `image_front_url` or
  `front_photo_url`). Without one, the app shows the Open Food Facts photo
  for the same barcode.
- Read access for `verification_status = 'approved'` only. Run
  `supabase/sql/food_database_read_only.sql` in the **food** project: it
  gives the app SELECT only and blocks INSERT / UPDATE / DELETE. Approvals
  write through the `approve-product-submission` Edge Function instead.

---

## Edge Functions

| Function | Purpose | Secrets |
|---|---|---|
| `extract-label` | Reads ingredient and front-package photos with AI (deployed separately) | Your AI provider key |
| `translate-food-text` | Translates label text and allergy names (English ↔ Arabic) with Gemini | `GEMINI_API_KEY` |
| `approve-product-submission` | Admin only: copies a submission into the food database (duplicate-safe) | `FOOD_SUPABASE_URL`, `FOOD_SUPABASE_SERVICE_ROLE_KEY` |
| `reject-product-submission` | Admin only: rejects a submission with optional notes | – |

### Deploying the Edge Functions

All functions are deployed to the **user** Supabase project. Secrets are
stored only in Supabase (never in the app, `.env` or GitHub).

```bash
# 1. Log in with the Supabase CLI (runs through npx, nothing to install)
npx supabase login

# 2. Link this folder to the USER project (ref from the project URL)
npx supabase link --project-ref YOUR-USER-PROJECT-REF

# 3. Set the secrets (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY of the
#    user project are provided automatically by Supabase)
npx supabase secrets set FOOD_SUPABASE_URL=https://YOUR-FOOD-PROJECT.supabase.co
npx supabase secrets set FOOD_SUPABASE_SERVICE_ROLE_KEY=your-food-service-role-key
npx supabase secrets set GEMINI_API_KEY=your-gemini-key

# 4. Deploy
npx supabase functions deploy approve-product-submission
npx supabase functions deploy reject-product-submission
npx supabase functions deploy translate-food-text
```

Then, in the SQL editor of the **food** project, run
`supabase/sql/food_database_read_only.sql` so the app can only read
approved products and all writes go through `approve-product-submission`.

`translate-food-text` is optional: without it, the built-in food dictionary
(`lib/i18n/foodGlossary.ts`) is used for Arabic and the app keeps working.

---

## Testing

```bash
npx tsc --noEmit                    # type check the whole app
npx tsx scripts/testScreening.ts    # allergy + halal screening tests
npx tsx scripts/testI18n.ts         # translation + screening-text tests
```

Manual checklist:
- Sign up → Privacy Notice → accept → Preferences → Scan.
- Close and reopen the app: it opens on Scan; Log out returns to Login.
- Scan a barcode from the food database, Open Food Facts, and an unknown one
  (photo flow).
- Add to Avoid List, delete, share as PDF, share as text, copy text.
- Switch to Arabic: layout is right-to-left, allergies and ingredients are in
  Arabic; switch back to English.
- Dark theme and text size (Profile → Appearance).

---

## Languages and RTL

- All UI text lives in `lib/i18n/en.ts` and `lib/i18n/ar.ts`; missing Arabic
  keys fall back to English. The choice is saved on the device.
- Arabic switches the layout to right-to-left **instantly, without restarting
  the app** (a root `direction: "rtl"` style instead of `I18nManager`).
- Screening still runs on the original (English) label text; only the
  display is translated, so translation can never change a result.
- Barcodes stay left-to-right; shared text uses right-to-left marks so chat
  apps display Arabic correctly.

## Themes and text size

Profile → **Appearance**:
- Light, Dark, or Same as device.
- Text size: Small, Normal, Large, Extra large.

Implemented in `lib/theme.tsx` and `components/Themed.tsx`, so every screen
follows the setting without its own dark-mode styles. The PDF always uses the
light layout for printing.

---

## Security notes

- The app contains **publishable keys only**. Service-role keys and AI keys
  exist only as Edge Function secrets.
- Row Level Security limits every user-database query to the signed-in user.
- Hiding the admin screen is only a convenience; RLS and the Edge Functions
  re-check admin rights on the server.
- Product submissions require an explicit opt-in (off by default) and never
  include the user's allergy profile.
- Users never get write access to the food database.

## Known limitations

- Contact Us opens the user's email app (there is no in-app mail server).
- Accounts created before the privacy check existed are asked to accept the
  Privacy Notice at their next login.
- Allergy names that are neither in the built-in dictionary nor translated by
  `translate-food-text` are shown as typed.
- In Arabic, the native header back arrow and a few overlay buttons keep their
  English-side positions.

## Contact

**labellens.contact@gmail.com** · United Arab Emirates University

## License

See [LICENSE](LICENSE). The bundled file is the MIT license from the Expo
project template; replace it if your project uses a different license.
