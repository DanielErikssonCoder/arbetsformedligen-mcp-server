import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { buildHistoricalUrl, historicalFetch } from "../services/apiClient.js";
import { SearchResponse } from "../types.js";
import { formatJobAdSummary, formatJobAdFull } from "../services/formatters.js";
import { DEFAULT_LIMIT, MAX_LIMIT } from "../constants.js";

export function registerHistoricalJobsTool(server: McpServer): void {
  server.registerTool(
    "af_search_historical_jobs",
    {
      title: "Search historical job listings",
      description: `Search among archived (historical) job listings from 2006 onwards via the Historical Job Ads API.

Same search parameters as af_search_jobs but targeting archived/closed listings.
Excellent for labour market analysis, trend analysis and research.

Args:
  - q (string, optional): Free-text search
  - occupation_name (string, optional): Occupation name
  - occupation_group (string, optional): Occupation group ID
  - occupation_field (string, optional): Occupation field ID
  - municipality (string, optional): Municipality code
  - region (string, optional): Region/county code
  - employer (string, optional): Organization number
  - published_after (string, optional): ISO 8601 date, e.g. "2023-01-01"
  - published_before (string, optional): ISO 8601 date, e.g. "2023-12-31"
  - limit (number, optional): Number of results (default: 10, max: 100)
  - offset (number, optional): Pagination offset
  - detail (string, optional): "summary" or "full"

Returns:
  List of historical job listings with metadata.`,
      inputSchema: z.object({
        q: z.string().optional().describe("Free-text search"),
        occupation_name: z.string().optional(),
        occupation_group: z.string().optional(),
        occupation_field: z.string().optional(),
        municipality: z.string().optional(),
        region: z.string().optional(),
        employer: z.string().optional(),
        published_after: z.string().optional().describe("ISO 8601 date, e.g. '2023-01-01'"),
        published_before: z.string().optional().describe("ISO 8601 date, e.g. '2023-12-31'"),
        limit: z.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
        offset: z.number().int().min(0).default(0),
        detail: z.enum(["summary", "full"]).default("summary"),
      }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      const searchParams: Record<string, string | number | boolean | undefined> = {
        limit: params.limit,
        offset: params.offset,
      };
      if (params.q) searchParams["q"] = params.q;
      if (params.occupation_name) searchParams["occupation-name"] = params.occupation_name;
      if (params.occupation_group) searchParams["occupation-group"] = params.occupation_group;
      if (params.occupation_field) searchParams["occupation-field"] = params.occupation_field;
      if (params.municipality) searchParams["municipality"] = params.municipality;
      if (params.region) searchParams["region"] = params.region;
      if (params.employer) searchParams["employer"] = params.employer;
      if (params.published_after) searchParams["published-after"] = params.published_after;
      if (params.published_before) searchParams["published-before"] = params.published_before;

      const url = buildHistoricalUrl("/search", searchParams);
      const data = await historicalFetch<SearchResponse>(url);

      const total = data.total?.value ?? 0;
      const hits = data.hits ?? [];

      if (!hits.length) {
        return { content: [{ type: "text", text: "No historical listings found." }] };
      }

      const formatted = hits
        .map((ad) => params.detail === "full" ? formatJobAdFull(ad) : formatJobAdSummary(ad))
        .join("\n\n---\n\n");

      const header = `**${total}** historical listings (showing ${params.offset + 1}–${params.offset + hits.length}):\n\n`;

      return {
        content: [{ type: "text", text: header + formatted }],
        structuredContent: { total, offset: params.offset, count: hits.length, hits },
      };
    }
  );
}
