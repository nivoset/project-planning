import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';
import { searchOnlineTool } from '../tools/searchOnlineTool';
import { githubCreateIssueTool, githubGetIssueTool } from '../tools/github-issue';

export const researchAgent = new Agent({
  name: 'Research Agent',
  instructions: `
You are an expert researcher. Your job is to research a given topic and provide a summary of the information.
- Use the provided tools to research the topic.
- Communicate clearly and concisely, focusing on technical depth and actionable feedback.
`,
  model: openai('gpt-4.1'),
  tools: {
    searchOnlineTool,
    // githubPagesQueryTool,
    githubCreateIssueTool,
    githubGetIssueTool,
  },
  memory: new Memory({
    storage: new LibSQLStore({
      url: 'file:../research-lead.db',
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