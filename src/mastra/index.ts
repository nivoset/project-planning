import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { weatherWorkflow } from './workflows/weather-workflow';
import { weatherAgent } from './agents/weather-agent';
import { projectWorkflow } from './workflows/project-workflow';
import { storyMappingWorkflow } from './workflows/story-mapping';
import { epicMappingWorkflow } from './workflows/epic-mapping';
import { roleContributionsWorkflow } from './workflows/role-contributions';
import { informationAgent } from './agents/story-mapping-entry-agent';
import { webTestAgent } from './agents/web/web-test-agent';

export const mastra = new Mastra({
  workflows: {
    weatherWorkflow,
    projectWorkflow,
    storyMappingWorkflow,
    epicMappingWorkflow,
    roleContributionsWorkflow,
  },
  agents: {
    weatherAgent,
    informationAgent,
    webTestAgent,
  },
  storage: new LibSQLStore({
    // stores telemetry, evals, ... into memory storage, if it needs to persist, change to file:../mastra.db
    url: ":memory:",
  }),
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
