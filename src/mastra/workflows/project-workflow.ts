import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { projectManagerAgent } from '../agents/project-manager';
import { engineeringLeadAgent } from '../agents/engineering-lead-agent';

// Step 1: Get overall project idea from user
const getProjectIdea = createStep({
  id: 'get-project-idea',
  description: 'Collect the high-level project idea from the user',
  inputSchema: z.object({
    idea: z.string().describe('The overall project idea or goal'),
  }),
  outputSchema: z.object({
    idea: z.string(),
  }),
  execute: async ({ inputData }) => {
    return { idea: inputData.idea };
  },
});

// Step 2: Project manager review (recursive)
const projectManagerReview = createStep({
  id: 'project-manager-review',
  description: 'Project manager reviews the idea, asks questions, and identifies missing info/data sources. Loops until all questions are resolved.',
  inputSchema: z.object({
    idea: z.string(),
    context: z.any().optional(),
    previousQuestions: z.array(z.string()).optional(),
    previousAnswers: z.record(z.string(), z.string()).optional(),
  }),
  outputSchema: z.object({
    idea: z.string(),
    context: z.any().optional(),
    openQuestions: z.array(z.string()),
    answers: z.record(z.string(), z.string()),
    dataSources: z.array(z.string()),
  }),
  execute: async ({ inputData }) => {
    // Call the project manager agent with the idea
    const response = await projectManagerAgent.generate(inputData.idea);
    // Simulate extracting questions, answers, and data sources
    // (Replace with actual parsing logic as needed)
    return {
      idea: inputData.idea,
      context: response.text,
      openQuestions: [],
      answers: {},
      dataSources: [],
    };
  },
});

// Step 3: Engineering lead review (recursive)
const engineeringLeadReview = createStep({
  id: 'engineering-lead-review',
  description: 'Engineering lead reviews requirements, adds technical questions/clarifications, and suggests improvements. Loops until all questions are resolved.',
  inputSchema: z.object({
    idea: z.string(),
    context: z.any().optional(),
    openQuestions: z.array(z.string()),
    answers: z.record(z.string(), z.string()),
    dataSources: z.array(z.string()),
  }),
  outputSchema: z.object({
    idea: z.string(),
    context: z.any().optional(),
    openQuestions: z.array(z.string()),
    answers: z.record(z.string(), z.string()),
    dataSources: z.array(z.string()),
    technicalNotes: z.string().optional(),
  }),
  execute: async ({ inputData }) => {
    // Call the engineering lead agent with the current state
    const response = await engineeringLeadAgent.generate(inputData.idea);
    console.log(response);    // Simulate extracting new/remaining questions, answers, and notes
    return {
      idea: inputData.idea,
      context: {},
      openQuestions: [],
      answers: {},
      dataSources: [],
      technicalNotes: response.text,
    };
  },
});

// Step 4: Output summary
const outputSummary = createStep({
  id: 'output-summary',
  description: 'Output a summary with all resolved info, open questions, and data sources.',
  inputSchema: z.object({
    idea: z.string(),
    context: z.any().optional(),
    openQuestions: z.array(z.string()),
    answers: z.record(z.string(), z.string()),
    dataSources: z.array(z.string()),
    technicalNotes: z.string().optional(),
  }),
  outputSchema: z.object({
    summary: z.string(),
    openQuestions: z.array(z.string()),
    dataSources: z.array(z.string()),
    technicalNotes: z.string().optional(),
  }),
  execute: async ({ inputData }) => {
    // Compose a summary
    const summary = `Project Idea: ${inputData.idea}\n\nData Sources: ${inputData.dataSources.join(', ')}\n\nTechnical Notes: ${inputData.technicalNotes || ''}\n\nOpen Questions: ${inputData.openQuestions.join('\n')}`;
    return {
      summary,
      openQuestions: inputData.openQuestions,
      dataSources: inputData.dataSources,
      technicalNotes: inputData.technicalNotes,
    };
  },
});

// Workflow definition (recursive logic can be handled in the UI or by re-invoking steps as needed)
export const projectWorkflow = createWorkflow({
  id: 'project-workflow',
  inputSchema: z.object({
    idea: z.string(),
  }),
  outputSchema: z.object({
    summary: z.string(),
    openQuestions: z.array(z.string()),
    dataSources: z.array(z.string()),
    technicalNotes: z.string().optional(),
  }),
})
  .then(getProjectIdea)
  .then(projectManagerReview)
  .then(engineeringLeadReview)
  .then(outputSummary);

projectWorkflow.commit();
