import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { buildJobStreamUrl, jobStreamFetch } from "../services/apiClient.js";
import { CHARACTER_LIMIT } from "../constants.js";

// Verified against JobStream Swagger v2.1.1
// Active endpoint: GET /v2/stream?updated-after=<ISO>&updated-before=<ISO>
// The deprecated /stream endpoint used param "date"; v2 uses "updated-after"

interface StreamEvent {
  id: string;
  removed?: boolean;
  removed_date?: string;
  occupation?: string;
  occupation_group?: string;
  occupation_field?: string;
  municipality?: string;
  region?: string;
  country?: string;
  // Full ad fields present if not removed
  headline?: string;
  employer?: { name?: string };
  publication_date?: string;
  last_publication_date?: string;
}

interface StreamResponse {
  events: StreamEvent[];
}

export function registerJobStreamTool(server: McpServer): void {
  server.registerTool(
    "af_stream_jobs",
    {
      title: "Fetch job events from stream (JobStream v2)",
      description: `Fetch real-time events (new, updated, and removed job listings) from the JobStream v2 API.

Ideal for keeping a local database in sync with the Swedish labour market.
Events contain full listing data for new/updated ads, and ID-only for removed ads.

Args:
  - date (string): Fetch all events since this datetime (ISO 8601: "YYYY-MM-DDTHH:MM:SS").
    Example: "2024-06-01T00:00:00". Note: large time ranges can return large volumes.
  - date_before (string, optional): Only fetch events before this datetime (ISO 8601). Defaults to now.
  - occupation_concept_id (string[], optional): Filter by occupation concept IDs from the taxonomy.
  - location_concept_id (string[], optional): Filter by location concept IDs from the taxonomy.

Returns:
  List of events since the given date. Removed listings are marked with removed=true.`,
      inputSchema: z.object({
        date: z.string()
          .describe("Start datetime (ISO 8601 e.g. '2024-06-01T00:00:00'). Fetches events since this point."),
        date_before: z.string().optional()
          .describe("End datetime (ISO 8601). Defaults to now."),
        occupation_concept_id: z.array(z.string()).optional()
          .describe("Filter by occupation concept IDs from af_search_taxonomy"),
        location_concept_id: z.array(z.string()).optional()
          .describe("Filter by location concept IDs from af_search_taxonomy"),
      }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      // v2 endpoint uses "updated-after" and "updated-before"
      const url = buildJobStreamUrl("/v2/stream", {
        "updated-after": params.date,
        ...(params.date_before ? { "updated-before": params.date_before } : {}),
        ...(params.occupation_concept_id?.length
          ? { "occupation-concept-id": params.occupation_concept_id }
          : {}),
        ...(params.location_concept_id?.length
          ? { "location-concept-id": params.location_concept_id }
          : {}),
      });

      const data = await jobStreamFetch<StreamResponse>(url);
      // API can return { events: [] } or a direct array
      const events: StreamEvent[] = Array.isArray(data)
        ? (data as StreamEvent[])
        : ((data as StreamResponse).events ?? []);

      if (!Array.isArray(events) || events.length === 0) {
        return {
          content: [{ type: "text", text: `No events found since ${params.date}.` }],
        };
      }

      const removed = events.filter((e) => e.removed);
      const active = events.filter((e) => !e.removed);

      const lines = [
        `**${events.length} events** since ${params.date}`,
        `New/updated: ${active.length} | Removed: ${removed.length}`,
        "",
      ];

      if (active.length > 0) {
        lines.push("### New/updated listings");
        active.slice(0, 20).forEach((e) => {
          lines.push(`- [${e.id}] ${e.headline ?? "(no title)"} — ${e.employer?.name ?? ""}`);
        });
        if (active.length > 20) lines.push(`  ...and ${active.length - 20} more`);
      }

      if (removed.length > 0) {
        lines.push("\n### Removed listings");
        removed.slice(0, 20).forEach((e) => {
          lines.push(`- [${e.id}] removed ${e.removed_date ?? ""}`);
        });
        if (removed.length > 20) lines.push(`  ...and ${removed.length - 20} more`);
      }

      const text = lines.join("\n");
      return {
        content: [{ type: "text", text: text.slice(0, CHARACTER_LIMIT) }],
        structuredContent: {
          total: events.length,
          new_or_updated: active.length,
          removed: removed.length,
          events: events.slice(0, 100),
        },
      };
    }
  );
}
