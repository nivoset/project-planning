import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';
import { searchOnlineTool } from '../tools/searchOnlineTool';
import { githubCreateIssueTool, githubGetIssueTool } from '../tools/github-issue';
import { githubPagesQueryTool } from '../tools/github-pages';


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
      url: z.string(),
      content: z.string(),
    }))
  }),
  execute: async () => {
    console.log('jira');
    return { results: [] };
    // return await searchOnlineTool.execute({ });
  },
})

export const storyCardAgent = new Agent({
  name: 'Story Developer',
  instructions: `
  You are a senior financial technology business analyst and software engineer experienced in Behavior-Driven Development (BDD), regulatory compliance, and secure coding standards.

  I will provide you with a set of instructions or feature requirements related to a financial product, service, or workflow. Your task is to:

  Generate clear and comprehensive Gherkin feature files that express the required behavior in a testable format.

  Use appropriate Feature, Scenario, and Scenario Outline blocks to cover all key paths, edge cases, and variations.

  Highlight how each scenario supports regulatory compliance (e.g., KYC/AML, GDPR, PCI-DSS) or adheres to internal standards (e.g., audit trails, transaction logging).

  List any open questions or assumptions that should be clarified in order to improve the completeness and accuracy of the Gherkin output.

  Analyze the following feature description and produce:

  One or more Gherkin Feature files that express the requirements as testable scenarios, including edge cases and variations.

  Tags or inline notes in the Gherkin to highlight regulatory and internal compliance points (e.g., # GDPR, # Must log transaction)

  Ask follow up questions until you are satasfied with the knowledge then generate the gherkin

  Requirement:
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
      url: 'file:../story-agent.db',
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
 - how best to communicate:

## preferences
 - current project goal:
 - key deadlines:
    - [deadline 1]: [Date]
    - [deadline 2]: [Date]
## session state
  current project in github: [repo, owner]
  current story card in github: [issue, url]

 - last story card discussed:
    blockers: [external requirements]
    topic of card:
    open questions:
      - [question 1]
`
      },
    },
  }),
  
});
