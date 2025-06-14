import { AgentResponse } from '../types/agent-response';

interface MastraAgentConfig {
  name: string;
  description: string;
  process: (query: string) => Promise<AgentResponse>;
}

export const mastra = (config: MastraAgentConfig) => {
  return {
    name: config.name,
    description: config.description,
    process: config.process
  };
}; 