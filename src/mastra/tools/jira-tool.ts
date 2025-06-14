import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import fetch from 'node-fetch';

const JIRA_BASE_URL = process.env.JIRA_BASE_URL; // e.g. 'your-domain.atlassian.net'
const JIRA_AUTH = process.env.JIRA_AUTH; // base64(email:api_token)

const jiraApi = async (path: string, method = 'GET', body?: any) => {
  const url = `https://${JIRA_BASE_URL}/rest/api/3${path}`;
  const headers: Record<string, string> = {
    'Authorization': `Basic ${JIRA_AUTH}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Jira API error: ${res.status} ${await res.text()}`);
  return res.json();
};

export const jiraCreateIssueTool = createTool({
  id: 'jira-create-issue',
  description: 'Creates a Jira issue in the configured project.',
  inputSchema: z.object({
    projectKey: z.string(),
    summary: z.string(),
    description: z.string(),
    issueType: z.string().default('Task'),
  }),
  outputSchema: z.object({
    key: z.string(),
    url: z.string(),
  }),
  execute: async ({ context }) => {
    const { projectKey, summary, description, issueType } = context;
    const issue = await jiraApi('/issue', 'POST', {
      fields: {
        project: { key: projectKey },
        summary,
        description,
        issuetype: { name: issueType },
      },
    });
    return {
      key: issue.key,
      url: `https://${JIRA_BASE_URL}/browse/${issue.key}`,
    };
  },
});
