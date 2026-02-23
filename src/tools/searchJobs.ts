import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { buildJobSearchUrl, jobSearchFetch } from "../services/apiClient.js";
import { formatJobAdSummary, formatJobAdFull } from "../services/formatters.js";
import { SearchResponse, JobAd } from "../types.js";
import { DEFAULT_LIMIT, MAX_LIMIT } from "../constants.js";

export function registerSearchJobsTool(server: McpServer): void {
  server.registerTool(
    "af_search_jobs",
    {
      title: "Search jobs",
      description: `Search for job listings in the Swedish Public Employment Service (Arbetsförmedlingen) via the JobSearch API.

Supports free-text search, occupation filters, geographic filtering, and more.

Args:
  - q (string, optional): Free-text search. Example: "nurse part-time", "python developer"
  - occupation_name (string, optional): Occupation name to filter on. Example: "Software developer"
  - occupation_group (string, optional): Occupation group ID (retrieved via af_search_taxonomy)
  - occupation_field (string, optional): Occupation field ID (retrieved via af_search_taxonomy)
  - municipality (string, optional): Municipality code or name. Example: "0180" (Stockholm)
  - region (string, optional): Region/county code. Example: "01" (Stockholm county)
  - country (string, optional): Country code. Example: "199" (Sweden)
  - employer (string, optional): Organization number or employer name
  - experience (boolean, optional): true = requires experience, false = no experience required
  - limit (number, optional): Number of results, max 100 (default: 10)
  - offset (number, optional): Skip N results for pagination
  - detail (string, optional): "summary" = short summary (default), "full" = full job listing

Returns:
  List of matching job listings with title, employer, location, occupation and link.

Examples:
  - Search "python" in Stockholm → q="python", municipality="0180"
  - Part-time nurse listings → q="nurse", experience=false`,
      inputSchema: z.object({
        q: z.string().optional().describe("Free-text search query"),
        occupation_name: z.string().optional().describe("Occupation name to filter on"),
        occupation_group: z.string().optional().describe("Occupation group ID"),
        occupation_field: z.string().optional().describe("Occupation field ID"),
        municipality: z.string().optional().describe("Municipality code, e.g. '0180' for Stockholm"),
        region: z.string().optional().describe("Region/county code, e.g. '01' for Stockholm county"),
        country: z.string().optional().describe("Country code, e.g. '199' for Sweden"),
        employer: z.string().optional().describe("Employer organization number or name"),
        experience: z.boolean().optional().describe("true = requires experience, false = no experience required"),
        limit: z.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT).describe("Number of results"),
        offset: z.number().int().min(0).default(0).describe("Pagination – skip N results"),
        detail: z.enum(["summary", "full"]).default("summary").describe("Detail level"),
      }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      const searchParams: Record<string, string | number | boolean | string[] | undefined> = {
        limit: params.limit,
        offset: params.offset,
      };

      if (params.q) searchParams["q"] = params.q;
      if (params.occupation_name) searchParams["occupation-name"] = params.occupation_name;
      if (params.occupation_group) searchParams["occupation-group"] = params.occupation_group;
      if (params.occupation_field) searchParams["occupation-field"] = params.occupation_field;
      if (params.municipality) searchParams["municipality"] = params.municipality;
      if (params.region) searchParams["region"] = params.region;
      if (params.country) searchParams["country"] = params.country;
      if (params.employer) searchParams["employer"] = params.employer;
      if (params.experience !== undefined) searchParams["experience"] = params.experience;

      const url = buildJobSearchUrl("/search", searchParams);

      const data = await jobSearchFetch<SearchResponse>(url);

      const total = data.total?.value ?? 0;
      const hits: JobAd[] = data.hits ?? [];

      if (!hits.length) {
        return {
          content: [{ type: "text", text: `No jobs found for your search.` }],
        };
      }

      const formatted = hits
        .map((ad) =>
          params.detail === "full" ? formatJobAdFull(ad) : formatJobAdSummary(ad)
        )
        .join("\n\n---\n\n");

      const header = `Found **${total}** jobs (showing ${params.offset + 1}–${params.offset + hits.length}):\n\n`;

      return {
        content: [{ type: "text", text: header + formatted }],
        structuredContent: { total, offset: params.offset, count: hits.length, hits },
      };
    }
  );
}
