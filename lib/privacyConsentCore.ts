// ---------------------------------------------------------------------------
// lib/privacyConsentCore.ts
// Pure rules for "has the Privacy Notice already been accepted?" (no
// storage), unit-tested in scripts/testPrivacyOnce.ts.
//
// Why the notice appeared twice: it was accepted once when the app first
// opened (stored only as "true" on the device), and then shown AGAIN while
// creating an account or logging in, because the account itself had no
// record yet. Now the device acceptance stores WHICH version was accepted
// and when, and that acceptance is reused for the account, so the notice
// is shown only once per version. A new PRIVACY_VERSION still asks again.
// ---------------------------------------------------------------------------

export type DeviceAcceptance = { version: string; acceptedAt: string | null };

// Versions accepted before the version was stored (value "true").
export const LEGACY_DEVICE_VERSION = "1.2";

export function parseDeviceAcceptance(raw: string | null | undefined): DeviceAcceptance | null {
  if (!raw) {
    return null;
  }

  if (raw === "true") {
    return { version: LEGACY_DEVICE_VERSION, acceptedAt: null };
  }

  try {
    const data = JSON.parse(raw);

    if (data && typeof data.version === "string") {
      return {
        version: data.version,
        acceptedAt: typeof data.acceptedAt === "string" ? data.acceptedAt : null,
      };
    }
  } catch {
    // not JSON
  }

  return null;
}

export function serializeDeviceAcceptance(version: string, now = new Date()): string {
  return JSON.stringify({ version, acceptedAt: now.toISOString() });
}

export function isDeviceAcceptanceCurrent(
  raw: string | null | undefined,
  currentVersion: string
): boolean {
  return parseDeviceAcceptance(raw)?.version === currentVersion;
}

// Account metadata written from a device acceptance (same fields Register
// and the Privacy Notice already use).
export function privacyMetadataFrom(
  acceptance: DeviceAcceptance,
  now = new Date()
): { privacy_accepted: true; privacy_version: string; privacy_accepted_at: string } {
  return {
    privacy_accepted: true,
    privacy_version: acceptance.version,
    privacy_accepted_at: acceptance.acceptedAt ?? now.toISOString(),
  };
}
