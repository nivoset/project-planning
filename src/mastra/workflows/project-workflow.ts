import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { projectManagerAgent } from "../agents/project-manager";
import { engineeringLeadAgent } from "../agents/engineering-lead-agent";
import { researchAgent } from "../agents/research-agent";
import { taskSplitterAgent } from '../agents/task-splitter-agent';
import { githubCreateIssueTool } from '../tools/github-issue';

// Step 1: Get overall project idea from user
const getProjectIdea = createStep({
  id: "get-project-idea",
  description: "Collect the high-level project idea from the user",
  inputSchema: z.object({
    idea: z.string().describe("The overall project idea or goal"),
    additionalContext: z.string().optional().describe("Additional context about the project"),
    githubRepoOwner: z.string().describe("GitHub repository owner"),
    githubRepoName: z.string().describe("GitHub repository name"),
  }),
  outputSchema: z.object({
    idea: z.string(),
    githubRepoOwner: z.string(),
    githubRepoName: z.string(),
  }),
  execute: async ({ inputData }) => {
    return {
      idea: inputData.idea + (inputData.additionalContext ? `\n\nAdditional Context: ${inputData.additionalContext}` : ""),
      githubRepoOwner: inputData.githubRepoOwner,
      githubRepoName: inputData.githubRepoName,
    };
  },
});

// Step 2: Project manager review (recursive)
const projectManagerReview = createStep({
  id: "project-manager-review",
  description:
    "Project manager reviews the idea, asks questions, and identifies missing info/data sources. Loops until all questions are resolved.",
  inputSchema: z.object({
    idea: z.string(),
    githubRepoOwner: z.string(),
    githubRepoName: z.string(),
    context: z.any().optional(),
    previousQuestions: z.array(z.string()).optional(),
    previousAnswers: z.record(z.string(), z.string()).optional(),
  }),
  outputSchema: z.object({
    idea: z.string(),
    githubRepoOwner: z.string(),
    githubRepoName: z.string(),
    tasks: z.array(z.string()),
    dependencies: z.array(z.string()),
    openQuestions: z.array(z.string()),
  }),
  execute: async ({ inputData }) => {
    // Call the project manager agent with the idea, get the tasks, dependencies, and open questions
    const response = await projectManagerAgent.generate(inputData.idea, {
      output: z.object({
        tasks: z.array(z.string()).describe("A list of major tasks"),
        dependencies: z.array(z.string()).describe("A list of dependencies"),
        openQuestions: z.array(z.string()).describe("A list of open questions"),
      }),
    });

    return {
      idea: inputData.idea,
      githubRepoOwner: inputData.githubRepoOwner,
      githubRepoName: inputData.githubRepoName,
      ...response.object,
    };
  },
});

// Step 3: Engineering lead review (recursive)
const engineeringLeadReview = createStep({
  id: "engineering-lead-review",
  description:
    "Engineering lead reviews requirements, adds technical questions/clarifications, and suggests improvements. Loops until all questions are resolved.",
  inputSchema: z.object({
    idea: z.string(),
    githubRepoOwner: z.string(),
    githubRepoName: z.string(),
    context: z.any().optional(),
    tasks: z.array(z.string()).describe("A list of major tasks"),
    dependencies: z.array(z.string()).describe("A list of dependencies"),
    openQuestions: z.array(z.string()).describe("A list of open questions"),
    userQuestions: z.array(z.string()),
    answers: z.record(z.string(), z.string()).optional().describe("A list of answers"),
    technicalNotes: z.string().optional().describe("A list of technical notes"),
  }),
  outputSchema: z.object({
    idea: z.string(),
    githubRepoOwner: z.string(),
    githubRepoName: z.string(),
    context: z.any().optional(),
    openQuestions: z.array(z.string()),
    userQuestions: z.array(z.string()),
    answers: z.record(z.string(), z.string()),
    dataSources: z.array(z.string()),
    technicalNotes: z.string().optional(),
  }),
  execute: async ({ inputData }) => {
    // Call the engineering lead agent with the current state
    const response = await engineeringLeadAgent.generate(`${
      inputData.idea}
      Tasks: ${inputData.tasks?.join("\n") || "no tasks yet"}
      Dependencies: ${inputData.dependencies?.join("\n") || "no dependencies yet"}
      Open Questions: ${inputData.openQuestions?.join("\n") || "no open questions yet"}
      User Questions: ${inputData.userQuestions?.join("\n") || "no user questions yet"}
      Technical Notes: ${inputData.technicalNotes || "no notes yet"}`,
      {
        output: z.object({
          text: z.string(),
          openQuestions: z.array(z.string()),
          userQuestions: z.array(z.string()),
          dataSources: z.array(z.string()),
          technicalNotes: z.string().optional().describe("A list of technical notes, or answers to questions").default(""),
        }),
      }
    );
    return {
      idea: inputData.idea,
      githubRepoOwner: inputData.githubRepoOwner,
      githubRepoName: inputData.githubRepoName,
      ...response.object,
      answers: inputData.answers || {},
      technicalNotes: (inputData.technicalNotes || "") + (response.object.technicalNotes || ""),
      context: inputData.context,
    };
  },
});

const splitTasksStep = createStep({
  id: "split-tasks",
  description: "Split tasks and questions into GitHub issues, closing unneeded ones and creating new ones as needed.",
  inputSchema: z.object({
    idea: z.string(),
    githubRepoOwner: z.string(),
    githubRepoName: z.string(),
    tasks: z.array(z.string()),
    openQuestions: z.array(z.string()),
    userQuestions: z.array(z.string()),
    answers: z.record(z.string(), z.string()),
    dataSources: z.array(z.string()),
    technicalNotes: z.string().optional(),
    context: z.any().optional(),
    unAnsweredQuestions: z.array(z.string()).optional().default([]),
  }),
  outputSchema: z.object({
    idea: z.string(),
    githubRepoOwner: z.string(),
    githubRepoName: z.string(),
    createdIssues: z.array(z.object({ title: z.string(), number: z.number(), url: z.string(), type: z.enum(["work", "research"]) })),
    closedIssues: z.array(z.object({ title: z.string(), number: z.number(), url: z.string() })),
    remainingIssues: z.array(z.object({ title: z.string(), number: z.number(), url: z.string(), type: z.enum(["work", "research"]) })),
    questionToResearchIssue: z.record(z.string(), z.number()),
    tasks: z.array(z.string()),
    openQuestions: z.array(z.string()),
    userQuestions: z.array(z.string()),
    answers: z.record(z.string(), z.string()),
    dataSources: z.array(z.string()),
    technicalNotes: z.string().optional(),
    context: z.any().optional(),
    unAnsweredQuestions: z.array(z.string()).optional().default([]),
  }),
  execute: async ({ inputData }) => {
    const response = await taskSplitterAgent.generate(
      `Project Idea: ${inputData.idea}
GitHub Repo Owner: ${inputData.githubRepoOwner}
GitHub Repo Name: ${inputData.githubRepoName}
Tasks: ${inputData.tasks.join("\n")}
Open Questions: ${inputData.openQuestions.join("\n")}
User Questions: ${inputData.userQuestions.join("\n")}`,
      { output: z.object({
        createdIssues: z.array(z.object({ title: z.string(), number: z.number(), url: z.string(), type: z.enum(["work", "research"]) })),
        closedIssues: z.array(z.object({ title: z.string(), number: z.number(), url: z.string() })),
        remainingIssues: z.array(z.object({ title: z.string(), number: z.number(), url: z.string(), type: z.enum(["work", "research"]) })),
        questionToResearchIssue: z.record(z.string(), z.number()),
      })}
    );
    return {
      idea: inputData.idea,
      githubRepoOwner: inputData.githubRepoOwner,
      githubRepoName: inputData.githubRepoName,
      createdIssues: response.object.createdIssues,
      closedIssues: response.object.closedIssues,
      remainingIssues: response.object.remainingIssues,
      questionToResearchIssue: response.object.questionToResearchIssue,
      tasks: inputData.tasks,
      openQuestions: inputData.openQuestions,
      userQuestions: inputData.userQuestions,
      answers: inputData.answers,
      dataSources: inputData.dataSources,
      technicalNotes: inputData.technicalNotes,
      context: inputData.context,
      unAnsweredQuestions: inputData.unAnsweredQuestions || [],
    };
  },
});

const splitQuestionsStep = createStep({
  id: "split-questions",
  description: "Split openQuestions into an array of single-question objects for research.",
  inputSchema: z.object({
    idea: z.string(),
    githubRepoOwner: z.string(),
    githubRepoName: z.string(),
    context: z.any().optional(),
    openQuestions: z.array(z.string()),
    userQuestions: z.array(z.string()),
    answers: z.record(z.string(), z.string()),
    dataSources: z.array(z.string()),
    technicalNotes: z.string().optional(),
    unAnsweredQuestions: z.array(z.string()).optional().default([]),
  }),
  outputSchema: z.array(z.object({
    idea: z.string(),
    githubRepoOwner: z.string(),
    githubRepoName: z.string(),
    context: z.any().optional(),
    question: z.string(),
    userQuestions: z.array(z.string()),
    answers: z.record(z.string(), z.string()),
    dataSources: z.array(z.string()),
    technicalNotes: z.string().optional(),
    unAnsweredQuestions: z.array(z.string()).optional().default([]),
  })),
  execute: async ({ inputData }) => {
    return (inputData.openQuestions || []).map(q => ({
      idea: inputData.idea,
      githubRepoOwner: inputData.githubRepoOwner,
      githubRepoName: inputData.githubRepoName,
      context: inputData.context,
      question: q,
      userQuestions: inputData.userQuestions,
      answers: inputData.answers,
      dataSources: inputData.dataSources,
      technicalNotes: inputData.technicalNotes,
      unAnsweredQuestions: inputData.unAnsweredQuestions || [],
    }));
  }
});

const researchStep = createStep({
  id: "research-agent",
  description: "Research a given topic and provide a summary of the information.",
  inputSchema: z.object({
    idea: z.string(),
    githubRepoOwner: z.string(),
    githubRepoName: z.string(),
    context: z.any().optional(),
    question: z.string(),
    userQuestions: z.array(z.string()),
    answers: z.record(z.string(), z.string()),
    dataSources: z.array(z.string()),
    technicalNotes: z.string().optional(),
    unAnsweredQuestions: z.array(z.string()).optional().default([]),
  }),
  outputSchema: z.object({
    idea: z.string(),
    githubRepoOwner: z.string(),
    githubRepoName: z.string(),
    context: z.any().optional(),
    question: z.string(),
    userQuestions: z.array(z.string()),
    answer: z.string().optional(),
    couldNotAnswer: z.boolean().optional(),
    dataSources: z.array(z.string()),
    technicalNotes: z.string().optional(),
    unAnsweredQuestions: z.array(z.string()).optional().default([]),
  }),
  execute: async ({ inputData }) => {
    const response = await researchAgent.generate(
      `Idea: ${inputData.idea}
       Technical Notes: ${inputData.technicalNotes || "no notes yet"}
       Data Sources: ${inputData.dataSources.join("\n")}
       Question: ${inputData.question}`,
      { output: z.object({
        answer: z.string().optional(),
        couldNotAnswer: z.boolean().optional(),
      })}
    );
    return {
      ...inputData,
      answer: response.object.answer,
      couldNotAnswer: response.object.couldNotAnswer,
    };
  },
});

const mergeResearchResultsStep = createStep({
  id: "merge-research-results",
  description: "Merge research results back into workflow state.",
  inputSchema: z.array(z.object({
    idea: z.string(),
    githubRepoOwner: z.string(),
    githubRepoName: z.string(),
    context: z.any().optional(),
    question: z.string(),
    userQuestions: z.array(z.string()),
    answer: z.string().optional(),
    couldNotAnswer: z.boolean().optional(),
    dataSources: z.array(z.string()),
    technicalNotes: z.string().optional(),
    unAnsweredQuestions: z.array(z.string()).optional().default([]),
    tasks: z.array(z.string()).optional(),
  })),
  outputSchema: z.object({
    idea: z.string(),
    githubRepoOwner: z.string(),
    githubRepoName: z.string(),
    context: z.any().optional(),
    openQuestions: z.array(z.string()),
    userQuestions: z.array(z.string()),
    answers: z.record(z.string(), z.string()),
    dataSources: z.array(z.string()),
    technicalNotes: z.string().optional(),
    unAnsweredQuestions: z.array(z.string()).optional().default([]),
    tasks: z.array(z.string()),
  }),
  execute: async ({ inputData }) => {
    const answers = {};
    const openQuestions: string[] = [];
    const unAnsweredQuestions: string[] = [];
    let userQuestions: string[] = [];
    let idea = "";
    let context, dataSources, technicalNotes, githubRepoOwner, githubRepoName, tasks: string[] = [];
    for (const result of inputData) {
      idea = result.idea;
      githubRepoOwner = result.githubRepoOwner;
      githubRepoName = result.githubRepoName;
      context = result.context;
      dataSources = result.dataSources;
      technicalNotes = result.technicalNotes;
      userQuestions = result.userQuestions;
      if (result.tasks) tasks = result.tasks;
      if (result.answer) {
        answers[result.question] = result.answer;
      } else if (result.couldNotAnswer) {
        openQuestions.push(result.question);
        unAnsweredQuestions.push(result.question);
      }
    }
    return {
      idea,
      githubRepoOwner,
      githubRepoName,
      context,
      openQuestions,
      userQuestions,
      answers,
      dataSources,
      technicalNotes,
      unAnsweredQuestions,
      tasks,
    };
  }
});

// Step: Push created issues to GitHub using an agent
const pushTasksToGitHubStep = createStep({
  id: "push-tasks-to-github",
  description: "Push created issues to GitHub using the provided repo and owner via an agent.",
  inputSchema: splitTasksStep.outputSchema,
  outputSchema: z.object({
    pushedIssues: z.array(z.object({
      title: z.string(),
      number: z.number(),
      url: z.string(),
      type: z.enum(["work", "research"]),
      pushed: z.boolean(),
      githubUrl: z.string().optional(),
    })),
    // Forward all workflow state for downstream use if needed
    idea: z.string(),
    githubRepoOwner: z.string(),
    githubRepoName: z.string(),
    createdIssues: z.array(z.object({ title: z.string(), number: z.number(), url: z.string(), type: z.enum(["work", "research"]) })),
    closedIssues: z.array(z.object({ title: z.string(), number: z.number(), url: z.string() })),
    remainingIssues: z.array(z.object({ title: z.string(), number: z.number(), url: z.string(), type: z.enum(["work", "research"]) })),
    questionToResearchIssue: z.record(z.string(), z.number()),
    tasks: z.array(z.string()),
    openQuestions: z.array(z.string()),
    userQuestions: z.array(z.string()),
    answers: z.record(z.string(), z.string()),
    dataSources: z.array(z.string()),
    technicalNotes: z.string().optional(),
    context: z.any().optional(),
    unAnsweredQuestions: z.array(z.string()).optional().default([]),
  }),
  execute: async ({ inputData, runtimeContext }) => {
    // Actually create issues in GitHub using the tool
    const pushedIssues: Array<{ title: string; number: number; url: string; type: "work" | "research"; pushed: boolean; githubUrl?: string }> = [];
    for (const issue of inputData.createdIssues) {
      try {
        const result = await githubCreateIssueTool.execute({
          context: {
            owner: inputData.githubRepoOwner,
            repo: inputData.githubRepoName,
            title: issue.title,
            // Optionally, you could add body, labels, assignees here if available
          },
          runtimeContext,
        });
        pushedIssues.push({
          title: result.title,
          number: result.number,
          url: result.url,
          type: issue.type,
          pushed: true,
          githubUrl: result.url,
        });
      } catch (e) {
        pushedIssues.push({
          title: issue.title,
          number: issue.number,
          url: issue.url,
          type: issue.type,
          pushed: false,
          githubUrl: undefined,
        });
      }
    }
    return {
      pushedIssues,
      ...inputData,
    };
  },
});

// Step 4: Output summary
const outputSummary = createStep({
  id: "output-summary",
  description:
    "Output a summary with all resolved info, open questions, and data sources.",
  inputSchema: splitTasksStep.outputSchema,
  outputSchema: z.object({
    summary: z.string(),
  }),
  execute: async ({ inputData }) => {
    // Compose a single summary text
    const summary = [
      `Project Idea: ${inputData.idea}`,
      `GitHub Repo: ${inputData.githubRepoOwner}/${inputData.githubRepoName}`,
      inputData.tasks.length ? `Tasks:\n${inputData.tasks.map(t => `- ${t}`).join("\n")}` : '',
      inputData.openQuestions.length ? `Open Questions:\n${inputData.openQuestions.map(q => `- ${q}`).join("\n")}` : '',
      inputData.userQuestions.length ? `User Questions:\n${inputData.userQuestions.map(q => `- ${q}`).join("\n")}` : '',
      inputData.unAnsweredQuestions.length ? `Unanswered Questions:\n${inputData.unAnsweredQuestions.map(q => `- ${q}`).join("\n")}` : '',
      inputData.technicalNotes ? `Technical Notes:\n${inputData.technicalNotes}` : '',
      inputData.createdIssues.length ? `Created Issues:\n${inputData.createdIssues.map(i => `- [${i.type}] #${i.number}: ${i.title} (${i.url})`).join("\n")}` : '',
      inputData.closedIssues.length ? `Closed Issues:\n${inputData.closedIssues.map(i => `- #${i.number}: ${i.title} (${i.url})`).join("\n")}` : '',
      inputData.remainingIssues.length ? `Remaining Issues:\n${inputData.remainingIssues.map(i => `- [${i.type}] #${i.number}: ${i.title} (${i.url})`).join("\n")}` : '',
    ].filter(Boolean).join("\n\n");
    return { summary };
  },
});

// Workflow definition (recursive logic can be handled in the UI or by re-invoking steps as needed)
export const projectWorkflow = createWorkflow({
  id: "project-workflow",
  inputSchema: z.object({
    idea: z.string(),
    additionalContext: z.string().optional().describe("Additional context about the project"),
    githubRepoOwner: z.string().describe("GitHub repository owner"),
    githubRepoName: z.string().describe("GitHub repository name"),
  }),
  outputSchema: z.object({
    githubPush: pushTasksToGitHubStep.outputSchema,
    summary: outputSummary.outputSchema,
  }),
})
  .then(getProjectIdea)
  .then(projectManagerReview)
  .then(engineeringLeadReview)
  .then(splitQuestionsStep)
  .foreach(researchStep)
  .then(mergeResearchResultsStep)
  .then(splitTasksStep)
  .parallel([
    pushTasksToGitHubStep,
    outputSummary,
  ]);

projectWorkflow.commit();
