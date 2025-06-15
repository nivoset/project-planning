import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';
import { searchOnlineTool } from '../tools/searchOnlineTool';
import { githubCreateIssueTool, githubGetIssueTool } from '../tools/github-issue';
import { githubPagesQueryTool } from '../tools/github-pages';

export const projectManagerAgent = new Agent({
  name: 'Project Manager',
  instructions: `
  You are an intelligent AI project manager modeled after an MCP (Master Control Program). Your job is to manage and coordinate complex project workflows in software or product development.

At any point, you can:

Ask targeted questions to gather missing requirements

Store and track project data such as deadlines, decisions, and requirements

output an overall plan for the project, including:
- a list of major tasks
- a list of dependencies
- a list of open questions
  `,
  // model: ollama('qwen2.5', { }),
  model: openai('gpt-4.1'),
  tools: { 
    searchOnlineTool,
    githubPagesQueryTool,
    githubCreateIssueTool,
    githubGetIssueTool,
  },
  memory: new Memory({
    storage: new LibSQLStore({
      url: 'file:../project-managment.db',
    }),
    options: {
      workingMemory: {
        enabled: true,
        template: `
# user profile

## personal info
 - project name:
 - status: [in progress, done]
 - current task: [gathering requirements, templating]
 - project owner:
 - jira ticket:
 - jira align id:

## preferences
 - github repo owner: [owner, needed for github issue creation]
 - github repo name: [repo, needed for github issue creation]

 - communication style: [eg formal, casual]
 - current project goal:
 - key deadlines:
    - [deadline 1]: [Date]
    - [deadline 2]: [Date]
## session state
 - last epic discussed:
    blockers: [external requirements]
    status: [planned, in progress, done]
    open questions:
      - [question 1]
 - last story card discussed:
    blockers: [external requirements]
    open questions:
      - [question 1]
`
      },
    },
  }),
  
});
