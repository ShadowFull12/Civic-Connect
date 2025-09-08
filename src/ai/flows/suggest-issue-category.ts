
'use server';
/**
 * @fileOverview Suggests an issue category based on the user's description.
 *
 * - suggestIssueCategory - A function that handles the category suggestion process.
 * - SuggestIssueCategoryInput - The input type for the suggestIssueCategory function.
 * - SuggestIssueCategoryOutput - The return type for the suggestIssueCategory function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const issueCategories = [
  'Pothole',
  'Streetlight Outage',
  'Garbage Overflow',
  'Water Leakage',
  'Damaged Public Property',
  'Other'
];

const SuggestIssueCategoryInputSchema = z.object({
  description: z.string().describe('A detailed description of the reported issue.'),
});
export type SuggestIssueCategoryInput = z.infer<
  typeof SuggestIssueCategoryInputSchema
>;

const SuggestIssueCategoryOutputSchema = z.object({
  category: z
    .enum(issueCategories as [string, ...string[]])
    .describe(
      'The suggested issue category. Must be one of the predefined categories.'
    ),
});
export type SuggestIssueCategoryOutput = z.infer<
  typeof SuggestIssueCategoryOutputSchema
>;

export async function suggestIssueCategory(
  input: SuggestIssueCategoryInput
): Promise<SuggestIssueCategoryOutput> {
  return suggestIssueCategoryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestIssueCategoryPrompt',
  input: {schema: SuggestIssueCategoryInputSchema},
  output: {schema: SuggestIssueCategoryOutputSchema},
  prompt: `You are an expert at classifying civic issues. Based on the user's description, suggest the single most appropriate category from the following list.

Available Categories:
- Pothole
- Streetlight Outage
- Garbage Overflow
- Water Leakage
- Damaged Public Property
- Other

User's Description:
"{{{description}}}"

Analyze the description and determine the best category. Your response must be only one of the categories from the list provided.`,
});

const suggestIssueCategoryFlow = ai.defineFlow(
  {
    name: 'suggestIssueCategoryFlow',
    inputSchema: SuggestIssueCategoryInputSchema,
    outputSchema: SuggestIssueCategoryOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
