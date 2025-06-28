import { z } from 'zod';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { identifyPersonasAgent } from '../agents/identify-personas-agent';
import { researchAgent } from '../agents/research-agent';
import { usabilityPlanAgent, PlanSectionOutputSchema as UsabilityPlanSectionOutputSchema } from '../agents/usability-plan-agent';
import { implementationPlanAgent, PlanSectionOutputSchema as ImplementationPlanSectionOutputSchema } from '../agents/implementation-plan-agent';
import { onboardingAgent, PlanSectionOutputSchema as OnboardingPlanSectionOutputSchema } from '../agents/onboarding-agent';
import { loggingAgent, PlanSectionOutputSchema as LoggingPlanSectionOutputSchema } from '../agents/logging-agent';
import { integrationAgent, PlanSectionOutputSchema as IntegrationPlanSectionOutputSchema } from '../agents/integration-agent';
import { testingPlanAgent, PlanSectionOutputSchema as TestingPlanSectionOutputSchema } from '../agents/testing-plan-agent';

// Unified output schema
const PlanSectionOutputSchema = z.object({
  description: z.string(),
  gherkinRequirements: z.array(z.string()),
});

const EpicInputSchema = z.object({
  epicStatement: z.string().describe('The epic or goal statement to map.'),
});

// Steps for each branch
const personasStep = createStep({
  id: 'personas',
  description: 'Generate user personas.',
  inputSchema: EpicInputSchema,
  outputSchema: PlanSectionOutputSchema,
  execute: async ({ inputData }) => {
    // For personas, we wrap the agent output in the unified schema
    const result = await identifyPersonasAgent.generate(inputData.epicStatement, { output: z.object({ personas: z.array(z.object({ name: z.string(), description: z.string() })) }) });
    return {
      description: 'Personas relevant to this epic.',
      gherkinRequirements: result.object.personas.map(p => `Given a user persona named ${p.name}, when they interact with the system, then their needs (${p.description}) should be addressed.`),
    };
  },
});

const researchStep = createStep({
  id: 'research',
  description: 'Generate research tasks for current state.',
  inputSchema: EpicInputSchema,
  outputSchema: PlanSectionOutputSchema,
  execute: async ({ inputData }) => {
    const result = await researchAgent.generate(inputData.epicStatement, { output: z.object({ researchTasks: z.array(z.string()) }) });
    return {
      description: 'Research tasks needed to understand the current state.',
      gherkinRequirements: result.object.researchTasks.map(task => `Given the need to understand the current state, when researching, then complete the task: ${task}`),
    };
  },
});

const usabilityStep = createStep({
  id: 'usability',
  description: 'Make a plan for usability/UX.',
  inputSchema: EpicInputSchema,
  outputSchema: PlanSectionOutputSchema,
  execute: async ({ inputData }) => {
    const result = await usabilityPlanAgent.generate(inputData.epicStatement, { output: PlanSectionOutputSchema });
    return result.object;
  },
});

const implementationStep = createStep({
  id: 'implementation',
  description: 'Make an implementation plan.',
  inputSchema: EpicInputSchema,
  outputSchema: PlanSectionOutputSchema,
  execute: async ({ inputData }) => {
    const result = await implementationPlanAgent.generate(inputData.epicStatement, { output: PlanSectionOutputSchema });
    return result.object;
  },
});

const onboardingStep = createStep({
  id: 'onboarding',
  description: 'Generate onboarding tasks.',
  inputSchema: EpicInputSchema,
  outputSchema: PlanSectionOutputSchema,
  execute: async ({ inputData }) => {
    const result = await onboardingAgent.generate(inputData.epicStatement, { output: PlanSectionOutputSchema });
    return result.object;
  },
});

const loggingStep = createStep({
  id: 'logging',
  description: 'List logging requirements.',
  inputSchema: EpicInputSchema,
  outputSchema: PlanSectionOutputSchema,
  execute: async ({ inputData }) => {
    const result = await loggingAgent.generate(inputData.epicStatement, { output: PlanSectionOutputSchema });
    return result.object;
  },
});

const integrationStep = createStep({
  id: 'integration',
  description: 'Plan integration and defensive coding.',
  inputSchema: EpicInputSchema,
  outputSchema: PlanSectionOutputSchema,
  execute: async ({ inputData }) => {
    const result = await integrationAgent.generate(inputData.epicStatement, { output: PlanSectionOutputSchema });
    return result.object;
  },
});

const testingStep = createStep({
  id: 'testing',
  description: 'Lay out a testing plan.',
  inputSchema: EpicInputSchema,
  outputSchema: PlanSectionOutputSchema,
  execute: async ({ inputData }) => {
    const result = await testingPlanAgent.generate(inputData.epicStatement, { output: PlanSectionOutputSchema });
    return result.object;
  },
});

// Gather step
const gatherStep = createStep({
  id: 'gather',
  description: 'Gather all outputs into a single document.',
  inputSchema: z.object({
    personas: PlanSectionOutputSchema,
    research: PlanSectionOutputSchema,
    usability: PlanSectionOutputSchema,
    implementation: PlanSectionOutputSchema,
    onboarding: PlanSectionOutputSchema,
    logging: PlanSectionOutputSchema,
    integration: PlanSectionOutputSchema,
    testing: PlanSectionOutputSchema,
  }),
  outputSchema: z.string(),
  execute: async ({ inputData }) => {
    return  `# Epic Mapping Document\n\n${Object.entries(inputData).map(([section, { description, gherkinRequirements }]) => `## ${section.charAt(0).toUpperCase() + section.slice(1)}\n${description}\n\n### Gherkin Requirements\n${gherkinRequirements.map(req => `- ${req}`).join('\n')}`).join('\n\n')}`
  },
});

export const epicMappingWorkflow = createWorkflow({
  id: 'epic-mapping-workflow',
  description: 'Map an epic to a set of user stories.',
  inputSchema: EpicInputSchema,
  outputSchema: z.object({ document: z.string() }),
})
.parallel([
  personasStep,
  researchStep,
  usabilityStep,
  implementationStep,
  onboardingStep,
  loggingStep,
  integrationStep,
  testingStep,
])
.then(gatherStep);

epicMappingWorkflow.commit();