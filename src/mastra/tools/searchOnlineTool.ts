import { createTool } from "@mastra/core";
import { MDocument} from '@mastra/rag'
import pupeteer from 'puppeteer'
import { convert } from "html-to-text"
// import { Memory } from '@mastra/memory';
// import { LibSQLStore, LibSQLVector } from '@mastra/libsql';
import z from "zod";
// import { openai } from '@ai-sdk/openai';

export const recursivlyLoadFromUrl = async (url: string, shouldLoad: (url: string) => boolean, depth: number = 3): Promise<MDocument[]> => {
  if (depth === 0 || !shouldLoad(url)) return [];
  console.log(`loading ${url} at depth ${depth}`);
  
  const browser = await pupeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(url);
  const content = await page.content();
  const links = await page.$$eval('a', (links) => links.map(link => link.href));
  const documents = await Promise.allSettled([
    MDocument.fromHTML(convert(content), { url }),
    ...links.flatMap(link => recursivlyLoadFromUrl(link, shouldLoad, depth - 1))
  ]);
  await browser.close();
  return documents.flatMap(document => document.status === 'fulfilled' ? document.value : []);
}


export const searchOnlineTool = createTool({
  id: 'search-online',
  description: 'using a url, look up and get additional information from the page',
  inputSchema: z.object({
    url: z.string().describe('The url to load'),
    query: z.string().describe('The search query for the page'),
  }),
  outputSchema: z.object({
    results: z.array(z.object({
      url: z.string(),
      content: z.string(),
    }))
  }),
  execute: async ({ context: {url, query }}) => {
    if (!query || !url) return { results: [] };

    const domain = new URL(url).hostname;
    const visitedUrls = new Set<string>();
    const shouldLoad = (url: string) => {
      if (visitedUrls.has(url)) return false
      visitedUrls.add(url);
      try {
        if (url.includes(domain)) return true;
      } catch (e) {
        console.error(`error loading ${url}`, e);
      }
      return false;
    }

    const documents = await recursivlyLoadFromUrl(url, shouldLoad);

    return {
      results: documents.map(document => ({
        url: document.getMetadata().at(0)?.url ?? '',
        content: document.getText().join('\n') ?? ''
      }))
    };
  }
});
