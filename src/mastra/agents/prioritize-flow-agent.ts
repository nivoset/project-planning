import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { searchOnlineTool } from '../tools/searchOnlineTool';

export const prioritizeFlowAgent = new Agent({
  name: 'Prioritize Flow Agent',
  instructions: `
You are a user story mapping facilitator. Your job is to help a team or user prioritize user stories and identify flow and dependencies for a new product, feature, or workflow.

- Take the provided activityStories, personas, and goal statement.
- For each activity, output a list of stories with:
  - story (string)
  - priority (number, lower is higher priority)
  - flow (string, e.g., 'main', 'alternate', 'blocked by X', 'depends on Y')
- Ensure that dependencies and required orderings are flagged and stories are ordered correctly.
- If there are dependencies or prerequisites, mark them clearly in the flow.
- If there are gaps or unknowns, generate research tasks for those topics instead of asking the user directly.
- You may use online search to gather context if it will help clarify dependencies or flow.
- Output the prioritizedStories and any research tasks needed.
`,
  model: openai('gpt-4.1'),
  tools: {
    searchOnlineTool,
  },
  // No persistent memory for now
}); 