/**
 * Ingest chat_pairs.jsonl into Upstash Vector (BGE_M3 auto-embedding)
 *
 * Usage: npx tsx scripts/ingest-vectors.ts
 *
 * Requires .env.local with:
 *   aime_rag_UPSTASH_VECTOR_REST_URL
 *   aime_rag_UPSTASH_VECTOR_REST_TOKEN
 */

import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local manually (no dotenv dependency)
const envPath = resolve(import.meta.dirname, "../.env.local");
const envContent = readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const match = line.match(/^([^#=]+)="(.*)"/);
  if (match) process.env[match[1]] = match[2];
}

const VECTOR_URL = process.env.aime_rag_UPSTASH_VECTOR_REST_URL!;
const VECTOR_TOKEN = process.env.aime_rag_UPSTASH_VECTOR_REST_TOKEN!;
const DATA_PATH = "../aime/data/processed/chat_pairs.jsonl";
const BATCH_SIZE = 50; // Upstash recommends batches for upsert

interface ChatPair {
  context: { role: string; name: string; content: string }[];
  response: string;
  timestamp: string;
  conversation_with: string;
}

function buildSearchText(pair: ChatPair): string {
  // Combine context + response into one text for embedding
  const contextText = pair.context
    .map((c) => `${c.name}: ${c.content}`)
    .join("\n");
  const full = contextText ? `${contextText}\n柴宁: ${pair.response}` : `柴宁: ${pair.response}`;
  // Truncate to ~500 chars to keep embeddings focused
  return full.slice(0, 500);
}

async function upsertBatch(
  vectors: { id: string; data: string; metadata: Record<string, string> }[]
) {
  const res = await fetch(`${VECTOR_URL}/upsert-data`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${VECTOR_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(vectors),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upsert failed: ${res.status} ${text}`);
  }
  return res.json();
}

async function main() {
  if (!VECTOR_URL || !VECTOR_TOKEN) {
    console.error("Missing UPSTASH_VECTOR env vars. Run: vercel env pull .env.local");
    process.exit(1);
  }

  const raw = readFileSync(DATA_PATH, "utf-8").trim().split("\n");
  console.log(`Loaded ${raw.length} chat pairs`);

  // Filter: skip very short responses and system messages
  const pairs: ChatPair[] = raw
    .map((line) => JSON.parse(line) as ChatPair)
    .filter((p) => p.response.length >= 4);

  console.log(`After filtering: ${pairs.length} pairs`);

  // Deduplicate by response text
  const seen = new Set<string>();
  const unique: ChatPair[] = [];
  for (const p of pairs) {
    if (!seen.has(p.response)) {
      seen.add(p.response);
      unique.push(p);
    }
  }
  console.log(`After dedup: ${unique.length} pairs`);

  let uploaded = 0;
  for (let i = 0; i < unique.length; i += BATCH_SIZE) {
    const batch = unique.slice(i, i + BATCH_SIZE);
    const vectors = batch.map((pair, j) => {
      const contextText = pair.context
        .map((c) => `${c.name}: ${c.content}`)
        .join(" | ");
      return {
        id: `chat_${i + j}`,
        data: buildSearchText(pair),
        metadata: {
          response: pair.response,
          context: contextText.slice(0, 500),
          conversation_with: pair.conversation_with,
          timestamp: pair.timestamp,
        },
      };
    });

    await upsertBatch(vectors);
    uploaded += batch.length;

    if (uploaded % 500 === 0 || uploaded === unique.length) {
      console.log(`Uploaded ${uploaded}/${unique.length}`);
    }
  }

  console.log("Done!");
}

main().catch(console.error);
