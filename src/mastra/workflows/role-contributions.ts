import { z } from 'zod';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';

// Unified schema for all role contributions
export const RoleContributionSchema = z.object({
  role: z.string(),
  contribution: z.string(),
});

const EpicInputSchema = z.object({ epicStatement: z.string() });

// --- Agent stubs for each role with detailed instructions ---
const productOwnerAgent = new Agent({
  name: 'Product Owner / Manager Agent',
  instructions: `
As a Product Owner / Manager, your contributions to story mapping are:
- Define the goal: Frame the user personas, product vision, and user needs.
  (See: amoeboids.com, easyagile.com, framework.scaledagile.com)
- Curate backlog: Surface existing user stories, epics, and priorities.
  (See: reddit.com, amoeboids.com, easyagile.com)
- Guide prioritization: Rationalize story ordering (value, impact, dependencies).
  (See: userstorymap.io, easyagile.com)
For each, provide a clear, actionable contribution for this epic. Output as { role: string, contribution: string }.
`,
  model: openai('gpt-4.1'),
  tools: {},
});

const facilitatorAgent = new Agent({
  name: 'Facilitator / Scrum Master Agent',
  instructions: `
As a Facilitator / Scrum Master, your contributions to story mapping are:
- Drive the process: Keep the session focused on user outcomes, not technical tangents.
  (See: reddit.com, atlassian.com, medium.com)
- Ensure participation: Encourage every voice and manage group dynamics.
  (See: nngroup.com, medium.com, mountaingoatsoftware.com)
- Time-box efficiently: Segment into manageable blocks or sprints.
  (See: uxdesign.cc)
For each, provide a clear, actionable contribution for this epic. Output as { role: string, contribution: string }.
`,
  model: openai('gpt-4.1'),
  tools: {},
});

const developerAgent = new Agent({
  name: 'Developers / Engineers Agent',
  instructions: `
As a Developer / Engineer, your contributions to story mapping are:
- Evaluate feasibility: Ask technical questions early ("How will login work?", "How to scale…?").
  (See: easyagile.com, reddit.com)
- Highlight dependencies: Surface backend, API, or platform constraints.
- Suggest alternatives: Propose leaner approaches that deliver value.
  (See: invensislearning.com, easyagile.com, atlassian.com)
For each, provide a clear, actionable contribution for this epic. Output as { role: string, contribution: string }.
`,
  model: openai('gpt-4.1'),
  tools: {},
});

const uxAgent = new Agent({
  name: 'UX/UI Designer & Researcher Agent',
  instructions: `
As a UX/UI Designer & Researcher, your contributions to story mapping are:
- Champion usability: Raise task flows, design clarity, accessibility gaps.
  (See: invensislearning.com, nngroup.com, reddit.com)
- Validate personas: Confirm user goals and signal missing scenarios.
  (See: nngroup.com, uxdesign.cc, easyagile.com)
- Sketch wireframes: Provide visual supports (not full designs) to clarify concepts.
  (See: ux.stackexchange.com)
For each, provide a clear, actionable contribution for this epic. Output as { role: string, contribution: string }.
`,
  model: openai('gpt-4.1'),
  tools: {},
});

const qaAgent = new Agent({
  name: 'QA / Testers Agent',
  instructions: `
As a QA / Tester, your contributions to story mapping are:
- Identify test scenarios: Think edge cases and validation paths under each story.
- Provide early quality checks: Point out ambiguous requirements or acceptance criteria gaps.
For each, provide a clear, actionable contribution for this epic. Output as { role: string, contribution: string }.
`,
  model: openai('gpt-4.1'),
  tools: {},
});

const analystAgent = new Agent({
  name: 'Business / Data Analyst Agent',
  instructions: `
As a Business / Data Analyst, your contributions to story mapping are:
- Back up with data: Bring metrics, usage patterns, or business logic insights.
- Suggest measurable outcomes: Add success criteria (KPIs, conversion rates, retention).
For each, provide a clear, actionable contribution for this epic. Output as { role: string, contribution: string }.
`,
  model: openai('gpt-4.1'),
  tools: {},
});

const marketingAgent = new Agent({
  name: 'Marketing / Sales Agent',
  instructions: `
As a Marketing / Sales contributor, your contributions to story mapping are:
- Align messaging: Share how features affect positioning, communications.
- Influence timing: Highlight scheduling needs (promo campaigns, seasonal demands).
  (See: invensislearning.com)
For each, provide a clear, actionable contribution for this epic. Output as { role: string, contribution: string }.
`,
  model: openai('gpt-4.1'),
  tools: {},
});

const supportAgent = new Agent({
  name: 'Customer Support / Success Agent',
  instructions: `
As a Customer Support / Success contributor, your contributions to story mapping are:
- Surface pain points: Represent voice-of-customer scenarios and typical support cases.
- Clarify support load: Point out stories that may increase complexity or volume.
For each, provide a clear, actionable contribution for this epic. Output as { role: string, contribution: string }.
`,
  model: openai('gpt-4.1'),
  tools: {},
});

const sponsorAgent = new Agent({
  name: 'Business Owner / Executive Sponsor Agent',
  instructions: `
As a Business Owner / Executive Sponsor, your contributions to story mapping are:
- Ensure alignment: Validate that prioritized work aligns with strategic goals.
- Champion the roadmap: Commit to business-wide timelines and outcome-driven releases.
For each, provide a clear, actionable contribution for this epic. Output as { role: string, contribution: string }.
`,
  model: openai('gpt-4.1'),
  tools: {},
});

const devopsAgent = new Agent({
  name: 'DevOps / Technical Ops Agent',
  instructions: `
As a DevOps / Technical Ops contributor, your contributions to story mapping are:
- Non-functional focus: Integrate deployability, reliability, monitoring needs.
- Plan operational workflows: Highlight infrastructure or integration tasks.
For each, provide a clear, actionable contribution for this epic. Output as { role: string, contribution: string }.
`,
  model: openai('gpt-4.1'),
  tools: {},
});

// --- Step creators ---
const makeRoleStep = (id: string, agent: Agent) => createStep({
  id,
  inputSchema: EpicInputSchema,
  outputSchema: RoleContributionSchema,
  execute: async ({ inputData }) => {
    const result = await agent.generate(inputData.epicStatement, { output: RoleContributionSchema });
    return result.object;
  },
});

const makeRoleFeedbackStep = (id: string, agent: Agent) => createStep({
  id,
  inputSchema: z.object({
    epicStatement: z.string(),
    allResponses: z.record(z.string(), RoleContributionSchema),
    previous: RoleContributionSchema,
  }),
  outputSchema: RoleContributionSchema,
  execute: async ({ inputData }) => {
    const prompt = `Epic: ${inputData.epicStatement}\nAll responses: ${JSON.stringify(inputData.allResponses, null, 2)}\nYour previous: ${inputData.previous.contribution}`;
    const result = await agent.generate(prompt, { output: RoleContributionSchema });
    return result.object;
  },
});

// --- Initial steps ---
const productOwnerStep = makeRoleStep('productOwner', productOwnerAgent);
const facilitatorStep = makeRoleStep('facilitator', facilitatorAgent);
const developerStep = makeRoleStep('developer', developerAgent);
const uxStep = makeRoleStep('ux', uxAgent);
const qaStep = makeRoleStep('qa', qaAgent);
const analystStep = makeRoleStep('analyst', analystAgent);
const marketingStep = makeRoleStep('marketing', marketingAgent);
const supportStep = makeRoleStep('support', supportAgent);
const sponsorStep = makeRoleStep('sponsor', sponsorAgent);
const devopsStep = makeRoleStep('devops', devopsAgent);

// --- Feedback steps ---
const productOwnerFeedbackStep = makeRoleFeedbackStep('productOwner-feedback', productOwnerAgent);
const facilitatorFeedbackStep = makeRoleFeedbackStep('facilitator-feedback', facilitatorAgent);
const developerFeedbackStep = makeRoleFeedbackStep('developer-feedback', developerAgent);
const uxFeedbackStep = makeRoleFeedbackStep('ux-feedback', uxAgent);
const qaFeedbackStep = makeRoleFeedbackStep('qa-feedback', qaAgent);
const analystFeedbackStep = makeRoleFeedbackStep('analyst-feedback', analystAgent);
const marketingFeedbackStep = makeRoleFeedbackStep('marketing-feedback', marketingAgent);
const supportFeedbackStep = makeRoleFeedbackStep('support-feedback', supportAgent);
const sponsorFeedbackStep = makeRoleFeedbackStep('sponsor-feedback', sponsorAgent);
const devopsFeedbackStep = makeRoleFeedbackStep('devops-feedback', devopsAgent);

// Step to wrap parallel output into { epicStatement, responses }
const wrapParallelOutput = createStep({
  id: 'wrap-parallel-output',
  inputSchema: z.object({
    epicStatement: z.string(),
    productOwner: RoleContributionSchema,
    facilitator: RoleContributionSchema,
    developer: RoleContributionSchema,
    ux: RoleContributionSchema,
    qa: RoleContributionSchema,
    analyst: RoleContributionSchema,
    marketing: RoleContributionSchema,
    support: RoleContributionSchema,
    sponsor: RoleContributionSchema,
    devops: RoleContributionSchema,
  }),
  outputSchema: z.object({
    epicStatement: z.string(),
    responses: z.record(z.string(), RoleContributionSchema),
  }),
  execute: async ({ inputData }) => {
    const { epicStatement, ...roles } = inputData;
    return {
      epicStatement,
      responses: roles,
    };
  },
});

// Step to fan out responses to each feedback step
const fanOutForFeedback = createStep({
  id: 'fan-out-for-feedback',
  inputSchema: z.object({
    epicStatement: z.string(),
    responses: z.record(z.string(), RoleContributionSchema),
  }),
  outputSchema: z.record(z.string(), z.object({
    epicStatement: z.string(),
    allResponses: z.record(z.string(), RoleContributionSchema),
    previous: RoleContributionSchema,
  })),
  execute: async ({ inputData }) => {
    const { epicStatement, responses } = inputData;
    const result = {};
    for (const [role, previous] of Object.entries(responses)) {
      result[role] = { epicStatement, allResponses: responses, previous };
    }
    return result;
  },
});

// Gather step for feedback
const gatherForFeedback = createStep({
  id: 'gather-for-feedback',
  inputSchema: z.object({
    epicStatement: z.string(),
    responses: z.record(z.string(), RoleContributionSchema),
  }),
  outputSchema: z.object({
    epicStatement: z.string(),
    responses: z.record(z.string(), RoleContributionSchema),
  }),
  execute: async ({ inputData }) => inputData,
});

// Step to convert a record to an array for parallel
const recordToArray = createStep({
  id: 'record-to-array',
  inputSchema: z.record(z.string(), z.any()),
  outputSchema: z.array(z.any()),
  execute: async ({ inputData }) => Object.values(inputData),
});

// Final gather step
const gatherFinal = createStep({
  id: 'gather-final',
  
  inputSchema: z.record(z.string(), z.object({
    epicStatement: z.string(),
    allResponses: z.record(z.string(), RoleContributionSchema),
    previous: RoleContributionSchema,
  })),
  // inputSchema: z.object({
  //   epicStatement: z.string(),
  //   responses: z.record(z.string(), RoleContributionSchema),
  // }),
  outputSchema: z.string(),
  execute: async ({ inputData }) =>
    `# Role Contributions\n\n${Object.values(inputData).map(({ previous }) => `## ${previous.role}\n${previous.contribution}`).join('\n\n')}`,
});

export const roleContributionsWorkflow = createWorkflow({
  id: 'role-contributions-workflow',
  inputSchema: EpicInputSchema,
  outputSchema: z.string(),
})
.parallel([
  productOwnerStep,
  facilitatorStep,
  developerStep,
  uxStep,
  qaStep,
  analystStep,
  marketingStep,
  supportStep,
  sponsorStep,
  devopsStep,
])
.then(wrapParallelOutput)
.then(gatherForFeedback)
.then(fanOutForFeedback)
.then(gatherFinal); 
