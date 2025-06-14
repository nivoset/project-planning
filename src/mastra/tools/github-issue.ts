import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import fetch from 'node-fetch';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // Set this in your environment

const githubApi = async (path: string, method = 'GET', body?: any) => {
  const url = `https://api.github.com${path}`;
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github+json',
    'Content-Type': 'application/json',
  };
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`GitHub API error: ${res.status} ${await res.text()}`);
  return res.json();
};

export const githubGetIssueTool = createTool({
  id: 'github-get-issue',
  description: 'Fetches a GitHub issue, extracts description, acceptance criteria, and linked issues.',
  inputSchema: z.object({
    owner: z.string(),
    repo: z.string(),
    issueNumber: z.number(),
  }),
  outputSchema: z.object({
    number: z.number(),
    title: z.string(),
    body: z.string(),
    acceptanceCriteria: z.string().optional(),
    linkedIssues: z.array(z.object({
      number: z.number(),
      title: z.string(),
      url: z.string(),
    })),
  }),
  execute: async ({ context }) => {
    const { owner, repo, issueNumber } = context;
    // Fetch the issue
    const issue = await githubApi(`/repos/${owner}/${repo}/issues/${issueNumber}`);
    const title = issue.title ?? '';
    const body = issue.body ?? '';

    // Extract acceptance criteria (if present)
    let acceptanceCriteria = '';
    const acMatch = body.match(/Acceptance Criteria:(.*?)(?:\n\n|\n$|$)/is);
    if (acMatch) {
      acceptanceCriteria = acMatch[1].trim();
    }

    // Find linked issues by scanning for #123 or full URLs in the body
    const linkedIssues: { number: number, title: string, url: string }[] = [];
    const issueUrlRegex = new RegExp(
      `https://github\\.com/${owner}/${repo}/issues/(\\d+)`,
      'g'
    );
    const issueRefs = [
      ...body.matchAll(/#(\d+)/g),
      ...body.matchAll(issueUrlRegex),
    ];
    for (const ref of issueRefs) {
      const linkedNumber = parseInt(ref[1], 10);
      if (!isNaN(linkedNumber) && linkedNumber !== issueNumber) {
        try {
          const linked = await githubApi(`/repos/${owner}/${repo}/issues/${linkedNumber}`);
          linkedIssues.push({
            number: linked.number,
            title: linked.title ?? '',
            url: linked.html_url,
          });
        } catch (e) {
          // Ignore fetch errors for missing issues
        }
      }
    }

    return {
      number: issue.number,
      title,
      body,
      acceptanceCriteria,
      linkedIssues,
    };
  },
});

export const githubCreateIssueTool = createTool({
  id: 'github-create-issue',
  description: 'Creates a new GitHub issue in the specified repository.',
  inputSchema: z.object({
    owner: z.string(),
    repo: z.string(),
    title: z.string(),
    body: z.string().optional(),
    labels: z.array(z.string()).optional(),
    assignees: z.array(z.string()).optional(),
  }),
  outputSchema: z.object({
    number: z.number(),
    url: z.string(),
    title: z.string(),
  }),
  execute: async ({ context }) => {
    const { owner, repo, title, body, labels, assignees } = context;
    const issue = await githubApi(
      `/repos/${owner}/${repo}/issues`,
      'POST',
      { title, body, labels, assignees }
    );
    return {
      number: issue.number,
      url: issue.html_url,
      title: issue.title,
    };
  },
});