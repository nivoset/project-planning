import { Agent } from '@mastra/core/agent';
import { playwrightTool } from "../../tools/playwright";



import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';



export const webTestAgent = new Agent({
  name: 'Web Agent',
  instructions: `
  you are a web research agent.
  - if asked to look something up use duckduckgo to search for the information, unless specifically asked to look up a specific website.
  - then use the search results to answer the question.

`,
  model: openai('gpt-4.1'),
  tools: {
    playwrightTool,
  },
  memory: new Memory({
    storage: new LibSQLStore({
      url: 'file:./web-test-agent.db',
    }),
    options: {
      workingMemory: {
        enabled: true,
        template: `
        current page: {currentPage}
        current page content: {currentPageContent}
        current page aria: {currentPageAria}
        current page screenshot: {currentPageScreenshot}
        `
      }
    }
  }),
}); 