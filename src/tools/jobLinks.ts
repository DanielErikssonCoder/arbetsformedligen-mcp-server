import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { buildLinksUrl, linksFetch } from "../services/apiClient.js";
import { DEFAULT_LIMIT, MAX_LIMIT, CHARACTER_LIMIT } from "../constants.js";

interface JobLink {
  id?: string;
  headline?: string;
  url?: string;
  employer?: { name?: string };
  occupation?: { label?: string };
  workplace_address?: {
    municipality?: string;
    region?: string;
    city?: string;
  };
  application_deadline?: string;
  publication_date?: string;
  source?: string;
}

interface LinksResponse {
  total?: { value: number };
  hits?: JobLink[];
}

export function registerJobLinksTool(server: McpServer): void {
  server.registerTool(
    "af_search_job_links",
    {
      title: "Search jobs from the full market (JobAd Links)",
      description: `Search job listings from the entire Swedish labour market via the JobAd Links API.
Includes listings from private job sites in addition to the Public Employment Service.

Args:
  - q (string, optional): Free-text search
  - occupation_name (string, optional): Occupation name
  - occupation_group (string, optional): Occupation group ID
  - occupation_field (string, optional): Occupation field ID
  - municipality (string, optional): Municipality code
  - region (string, optional): Region/county code
  - country (string, optional): Country code (default: Sweden)
  - limit (number, optional): Number of results (default: 10, max: 100)
  - offset (number, optional): Pagination offset

Returns:
  List of job listings with source and link to the original posting.`,
      inputSchema: z.object({
        q: z.string().optional(),
        occupation_name: z.string().optional(),
        occupation_group: z.string().optional(),
        occupation_field: z.string().optional(),
        municipality: z.string().optional(),
        region: z.string().optional(),
        country: z.string().optional(),
        limit: z.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
        offset: z.number().int().min(0).default(0),
      }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      const searchParams: Record<string, string | number | undefined> = {
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

      const url = buildLinksUrl("/joblinks", searchParams);
      const data = await linksFetch<LinksResponse>(url);

      const total = data.total?.value ?? 0;
      const hits = data.hits ?? (data as unknown as JobLink[]);

      if (!Array.isArray(hits) || hits.length === 0) {
        return { content: [{ type: "text", text: "No listings found." }] };
      }

      const lines = hits.map((ad) => {
        const parts = [
          `**${ad.headline ?? "No title"}**`,
          ad.employer?.name ? `Employer: ${ad.employer.name}` : null,
          ad.occupation?.label ? `Occupation: ${ad.occupation.label}` : null,
          (ad.workplace_address?.city || ad.workplace_address?.municipality)
            ? `Location: ${ad.workplace_address?.city ?? ad.workplace_address?.municipality}` : null,
          ad.application_deadline ? `Apply by: ${ad.application_deadline.split("T")[0]}` : null,
          ad.source ? `Source: ${ad.source}` : null,
          ad.url ? `Link: ${ad.url}` : null,
        ].filter(Boolean);
        return parts.join(" | ");
      });

      const header = `**${total}** listings (showing ${params.offset + 1}–${params.offset + hits.length}):\n\n`;
      const text = header + lines.join("\n\n");

      return {
        content: [{ type: "text", text: text.slice(0, CHARACTER_LIMIT) }],
        structuredContent: { total, count: hits.length, hits },
      };
    }
  );
}
