
'use server';

/**
 * @fileOverview This file defines a Genkit flow for intelligent response
 * selection based on keywords from the current user message or conversation history.
 *
 * - intelligentResponseSelection - A function that takes user input and returns
 *   a list of suggested response templates.
 * - IntelligentResponseSelectionInput - The input type for the
 *   intelligentResponseSelection function.
 * - IntelligentResponseSelectionOutput - The output type for the
 *   intelligentResponseSelection function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const IntelligentResponseSelectionInputSchema = z.object({
  keywords: z
    .string()
    .describe(
      'Keywords extracted from the user message or conversation history.'
    ),
  conversationHistory: z
    .string()
    .optional()
    .describe('The history of the conversation. Optional.'),
  numSuggestions: z
    .number()
    .default(3)
    .describe('The number of response template suggestions to return.'),
  context: z
    .string()
    .optional()
    .describe('Context from knowledge base documents.'),
});
export type IntelligentResponseSelectionInput = z.infer<
  typeof IntelligentResponseSelectionInputSchema
>;

const IntelligentResponseSelectionOutputSchema = z.object({
  suggestedResponses: z.array(z.string()).describe(
    'A list of suggested response templates based on the input keywords and conversation history.'
  ),
});
export type IntelligentResponseSelectionOutput = z.infer<
  typeof IntelligentResponseSelectionOutputSchema
>;

export async function intelligentResponseSelection(
  input: IntelligentResponseSelectionInput
): Promise<IntelligentResponseSelectionOutput> {
  return intelligentResponseSelectionFlow(input);
}

const intelligentResponseSelectionPrompt = ai.definePrompt({
  name: 'intelligentResponseSelectionPrompt',
  input: {schema: IntelligentResponseSelectionInputSchema},
  output: {schema: IntelligentResponseSelectionOutputSchema},
  prompt: `You are an AI agent expert specializing in suggesting response templates for AI agents.

  {{#if context}}
  Use the following context to inform your suggestions if it is relevant to the user's query.
  Context:
  {{{context}}}
  ---
  {{/if}}

  Given the following keywords and conversation history, suggest {{numSuggestions}} response templates that would be relevant and helpful.

  Keywords: {{{keywords}}}
  Conversation History: {{{conversationHistory}}}

  Ensure the suggested responses are clear, concise, and appropriate for the context.
  Return the responses as a JSON array of strings.
  `,config: {
    safetySettings: [
      {
        category: 'HARM_CATEGORY_HATE_SPEECH',
        threshold: 'BLOCK_ONLY_HIGH',
      },
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_NONE',
      },
      {
        category: 'HARM_CATEGORY_HARASSMENT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE',
      },
      {
        category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
        threshold: 'BLOCK_LOW_AND_ABOVE',
      },
    ],
  },
});

const intelligentResponseSelectionFlow = ai.defineFlow(
  {
    name: 'intelligentResponseSelectionFlow',
    inputSchema: IntelligentResponseSelectionInputSchema,
    outputSchema: IntelligentResponseSelectionOutputSchema,
  },
  async input => {
    const {output} = await intelligentResponseSelectionPrompt(input);
    return output!;
  }
);
