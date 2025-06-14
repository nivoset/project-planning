import { createTool } from "@mastra/core";
import { HallucinationMetric } from "@mastra/evals/llm";
import { ollama } from "ollama-ai-provider";
import z from "zod";

export const createHallucinationMetricTool = (context: string[]) => {
  const hallucinationMetric = new HallucinationMetric(ollama('mistral'), { context, });
  return createTool({
  id: 'hallucination-metric',
  description: 'Evaluates if a given answer hallucinates facts not present in the provided legal context.',
  inputSchema: z.object({
    answer: z.string().describe('The answer to check for hallucinations'),
    question: z.string().describe('The question that was asked'),
  }),
  outputSchema: z.object({
    score: z.number().describe('Hallucination score (lower is better)'),
    explanation: z.string().describe('Explanation of the score'),
    // hallucinations: z.array(z.string()).describe('List of hallucinated facts, if any'),
  }),
  execute: async ({ context }) => {
    const answer = context?.answer;
    if (!answer) {
      return {
        score: 1,
        explanation: 'No answer provided.',
      };
    }
    // Evaluate hallucination
    const result = await hallucinationMetric.measure(context?.question, answer);
    console.log('hallucinationMetric', result);
    return {
      score: result.score,
      explanation: result.info.reason,
    };
  },
})};