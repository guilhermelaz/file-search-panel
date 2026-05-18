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
  state?: string;
  sizeBytes?: string;
  mimeType?: string;
  customMetadata?: Array<{ key: string; stringValue?: string; numericValue?: number }>;
}

export interface CustomMetadata {
  key: string;
  stringValue?: string;
  numericValue?: number;
}

interface Operation {
  name: string;
  done?: boolean;
  error?: { code: number; message: string };
  response?: { name?: string; [key: string]: unknown };
  metadata?: Record<string, unknown>;
}

function getApiKey(): string {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_API_KEY env var não configurada");
  }
  return apiKey;
}

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const apiKey = getApiKey();
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

  const text = await response.text();
  return text ? JSON.parse(text) : ({} as T);
}

// ===== Stores =====

export async function createFileSearchStore(displayName: string): Promise<FileSearchStore> {
  return apiRequest<FileSearchStore>("/fileSearchStores", {
    method: "POST",
    body: JSON.stringify({ displayName }),
  });
}

export async function listFileSearchStores(): Promise<FileSearchStore[]> {
  const result = await apiRequest<{ fileSearchStores?: FileSearchStore[] }>(
    "/fileSearchStores?pageSize=20"
  );
  return result.fileSearchStores || [];
}

export async function getFileSearchStore(name: string): Promise<FileSearchStore> {
  const path = name.startsWith("fileSearchStores/") ? name : `fileSearchStores/${name}`;
  return apiRequest<FileSearchStore>(`/${path}`);
}

export async function deleteFileSearchStore(name: string): Promise<void> {
  const path = name.startsWith("fileSearchStores/") ? name : `fileSearchStores/${name}`;
  await apiRequest(`/${path}?force=true`, { method: "DELETE" });
}

// ===== Documents =====

export async function listDocuments(storeName: string): Promise<FileSearchDocument[]> {
  const path = storeName.startsWith("fileSearchStores/")
    ? storeName
    : `fileSearchStores/${storeName}`;
  const result = await apiRequest<{ documents?: FileSearchDocument[] }>(
    `/${path}/documents?pageSize=20`
  );
  return result.documents || [];
}

export async function getDocument(documentName: string): Promise<FileSearchDocument> {
  return apiRequest<FileSearchDocument>(`/${documentName}`);
}

export async function deleteDocument(documentName: string, retries = 10, delayMs = 3000): Promise<void> {
  // documentName format: fileSearchStores/xxx/documents/yyy
  // Documents may be in STATE_PENDING_PROCESSING and cannot be deleted until active
  for (let i = 0; i < retries; i++) {
    try {
      // Check state first (optional, for debugging)
      if (i > 0) {
        try {
          const doc = await getDocument(documentName);
          console.log(`[deleteDocument] State: ${doc.state}, attempt ${i + 1}/${retries}`);
        } catch {
          // Ignore, will try delete anyway
        }
      }
      await apiRequest(`/${documentName}`, { method: "DELETE" });
      console.log(`[deleteDocument] Success after ${i + 1} attempts`);
      return; // Success
    } catch (err) {
      const errStr = String(err);
      // If "non-empty" or "FAILED_PRECONDITION", wait and retry (document still processing)
      if (
        (errStr.includes("non-empty") || errStr.includes("FAILED_PRECONDITION")) &&
        i < retries - 1
      ) {
        console.log(`[deleteDocument] Retrying in ${delayMs}ms... (${i + 1}/${retries})`);
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }
      throw err; // Re-throw if not retryable or no more retries
    }
  }
}

// ===== Operations =====

async function getOperation(operationName: string): Promise<Operation> {
  const path = operationName.startsWith("/") ? operationName : `/${operationName}`;
  return apiRequest<Operation>(path);
}

async function waitForOperation(
  operation: Operation,
  maxWaitMs = 120000,
  pollIntervalMs = 2000
): Promise<Operation> {
  const startedAt = Date.now();
  let current = operation;

  while (!current.done) {
    if (Date.now() - startedAt > maxWaitMs) {
      throw new Error(`Operation ${current.name} timed out after ${maxWaitMs}ms`);
    }
    await new Promise((r) => setTimeout(r, pollIntervalMs));
    current = await getOperation(current.name);
  }

  if (current.error) {
    throw new Error(`Operation failed: ${current.error.message}`);
  }
  return current;
}

// ===== Upload =====

export async function uploadToFileSearchStore(
  storeName: string,
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
  customMetadata?: CustomMetadata[]
): Promise<{ documentName: string; operationName: string }> {
  const apiKey = getApiKey();
  const path = storeName.startsWith("fileSearchStores/")
    ? storeName
    : `fileSearchStores/${storeName}`;

  const startUrl = `${UPLOAD_URL}/${path}:uploadToFileSearchStore?key=${apiKey}`;

  const metadata: { displayName: string; customMetadata?: CustomMetadata[] } = {
    displayName: fileName,
  };
  if (customMetadata && customMetadata.length > 0) {
    metadata.customMetadata = customMetadata;
  }

  // Step 1: Start resumable upload
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

  // Step 2: Upload bytes
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

  const operation: Operation = await uploadResponse.json();
  console.log("[GoogleAPI] Upload operation:", operation.name);

  const completed = await waitForOperation(operation);
  // Response pode ter documentName diretamente (UploadToFileSearchStoreResponse)
  const documentName =
    (completed.response as { documentName?: string })?.documentName ||
    completed.response?.name;

  if (!documentName) {
    throw new Error(`Upload completed but no document name: ${JSON.stringify(completed)}`);
  }

  return { documentName, operationName: operation.name };
}

// ===== Chat (generateContent with file_search tool) =====

export interface ChatMessage {
  role: "user" | "model";
  text: string;
}

export interface ChatResponse {
  text: string;
  citations?: Array<{ uri?: string; title?: string; text?: string }>;
}

export async function chatWithStores(
  storeNames: string[],
  history: ChatMessage[],
  model: string = "gemini-2.5-flash"
): Promise<ChatResponse> {
  const apiKey = getApiKey();
  const fullStoreNames = storeNames.map((n) =>
    n.startsWith("fileSearchStores/") ? n : `fileSearchStores/${n}`
  );

  const url = `${BASE_URL}/models/${model}:generateContent?key=${apiKey}`;

  const body = {
    contents: history.map((m) => ({
      role: m.role,
      parts: [{ text: m.text }],
    })),
    tools: [
      {
        file_search: {
          file_search_store_names: fullStoreNames,
        },
      },
    ],
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("[GoogleAPI chat] Failed:", errText);
    throw new Error(`Chat error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const candidate = data.candidates?.[0];
  const text =
    candidate?.content?.parts?.map((p: { text?: string }) => p.text || "").join("") || "";

  const citations =
    candidate?.groundingMetadata?.groundingChunks?.map(
      (c: { retrievedContext?: { uri?: string; title?: string; text?: string } }) => ({
        uri: c.retrievedContext?.uri,
        title: c.retrievedContext?.title,
        text: c.retrievedContext?.text,
      })
    ) || [];

  return { text, citations };
}

// ===== Models =====

export interface GeminiModel {
  name: string;
  displayName: string;
  description?: string;
  version?: string;
}

export async function listGeminiModels(): Promise<GeminiModel[]> {
  const apiKey = getApiKey();
  const url = `${BASE_URL}/models?key=${apiKey}&pageSize=50`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to list models: ${res.status} ${err}`);
  }
  const data = await res.json();
  const models: GeminiModel[] = data.models || [];
  // Filter to Gemini 2.5/3.x generation models supporting generateContent
  return models
    .filter((m: GeminiModel) => {
      const name = m.name.toLowerCase();
      // Exclude embedding, tuning, aqa, vision models
      if (name.includes("embedding") || name.includes("aqa") || name.includes("tuning")) return false;
      // Include flash/pro models
      return name.includes("gemini-2.5") || name.includes("gemini-3.1") || name.includes("gemini-3");
    })
    .map((m: GeminiModel) => ({
      name: m.name.replace("models/", ""),
      displayName: m.displayName || m.name.replace("models/", ""),
      description: m.description,
      version: m.version,
    }));
}

// ===== Health check =====

export async function testConnection(): Promise<{ ok: boolean; storesCount?: number; error?: string }> {
  try {
    const stores = await listFileSearchStores();
    return { ok: true, storesCount: stores.length };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
