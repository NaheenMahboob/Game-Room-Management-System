/**
 * Browser helpers for turning camera/file previews into multipart uploads
 * against the member photo API routes.
 */

/**
 * Converts a `data:` URL (from {@link PhotoCapture}) into a `File` suitable
 * for `FormData` uploads.
 *
 * @param dataUrl - Base64 data URL (`data:image/jpeg;base64,...`)
 * @param filename - Filename attached to the multipart part
 * @returns A `File` with the decoded bytes and original MIME type
 * @throws If the string is not a valid base64 data URL
 */
export function dataUrlToFile(dataUrl: string, filename = "photo.jpg"): File {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) {
    throw new Error("Invalid image data");
  }

  const mime = match[1]!;
  const binary = atob(match[2]!);

  // Decode base64 into a typed array for the File constructor.
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new File([bytes], filename, { type: mime });
}

/** Loose response shape covering both upload endpoints. */
type UploadResponse = {
  /** Storage filename from `POST /api/uploads/member-photo`. */
  photoUrl?: string;
  /** Updated member from `POST /api/members/[id]/photo` (client API photo path). */
  member?: { photoUrl?: string };
  error?: string;
};

/**
 * Uploads a `File` via multipart POST and returns the response photo reference.
 *
 * Registration returns a storage filename; retake returns the authenticated
 * API path on `member.photoUrl` (or top-level `photoUrl`).
 *
 * @param file - Image file to upload
 * @param endpoint - Absolute path of the upload API route
 * @returns Storage filename or `/api/members/.../photo` depending on endpoint
 */
export async function uploadMemberPhotoFile(
  file: File,
  endpoint: string
): Promise<string> {
  const form = new FormData();
  form.append("file", file);

  const response = await fetch(endpoint, {
    method: "POST",
    body: form,
  });

  const data = (await response.json().catch(() => ({}))) as UploadResponse;
  const photoUrl = data.photoUrl ?? data.member?.photoUrl;

  if (!response.ok || !photoUrl) {
    throw new Error(data.error ?? `Upload failed (${response.status})`);
  }

  return photoUrl;
}

/**
 * Uploads a local preview data URL, or passes through an already-stored key/path.
 *
 * @param dataUrl - Camera/file preview (`data:...`), storage filename, or API path
 * @param endpoint - Upload API route to POST against when conversion is needed
 * @returns Storage filename (registration) or API photo path (retake)
 */
export async function uploadMemberPhotoDataUrl(
  dataUrl: string,
  endpoint: string
): Promise<string> {
  // Already a storage filename or authenticated API URL — no re-upload.
  if (
    dataUrl.startsWith("/api/members/") ||
    /^[\w.-]+\.(jpe?g|png|webp)$/i.test(dataUrl)
  ) {
    return dataUrl;
  }

  const file = dataUrlToFile(dataUrl);
  return uploadMemberPhotoFile(file, endpoint);
}
