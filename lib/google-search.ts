// Official-source search via Google Custom Search (JSON API). Server-side only.
// Never returns fabricated results: when not configured, mode is "demo" and results are empty.
// The API key is read at call time and is never logged or echoed back to clients.

export type OfficialSearchResult = {
  title: string;
  link: string;
  snippet: string;
  displayLink: string;
  isOfficial: boolean;
};

export type OfficialSearchResponse = {
  mode: "live" | "demo";
  results: OfficialSearchResult[];
  note: string;
};

const NOT_CONFIGURED_NOTE =
  "Google Search is not configured. Set GOOGLE_SEARCH_API_KEY and GOOGLE_SEARCH_ENGINE_ID in .env to enable live official-source search.";
const SITE_FILTER = " site:gov.in OR site:nic.in";
const UNREACHABLE_NOTE = "Google Search could not be reached. Try again later or search the official portals directly.";
const UNREADABLE_NOTE = "Google Search returned a response that could not be read. Try again later.";

function readConfig(): { key: string; cx: string } | null {
  const key = process.env.GOOGLE_SEARCH_API_KEY?.trim();
  const cx = process.env.GOOGLE_SEARCH_ENGINE_ID?.trim();
  if (!key || !cx) return null;
  return { key, cx };
}

export function isGoogleSearchConfigured(): boolean {
  return readConfig() !== null;
}

function isOfficialHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host.endsWith(".gov.in") || host.endsWith(".nic.in") || host.endsWith(".gov");
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

// Maps one Google item to our result shape. Returns null for links that are not http(s).
function mapItem(item: unknown): OfficialSearchResult | null {
  if (typeof item !== "object" || item === null) return null;
  const raw = item as Record<string, unknown>;
  const link = asString(raw.link);
  let hostname: string;
  try {
    const url = new URL(link);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    hostname = url.hostname;
  } catch {
    return null;
  }
  return {
    title: asString(raw.title),
    link,
    snippet: asString(raw.snippet),
    displayLink: asString(raw.displayLink) || hostname,
    isOfficial: isOfficialHost(hostname),
  };
}

export async function searchOfficialSchemes(query: string): Promise<OfficialSearchResponse> {
  const config = readConfig();
  if (config === null) {
    return { mode: "demo", results: [], note: NOT_CONFIGURED_NOTE };
  }

  const params = new URLSearchParams({
    key: config.key,
    cx: config.cx,
    q: `${query.trim()}${SITE_FILTER}`,
    num: "8",
  });
  const url = `https://www.googleapis.com/customsearch/v1?${params.toString()}`;

  let response: Response;
  try {
    response = await fetch(url, { cache: "no-store" });
  } catch {
    return { mode: "live", results: [], note: UNREACHABLE_NOTE };
  }

  if (!response.ok) {
    return {
      mode: "live",
      results: [],
      note: `Google Search returned an error (HTTP ${response.status}). Try again later or search the official portals directly.`,
    };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { mode: "live", results: [], note: UNREADABLE_NOTE };
  }

  const rawItems: unknown[] =
    typeof body === "object" && body !== null && "items" in body && Array.isArray(body.items) ? body.items : [];
  const results = rawItems.map(mapItem).filter((r): r is OfficialSearchResult => r !== null);

  const note =
    results.length === 0
      ? "No results were found for this search."
      : "Results come from Google Search. Items marked official are on .gov.in, .nic.in or .gov domains; still confirm details on the official portal.";

  return { mode: "live", results, note };
}
