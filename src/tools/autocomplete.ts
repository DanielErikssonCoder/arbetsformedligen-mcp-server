import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { buildJobSearchUrl, jobSearchFetch } from "../services/apiClient.js";
import { AutocompleteResponse } from "../types.js";

export function registerAutocompleteTool(server: McpServer): void {
  server.registerTool(
    "af_autocomplete",
    {
      title: "Search suggestions",
      description: `Fetch autocomplete suggestions for job listing searches.

Use this to find correct search terms before calling af_search_jobs.

Args:
  - q (string): Search term to complete, minimum 2 characters. Example: "nurs", "java dev"
  - contextual_q (string, optional): Existing search query that provides contextual suggestions

Returns:
  List of suggested search terms with occurrence counts.`,
      inputSchema: z.object({
        q: z.string().min(2).describe("The search term to autocomplete"),
        contextual_q: z.string().optional().describe("Existing search query for context"),
      }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      const url = buildJobSearchUrl("/complete", {
        q: params.q,
        ...(params.contextual_q ? { contextual_q: params.contextual_q } : {}),
      });

      const data = await jobSearchFetch<AutocompleteResponse>(url);
      const suggestions = data.typeahead ?? [];

      if (!suggestions.length) {
        return {
          content: [{ type: "text", text: `No suggestions for "${params.q}".` }],
        };
      }

      const lines = suggestions
        .slice(0, 20)
        .map((s) => `- ${s.value} (${s.occurrences} listings, type: ${s.type})`)
        .join("\n");

      return {
        content: [{ type: "text", text: `Suggestions for "${params.q}":\n${lines}` }],
        structuredContent: { suggestions },
      };
    }
  );
}
