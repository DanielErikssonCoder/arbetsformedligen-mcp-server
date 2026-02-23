import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { buildTaxonomyUrl, taxonomyFetch } from "../services/apiClient.js";
import { TaxonomyConcept, TaxonomyApiResponse } from "../types.js";
import { CHARACTER_LIMIT } from "../constants.js";

interface ConceptDetail extends TaxonomyConcept {
  broader?: TaxonomyConcept[];
  narrower?: TaxonomyConcept[];
  related?: TaxonomyConcept[];
  ssyk_code_2012?: string;
  sun_code?: string;
}

export function registerTaxonomyExtendedTools(server: McpServer): void {
  // Tool: Get concept details
  server.registerTool(
    "af_get_taxonomy_concept",
    {
      title: "Get taxonomy concept with relations",
      description: `Fetch detailed information about a taxonomy concept including its hierarchical relations.

Shows parent (broader), child (narrower) and related concepts.
Useful for navigating the occupation hierarchy (occupation-field → occupation-group → occupation-name).

Args:
  - concept_id (string): The concept ID from af_search_taxonomy

Returns:
  Detailed info about the concept including SSYK code and relations to other concepts.`,
      inputSchema: z.object({
        concept_id: z.string().min(1).describe("The concept ID"),
      }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const getConceptUrl = buildTaxonomyUrl("/v1/taxonomy/main/concepts", { id: params.concept_id, "include-deprecated": "true" });
      const getBroaderUrl = buildTaxonomyUrl("/v1/taxonomy/main/concepts", { "related-ids": params.concept_id, relation: "broader", "include-deprecated": "true" });
      const getNarrowerUrl = buildTaxonomyUrl("/v1/taxonomy/main/concepts", { "related-ids": params.concept_id, relation: "narrower", "include-deprecated": "true" });
      const getRelatedUrl = buildTaxonomyUrl("/v1/taxonomy/main/concepts", { "related-ids": params.concept_id, relation: "related", "include-deprecated": "true" });

      try {
        const [conceptRes, broaderRes, narrowerRes, relatedRes] = await Promise.all([
          taxonomyFetch<TaxonomyApiResponse[]>(getConceptUrl),
          taxonomyFetch<TaxonomyApiResponse[]>(getBroaderUrl),
          taxonomyFetch<TaxonomyApiResponse[]>(getNarrowerUrl),
          taxonomyFetch<TaxonomyApiResponse[]>(getRelatedUrl),
        ]);

        if (!conceptRes || conceptRes.length === 0) {
          return { content: [{ type: "text", text: `Taxonomy concept with ID "${params.concept_id}" not found.` }] };
        }

        const mapItem = (item: TaxonomyApiResponse): TaxonomyConcept => ({
          conceptId: item["taxonomy/id"],
          type: item["taxonomy/type"],
          preferredLabel: item["taxonomy/preferred-label"],
          deprecated: item["taxonomy/deprecated"],
          definition: item["taxonomy/definition"]
        });

        const baseConcept = mapItem(conceptRes[0]);
        const concept: ConceptDetail = {
          ...baseConcept,
          broader: broaderRes.map(mapItem),
          narrower: narrowerRes.map(mapItem),
          related: relatedRes.map(mapItem),
        };

        const lines = [
          `## ${concept.preferredLabel}`,
          `**ID:** \`${concept.conceptId}\``,
          `**Type:** ${concept.type ?? "unknown"}`,
        ];

        if (concept.deprecated) lines.push(`⚠️ **Deprecated concept**`);
        if (concept.definition) lines.push(`\n**Definition:** ${concept.definition}`);

        if (concept.broader?.length) {
          lines.push(`\n**Parent (broader):**`);
          concept.broader.forEach((b) => lines.push(`  - ${b.preferredLabel} (\`${b.conceptId}\`)`));
        }
        if (concept.narrower?.length) {
          lines.push(`\n**Children (narrower) (${concept.narrower.length}):**`);
          concept.narrower.slice(0, 20).forEach((n) => lines.push(`  - ${n.preferredLabel} (\`${n.conceptId}\`)`));
          if (concept.narrower.length > 20) lines.push(`  ...and ${concept.narrower.length - 20} more`);
        }
        if (concept.related?.length) {
          lines.push(`\n**Related:**`);
          concept.related.slice(0, 10).forEach((r) => lines.push(`  - ${r.preferredLabel} (\`${r.conceptId}\`)`));
        }

        return {
          content: [{ type: "text", text: lines.join("\n").slice(0, CHARACTER_LIMIT) }],
          structuredContent: { concept },
        };
      } catch (err: unknown) {
        if (err && typeof err === 'object' && 'statusCode' in err && (err as { statusCode: number }).statusCode === 404) {
          return { content: [{ type: "text", text: `Taxonomy concept with ID "${params.concept_id}" not found.` }] };
        }
        if (err instanceof Error) {
          return { content: [{ type: "text", text: `An error occurred: ${err.message}` }], isError: true };
        }
        throw err;
      }
    }
  );

  // Tool: List all concepts of a type
  server.registerTool(
    "af_list_taxonomy_types",
    {
      title: "List all taxonomy concepts of a type",
      description: `List all concepts of a specific type in the taxonomy, e.g. all occupation fields or all regions.

Args:
  - type (string): Type to list. Common types:
    "occupation-field" (occupation fields, ~10 entries),
    "occupation-group" (occupation groups, ~100 entries),
    "region" (Swedish regions/counties),
    "country" (countries),
    "employment-type" (employment types),
    "driving-licence" (driving licence categories),
    "language" (languages)
  - include_deprecated (boolean, optional): Include deprecated concepts (default: false)

Returns:
  Complete list of all concepts of the given type.`,
      inputSchema: z.object({
        type: z.string().min(1).describe("Taxonomy type to list"),
        include_deprecated: z.boolean().default(false),
      }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const url = buildTaxonomyUrl("/v1/taxonomy/main/concepts", {
        type: params.type,
        "include-deprecated": params.include_deprecated ? "true" : "false",
        limit: 500,
      });
      let response: TaxonomyApiResponse[];
      try {
        response = await taxonomyFetch<TaxonomyApiResponse[]>(url);
      } catch (err: any) {
        if (err.statusCode === 404) return { content: [{ type: "text", text: `No taxonomy concepts of type "${params.type}" found.` }] };
        throw err;
      }

      const concepts: TaxonomyConcept[] = response.map(item => ({
        conceptId: item["taxonomy/id"],
        type: item["taxonomy/type"],
        preferredLabel: item["taxonomy/preferred-label"],
        deprecated: item["taxonomy/deprecated"],
        definition: item["taxonomy/definition"]
      }));

      if (!Array.isArray(concepts) || concepts.length === 0) {
        return { content: [{ type: "text", text: `No concepts found for type "${params.type}".` }] };
      }

      const active = params.include_deprecated ? concepts : concepts.filter((c) => !c.deprecated);
      const lines = active.map((c) => `- **${c.preferredLabel}** — \`${c.conceptId}\``);

      const header = `**${active.length}** concepts of type "${params.type}":\n\n`;
      return {
        content: [{ type: "text", text: (header + lines.join("\n")).slice(0, CHARACTER_LIMIT) }],
        structuredContent: { type: params.type, count: active.length, concepts: active },
      };
    }
  );
}
