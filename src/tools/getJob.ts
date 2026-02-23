import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { buildJobSearchUrl, jobSearchFetch } from "../services/apiClient.js";
import { formatJobAdFull } from "../services/formatters.js";
import { JobAd } from "../types.js";

export function registerGetJobTool(server: McpServer): void {
  server.registerTool(
    "af_get_job",
    {
      title: "Get job listing",
      description: `Fetch a full job listing from Arbetsförmedlingen by its listing ID.

Listing IDs are found via af_search_jobs.

Args:
  - id (string): The job listing ID

Returns:
  Full job listing with description, requirements, contact details and application link.`,
      inputSchema: z.object({
        id: z.string().min(1).describe("The job listing ID"),
      }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const url = buildJobSearchUrl(`/ad/${params.id}`, {});
      const ad = await jobSearchFetch<JobAd>(url);
      return {
        content: [{ type: "text", text: formatJobAdFull(ad) }],
        structuredContent: ad as any,
      } as any;
    }
  );
}
