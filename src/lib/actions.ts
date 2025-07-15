
'use server';

import {
  intelligentResponseSelection,
  type IntelligentResponseSelectionInput,
} from '@/ai/flows/intelligent-response-selection';
import { getKnowledgeFile } from './db';

export async function getAiSuggestions(input: {
  keywords: string;
  knowledgeFileIds?: string[];
}) {
  try {
    let context = '';
    if (input.knowledgeFileIds && input.knowledgeFileIds.length > 0) {
      const contextPromises = input.knowledgeFileIds.map(getKnowledgeFile);
      const files = await Promise.all(contextPromises);
      context = files
        .filter(Boolean)
        .map(file => `Content from ${file!.fileName}:\n${file!.content}`)
        .join('\n\n---\n\n');
    }

    const aiInput: IntelligentResponseSelectionInput = {
      keywords: input.keywords,
      numSuggestions: 3,
      context: context || undefined,
    };
    const result = await intelligentResponseSelection(aiInput);
    return { suggestions: result.suggestedResponses };
  } catch (e: any) {
    console.error('AI Suggestion Error:', e);
    return { error: 'Failed to get suggestions from AI. Please try again.' };
  }
}
