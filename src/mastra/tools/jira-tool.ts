import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import fetch from 'node-fetch';

const JIRA_BASE_URL = 'https://nivoset.atlassian.net/rest/api/3';
const JIRA_TOKEN = process.env.JIRA_TOKEN;
const JIRA_EMAIL = process.env.JIRA_EMAIL; // Jira Cloud API requires email + token

function getAuthHeader() {
  if (!JIRA_TOKEN || !JIRA_EMAIL) throw new Error('JIRA_TOKEN and JIRA_EMAIL must be set in .env');
  return {
    'Authorization': 'Basic ' + Buffer.from(`${JIRA_EMAIL}:${JIRA_TOKEN}`).toString('base64'),
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };
}

export const createJiraIssueTool = createTool({
  id: 'create-jira-issue',
  description: 'Create a new Jira issue/card.',
  inputSchema: z.object({
    projectKey: z.string(),
    summary: z.string(),
    description: z.string().optional(),
    issueType: z.string().default('Task'),
  }),
  outputSchema: z.object({
    key: z.string(),
    id: z.string(),
    url: z.string(),
  }),
  execute: async (context) => {
    try {
      const inputData = context.inputData || context.context || context;
      console.log('createJiraIssueTool inputData:', inputData);
      const body = JSON.stringify({
        fields: {
          project: { key: inputData.projectKey },
          summary: inputData.summary,
          description: {
            type: 'doc',
            version: 1,
            content: [
              {
                type: 'paragraph',
                content: [
                  { type: 'text', text: inputData.description }
                ]
              }
            ]
          },
          issuetype: { name: inputData.issueType },
          // Add more fields as needed
        },
      });
      console.log('createJiraIssueTool request body:', body);
      const res = await fetch(`${JIRA_BASE_URL}/issue`, {
        method: 'POST',
        headers: {
          ...getAuthHeader(),
          'Content-Type': 'application/json',
        },
        body,
      });
      if (!res.ok) {
        const errorText = await res.text();
        console.error(`Jira create issue failed: ${res.status} ${res.statusText} - ${errorText}`);
        throw new Error(`Jira create issue failed: ${res.status} ${res.statusText} - ${errorText}`);
      }
      const data = await res.json();
      return data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      console.error('Unexpected error in createJiraIssueTool:', msg);
      throw new Error(msg);
    }
  },
});

export const getJiraIssueTool = createTool({
  id: 'get-jira-issue',
  description: 'Get a Jira issue/card by key.',
  inputSchema: z.object({
    issueKey: z.string(),
  }),
  outputSchema: z.object({
    key: z.string(),
    id: z.string(),
    summary: z.string(),
    description: z.string().optional(),
    status: z.string(),
    url: z.string(),
  }),
  execute: async (context) => {
    try {
      const inputData = context.inputData || context.context || context;
      const res = await fetch(`${JIRA_BASE_URL}/issue/${inputData.issueKey}`, {
        method: 'GET',
        headers: getAuthHeader(),
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Jira get issue failed: ${res.status} ${res.statusText} - ${errorText}`);
      }
      const data = await res.json();
      return data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      throw new Error(msg);
    }
  },
});

export const updateJiraIssueTool = createTool({
  id: 'update-jira-issue',
  description: 'Update a Jira issue/card.',
  inputSchema: z.object({
    issueKey: z.string(),
    summary: z.string().optional(),
    description: z.string().optional(),
    status: z.string().optional(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    key: z.string(),
    url: z.string(),
  }),
  execute: async (context) => {
    try {
      const inputData = context.inputData || context.context || context;
      const fields: any = {};
      if (inputData.summary) fields.summary = inputData.summary;
      if (inputData.description) {
        fields.description = {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [
                { type: 'text', text: inputData.description }
              ]
            }
          ]
        };
      }
      // To link a story to an Epic, set the Epic Link custom field here (e.g., customfield_10014):
      // if (inputData.epicKey) fields['customfield_10014'] = inputData.epicKey;
      // Do NOT include status in fields; use the transitions API for status changes.
      const res = await fetch(`${JIRA_BASE_URL}/issue/${inputData.issueKey}`, {
        method: 'PUT',
        headers: {
          ...getAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fields }),
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Jira update issue failed: ${res.status} ${res.statusText} - ${errorText}`);
      }
      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      throw new Error(msg);
    }
  },
});

export const deleteJiraIssueTool = createTool({
  id: 'delete-jira-issue',
  description: 'Delete a Jira issue/card.',
  inputSchema: z.object({
    issueKey: z.string(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    key: z.string(),
  }),
  execute: async (context) => {
    try {
      const inputData = context.inputData || context.context || context;
      const res = await fetch(`${JIRA_BASE_URL}/issue/${inputData.issueKey}`, {
        method: 'DELETE',
        headers: getAuthHeader(),
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Jira delete issue failed: ${res.status} ${res.statusText} - ${errorText}`);
      }
      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      throw new Error(msg);
    }
  },
});

export const listJiraIssuesTool = createTool({
  id: 'list-jira-issues',
  description: 'List Jira issues using a JQL query.',
  inputSchema: z.object({
    jql: z.string().describe('Jira Query Language string'),
    maxResults: z.number().optional().default(20),
  }),
  outputSchema: z.object({
    issues: z.array(z.object({
      key: z.string(),
      id: z.string(),
      summary: z.string(),
      status: z.string(),
      url: z.string(),
    })),
  }),
  execute: async (context) => {
    try {
      const inputData = context.inputData || context.context || context;
      const params = new URLSearchParams({
        jql: inputData.jql,
        maxResults: String(inputData.maxResults ?? 20),
      });
      const res = await fetch(`${JIRA_BASE_URL}/search?${params.toString()}`, {
        method: 'GET',
        headers: getAuthHeader(),
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Jira list issues failed: ${res.status} ${res.statusText} - ${errorText}`);
      }
      const data = await res.json();
      return {
        issues: (data.issues || []).map((issue: any) => ({
          key: issue.key,
          id: issue.id,
          summary: issue.fields.summary,
          status: issue.fields.status?.name || '',
          url: `https://nivoset.atlassian.net/browse/${issue.key}`,
        })),
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      throw new Error(msg);
    }
  },
});

export const listJiraProjectsTool = createTool({
  id: 'list-jira-projects',
  description: 'List all Jira projects.',
  inputSchema: z.object({}),
  outputSchema: z.object({
    projects: z.array(z.object({
      id: z.string(),
      key: z.string(),
      name: z.string(),
      url: z.string(),
    })),
  }),
  execute: async (context) => {
    try {
      const inputData = context.inputData || context.context || context;
      const res = await fetch(`${JIRA_BASE_URL}/project/search`, {
        method: 'GET',
        headers: getAuthHeader(),
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Jira list projects failed: ${res.status} ${res.statusText} - ${errorText}`);
      }
      const data = await res.json();
      return {
        projects: (data.values || []).map((project: any) => ({
          id: project.id,
          key: project.key,
          name: project.name,
          url: `https://nivoset.atlassian.net/browse/${project.key}`,
        })),
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      throw new Error(msg);
    }
  },
});

export const listJiraEpicsForProjectTool = createTool({
  id: 'list-jira-epics-for-project',
  description: 'List all epics for a given Jira project key.',
  inputSchema: z.object({
    projectKey: z.string().nullish().describe('Jira project key (currentProjectKey)'),
    maxResults: z.number().optional().default(50),
  }),
  outputSchema: z.object({
    issues: z.array(z.object({
      key: z.string(),
      id: z.string(),
      summary: z.string(),
      status: z.string(),
      url: z.string(),
    })),
  }),
  execute: async (context) => {
    try {
      const inputData = context.inputData || context.context || context;
      const jql = `project = ${inputData.projectKey || 'SCRUM'} AND issuetype = Epic`;
      const params = new URLSearchParams({
        jql,
        maxResults: String(inputData.maxResults ?? 50),
      });
      const res = await fetch(`${JIRA_BASE_URL}/search?${params.toString()}`, {
        method: 'GET',
        headers: getAuthHeader(),
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Jira list epics failed: ${res.status} ${res.statusText} - ${errorText}`);
      }
      const data = await res.json();
      return {
        issues: (data.issues || []).map((issue: any) => ({
          key: issue.key,
          id: issue.id,
          summary: issue.fields.summary,
          status: issue.fields.status?.name || '',
          url: `https://nivoset.atlassian.net/browse/${issue.key}`,
        })),
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      throw new Error(msg);
    }
  },
});

export const getCurrentProjectKeyTool = createTool({
  id: 'get-current-project-key',
  description: 'Get the current project key from memory.',
  inputSchema: z.object({}),
  outputSchema: z.object({ projectKey: z.string().optional() }),
  execute: async (context) => {
    const projectKey = await context.memory.get('currentProjectKey');
    return { projectKey };
  },
});
