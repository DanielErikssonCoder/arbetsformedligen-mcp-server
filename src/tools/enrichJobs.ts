import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { buildEnrichmentUrl, enrichmentPost, taxonomyFetch } from "../services/apiClient.js";
import { CHARACTER_LIMIT } from "../constants.js";

interface EnrichmentTerm {
  concept_label: string;
  term: string;
  prediction?: number;
}

interface EnrichedCandidates {
  occupations?: EnrichmentTerm[];
  competencies?: EnrichmentTerm[];
  traits?: EnrichmentTerm[];
  geos?: EnrichmentTerm[];
}

interface EnrichDocsResponse {
  doc_id?: string;
  enriched_candidates?: EnrichedCandidates;
}

interface SynonymEntry {
  concept: string;
  term: string;
  type: string;
}

export function registerEnrichJobsTool(server: McpServer): void {
  // Tool 1: Enrich ad text (all terms + probabilities)
  server.registerTool(
    "af_enrich_job_text",
    {
      title: "Enrich job listing text",
      description: `Analyse a job listing text with AI and extract relevant labour market terms.

Returns identified occupations, competencies, personal traits and geographies,
each with a probability score (0.0–1.0) indicating how likely the term is *requested* by the employer.
Closer to 1.0 = explicitly requested. Closer to 0.0 = mentioned but not required.

Args:
  - text (string): The job listing text to analyse (headline + description)
  - only_requested (boolean, optional): If true, only return terms above the classification threshold (default: false)

Returns:
  Identified occupations, competencies, traits and locations with probability scores.`,
      inputSchema: z.object({
        text: z.string().min(10).max(10000).describe("The job listing to analyse (max 10,000 characters)"),
        only_requested: z.boolean().default(false).describe("Return only terms classified as requested"),
      }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params) => {
      const endpoint = params.only_requested ? "/enrichtextdocumentsbinary" : "/enrichtextdocuments";
      const url = buildEnrichmentUrl(endpoint, {});

      const data = await enrichmentPost<EnrichDocsResponse | EnrichDocsResponse[]>(
        url,
        { documents_input: [{ doc_id: "1", doc_text: params.text }] }
      );

      const resultArr = Array.isArray(data) ? data : [data];
      const docData = resultArr[0] || {};
      const candidates = docData.enriched_candidates || {};

      const lines: string[] = ["## Enrichment results\n"];

      const formatTerms = (label: string, terms?: EnrichmentTerm[]) => {
        if (!terms?.length) return;
        lines.push(`### ${label}`);
        terms.forEach((t) => {
          const pred = t.prediction !== undefined ? ` (probability: ${t.prediction.toFixed(2)})` : "";
          lines.push(`- **${t.concept_label || t.term}**${pred} — Extracted as: \`${t.term}\``);
        });
        lines.push("");
      };

      formatTerms("Occupations", candidates.occupations);
      formatTerms("Competencies", candidates.competencies);
      formatTerms("Personal traits", candidates.traits);
      formatTerms("Geographies", candidates.geos);

      const text = lines.join("\n");
      return {
        content: [{ type: "text", text: text.slice(0, CHARACTER_LIMIT) }],
        structuredContent: { results: data } as any,
      } as any;
    }
  );

  // Tool 2: Synonym dictionary
  server.registerTool(
    "af_synonym_dictionary",
    {
      title: "Synonym dictionary for labour market terms",
      description: `Fetch synonyms for labour market terms from the JobAd Enrichments synonym dictionary.

Useful for understanding how different spellings, plural/singular forms and synonyms
are mapped to a common search concept in the job listing database.

Args:
  - q (string, optional): Filter by term or synonym. Leave empty for all.
  - concept_type (string, optional): Filter by type, e.g. "OCCUPATION", "COMPETENCE"
  - limit (number, optional): Number of results (default: 20)

Returns:
  List of terms with their synonyms.`,
      inputSchema: z.object({
        q: z.string().optional().describe("Search for a specific term or synonym"),
        concept_type: z.enum(["COMPETENCE", "OCCUPATION", "TRAIT", "GEO"]).default("OCCUPATION").describe("Type, e.g. 'OCCUPATION', 'COMPETENCE'"),
        limit: z.number().int().min(1).max(100).default(20),
      }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const url = buildEnrichmentUrl("/synonymdictionary", { type: params.concept_type, spelling: "BOTH" });
      const data = await taxonomyFetch<{ items?: SynonymEntry[] }>(url);

      let entries = data.items ?? [];

      if (params.q) {
        const qLowerCase = params.q.toLowerCase();
        entries = entries.filter((e) => e.term.toLowerCase().includes(qLowerCase) || e.concept.toLowerCase().includes(qLowerCase));
      }

      if (!entries.length) {
        return { content: [{ type: "text", text: "No synonyms found." }] };
      }

      const lines = entries.slice(0, params.limit).map((e) =>
        `- **${e.concept}** (${e.type}): ${e.term}`
      );

      return {
        content: [{ type: "text", text: `Synonyms:\n\n${lines.join("\n")}` }],
        structuredContent: { entries },
      };
    }
  );
}
