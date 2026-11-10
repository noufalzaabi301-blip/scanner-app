// ---------------------------------------------------------------------------
// lib/photoStorage.ts
// One place for everything that happens to a product photo, for both
// camera photos and photos chosen from the device:
//
//   1. persistPhoto()        – right after the camera / picker returns, the
//                              photo is COPIED to a permanent app file
//                              (phones: the app's document folder; web: a
//                              data URL). Camera and picker files live in a
//                              temporary cache that the system may clear at
//                              any time, so they are never used later.
//   2. uploadPhotoToBucket() – when the Avoid List item / submission is
//                              saved, the permanent copy is uploaded to the
//                              user's folder "<userId>/…" in the right
//                              Supabase Storage bucket. Remote images (Open
//                              Food Facts) are DOWNLOADED first and then
//                              uploaded, so the saved item keeps its own
//                              copy. Any failure throws PhotoError with a
//                              clear message; nothing silently continues.
//   3. downloadPhotoAsDataUrl() – downloads a remote photo to a local file
//                              (phones) before it is embedded in a PDF.
//
// Phones use the expo-file-system File / Directory / Paths API
// (expo-file-system 19+, already in package.json). On phones, reading a
// local file with fetch().arrayBuffer() is not reliable (it is the reason
// photos were not being uploaded), so File.bytes() is used instead.
// Only the user's normal (publishable) Supabase client is used; no
// service-role key is involved.
// ---------------------------------------------------------------------------

import { Directory, File, Paths } from "expo-file-system";
import { Platform } from "react-native";

import { supabase } from "./supabase";

export const AVOID_PHOTO_BUCKET = "avoid-products";
export const SUBMISSION_PHOTO_BUCKET = "product-submissions";

const PHOTO_FOLDER = "labellens-photos";
// Kept local copies older than this are removed on the next app start.
const MAX_LOCAL_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export class PhotoError extends Error {
  step: "copy" | "download" | "read" | "upload";

  constructor(step: PhotoError["step"], message: string) {
    super(message);
    this.name = "PhotoError";
    this.step = step;
  }
}

const isWeb = Platform.OS === "web";

function errorText(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return typeof error === "string" && error ? error : "unknown error";
}

export function isRemoteUrl(uri: string | null | undefined): boolean {
  return !!uri && /^https?:\/\//i.test(uri);
}

function photoDirectory(): Directory {
  const directory = new Directory(Paths.document, PHOTO_FOLDER);

  if (!directory.exists) {
    directory.create({ intermediates: true, idempotent: true });
  }

  return directory;
}

function uniqueName(kind: string): string {
  const random = Math.random().toString(36).slice(2, 8);
  return `${Date.now()}-${random}-${kind}.jpg`;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("The photo could not be read."));
    reader.onerror = () => reject(new Error("The photo could not be read."));
    reader.readAsDataURL(blob);
  });
}

// ----- 1. Make a permanent local copy -------------------------------------

// Copies a camera / picker photo to a permanent location and returns the
// new URI. Throws PhotoError (never returns the temporary URI).
export async function persistPhoto(
  temporaryUri: string,
  kind: "front" | "ingredients"
): Promise<string> {
  if (!temporaryUri) {
    throw new PhotoError("copy", "No photo was returned by the camera.");
  }

  try {
    if (isWeb) {
      // Browser blob: URLs stop working once released; a data URL is a
      // self-contained copy of the photo.
      if (temporaryUri.startsWith("data:")) {
        return temporaryUri;
      }

      const response = await fetch(temporaryUri);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await blobToDataUrl(await response.blob());
    }

    const source = new File(temporaryUri);
    const target = new File(photoDirectory(), uniqueName(kind));

    await source.copy(target);

    if (!target.exists) {
      throw new Error("the copied file is missing");
    }

    return target.uri;
  } catch (error) {
    throw new PhotoError(
      "copy",
      `The photo could not be saved on this device (${errorText(error)}). Please take or choose the photo again.`
    );
  }
}

// Removes permanent local copies once they are safely uploaded.
export function deleteLocalPhoto(uri: string | null | undefined): void {
  if (isWeb || !uri || isRemoteUrl(uri) || !uri.includes(PHOTO_FOLDER)) {
    return;
  }

  try {
    const file = new File(uri);

    if (file.exists) {
      file.delete();
    }
  } catch {
    // Not important: old copies are also pruned on start-up.
  }
}

// Deletes local copies older than a week (photos of scans that were never
// saved). Safe to call at any time.
export function pruneOldLocalPhotos(): void {
  if (isWeb) {
    return;
  }

  try {
    const directory = new Directory(Paths.document, PHOTO_FOLDER);

    if (!directory.exists) {
      return;
    }

    const now = Date.now();

    for (const item of directory.list()) {
      if (item instanceof File) {
        const modified = item.modificationTime ?? now;

        if (now - modified > MAX_LOCAL_AGE_MS) {
          item.delete();
        }
      }
    }
  } catch {
    // Ignore: pruning is housekeeping only.
  }
}

// ----- 2. Read / download --------------------------------------------------

async function readLocalBytes(uri: string): Promise<ArrayBuffer> {
  try {
    if (isWeb) {
      const response = await fetch(uri);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.arrayBuffer();
    }

    const file = new File(uri);

    if (!file.exists) {
      throw new Error("the photo file no longer exists");
    }

    const bytes = await file.bytes();
    return bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength
    ) as ArrayBuffer;
  } catch (error) {
    throw new PhotoError(
      "read",
      `The photo could not be read (${errorText(error)}). Please take or choose the photo again.`
    );
  }
}

async function downloadRemoteBytes(url: string): Promise<ArrayBuffer> {
  try {
    if (isWeb) {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.arrayBuffer();
    }

    // Phones: download to a local file first, then read it.
    const target = new File(Paths.cache, uniqueName("download"));
    const downloaded = await File.downloadFileAsync(url, target, {
      idempotent: true,
    });

    try {
      const bytes = await downloaded.bytes();
      return bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength
      ) as ArrayBuffer;
    } finally {
      try {
        downloaded.delete();
      } catch {
        // cache file; ignore
      }
    }
  } catch (error) {
    throw new PhotoError(
      "download",
      `The product image could not be downloaded (${errorText(error)}).`
    );
  }
}

// Downloads a remote photo to a local file (phones) and returns it as a
// base64 data URL, e.g. for embedding in the Avoid List PDF.
// Returns null when the photo cannot be downloaded.
export async function downloadPhotoAsDataUrl(
  url: string,
  timeoutMs = 10000
): Promise<string | null> {
  if (url.startsWith("data:image/")) {
    return url;
  }

  const timeout = new Promise<null>((resolve) =>
    setTimeout(() => resolve(null), timeoutMs)
  );

  const work = (async () => {
    try {
      if (isWeb) {
        const response = await fetch(url);

        if (!response.ok) {
          return null;
        }

        return await blobToDataUrl(await response.blob());
      }

      const local = isRemoteUrl(url)
        ? await File.downloadFileAsync(url, new File(Paths.cache, uniqueName("pdf")), {
            idempotent: true,
          })
        : new File(url);

      const base64 = await local.base64();

      if (isRemoteUrl(url)) {
        try {
          local.delete();
        } catch {
          // ignore
        }
      }

      return base64 ? `data:image/jpeg;base64,${base64}` : null;
    } catch {
      return null;
    }
  })();

  const result = await Promise.race([work, timeout]);

  if (!result || !result.startsWith("data:")) {
    return null;
  }

  // Some servers send images as "application/octet-stream".
  return result.replace(
    /^data:(application\/octet-stream|binary\/octet-stream)?;/,
    "data:image/jpeg;"
  );
}

// ----- 3. Upload -----------------------------------------------------------

// Uploads one photo to "<userId>/<time>-<name>.jpg" in the given bucket and
// returns the Storage path that is saved on the Avoid List / submission
// row. Remote URLs are downloaded first. Throws PhotoError on any failure.
export async function uploadPhotoToBucket(
  bucket: string,
  userId: string,
  photoUri: string | null | undefined,
  photoName: "front" | "ingredients"
): Promise<string | null> {
  if (!photoUri) {
    return null;
  }

  const fileData = isRemoteUrl(photoUri)
    ? await downloadRemoteBytes(photoUri)
    : await readLocalBytes(photoUri);

  if (!fileData || fileData.byteLength === 0) {
    throw new PhotoError("read", "The photo is empty. Please take it again.");
  }

  const filePath = `${userId}/${uniqueName(photoName)}`;

  const { error } = await supabase.storage.from(bucket).upload(filePath, fileData, {
    contentType: "image/jpeg",
    upsert: false,
  });

  if (error) {
    throw new PhotoError(
      "upload",
      `The ${photoName} photo could not be uploaded (${error.message}).`
    );
  }

  return filePath;
}
