import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { githubCreateIssueTool, githubGetIssueTool } from '../tools/github-issue';

export const taskSplitterAgent = new Agent({
  name: 'Task Splitter',
  instructions: `
You are a project task and GitHub issue management expert. Given:
- A list of tasks
- A list of research questions
- The current list of GitHub issues (if any)

Your job is to:
1. Remove/close any issues that are no longer needed.
2. Create new GitHub issues for all actionable work tasks and for each research question (label research issues as 'research').
3. Output ONLY a JSON object matching this schema:
{
  "createdIssues": [ { "title": string, "number": number, "url": string, "type": "work" | "research" } ],
  "closedIssues": [ { "title": string, "number": number, "url": string } ],
  "remainingIssues": [ { "title": string, "number": number, "url": string, "type": "work" | "research" } ],
  "questionToResearchIssue": { [question: string]: number }
}
Do not include any explanation or text outside the JSON object.
`,
  model: openai('gpt-4.1'),
  tools: {
    githubCreateIssueTool,
    githubGetIssueTool,
  },
}); 