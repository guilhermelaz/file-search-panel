import { prisma } from "./prisma";

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const UPLOAD_URL = "https://generativelanguage.googleapis.com/upload/v1beta";

export interface FileSearchStore {
  name: string;
  displayName: string;
  createTime: string;
  updateTime: string;
  activeDocumentsCount?: string;
  sizeBytes?: string;
  embeddingModel?: string;
}

export interface FileSearchDocument {
  name: string;
  displayName?: string;
  createTime?: string;
  updateTime?: string;
  customMetadata?: Array<{ key: string; stringValue?: string; numericValue?: number }>;
}

export interface CustomMetadata {
  key: string;
  stringValue?: string;
  numericValue?: number;
}

async function getApiKey(): Promise<string> {
  const settings = await prisma.settings.findFirst();
  const apiKey = settings?.googleApiKey || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("Google API Key não configurada. Configure em Configurações.");
  }
  return apiKey;
}

async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const apiKey = await getApiKey();
  const separator = path.includes("?") ? "&" : "?";
  const url = `${BASE_URL}${path}${separator}key=${apiKey}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[GoogleAPI] ${options.method || "GET"} ${path} failed:`, errorText);
    throw new Error(`Google API error (${response.status}): ${errorText}`);
  }

  // DELETE may return empty body
  const text = await response.text();
  return text ? JSON.parse(text) : ({} as T);
}

// ===== File Search Stores =====

export async function createFileSearchStore(displayName: string): Promise<FileSearchStore> {
  return apiRequest<FileSearchStore>("/fileSearchStores", {
    method: "POST",
    body: JSON.stringify({
      displayName,
    }),
  });
}

export async function listFileSearchStores(): Promise<{ fileSearchStores: FileSearchStore[] }> {
  return apiRequest("/fileSearchStores");
}

export async function getFileSearchStore(name: string): Promise<FileSearchStore> {
  // name can be "fileSearchStores/xxx" or just "xxx"
  const path = name.startsWith("fileSearchStores/") ? name : `fileSearchStores/${name}`;
  return apiRequest<FileSearchStore>(`/${path}`);
}

export async function deleteFileSearchStore(name: string): Promise<void> {
  const path = name.startsWith("fileSearchStores/") ? name : `fileSearchStores/${name}`;
  await apiRequest(`/${path}?force=true`, {
    method: "DELETE",
  });
}

// ===== Documents =====

export async function listDocuments(storeName: string): Promise<{ documents?: FileSearchDocument[] }> {
  const path = storeName.startsWith("fileSearchStores/") ? storeName : `fileSearchStores/${storeName}`;
  return apiRequest(`/${path}/documents`);
}

export async function deleteDocument(documentName: string): Promise<void> {
  // documentName format: fileSearchStores/xxx/documents/yyy
  await apiRequest(`/${documentName}`, {
    method: "DELETE",
  });
}

// ===== File Upload =====

/**
 * Upload a file directly to a File Search Store using multipart upload.
 * This combines media upload + import into one call.
 */
export async function uploadToFileSearchStore(
  storeName: string,
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
  customMetadata?: CustomMetadata[]
): Promise<{ name: string }> {
  const apiKey = await getApiKey();
  const path = storeName.startsWith("fileSearchStores/") ? storeName : `fileSearchStores/${storeName}`;

  // Step 1: Start resumable upload to get upload URL
  const startUrl = `${UPLOAD_URL}/${path}:uploadToFileSearchStore?key=${apiKey}`;

  const metadata: { displayName: string; customMetadata?: CustomMetadata[] } = {
    displayName: fileName,
  };
  if (customMetadata && customMetadata.length > 0) {
    metadata.customMetadata = customMetadata;
  }

  const startResponse = await fetch(startUrl, {
    method: "POST",
    headers: {
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": fileBuffer.length.toString(),
      "X-Goog-Upload-Header-Content-Type": mimeType,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(metadata),
  });

  if (!startResponse.ok) {
    const errText = await startResponse.text();
    throw new Error(`Failed to start upload: ${startResponse.status} ${errText}`);
  }

  const uploadUrl = startResponse.headers.get("X-Goog-Upload-URL");
  if (!uploadUrl) {
    throw new Error("Missing upload URL from Google response");
  }

  // Step 2: Upload bytes (convert Buffer to Uint8Array for fetch)
  const uploadResponse = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Length": fileBuffer.length.toString(),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    body: new Uint8Array(fileBuffer),
  });

  if (!uploadResponse.ok) {
    const errText = await uploadResponse.text();
    throw new Error(`Failed to upload bytes: ${uploadResponse.status} ${errText}`);
  }

  const result = await uploadResponse.json();
  // Result is an Operation object - we just return what we have
  // The document will be ready after some processing time
  return result;
}
