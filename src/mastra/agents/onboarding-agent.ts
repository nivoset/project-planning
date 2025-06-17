import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

export const PlanSectionOutputSchema = z.object({
  description: z.string(),
  gherkinRequirements: z.array(z.string()),
});

export const onboardingAgent = new Agent({
  name: 'Onboarding Agent',
  instructions: `
    Given an epic statement, describe what is needed and why for onboarding.
    Then output all requirements as Gherkin scenarios in an array.
    Output as: { description: string, gherkinRequirements: string[] }
  `,
  model: openai('gpt-4.1'),
  tools: {},
}); 