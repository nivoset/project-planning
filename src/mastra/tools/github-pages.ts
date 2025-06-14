import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import fetch from 'node-fetch';
import { convert } from 'html-to-text';
import * as cheerio from 'cheerio';
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';
import { ollama } from 'ollama-ai-provider';
import { v4 as uuidv4 } from 'uuid';

const githubPagesMemory = new Memory(
  {
    storage: new LibSQLStore({
      url: 'file:../githubpages.db',
    }),
    embedder: ollama.embedding('nomic-embed-text'),
  },
);

async function crawlGithubPages(baseUrl: string, stepLimit = 1) {
  const visited = new Set<string>();
  const toVisit = [{ url: baseUrl, depth: 0 }];

  while (toVisit.length > 0) {
    const { url, depth } = toVisit.shift()!;
    if (visited.has(url) || depth > stepLimit) continue;
    visited.add(url);

    try {
      const res = await fetch(url);
      const html = await res.text();
      const text = convert(html, { wordwrap: false });
      const $ = cheerio.load(html);

      // Chunk into paragraphs (sets of 3 for example)
      const paragraphs = text.split('\n').filter(Boolean);
      const chunkSize = 3;
      for (let i = 0; i < paragraphs.length; i += chunkSize) {
        const chunk = paragraphs.slice(i, i + chunkSize).join('\n');
        await githubPagesMemory.saveMessages({
          messages: [{
            id: uuidv4(),
            content: chunk,
            role: 'system',
            createdAt: new Date(),
            type: 'text',
          }],
        });
      }

      // Find and queue links
      if (depth < stepLimit) {
        $('a[href]').each((_, el) => {
          const href = $(el).attr('href');
          if (href && href.startsWith('http') && href.includes('.github.io')) {
            toVisit.push({ url: href, depth: depth + 1 });
          }
        });
      }
    } catch (e) {
      console.error(`Failed to fetch ${url}:`, e);
    }
  }
}

export const githubPagesIndexerTool = createTool({
  id: 'github-pages-indexer',
  description: 'Indexes a GitHub Pages site recursively, cleans HTML, chunks text, and stores embeddings for querying.',
  inputSchema: z.object({
    baseUrl: z.string().url(),
    stepLimit: z.number().min(1).max(5).default(1),
  }),
  outputSchema: z.object({
    message: z.string(),
  }),
  execute: async ({ context }) => {
    const { baseUrl, stepLimit } = context;
    await crawlGithubPages(baseUrl, stepLimit ?? 1);
    return { message: `Indexed ${baseUrl} up to ${stepLimit ?? 1} steps.` };
  },
});

export const githubPagesQueryTool = createTool({
  id: 'github-pages-query',
  description: 'Queries the indexed GitHub Pages content using semantic search.',
  inputSchema: z.object({
    query: z.string(),
    limit: z.number().min(1).max(10).default(3),
  }),
  outputSchema: z.object({
    results: z.array(z.object({
      text: z.string(),
      url: z.string(),
      chunkIndex: z.number(),
    })),
  }),
  execute: async ({ context }) => {
    const { query, limit = 3 } = context;
    const results = await githubPagesMemory.vector?.query(query);
    if (!results) {
      return { results: [] };
    }
    return {
      results: results.map(r => ({
        text: r.document ?? '',
        url: r.metadata?.url ?? '',
        chunkIndex: r.metadata?.chunkIndex ?? 0,
      })),
    };
  },
});
