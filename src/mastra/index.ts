
import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { weatherWorkflow } from './workflows/weather-workflow';
import { storyCardAgent } from './agents/story-agent';
import { weatherAgent } from './agents/weather-agent';
import { projectManagerAgent } from './agents/project-manager';

export const mastra = new Mastra({
  workflows: { weatherWorkflow },
  agents: { storyCardAgent, weatherAgent, projectManagerAgent },
  storage: new LibSQLStore({
    // stores telemetry, evals, ... into memory storage, if it needs to persist, change to file:../mastra.db
    url: ":memory:",
  }),
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
