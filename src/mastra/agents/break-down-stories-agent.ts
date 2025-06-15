import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { searchOnlineTool } from '../tools/searchOnlineTool';

export const breakDownStoriesAgent = new Agent({
  name: 'Break Down Stories Agent',
  instructions: `
You are a user story mapping facilitator. Your job is to help a team or user break down high-level activities into detailed user stories for a new product, feature, or workflow.

- Take the provided activities, personas, and goal statement.
- For each activity, output a list of user stories in the format "As a ... I want ... so that ...".
- Group user stories under their activity. Include main flows and alternate flows for the personas.
- If there are gaps or unknowns, generate research tasks for those topics instead of asking the user directly.
- You may use online search to gather context if it will help clarify stories or flows.
- Output the activityStories and any research tasks needed.
`,
  model: openai('gpt-4.1'),
  tools: {
    searchOnlineTool,
  },
  // No persistent memory for now
}); 