import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { buildTaxonomyUrl, taxonomyFetch } from "../services/apiClient.js";
import { TaxonomyConcept, TaxonomyApiResponse } from "../types.js";
import { CHARACTER_LIMIT } from "../constants.js";

export function registerSearchTaxonomyTool(server: McpServer): void {
  server.registerTool(
    "af_search_taxonomy",
    {
      title: "Search the JobTech Taxonomy",
      description: `Search all concepts (occupations, competencies, languages, driving licences, etc.) in the official taxonomy for the Swedish labour market.

Essential for finding the exact terms, concept_ids and types used when searching for job listings.
For example, if a user asks for "programmer" you can search here and find the correct system term "Software developer".

You can filter on a specific type (e.g. "occupation-name", "skill", "language").

Once you have the ID of a concept, use af_get_taxonomy_concept to see how it relates to other concepts.

Common types:
- occupation-name (occupation title, e.g. Nurse)
- skill (competency/skill, e.g. Python)
- occupation-field (occupation field, e.g. IT)
- occupation-group (occupation group, broader category)
- language (language, e.g. Swedish)
- driving-licence (driving licence category, e.g. B)

Args:
  - q (string): Search query (e.g. "nurse" or "software developer").
  - type (string, optional): Restrict to a specific type (e.g. "occupation-name" or "skill").
  - limit (number, optional): Max number of results to return (default 20, max 100).

Returns:
  A list of matching concepts with their ID, preferred label and type.`,
      inputSchema: z.object({
        q: z.string().min(1).max(100).describe("Search query (e.g. 'nurse' or 'software developer')"),
        type: z.string().optional().describe("Filter by concept type (e.g. 'occupation-name' or 'skill')"),
        limit: z.number().int().min(1).max(100).default(20).describe("Max number of results to return (default 20)")
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: { q: string; type?: string; limit: number }) => {
      const searchParams: Record<string, string | number | boolean | undefined> = {
        "query-string": params.q,
        limit: params.limit,
      };

      if (params.type) {
        searchParams["type"] = params.type;
      }

      const url = buildTaxonomyUrl("/v1/taxonomy/suggesters/autocomplete", searchParams);
      let data: TaxonomyApiResponse[] = [];
      try {
        data = await taxonomyFetch<TaxonomyApiResponse[]>(url);
      } catch (err: unknown) {
        if (err instanceof Error) {
          return {
            content: [{ type: "text", text: `An error occurred: ${err.message}` }],
            isError: true,
          };
        }
        return {
          content: [{ type: "text", text: `An unknown error occurred.` }],
          isError: true,
        };
      }

      if (!Array.isArray(data) || data.length === 0) {
        return {
          content: [{ type: "text", text: `No taxonomy concepts found for "${params.q}".` }],
        };
      }

      const concepts: TaxonomyConcept[] = data.map((item) => ({
        conceptId: item["taxonomy/id"],
        type: item["taxonomy/type"],
        preferredLabel: item["taxonomy/preferred-label"],
        deprecated: item["taxonomy/deprecated"],
        definition: item["taxonomy/definition"]
      }));

      const lines = [
        `Found **${concepts.length}** concepts for "${params.q}":\n`
      ];

      concepts.forEach((concept) => {
        let text = `- **${concept.preferredLabel}** (id: \`${concept.conceptId}\`, type: \`${concept.type}\`)`;
        if (concept.deprecated) {
          text += ` *(DEPRECATED)*`;
        }
        lines.push(text);
      });

      const fullText = lines.join("\n");
      const truncatedText = fullText.slice(0, CHARACTER_LIMIT);

      return {
        content: [{ type: "text", text: truncatedText }],
        structuredContent: {
          query: params.q,
          count: concepts.length,
          concepts: concepts
        },
      };
    }
  );
}
