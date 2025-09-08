'use server';
/**
 * @fileOverview Automatically routes reported issues to the correct department based on issue category and location.
 *
 * - autoRouteIssueToDepartment - A function that handles the issue routing process.
 * - AutoRouteIssueToDepartmentInput - The input type for the autoRouteIssueToDepartment function.
 * - AutoRouteIssueToDepartmentOutput - The return type for the autoRouteIssueToDepartment function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AutoRouteIssueToDepartmentInputSchema = z.object({
  category: z
    .string()
    .describe('The category of the reported issue (e.g., pothole, garbage, street light).'),
  description: z.string().describe('A detailed description of the reported issue.'),
  location: z
    .object({
      lat: z.number().describe('The latitude of the issue location.'),
      lng: z.number().describe('The longitude of the issue location.'),
      address: z.string().describe('The address of the issue location.'),
    })
    .describe('The location details of the reported issue.'),
});
export type AutoRouteIssueToDepartmentInput = z.infer<
  typeof AutoRouteIssueToDepartmentInputSchema
>;

const AutoRouteIssueToDepartmentOutputSchema = z.object({
  department: z
    .string()
    .describe(
      'The department to which the issue should be routed (e.g., Public Works, Sanitation, Water).'
    ),
  reason: z
    .string()
    .describe(
      'The reasoning behind the department assignment, based on the issue category, description, and location.'
    ),
});
export type AutoRouteIssueToDepartmentOutput = z.infer<
  typeof AutoRouteIssueToDepartmentOutputSchema
>;

export async function autoRouteIssueToDepartment(
  input: AutoRouteIssueToDepartmentInput
): Promise<AutoRouteIssueToDepartmentOutput> {
  return autoRouteIssueToDepartmentFlow(input);
}

const prompt = ai.definePrompt({
  name: 'autoRouteIssueToDepartmentPrompt',
  input: {schema: AutoRouteIssueToDepartmentInputSchema},
  output: {schema: AutoRouteIssueToDepartmentOutputSchema},
  prompt: `You are an expert civic issue routing specialist. Given the following issue details, determine the most appropriate department to handle the issue. Explain your reasoning.

Issue Category: {{{category}}}
Description: {{{description}}}
Location: {{{location.address}}} (Latitude: {{{location.lat}}}, Longitude: {{{location.lng}}})

Based on the issue category, description and location, which department should handle this issue, and why?

Department: 
Reason: `,
});

const autoRouteIssueToDepartmentFlow = ai.defineFlow(
  {
    name: 'autoRouteIssueToDepartmentFlow',
    inputSchema: AutoRouteIssueToDepartmentInputSchema,
    outputSchema: AutoRouteIssueToDepartmentOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
