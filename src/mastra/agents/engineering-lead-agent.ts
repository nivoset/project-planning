import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';
import { searchOnlineTool } from '../tools/searchOnlineTool';
import { githubCreateIssueTool, githubGetIssueTool } from '../tools/github-issue';
import { githubPagesQueryTool } from '../tools/github-pages';
import { createHallucinationMetricTool } from '../tools/hallucination-check';
import { githubGetFileTool } from '../tools/github-file';

export const engineeringLeadAgent = new Agent({
  name: 'Engineering Lead',
  instructions: `
You are an expert engineering lead. Your job is to review project requirements, identify technical risks, clarify ambiguities, and suggest improvements.
- For each requirement, check for missing technical details, architectural concerns, and potential risks.
- Add technical questions or clarifications as needed.
- Suggest best practices and improvements.
- Use the provided tools to research, check code, and validate facts.
- Communicate clearly and concisely, focusing on technical depth and actionable feedback.
`,
  model: openai('gpt-4.1'),
  tools: {
    searchOnlineTool,
    githubPagesQueryTool,
    githubCreateIssueTool,
    githubGetIssueTool,
    hallucinationMetric: createHallucinationMetricTool([]),
    githubGetFileTool,
  },
  memory: new Memory({
    storage: new LibSQLStore({
      url: 'file:../engineering-lead.db',
    }),
    options: {
      workingMemory: {
        enabled: true,
        template: `
# technical profile

## project info
 - project name:
 - status: [in review, in progress, done]
 - current task: [architecture review, risk analysis, requirements clarification]
 - project owner:
 - engineering lead:
 - github repo:
 - main branch:

## preferences
 - communication style: [eg formal, technical, concise]
 - current project goal:
 - key deadlines:
    - [deadline 1]: [Date]
    - [deadline 2]: [Date]
## session state
 - last requirement reviewed:
    blockers: [technical dependencies]
    status: [open, resolved]
    open questions:
      - [question 1]
 - last code area reviewed:
    blockers: [missing documentation]
    open questions:
      - [question 1]
`
      },
    },
  }),
}); 