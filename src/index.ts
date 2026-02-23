#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { logger } from "./utils/logger.js";

// JobSearch
import { registerSearchJobsTool } from "./tools/searchJobs.js";
import { registerGetJobTool } from "./tools/getJob.js";
import { registerAutocompleteTool } from "./tools/autocomplete.js";
// JobStream
import { registerJobStreamTool } from "./tools/jobStream.js";
// Historical
import { registerHistoricalJobsTool } from "./tools/historicalJobs.js";
// Enrichments
import { registerEnrichJobsTool } from "./tools/enrichJobs.js";
// Links
import { registerJobLinksTool } from "./tools/jobLinks.js";
// JobEd Connect
import { registerJobEdConnectTools } from "./tools/jobEdConnect.js";
// Taxonomy
import { registerSearchTaxonomyTool } from "./tools/searchTaxonomy.js";
import { registerTaxonomyExtendedTools } from "./tools/taxonomyExtended.js";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "arbetsformedlingen-mcp-server",
    version: "2.0.0",
  });

  // === JobSearch API ===
  registerSearchJobsTool(server);
  registerGetJobTool(server);
  registerAutocompleteTool(server);

  // === JobStream API ===
  registerJobStreamTool(server);

  // === Historical Job Ads API ===
  registerHistoricalJobsTool(server);

  // === JobAd Enrichments API ===
  registerEnrichJobsTool(server);

  // === JobAd Links API ===
  registerJobLinksTool(server);

  // === JobEd Connect API ===
  registerJobEdConnectTools(server);

  // === Taxonomy API ===
  registerSearchTaxonomyTool(server);
  registerTaxonomyExtendedTools(server);

  return server;
}

async function runStdio(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("Arbetsförmedlingen MCP server v2 starting via stdio...");
  logger.info("Tools: af_search_jobs, af_get_job, af_autocomplete, af_stream_jobs,");
  logger.info("       af_search_historical_jobs, af_enrich_job_text, af_synonym_dictionary,");
  logger.info("       af_search_job_links, af_education_to_occupations, af_occupation_to_educations,");
  logger.info("       af_search_taxonomy, af_get_taxonomy_concept, af_list_taxonomy_types");
}

async function runHTTP(): Promise<void> {
  const app = express();
  app.use(express.json());

  app.post("/mcp", async (req, res) => {
    const server = createServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => transport.close());
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      server: "arbetsformedlingen-mcp-server",
      version: "2.0.0",
      tools: [
        "af_search_jobs", "af_get_job", "af_autocomplete",
        "af_stream_jobs",
        "af_search_historical_jobs",
        "af_enrich_job_text", "af_synonym_dictionary",
        "af_search_job_links",
        "af_education_to_occupations", "af_occupation_to_educations",
        "af_search_taxonomy", "af_get_taxonomy_concept", "af_list_taxonomy_types",
      ],
    });
  });

  const port = parseInt(process.env.PORT ?? "3000");
  app.listen(port, () => {
    logger.info(`Arbetsförmedlingen MCP server v2 running on http://localhost:${port}/mcp`);
  });
}

const transport = process.env.TRANSPORT ?? "stdio";

if (transport === "http") {
  runHTTP().catch((error: unknown) => {
    logger.error({ err: error }, "Server error in HTTP mode");
    process.exit(1);
  });
} else {
  runStdio().catch((error: unknown) => {
    logger.error({ err: error }, "Server error in stdio mode");
    process.exit(1);
  });
}
