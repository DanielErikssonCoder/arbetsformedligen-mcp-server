import { logger } from "../utils/logger.js";
import {
  JOBSEARCH_BASE_URL,
  JOBSTREAM_BASE_URL,
  HISTORICAL_BASE_URL,
  ENRICHMENT_BASE_URL,
  LINKS_BASE_URL,
  JOBED_BASE_URL,
  TAXONOMY_BASE_URL,
} from "../constants.js";

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public endpoint?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type Params = Record<string, string | number | boolean | string[] | undefined>;

async function fetchJson<T>(url: string, retries = 3): Promise<T> {
  const headers: Record<string, string> = { accept: "application/json" };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(url, { headers, signal: controller.signal });

    if (response.status === 429) {
      throw new ApiError("Rate limit reached – please try again shortly", 429, url);
    }

    if (response.status >= 500 && retries > 0) {
      const delay = (4 - retries) * 1000; // 1s, 2s, 3s
      logger.warn({ url, retriesLeft: retries - 1, delay }, `Retry ${4 - retries}/3 for ${url} after ${delay}ms`);
      await new Promise((res) => setTimeout(res, delay));
      return fetchJson<T>(url, retries - 1);
    }

    if (!response.ok) {
      throw new ApiError(
        `API request failed: ${response.status} ${response.statusText}`,
        response.status,
        url
      );
    }
    return response.json() as Promise<T>;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new ApiError(`Timeout after 10s for ${url}`, 0, url);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

function buildUrl(base: string, path: string, params: Params): string {
  const url = new URL(`${base}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      value.forEach((v) => url.searchParams.append(key, String(v)));
    } else {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

export const buildJobSearchUrl = (path: string, params: Params) => buildUrl(JOBSEARCH_BASE_URL, path, params);
export const buildJobStreamUrl = (path: string, params: Params) => buildUrl(JOBSTREAM_BASE_URL, path, params);
export const buildHistoricalUrl = (path: string, params: Params) => buildUrl(HISTORICAL_BASE_URL, path, params);
export const buildEnrichmentUrl = (path: string, params: Params) => buildUrl(ENRICHMENT_BASE_URL, path, params);
export const buildLinksUrl = (path: string, params: Params) => buildUrl(LINKS_BASE_URL, path, params);
export const buildJobEdUrl = (path: string, params: Params) => buildUrl(JOBED_BASE_URL, path, params);
export const buildTaxonomyUrl = (path: string, params: Params) => buildUrl(TAXONOMY_BASE_URL, path, params);

export const jobSearchFetch = <T>(url: string) => fetchJson<T>(url);
export const jobStreamFetch = <T>(url: string) => fetchJson<T>(url);
export const historicalFetch = <T>(url: string) => fetchJson<T>(url);
export const linksFetch = <T>(url: string) => fetchJson<T>(url);
export const jobEdFetch = <T>(url: string) => fetchJson<T>(url);
export const taxonomyFetch = <T>(url: string) => fetchJson<T>(url);

export async function postJson<T>(url: string, body: unknown, retries = 3): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    accept: "application/json",
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (response.status === 429) {
      throw new ApiError("Rate limit reached – please try again shortly", 429, url);
    }

    if (response.status >= 500 && retries > 0) {
      const delay = Math.pow(2, 3 - retries) * 1000;
      logger.warn({ url, retriesLeft: retries - 1, delay }, `Retry ${4 - retries}/3 for ${url} after ${delay}ms`);
      await new Promise((res) => setTimeout(res, delay));
      return postJson<T>(url, body, retries - 1);
    }

    if (!response.ok) {
      throw new ApiError(
        `POST API request failed: ${response.status} ${response.statusText}`,
        response.status,
        url
      );
    }
    return response.json() as Promise<T>;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new ApiError(`Timeout after 10s for ${url}`, 0, url);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export const jobEdPost = <T>(url: string, body: unknown) => postJson<T>(url, body);
export const enrichmentPost = <T>(url: string, body: unknown) => postJson<T>(url, body);
