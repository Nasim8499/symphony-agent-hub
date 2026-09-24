import { getSettings, updateSettings } from "./settings";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE = "https://www.googleapis.com/drive/v3";
const DOCS = "https://docs.googleapis.com/v1/documents";
const SHEETS = "https://sheets.googleapis.com/v4/spreadsheets";
const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me";

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/documents.readonly",
  "https://www.googleapis.com/auth/spreadsheets.readonly",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
];

export type GoogleFile = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string | null;
  size: string | null;
  webViewLink: string | null;
  iconLink: string | null;
  owners: string[];
};

export type GoogleStatus = {
  configured: boolean;
  connected: boolean;
  email: string | null;
  connectedAt: string | null;
  scopes: string[];
  previewCapable: boolean;
};

function config() {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/google/callback`,
  };
}

export async function googleStatus(): Promise<GoogleStatus> {
  const s = await getSettings();
  const envId = process.env.GOOGLE_CLIENT_ID;
  const envSecret = process.env.GOOGLE_CLIENT_SECRET;
  return {
    configured: Boolean((s.googleClientId || envId) && (s.googleClientSecret || envSecret)),
    connected: Boolean(s.googleRefreshToken),
    email: s.googleAccountEmail,
    connectedAt: s.googleConnectedAt ? s.googleConnectedAt.toISOString() : null,
    scopes: GOOGLE_SCOPES,
    previewCapable: true,
  };
}

export function buildAuthUrl(state: string) {
  const s = config();
  const env = { id: process.env.GOOGLE_CLIENT_ID, secret: process.env.GOOGLE_CLIENT_SECRET };
  const clientId = s.clientId || env.id;
  if (!clientId) throw new Error("GOOGLE_CLIENT_ID is not configured.");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: s.redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    scope: GOOGLE_SCOPES.join(" "),
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

async function credentials() {
  const s = await getSettings();
  const clientId = s.googleClientId || process.env.GOOGLE_CLIENT_ID;
  const clientSecret = s.googleClientSecret || process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Google OAuth client is not configured. Add a Client ID and Secret in Settings → Google Workspace.");
  return { clientId, clientSecret, refreshToken: s.googleRefreshToken };
}

export async function exchangeCode(code: string) {
  const s = config();
  const env = { id: process.env.GOOGLE_CLIENT_ID, secret: process.env.GOOGLE_CLIENT_SECRET };
  const clientId = s.clientId || env.id;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId || "",
      client_secret: clientSecret,
      redirect_uri: s.redirectUri,
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Google token exchange failed (${res.status}): ${text}`);
  const j = JSON.parse(text) as { access_token: string; refresh_token?: string; expires_in: number };
  if (!j.refresh_token) throw new Error("Google did not return a refresh token. Revoke access and reconnect to grant offline access.");
  return j;
}

let cached: { token: string; expiresAt: number } | null = null;

export async function googleAccessToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 30_000) return cached.token;
  const { clientId, clientSecret, refreshToken } = await credentials();
  if (!refreshToken) throw new Error("Google Workspace is not connected.");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Google token refresh failed (${res.status}): ${text}`);
  const j = JSON.parse(text) as { access_token: string; expires_in: number };
  cached = { token: j.access_token, expiresAt: Date.now() + j.expires_in * 1000 };
  return j.access_token;
}

async function gfetch<T>(url: string, init?: RequestInit): Promise<T> {
  const token = await googleAccessToken();
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) throw Object.assign(new Error(`Google API error (${res.status}): ${text.slice(0, 280)}`), { status: res.status });
  return (text ? JSON.parse(text) : {}) as T;
}

/** Google Drive search over file names, full text and metadata. */
export async function driveSearch(query: string, limit = 25): Promise<GoogleFile[]> {
  const q = query.trim();
  const clauses = ["trashed = false"];
  if (q) {
    const safe = q.replace(/'/g, "\\'");
    clauses.push(`(name contains '${safe}' or fullText contains '${safe}')`);
  }
  const params = new URLSearchParams({
    q: clauses.join(" and "),
    pageSize: String(Math.min(100, limit)),
    orderBy: "modifiedTime desc",
    fields: "files(id,name,mimeType,modifiedTime,size,webViewLink,iconLink,owners(displayName,emailAddress))",
  });
  const j = await gfetch<{ files?: RawFile[] }>(`${DRIVE}/files?${params}`);
  return (j.files ?? []).map(normalizeFile);
}

type RawFile = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: string;
  webViewLink?: string;
  iconLink?: string;
  owners?: { displayName?: string; emailAddress?: string }[];
};

function normalizeFile(f: RawFile): GoogleFile {
  return {
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    modifiedTime: f.modifiedTime ?? null,
    size: f.size ?? null,
    webViewLink: f.webViewLink ?? null,
    iconLink: f.iconLink ?? null,
    owners: (f.owners ?? []).map((o) => o.displayName || o.emailAddress || "Unknown"),
  };
}

export async function driveList(limit = 25, folderId?: string): Promise<GoogleFile[]> {
  const clauses = ["trashed = false"];
  if (folderId) clauses.push(`'${folderId}' in parents`);
  const params = new URLSearchParams({
    q: clauses.join(" and "),
    pageSize: String(Math.min(100, limit)),
    orderBy: "modifiedTime desc",
    fields: "files(id,name,mimeType,modifiedTime,size,webViewLink,iconLink,owners(displayName,emailAddress))",
  });
  const j = await gfetch<{ files?: RawFile[] }>(`${DRIVE}/files?${params}`);
  return (j.files ?? []).map(normalizeFile);
}

export async function driveGet(id: string): Promise<GoogleFile> {
  const f = await gfetch<RawFile>(`${DRIVE}/files/${encodeURIComponent(id)}?fields=id,name,mimeType,modifiedTime,size,webViewLink,iconLink,owners(displayName,emailAddress)`);
  return normalizeFile(f);
}

export type ExportKind = "pdf" | "text" | "docx" | "csv" | "xlsx";

export function exportMime(kind: ExportKind): string {
  return {
    pdf: "application/pdf",
    text: "text/plain",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    csv: "text/csv",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  }[kind];
}

/** Fetches a file's bytes (or exports a Google Doc/Sheet) for the viewer or a download. */
export async function driveFetchContent(fileId: string, kind: ExportKind = "pdf"): Promise<{ buffer: ArrayBuffer; mimeType: string; name: string }> {
  const meta = await driveGet(fileId);
  const isGoogleDoc = meta.mimeType.startsWith("application/vnd.google-apps");
  const token = await googleAccessToken();
  const url = isGoogleDoc
    ? `${DRIVE}/files/${encodeURIComponent(fileId)}/export?mimeType=${encodeURIComponent(exportMime(kind))}`
    : `${DRIVE}/files/${encodeURIComponent(fileId)}?alt=media`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!res.ok) throw Object.assign(new Error(`Google export failed (${res.status})`), { status: res.status });
  const mimeType = isGoogleDoc ? exportMime(kind) : (res.headers.get("content-type") ?? "application/octet-stream");
  const buffer = await res.arrayBuffer();
  const ext = mimeType.includes("pdf") ? "pdf" : mimeType.includes("text/plain") ? "txt" : mimeType.includes("csv") ? "csv" : mimeType.includes("spreadsheet") ? "xlsx" : mimeType.includes("word") ? "docx" : "bin";
  const base = meta.name.replace(/\.[^.]+$/, "");
  return { buffer, mimeType, name: `${base}.${ext}` };
}

/** Plain-text rendering of a Google Doc, used for inline preview panels. */
export async function docText(documentId: string): Promise<{ title: string; text: string }> {
  const j = await gfetch<{ title?: string; body?: { content?: DocBlock[] } }>(`${DOCS}/${encodeURIComponent(documentId)}`);
  return { title: j.title ?? "Untitled document", text: extractDocText(j.body?.content ?? []) };
}

type DocBlock = { paragraph?: { elements?: { textRun?: { content?: string } }[] }; table?: { tableRows?: { tableCells?: { content?: DocBlock[] }[] }[] } };

function extractDocText(blocks: DocBlock[]): string {
  const out: string[] = [];
  for (const b of blocks) {
    if (b.paragraph) {
      const line = (b.paragraph.elements ?? []).map((e) => e.textRun?.content ?? "").join("");
      if (line.trim()) out.push(line.trimEnd());
    }
    if (b.table) {
      for (const row of b.table.tableRows ?? []) {
        const cells = (row.tableCells ?? []).map((c) => extractDocText(c.content ?? []).replace(/\n+/g, " ").trim());
        out.push(cells.join(" | "));
      }
    }
  }
  return out.join("\n");
}

export async function sheetValues(spreadsheetId: string, range = "A1:Z100"): Promise<{ title: string; rows: string[][] }> {
  const meta = await gfetch<{ properties?: { title?: string } }>(`${SHEETS}/${encodeURIComponent(spreadsheetId)}?fields=properties.title`);
  const j = await gfetch<{ values?: string[][] }>(`${SHEETS}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`);
  return { title: meta.properties?.title ?? "Spreadsheet", rows: j.values ?? [] };
}

export type GmailMessage = { id: string; threadId: string; snippet: string; subject: string; from: string; date: string };

export async function gmailRecent(limit = 10, query = ""): Promise<GmailMessage[]> {
  const params = new URLSearchParams({ maxResults: String(Math.min(50, limit)) });
  if (query) params.set("q", query);
  const list = await gfetch<{ messages?: { id: string; threadId: string }[] }>(`${GMAIL}/messages?${params}`);
  const out = await Promise.all(
    (list.messages ?? []).map(async (m) => {
      const full = await gfetch<{ id: string; threadId: string; snippet?: string; payload?: { headers?: { name: string; value: string }[] } }>(
        `${GMAIL}/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
      );
      const h = (n: string) => full.payload?.headers?.find((x) => x.name.toLowerCase() === n.toLowerCase())?.value ?? "";
      return { id: full.id, threadId: full.threadId, snippet: full.snippet ?? "", subject: h("Subject"), from: h("From"), date: h("Date") };
    }),
  );
  return out;
}

export async function disconnectGoogle() {
  cached = null;
  await updateSettings({ googleRefreshToken: null, googleAccountEmail: null, googleConnectedAt: null });
}

export function isViewable(mimeType: string) {
  return (
    mimeType === "application/pdf" ||
    mimeType.startsWith("text/") ||
    mimeType.startsWith("image/") ||
    mimeType.startsWith("application/vnd.google-apps.document") ||
    mimeType.startsWith("application/vnd.google-apps.spreadsheet") ||
    mimeType.startsWith("application/vnd.google-apps.presentation")
  );
}

export function fileKind(mimeType: string): "pdf" | "image" | "doc" | "sheet" | "slides" | "other" {
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.includes("spreadsheet")) return "sheet";
  if (mimeType.includes("presentation")) return "slides";
  if (mimeType.includes("document") || mimeType.startsWith("text/")) return "doc";
  return "other";
}
