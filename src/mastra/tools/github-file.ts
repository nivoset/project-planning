import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import fetch from 'node-fetch';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // Set this in your environment

type EntryType = 'file' | 'dir';

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

export const githubGetFileTool = createTool({
  id: 'github-get-file',
  description: 'Fetches the content of a file from a GitHub repository or returns the structure of the repository.',
  inputSchema: z.object({
    owner: z.string(),
    repo: z.string(),
    path: z.string().optional().describe('Path to the file or directory. If omitted, returns the root structure.'),
    ref: z.string().optional().describe('The name of the commit/branch/tag. Default: the repository\'s default branch.'),
  }),
  outputSchema: z.object({
    type: z.enum(['file', 'dir']),
    content: z.string().optional(),
    entries: z.array(z.object({
      name: z.string(),
      path: z.string(),
      type: z.enum(['file', 'dir']),
    })).optional(),
  }),
  execute: async ({ context }) => {
    const { owner, repo, path, ref } = context;
    const apiPath = path
      ? `/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}${ref ? `?ref=${ref}` : ''}`
      : `/repos/${owner}/${repo}/contents${ref ? `?ref=${ref}` : ''}`;
    const result = await githubApi(apiPath);
    if (Array.isArray(result)) {
      // Directory listing
      return {
        type: 'dir' as const,
        entries: result.map((entry: any) => ({
          name: entry.name,
          path: entry.path,
          type: entry.type === 'dir' ? 'dir' as EntryType : 'file' as EntryType,
        })),
      };
    } else {
      // File content
      let content = '';
      if (result.content) {
        if (typeof Buffer !== 'undefined') {
          content = Buffer.from(result.content, 'base64').toString('utf-8');
        } else if (typeof atob !== 'undefined') {
          content = atob(result.content);
        }
      }
      return {
        type: 'file' as const,
        content,
      };
    }
  },
}); 