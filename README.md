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
- [Deploying the web version on Netlify](#deploying-the-web-version-on-netlify)
- [Normal users and developers](#normal-users-and-developers)
- [Supabase setup](#supabase-setup)
- [Password reset (email code)](#password-reset-email-code)
- [Delete account](#delete-account)
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
- Sign up, log in, reset a forgotten password with an emailed code, delete account.
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
netlify.toml                 Netlify web build settings
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
  allergyValidation.ts       Rules for custom allergies typed in Preferences
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
supabase/sql/
  user_database_developer_review.sql   admin_users + submission policies
  food_database_read_only.sql          food DB: read-only for the app
supabase/functions/
  approve-product-submission/
  reject-product-submission/
  translate-food-text/
  delete-account/
  _shared/review.ts
scripts/
  testScreening.ts           Screening engine tests
  testI18n.ts                Translation tests
  testAllergyValidation.ts   Custom allergy input validation tests
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

## Deploying the web version on Netlify

`netlify.toml` is included, so Netlify needs no manual build settings:

1. In Netlify, **Add new site → Import an existing project** and pick this
   GitHub repository (or open your existing site and check
   **Site configuration → Build & deploy → Repository** points to it, on the
   right branch).
2. **Site configuration → Environment variables**: add the four
   `EXPO_PUBLIC_...` values from `.env.example`.
3. Push to GitHub. Netlify runs `npx expo export --platform web` and
   publishes `dist/`.
4. **Check the deployed commit:** open the developer page and look at the
   bottom line, `Developer page · secure approval · build abc1234`. It must
   match the latest commit hash on GitHub (also shown in Netlify →
   Deploys). If it says something else, or the page has no such line,
   Netlify is serving an old build or another repository: trigger
   **Deploys → Trigger deploy → Clear cache and deploy site**.

---

## Normal users and developers

| | Normal users | Developers (`admin_users`) |
|---|---|---|
| Scan products, Avoid List | ✅ | ✅ |
| Submit products for verification | Only with the Preferences consent switch on | Same |
| Developer review screen | ❌ (route not registered, screen re-checks) | ✅ Profile → Review product submissions |
| Save draft | ❌ | ✅ writes **only** to `product_submissions` |
| Approve for scanner | ❌ | ✅ through the `approve-product-submission` Edge Function |
| Write to food DB `products` | ❌ never | ❌ never directly – only the Edge Function can |

Developers are rows in the **user** database table `admin_users`:

```sql
insert into public.admin_users (user_id) values ('USER-UUID-HERE');
```

Run `supabase/sql/user_database_developer_review.sql` (user project) and
`supabase/sql/food_database_read_only.sql` (food project) once.

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

## Password reset (email code)

Forgot Password works with a **code from the email**, so no link has to
open the app:

1. The user enters their email → Supabase sends a reset email.
2. The user types the code from the email and a new password → done.

One-time setup in the **user** Supabase project:
**Authentication → Emails → Templates → Reset Password**, and make the email
show the code, for example:

```html
<h2>Reset your LabelLens password</h2>
<p>Your reset code is:</p>
<h1>{{ .Token }}</h1>
<p>Enter this code in the LabelLens app. It expires soon.</p>
```

(Use a custom SMTP server in **Authentication → Emails → SMTP Settings** for
real users; Supabase's built-in email only sends a few emails per hour.)

## Delete account

Profile → **Delete account** (asked twice) calls the `delete-account` Edge
Function. The customer and food databases are handled separately:

| | Customer (user) database | Food database |
|---|---|---|
| **Normal customer** | Deletes their login, preferences, Avoid List, submissions and photos | **Nothing changes** |
| **Developer** | Same as above | Their `developer_users` row is removed **only if** they choose "Remove developer access" in a separate question (default: keep). It is matched by the signed-in **email** (`trim().toLowerCase()`), because the two projects have separate logins and user ids. If no developer has that email, an error is shown and **nothing** is deleted. |
| **Approved products** | – | **Never deleted** |

The food database service-role key (`FOOD_SUPABASE_SERVICE_ROLE_KEY`) is
used only inside the Edge Function, and only for that developer step. The
function only ever deletes the logged-in caller's own data.

---

## Edge Functions

| Function | Purpose | Secrets |
|---|---|---|
| `extract-label` | Reads ingredient and front-package photos with AI (deployed separately) | Your AI provider key |
| `translate-food-text` | Translates label text and allergy names (English ↔ Arabic) with Gemini | `GEMINI_API_KEY` |
| `approve-product-submission` | Admin only: copies a submission into the food database (duplicate-safe) | `FOOD_SUPABASE_URL`, `FOOD_SUPABASE_SERVICE_ROLE_KEY` |
| `reject-product-submission` | Admin only: rejects a submission with optional notes | – |
| `delete-account` | Deletes the caller's own account, photos and personal data (Profile → Delete account); optionally removes a developer's own `developer_users` row in the food DB | `FOOD_SUPABASE_URL`, `FOOD_SUPABASE_SERVICE_ROLE_KEY` (only for the developer option) |

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
npx supabase functions deploy delete-account
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
npx tsx scripts/testAllergyValidation.ts  # custom allergy input rules
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
