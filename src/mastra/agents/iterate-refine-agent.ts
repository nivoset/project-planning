import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { z } from 'zod';

// Example IterationSchema (should match the one in the workflow)
export const IterationSchema = z.object({
  updatedMap: z.string().describe('Summary of changes or refinements.'),
  sessionBlocks: z.array(z.object({
    date: z.string(),
    durationHours: z.number(),
    focus: z.string(),
  })),
  participants: z.array(z.string()),
  facilitator: z.string(),
  releases: z.array(z.object({
    name: z.string(),
    stories: z.array(z.string()),
  })),
  goalStatement: z.string(),
});

export const iterateRefineAgent = new Agent({
  name: 'Iterate Refine Agent',
  instructions: `
  You are a user journey mapping facilitator. Your job is to help a team or user iterate and refine the story map.
  - Take the provided story map and iterate and refine it.
  - Output the updated story map.
  - Output the participants, facilitator, and any research tasks needed.
`,
  model: openai('gpt-4.1'),
  tools: {
  },
  // No persistent memory for now
}); 