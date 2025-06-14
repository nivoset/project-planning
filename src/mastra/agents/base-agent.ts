import { AgentResponse } from '../types/agent-response';

export abstract class BaseAgent {
  protected name: string;

  constructor(name: string) {
    this.name = name;
  }

  abstract processQuery(query: string): Promise<AgentResponse>;
} 