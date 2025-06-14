import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';
import { searchOnlineTool } from '../tools/searchOnlineTool';


export const jiraTool = createTool({
  id: 'jira',
  description: 'using a url, look up and get additional information from the page',
  inputSchema: z.object({
    issueType: z.enum(['story', 'epic']),
    issueName: z.string().describe('The card id, should be in a format of "JIRA-1234"'),
    query: z.string().describe('The search query for the page'),
  }),
  outputSchema: z.object({
    results: z.array(z.object({
      fields: z.object({
        
      }),
    }))
  }),
  execute: async () => {
    console.log('jira');
    return { results: [
      {
        "fields": {
          "project": { "key": "APP" },
          "summary": "Design login form UI",
          "description": "Create responsive login form with email/password fields.",
          "issuetype": { "name": "Story" },
          "customfield_10014": "User Auth"
        }
      },
      {
        "fields": {
          "project": { "key": "APP" },
          "summary": "Implement backend login endpoint",
          "description": "Create API to handle login with JWT session.",
          "issuetype": { "name": "Story" },
          "customfield_10014": "User Auth"
        }
      },
      {
        "fields": {
          "project": { "key": "APP" },
          "summary": "Set up session storage in Redis",
          "description": "Configure Redis to store session tokens securely.",
          "issuetype": { "name": "Story" },
          "customfield_10014": "User Auth"
        }
      }
    ] };
    // return await searchOnlineTool.execute({ });
  },
})

export const projectManagerAgent = new Agent({
  name: 'Project Manager',
  instructions: `
  You are an intelligent AI project manager modeled after an MCP (Master Control Program). Your job is to manage and coordinate complex project workflows in software or product development.

At any point, you can:

Ask targeted questions to gather missing requirements

Store and track project data such as deadlines, decisions, and requirements

Output either:

A descriptive paragraph explaining what is needed in a specific step, or

A Gherkin-style specification for clear behavior-driven understanding

Organize information into logical steps, describing how they interact, what dependencies exist, and how best to structure them to maintain flow

For every user input:

First, identify missing or ambiguous information and ask for it

Then, update your internal project data model (you do not have to show this to the user)

Provide an output as either a paragraph or Gherkin spec, depending on what is most appropriate or what the user asks

Finally, provide a brief summary of step interactions, flow, and structural suggestions

Always keep communication professional, precise, and flow-optimized. Prioritize clarity and progress.
  `,
  // model: ollama('qwen2.5', { }),
  model: openai('gpt-4.1'),
  tools: { 
    // unionLegalTool,
    searchOnlineTool,
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
