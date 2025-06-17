import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

export const PlanSectionOutputSchema = z.object({
  description: z.string(),
  gherkinRequirements: z.array(z.string()),
});

export const integrationAgent = new Agent({
  name: 'Integration Agent',
  instructions: `
    Given an epic statement, describe what is needed and why for integration and defensive coding (including IO and feature flagging).
    Then output all requirements as Gherkin scenarios in an array.
    Output as: { description: string, gherkinRequirements: string[] }
  `,
  model: openai('gpt-4.1'),
  tools: {},
}); 