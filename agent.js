import { createClient } from "@sanity/client";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

dotenv.config({ path: fileURLToPath(new URL(".env", import.meta.url)) });

if (!process.env.GEMINI_API_KEY || !process.env.SANITY_API_TOKEN) {
  console.error("❌ Missing API keys in .env file!");
  process.exit(1);
}
console.log("✅ Environment variables loaded.");

const sanity = createClient({
  projectId: "uyvc8si1",
  dataset: "production",
  apiVersion: "2024-01-01",
  token: process.env.SANITY_API_TOKEN,
  useCdn: false
});

// Quick sanity check: can we actually query?
try {
  const count = await sanity.fetch('count(*[_type == "article"])');
  console.log(`✅ Connected to Sanity. Found ${count} article(s).`);
} catch (err) {
  console.error("❌ Sanity auth failed:", err.message);
  console.error("→ Check the token in your .env has 'Editor' permissions for project uyvc8si1.");
  process.exit(1);
}

const functionDeclarations = [
  {
    name: "query_documents",
    description: "Run a GROQ query against the Sanity dataset. Returns JSON.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "A GROQ query string." }
      },
      required: ["query"]
    }
  },
  {
    name: "list_content_types",
    description:
      "Returns the list of document types in the Sanity dataset and one example document per type, so you can see the available fields. Call this first if you don't know the schema.",
    parameters: {
      type: "object",
      properties: {},
      required: []
    }
  }
];

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = "gemini-3.5-flash-lite";

async function executeTool(name, args) {
  if (name === "query_documents") {
    const result = await sanity.fetch(args.query);
    return JSON.stringify(result);
  }
  if (name === "list_content_types") {
    const types = await sanity.fetch(`array::unique(*[]._type)`);
    const examples = {};
    for (const t of types) {
      const doc = await sanity.fetch(`*[_type == $t][0]{...}`, { t });
      examples[t] = doc ? Object.keys(doc) : [];
    }
    return JSON.stringify({ types, fieldsByType: examples });
  }
  throw new Error(`Unknown tool: ${name}`);
}

const chat = ai.chats.create({
  model: MODEL,
  config: {
    tools: [{ functionDeclarations }],
    systemInstruction: [
      "You are a Sanity Content agent. You answer questions using ONLY content returned from Sanity.",
      "",
      "SCHEMA (important - use these exact type names and field names in GROQ queries):",
      "  * _type == \"article\"",
      "    - title (string): the article title",
      "    - slug (slug): URL slug",
      "    - body (text): the full text content of the article",
      "    - source (url): the URL the information came from",
      "",
      "EXAMPLE QUERY: *[_type == \"article\"]{title, body, source}",
      "",
      "RULES:",
      "  1. Always query with _type == \"article\". Do NOT invent other type names like 'card' or 'document'.",
      "  2. When two sources contradict each other, present both claims side by side and cite the source URL of each.",
      "  3. Never invent information not returned by a query."
    ].join("\n")
  }
});

const userQuestion =
  "What is the win condition for Nebula?";
console.log(`\n👤 User: ${userQuestion}\n`);

let response = await chat.sendMessage({ message: userQuestion });

let safety = 0;
while (response.functionCalls && response.functionCalls.length > 0 && safety < 10) {
  safety++;
  const call = response.functionCalls[0];
  console.log(`🤖 Agent using tool: ${call.name}`);

  let toolOutput;
  try {
    toolOutput = await executeTool(call.name, call.args || {});
    console.log(`   Result preview: ${toolOutput.slice(0, 300)}...`);
  } catch (err) {
    console.error("❌ Tool error:", err.message);
    toolOutput = JSON.stringify({ error: err.message });
  }

  response = await chat.sendMessage({
    message: [{
      functionResponse: {
        name: call.name,
        response: { result: toolOutput }
      }
    }]
  });
}

console.log(`\n🤖 Agent: ${response.text || "(no text response)"}`);