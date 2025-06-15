import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { projectManagerAgent } from "../agents/project-manager";
import { engineeringLeadAgent } from "../agents/engineering-lead-agent";
import { researchAgent } from "../agents/research-agent";

// Step 1: Get overall project idea from user
const getProjectIdea = createStep({
  id: "get-project-idea",
  description: "Collect the high-level project idea from the user",
  inputSchema: z.object({
    idea: z.string().describe("The overall project idea or goal"),
    userAnswers: z.record(z.string(), z.string()).optional(),
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
  id: "project-manager-review",
  description:
    "Project manager reviews the idea, asks questions, and identifies missing info/data sources. Loops until all questions are resolved.",
  inputSchema: z.object({
    idea: z.string(),
    context: z.any().optional(),
    previousQuestions: z.array(z.string()).optional(),
    previousAnswers: z.record(z.string(), z.string()).optional(),
  }),
  outputSchema: z.object({
    idea: z.string(),
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
      ...response.object,
      answers: inputData.answers || {},
      technicalNotes: (inputData.technicalNotes || "") + (response.object.technicalNotes || ""),
    };
  },
});

const splitQuestionsStep = createStep({
  id: "split-questions",
  description: "Split openQuestions into an array of single-question objects for research.",
  inputSchema: z.object({
    idea: z.string(),
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
    context: z.any().optional(),
    question: z.string(),
    userQuestions: z.array(z.string()),
    answer: z.string().optional(),
    couldNotAnswer: z.boolean().optional(),
    dataSources: z.array(z.string()),
    technicalNotes: z.string().optional(),
    unAnsweredQuestions: z.array(z.string()).optional().default([]),
  })),
  outputSchema: z.object({
    idea: z.string(),
    context: z.any().optional(),
    openQuestions: z.array(z.string()),
    userQuestions: z.array(z.string()),
    answers: z.record(z.string(), z.string()),
    dataSources: z.array(z.string()),
    technicalNotes: z.string().optional(),
    unAnsweredQuestions: z.array(z.string()).optional().default([]),
  }),
  execute: async ({ inputData }) => {
    const answers = {};
    const openQuestions: string[] = [];
    const unAnsweredQuestions: string[] = [];
    let userQuestions: string[] = [];
    let idea = "";
    let context, dataSources, technicalNotes;
    for (const result of inputData) {
      idea = result.idea;
      context = result.context;
      dataSources = result.dataSources;
      technicalNotes = result.technicalNotes;
      userQuestions = result.userQuestions;
      if (result.answer) {
        answers[result.question] = result.answer;
      } else if (result.couldNotAnswer) {
        openQuestions.push(result.question);
        unAnsweredQuestions.push(result.question);
      }
    }
    return {
      idea,
      context,
      openQuestions,
      userQuestions,
      answers,
      dataSources,
      technicalNotes,
      unAnsweredQuestions,
    };
  }
});

// Step 4: Output summary
const outputSummary = createStep({
  id: "output-summary",
  description:
    "Output a summary with all resolved info, open questions, and data sources.",
  inputSchema: z.object({
    idea: z.string(),
    context: z.any().optional(),
    openQuestions: z.array(z.string()),
    userQuestions: z.array(z.string()),
    answers: z.record(z.string(), z.string()),
    dataSources: z.array(z.string()),
    unAnsweredQuestions: z.array(z.string()).optional().default([]).describe("A list of unanswered questions"),
    technicalNotes: z.string().optional(),
  }),
  outputSchema: z.object({
    summary: z.string(),
    openQuestions: z.array(z.string()),
    userQuestions: z.array(z.string()),
    answers: z.record(z.string(), z.string()),
    dataSources: z.array(z.string()),
    technicalNotes: z.string().optional(),
  }),
  execute: async ({ inputData }) => {
    // Compose a summary
    const summary = `
    Project Idea: ${inputData.idea}

    Data Sources: ${inputData.dataSources.join(", ")}

    Technical Notes: ${inputData.technicalNotes || ""}

    Open Questions: ${inputData.openQuestions.join("\n")}

    User Questions: ${inputData.userQuestions.join("\n")}

    Unanswered Questions: ${inputData.unAnsweredQuestions.join("\n")}
    `;
    return {
      summary,
      openQuestions: inputData.openQuestions,
      userQuestions: inputData.userQuestions,
      answers: inputData.answers,
      dataSources: inputData.dataSources,
      technicalNotes: inputData.technicalNotes,
    };
  },
});

// Workflow definition (recursive logic can be handled in the UI or by re-invoking steps as needed)
export const projectWorkflow = createWorkflow({
  id: "project-workflow",
  inputSchema: z.object({
    idea: z.string(),
  }),
  outputSchema: z.object({
    summary: z.string(),
    context: z.any().optional(),
    openQuestions: z.array(z.string()),
    dataSources: z.array(z.string()),
    technicalNotes: z.string().optional(),
  }),
})
  .then(getProjectIdea)
  .then(projectManagerReview)
  .then(engineeringLeadReview)
  .then(splitQuestionsStep)
  .foreach(researchStep)
  .then(mergeResearchResultsStep)
  .then(outputSummary);

projectWorkflow.commit();
