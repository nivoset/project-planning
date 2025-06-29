import { createTool } from "@mastra/core";
import { chromium } from "@playwright/test";
import z from "zod";


export const playwrightTool = createTool({
  id: 'playwright',
  description: 'Use playwright to navigate to a URL and retrievearia, or content, or take a base64 screenshot',
  inputSchema: z.object({
    websiteUrl: z.string().describe('The URL to navigate to.'),
    whatToGrab: z.enum(['aria', 'content', 'screenshot']).describe('What to grab from the page.'),
  }),
  outputSchema: z.string().describe('The output of the tool.'),

  execute: async ({context}) => {
    const url = context.websiteUrl;
    const whatToGrab = context.whatToGrab;
    if (!url) {
      throw new Error('No website URL provided');
    }
    if (!whatToGrab) {
      throw new Error('No what to grab provided');
    }
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    try {
    await page.goto(url);

    if (whatToGrab === 'aria') {
      return await page.locator('html').first().ariaSnapshot();
    }
    if (whatToGrab === 'content') {
      return await page.content();
    } 
    if (whatToGrab === 'screenshot') {
      return await page.screenshot();
    }
    } catch (error) {
      console.error(error);
      return error.message
    } finally {
      browser.close();
    }
  },
});