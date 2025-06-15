import { z } from 'zod';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { storyMappingFacilitatorAgent } from '../agents/story-mapping-facilitator-agent';
import { identifyPersonasAgent } from '../agents/identify-personas-agent';
import { mapActivitiesAgent } from '../agents/map-activities-agent';
import { breakDownStoriesAgent } from '../agents/break-down-stories-agent';
import { prioritizeFlowAgent } from '../agents/prioritize-flow-agent';
import { spotGapsAgent } from '../agents/spot-gaps-agent';
import { sliceReleasesAgent } from '../agents/slice-releases-agent';
import { collaborateAgent } from '../agents/collaborate-agent';

// --- Zod Schemas for each step ---

// 1. Frame the Problem / Define the Goal
const FrameProblemSchema = z.object({
  goalStatement: z.string().describe('As a [type of user], I want [action] so that [benefit].'),
  majorQuestions: z.array(z.string()).optional(),
  researchTasks: z.array(z.string()).optional(),
});

const EarlyExitSchema = FrameProblemSchema;

const WorkflowOutputSchema = z.union([
  EarlyExitSchema,
  z.object({
    updatedMap: z.string(),
    sessionBlocks: z.array(z.object({
      date: z.string(),
      durationHours: z.number(),
      focus: z.string(),
    })),
    participants: z.array(z.string()),
    facilitator: z.string(),
    releases: z.array(z.object({
      name: z.string(),
      stories: z.array(z.string()),
    })),
    goalStatement: z.string(),
  })
]);

// 2. Identify Personas
const PersonasSchema = z.object({
  personas: z.array(z.object({
    name: z.string(),
    description: z.string(),
    goals: z.array(z.string()),
    painPoints: z.array(z.string()),
    behaviors: z.array(z.string()),
  })),
  goalStatement: z.string(),
});

// 3. Map High-Level Activities (Backbone)
const ActivitiesSchema = z.object({
  activities: z.array(z.string()),
  personas: PersonasSchema.shape.personas,
  goalStatement: z.string(),
});

// 4. Break Down into Stories
const StoriesSchema = z.object({
  activityStories: z.array(z.object({
    activity: z.string(),
    stories: z.array(z.string()), // user stories in "As a ... I want ... so that ..." format
  })),
  activities: ActivitiesSchema.shape.activities,
  personas: PersonasSchema.shape.personas,
  goalStatement: z.string(),
});

// 5. Prioritize & Identify Flow
const PrioritizedStoriesSchema = z.object({
  prioritizedStories: z.array(z.object({
    activity: z.string(),
    stories: z.array(z.object({
      story: z.string(),
      priority: z.number(),
      flow: z.string().optional(),
    })),
  })),
  activityStories: StoriesSchema.shape.activityStories,
  personas: PersonasSchema.shape.personas,
  goalStatement: z.string(),
});

// 6. Spot Gaps, Dependencies & Risks
const GapsDependenciesSchema = z.object({
  gaps: z.array(z.string()),
  dependencies: z.array(z.string()),
  risks: z.array(z.string()),
  prioritizedStories: PrioritizedStoriesSchema.shape.prioritizedStories,
  personas: PersonasSchema.shape.personas,
  goalStatement: z.string(),
});

// 7. Slice into Releases or Sprints
const SlicesSchema = z.object({
  releases: z.array(z.object({
    name: z.string(),
    stories: z.array(z.string()),
  })),
  gaps: GapsDependenciesSchema.shape.gaps,
  dependencies: GapsDependenciesSchema.shape.dependencies,
  risks: GapsDependenciesSchema.shape.risks,
  prioritizedStories: PrioritizedStoriesSchema.shape.prioritizedStories,
  personas: PersonasSchema.shape.personas,
  goalStatement: z.string(),
});

// 8. Collaborate & Facilitate
const CollaborationSchema = z.object({
  participants: z.array(z.string()),
  facilitator: z.string(),
  releases: SlicesSchema.shape.releases,
  goalStatement: z.string(),
});

// 9. Time-box Sessions
const TimeboxSchema = z.object({
  sessionBlocks: z.array(z.object({
    date: z.string(),
    durationHours: z.number(),
    focus: z.string(),
  })),
  participants: CollaborationSchema.shape.participants,
  facilitator: CollaborationSchema.shape.facilitator,
  releases: SlicesSchema.shape.releases,
  goalStatement: z.string(),
});

// 10. Iterate and Refine
const IterationSchema = z.object({
  updatedMap: z.string().describe('Summary of changes or refinements.'),
  sessionBlocks: TimeboxSchema.shape.sessionBlocks,
  participants: CollaborationSchema.shape.participants,
  facilitator: CollaborationSchema.shape.facilitator,
  releases: SlicesSchema.shape.releases,
  goalStatement: z.string(),
});

const OutputNeedsSchema = z.object({
  summary: z.string(),
});

// --- Steps ---

const frameProblemStep = createStep({
  id: 'frame-problem',
  description: 'Frame the problem and define the goal.',
  inputSchema: FrameProblemSchema,
  outputSchema: FrameProblemSchema,
  execute: async ({ inputData }) => {
    // Use the agent to frame the problem
    const result = await storyMappingFacilitatorAgent.generate(inputData.goalStatement, {
      output: FrameProblemSchema,
    });
    // If there are major questions or research tasks, return them and stop processing
    if ((result.object.majorQuestions?.length ?? 0) > 0 ||
        ((result.object.researchTasks?.length ?? 0) > 0) ||
        !result.object.goalStatement) {
      // Early exit: return the questions/research tasks, do not proceed
      return {
        goalStatement: result.object.goalStatement || '',
        majorQuestions: result.object.majorQuestions || [],
        researchTasks: result.object.researchTasks || [],
      };
    }
    // Otherwise, return the goal statement
    return {
      goalStatement: result.object.goalStatement,
    };
  },
});

const outputNeedsStep = createStep({
  id: 'output-needs',
  description: 'Output a summary of missing information or research tasks.',
  inputSchema: FrameProblemSchema,
  outputSchema: OutputNeedsSchema,
  execute: async ({ inputData, suspend }) => {
    if ((inputData.majorQuestions?.length ?? 0) > 0) {
      await suspend({
        inputData: {
          majorQuestions: inputData.majorQuestions,
        },
      });
    }

    let summary = '';
    if ((inputData.majorQuestions?.length ?? 0) > 0) {
      summary += 'Major questions to resolve before proceeding:\n' + inputData.majorQuestions!.map(q => `- ${q}`).join('\n') + '\n';
    }
    if ((inputData.researchTasks?.length ?? 0) > 0) {
      summary += 'Research tasks needed:\n' + inputData.researchTasks!.map(r => `- ${r}`).join('\n') + '\n';
    }
    if (!summary) summary = 'No major questions or research tasks.';
    return { summary };
  },
});


const identifyPersonasStep = createStep({
  id: 'identify-personas',
  description: 'Identify key user personas.',
  inputSchema: FrameProblemSchema,
  outputSchema: PersonasSchema,
  execute: async ({ inputData }) => {
    const result = await identifyPersonasAgent.generate(inputData.goalStatement, {
      output: PersonasSchema,
    });
    return result.object;
  },
});

const unwrapIdentifyPersonasStep = createStep({
  id: 'unwrap-identify-personas',
  description: 'Unwrap identify-personas branch output.',
  inputSchema: z.object({
    'output-needs': OutputNeedsSchema,
    'identify-personas': PersonasSchema,
  }),
  outputSchema: PersonasSchema,
  execute: async ({ inputData }) => {
    if (inputData['identify-personas']) {
      return inputData['identify-personas'];
    }
    throw new Error('No identify-personas branch to unwrap');
  },
});

const mapActivitiesStep = createStep({
  id: 'map-activities',
  description: 'Map high-level activities (backbone).',
  inputSchema: PersonasSchema,
  outputSchema: ActivitiesSchema,
  execute: async ({ inputData }) => {
    const result = await mapActivitiesAgent.generate(`
      ${inputData.personas.map(persona => `Persona: ${persona.name} - ${persona.description}`).join('\n')}
      ${inputData.goalStatement}
      `, {
      output: ActivitiesSchema,
    });
    return result.object;
  },
});

const breakDownStoriesStep = createStep({
  id: 'break-down-stories',
  description: 'Break down activities into user stories.',
  inputSchema: ActivitiesSchema,
  outputSchema: StoriesSchema,
  execute: async ({ inputData }) => {
    const result = await breakDownStoriesAgent.generate(`
      ${inputData.activities.map(activity => `Activity: ${activity}`).join('\n')}
      ${inputData.personas.map(persona => `Persona: ${persona.name} - ${persona.description}`).join('\n')}
      ${inputData.goalStatement}
      `, {
      output: StoriesSchema,
    });
    return result.object;
  },
});

const prioritizeFlowStep = createStep({
  id: 'prioritize-flow',
  description: 'Prioritize stories and identify flow.',
  inputSchema: StoriesSchema,
  outputSchema: PrioritizedStoriesSchema,
  execute: async ({ inputData }) => {
    const result = await prioritizeFlowAgent.generate(`
      ${inputData.activityStories.map(activityStory => `Activity Story: ${activityStory.activity} - ${activityStory.stories.join('\n')}`).join('\n')}
      ${inputData.personas.map(persona => `Persona: ${persona.name} - ${persona.description}`).join('\n')}
      ${inputData.goalStatement}
      `, {
      output: PrioritizedStoriesSchema,
    });
    return result.object;
  },
});

const spotGapsStep = createStep({
  id: 'spot-gaps',
  description: 'Spot gaps, dependencies, and risks.',
  inputSchema: PrioritizedStoriesSchema,
  outputSchema: GapsDependenciesSchema,
  execute: async ({ inputData }) => {
    const result = await spotGapsAgent.generate(`
      ${inputData.prioritizedStories.map(prioritizedStory => `Prioritized Story: ${prioritizedStory.activity} - ${prioritizedStory.stories.join('\n')}`).join('\n')}
      ${inputData.personas.map(persona => `Persona: ${persona.name} - ${persona.description}`).join('\n')}
      ${inputData.goalStatement}
      `, {
      output: GapsDependenciesSchema,
    });
    return result.object;
  },
});

const sliceReleasesStep = createStep({
  id: 'slice-releases',
  description: 'Slice into releases or sprints.',
  inputSchema: GapsDependenciesSchema,
  outputSchema: SlicesSchema,
  execute: async ({ inputData }) => {
    const result = await sliceReleasesAgent.generate(`
      ${inputData.prioritizedStories.map(prioritizedStory => `Prioritized Story: ${prioritizedStory.activity} - ${prioritizedStory.stories.join('\n')}`).join('\n')}
      ${inputData.personas.map(persona => `Persona: ${persona.name} - ${persona.description}`).join('\n')}
      ${inputData.goalStatement}
      `, {
      output: SlicesSchema,
    });
    return result.object;
  },
});

const collaborateStep = createStep({
  id: 'collaborate',
  description: 'Collaborate and facilitate.',
  inputSchema: SlicesSchema,
  outputSchema: CollaborationSchema,
  execute: async ({ inputData }) => {
    const result = await collaborateAgent.generate(`
      ${inputData.releases.map(release => `Release: ${release.name} - ${release.stories.join('\n')}`).join('\n')}
      ${inputData.personas.map(persona => `Persona: ${persona.name} - ${persona.description}`).join('\n')}
      ${inputData.goalStatement}
      `, {
      output: CollaborationSchema,
    });
    return result.object;
  },
});

const timeboxStep = createStep({
  id: 'timebox',
  description: 'Time-box sessions.',
  inputSchema: CollaborationSchema,
  outputSchema: TimeboxSchema,
  execute: async ({ inputData }) => {
    // TODO: LLM logic for time-boxing
    return { sessionBlocks: [], participants: inputData.participants, facilitator: inputData.facilitator, releases: inputData.releases, goalStatement: inputData.goalStatement };
  },
});

const iterateRefineStep = createStep({
  id: 'iterate-refine',
  description: 'Iterate and refine the map.',
  inputSchema: TimeboxSchema,
  outputSchema: IterationSchema,
  execute: async ({ inputData }) => {
    // TODO: LLM logic for iteration/refinement
    return { updatedMap: '', sessionBlocks: inputData.sessionBlocks, participants: inputData.participants, facilitator: inputData.facilitator, releases: inputData.releases, goalStatement: inputData.goalStatement };
  },
});

const fullStoryMappingStep = createStep({
  id: 'full-story-mapping',
  description: 'Output of data.',
  inputSchema: IterationSchema,
  outputSchema: z.string(),
  execute: async ({ inputData, ...context }) => {
    return JSON.stringify(inputData, null, 2);
  },
});

// --- Workflow ---

export const storyMappingWorkflow = createWorkflow({
  id: 'story-mapping-workflow',
  inputSchema: z.object({ goalStatement: z.string() }),
  outputSchema: z.union([OutputNeedsSchema, WorkflowOutputSchema]),
})
  .then(frameProblemStep)
  .branch([
    [async (output) => (output?.inputData?.majorQuestions?.length ?? 0) > 0, outputNeedsStep],
    [async (output) => !output?.inputData?.majorQuestions?.length, identifyPersonasStep],
  ])
  .then(unwrapIdentifyPersonasStep)
  .then(mapActivitiesStep)
  .then(breakDownStoriesStep)
  .then(prioritizeFlowStep)
  .then(spotGapsStep)
  .then(sliceReleasesStep)
  .then(collaborateStep)
  .then(timeboxStep)
  .then(iterateRefineStep)
  .then(fullStoryMappingStep)

// Optionally, commit the workflow if required by the framework
// storyMappingWorkflow.commit();
