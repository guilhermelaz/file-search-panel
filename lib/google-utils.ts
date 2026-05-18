// Convert "fileSearchStores/teste-xxx" -> "teste-xxx"
export function shortStoreId(fullName: string): string {
  return fullName.replace(/^fileSearchStores\//, "");
}

// Convert "fileSearchStores/teste-xxx/documents/yyy" -> "yyy"
export function shortDocId(fullName: string): string {
  const m = fullName.match(/\/documents\/(.+)$/);
  return m ? m[1] : fullName;
}

export function formatBytes(bytes: number | string | undefined): string {
  if (bytes == null) return "—";
  const n = typeof bytes === "string" ? parseInt(bytes, 10) : bytes;
  if (isNaN(n)) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function formatDate(iso: string | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR");
  } catch {
    return iso;
  }
}
