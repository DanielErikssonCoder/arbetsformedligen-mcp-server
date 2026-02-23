import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { buildJobEdUrl, jobEdPost } from "../services/apiClient.js";
import { CHARACTER_LIMIT } from "../constants.js";

// Swagger defines no explicit response schema, so we use permissive types
// and handle both array and wrapped-object response shapes defensively.
type AnyRecord = Record<string, unknown>;

function toArray(data: unknown): AnyRecord[] {
  if (Array.isArray(data)) return data as AnyRecord[];
  if (data && typeof data === "object") {
    // Check common wrapping keys the API might return
    const obj = data as Record<string, unknown>;
    for (const key of ["occupations", "educations", "items", "hits", "result", "results"]) {
      if (Array.isArray(obj[key])) return obj[key] as AnyRecord[];
    }
  }
  return [];
}

function str(v: unknown): string {
  return typeof v === "string" ? v : String(v ?? "");
}

export function registerJobEdConnectTools(server: McpServer): void {
  // Tool 1: Education → Occupations
  // Verified: POST /v1/occupations/match-by-education?education_id=<id>&limit=<n>
  // All params are query params on the URL (empty body). Response schema not defined by API.
  server.registerTool(
    "af_education_to_occupations",
    {
      title: "Find occupations from education (JobEd Connect)",
      description: `Find which occupations a given education leads to via the JobEd Connect API.

The matching is based on learning objectives in education descriptions and the competencies
that employers request in job listings.

Args:
  - education_id (string): The internal Susa-Navet education ID (e.g. "i.sv.ft001").
    Use af_search_taxonomy or search /v1/educations to discover valid IDs.
  - limit (number, optional): Max number of occupation matches to return (default: 10, max: 50)

Returns:
  List of matched occupations with scores (where available).`,
      inputSchema: z.object({
        education_id: z.string().min(1).describe(
          "Susa-Navet education ID (e.g. \"i.sv.ft001\"). Use /v1/educations search to find valid IDs."
        ),
        limit: z.number().int().min(1).max(50).default(10),
      }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      // Params go as query params; body is empty
      const url = buildJobEdUrl("/v1/occupations/match-by-education", {
        education_id: params.education_id,
        limit: params.limit,
      });

      let raw: unknown;
      try {
        raw = await jobEdPost<unknown>(url, {});
      } catch (err: unknown) {
        const e = err as { statusCode?: number; message?: string };
        if (e.statusCode === 404) {
          return {
            content: [{
              type: "text",
              text: `No occupation matches found for education ID "${params.education_id}". ` +
                `Verify the ID via the /v1/educations endpoint.`,
            }],
          };
        }
        throw err;
      }

      const occupations = toArray(raw);

      if (!occupations.length) {
        return {
          content: [{
            type: "text",
            text: `No occupation matches found for education ID "${params.education_id}".`,
          }],
        };
      }

      const lines = occupations.map((o, i) => {
        const label = str(o.occupation_label ?? o.label ?? o.name ?? o.occupation_id ?? o.id ?? "Unknown");
        const score = typeof o.score === "number"
          ? ` (match: ${(o.score * 100).toFixed(0)}%)`
          : typeof o.prediction === "number"
            ? ` (score: ${o.prediction.toFixed(2)})`
            : "";
        const ssyk = o.ssyk_code ? ` [SSYK: ${str(o.ssyk_code)}]` : "";
        const conceptId = o.concept_id ? ` [ID: ${str(o.concept_id)}]` : (o.occupation_id ? ` [ID: ${str(o.occupation_id)}]` : "");
        return `${i + 1}. **${label}**${score}${ssyk}${conceptId}`;
      });

      const text = `Occupations for education \`${params.education_id}\`:\n\n${lines.join("\n")}`;
      return {
        content: [{ type: "text", text: text.slice(0, CHARACTER_LIMIT) }],
        structuredContent: { count: occupations.length, occupations: raw },
      };
    }
  );

  // Tool 2: Occupation → Educations
  // Verified: POST /v1/educations/match-by-occupation?occupation_id=<id>&limit=<n>
  // All params are query params on the URL (empty body). Response schema not defined by API.
  server.registerTool(
    "af_occupation_to_educations",
    {
      title: "Find educations from occupation (JobEd Connect)",
      description: `Find which educations best match an occupation via the JobEd Connect API.

Args:
  - occupation_id (string): Taxonomy concept ID for the occupation (e.g. "i46j_HmG_v64").
    Use af_search_taxonomy with type "occupation-name" to find valid concept IDs.
  - limit (number, optional): Max number of education matches (default: 10, max: 50)

Returns:
  List of matched educations with scores and education codes (where available).`,
      inputSchema: z.object({
        occupation_id: z.string().min(1).describe(
          "Taxonomy concept ID for the occupation (e.g. \"i46j_HmG_v64\"). Use af_search_taxonomy to find it."
        ),
        limit: z.number().int().min(1).max(50).default(10),
      }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      // Params go as query params; body is empty
      const url = buildJobEdUrl("/v1/educations/match-by-occupation", {
        occupation_id: params.occupation_id,
        limit: params.limit,
      });

      let raw: unknown;
      try {
        raw = await jobEdPost<unknown>(url, {});
      } catch (err: unknown) {
        const e = err as { statusCode?: number; message?: string };
        if (e.statusCode === 404) {
          return {
            content: [{
              type: "text",
              text: `No education matches found for occupation ID "${params.occupation_id}". ` +
                `Find valid concept IDs with af_search_taxonomy (type: "occupation-name").`,
            }],
          };
        }
        throw err;
      }

      const educations = toArray(raw);

      if (!educations.length) {
        return {
          content: [{
            type: "text",
            text: `No education matches found for occupation ID "${params.occupation_id}".`,
          }],
        };
      }

      const lines = educations.map((e, i) => {
        const label = str(e.education_label ?? e.label ?? e.name ?? e.education_id ?? e.id ?? "Unknown");
        const score = typeof e.score === "number"
          ? ` (match: ${(e.score * 100).toFixed(0)}%)`
          : typeof e.prediction === "number"
            ? ` (score: ${e.prediction.toFixed(2)})`
            : "";
        const code = e.education_code ? ` [code: ${str(e.education_code)}]` : (e.sun_code ? ` [SUN: ${str(e.sun_code)}]` : "");
        const form = e.education_form ? ` — ${str(e.education_form)}` : (e.level ? ` — ${str(e.level)}` : "");
        return `${i + 1}. **${label}**${score}${code}${form}`;
      });

      const text = `Educations for occupation \`${params.occupation_id}\`:\n\n${lines.join("\n")}`;
      return {
        content: [{ type: "text", text: text.slice(0, CHARACTER_LIMIT) }],
        structuredContent: { count: educations.length, educations: raw },
      };
    }
  );
}
