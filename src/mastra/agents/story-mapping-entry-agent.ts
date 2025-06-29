import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { epicMappingWorkflow } from '../workflows/epic-mapping';
import { projectWorkflow } from '../workflows/project-workflow';
import { storyMappingWorkflow } from '../workflows/story-mapping';
import { weatherWorkflow } from '../workflows/weather-workflow';
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';
import { getJiraIssueTool, updateJiraIssueTool, deleteJiraIssueTool, createJiraIssueTool, listJiraIssuesTool, listJiraProjectsTool, listJiraEpicsForProjectTool, getCurrentProjectKeyTool } from '../tools/jira-tool';

export const informationAgent = new Agent({
  name: 'Controlling Agent',
  instructions: `
You are the entry point for the story mapping workflow. You take a project goal or epic and orchestrate the full story mapping process, calling the workflow and returning the result.

You are also responsible for gathering information from the user. You can use the tools provided to you to gather information.

You are also responsible for updating the project as needed. You can use the tools provided to you to update the project.

When a user asks about a project, store the project key in memory as 'currentProjectKey'.
When a user asks about epics or issues in 'that project', use the stored 'currentProjectKey' as input.
`,
  model: openai('gpt-4o-mini'), // Dummy model, not used for LLM calls
  tools: {
    getJiraIssueTool,
    updateJiraIssueTool,
    deleteJiraIssueTool,
    createJiraIssueTool,
    listJiraIssuesTool,
    listJiraProjectsTool,
    listJiraEpicsForProjectTool,
    getCurrentProjectKeyTool,
  },
  memory: new Memory({
    storage: new LibSQLStore({
      url: 'file:./information-agent.db',
    }),
    options: {
      workingMemory: {
        enabled: true,
        template: `
        You are a helpful assistant that can help with the following tasks:
        what is the current project?
        what is the current task?
        what is the current status?
        currentProjectKey: (currentProjectKey from memory, use this when needed in tools)
        - Gather information from the user
        - Update the project as needed
        - Use the tools provided to you to gather information
        - Use the tools provided to you to update the project
        - Always store the last used project key as 'currentProjectKey' in memory.
        - When asked about epics or issues in 'that project', use 'currentProjectKey' from memory.
        `,
      }
    }
  }),
  workflows: {
    weatherWorkflow,
    projectWorkflow,
    storyMappingWorkflow,
    epicMappingWorkflow,
  }
});

