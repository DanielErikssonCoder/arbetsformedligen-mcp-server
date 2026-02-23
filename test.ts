import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function runTests() {
    const transport = new StdioClientTransport({
        command: "npx",
        args: ["tsx", "src/index.ts"],
        env: process.env as any,
    });

    const client = new Client({ name: "test-client", version: "1.0.0" }, { capabilities: {} });
    await client.connect(transport);

    console.log("Connected to MCP server");

    // Helper type because client.request might need a Zod schema in newer versions, 
    // but if we call tools, client.callTool is a wrapper!
    // Let's use callTool
    async function testWithCallTool(name: string, args: Record<string, any>) {
        console.log(`\n--- Testing ${name} ---`);
        try {
            const result = await client.callTool({ name, arguments: args });
            console.log(`SUCCESS: ${name}`);
            const content = (result.content as Array<{ type: string; text?: string }>)?.[0];
            if (content && content.type === "text") {
                console.log("Output summary:\n", (content.text ?? "").substring(0, 200) + "...");
            } else {
                console.log("Output content:", content);
            }
            return result;
        } catch (err) {
            console.error(`FAILED: ${name}`, err);
        }
    }

    // 1. af_search_jobs
    const searchRes = await testWithCallTool("af_search_jobs", { q: "sjuksköterska", limit: 2 });

    let jobId = "29432479"; // fallback
    if (searchRes && (searchRes as any).structuredContent?.hits?.[0]?.id) {
        jobId = (searchRes as any).structuredContent.hits[0].id;
    }

    // 2. af_get_job
    await testWithCallTool("af_get_job", { id: jobId });

    // 3. af_autocomplete
    await testWithCallTool("af_autocomplete", { q: "sjuksk" });

    // 4. af_search_historical_jobs
    await testWithCallTool("af_search_historical_jobs", { q: "lärare", published_after: "2023-01-01T00:00:00", published_before: "2023-06-01T00:00:00", limit: 2 });

    // 5. af_enrich_job_text
    await testWithCallTool("af_enrich_job_text", { text: "Vi söker en driven agil coach med tre års erfarenhet av mjukvaruutveckling och scrum. Arbetsplats är i Stockholm." });

    // 6. af_synonym_dictionary
    await testWithCallTool("af_synonym_dictionary", { q: "sjuksköterska" });

    // 7. af_search_job_links
    await testWithCallTool("af_search_job_links", { q: "säljare", limit: 2 });

    // 8. af_education_to_occupations
    await testWithCallTool("af_education_to_occupations", { education_id: "suntia200021" });

    // 9. af_occupation_to_educations
    await testWithCallTool("af_occupation_to_educations", { occupation_id: "2512" });

    // 10. af_search_taxonomy
    const taxoRes = await testWithCallTool("af_search_taxonomy", { q: "sjuksköterska", type: "occupation-name" });
    let conceptId = "i46j_HmG_v64"; // fallback
    if (taxoRes && (taxoRes as any).structuredContent?.concepts?.[0]?.id) {
        conceptId = (taxoRes as any).structuredContent.concepts[0].id;
    }

    // 11. af_get_taxonomy_concept
    await testWithCallTool("af_get_taxonomy_concept", { concept_id: conceptId });

    // 12. af_list_taxonomy_types
    await testWithCallTool("af_list_taxonomy_types", { type: "occupation-field" });

    // 13. af_stream_jobs
    // Use a narrow 1-hour window — full-day ranges return huge volumes and time out
    await testWithCallTool("af_stream_jobs", {
        date: "2026-02-23T09:00:00",
        date_before: "2026-02-23T10:00:00",
    });

    await transport.close();
}

runTests().catch(console.error);
