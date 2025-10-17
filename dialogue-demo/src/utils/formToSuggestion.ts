import { TextSuggestion } from "@/components/proseMirror";
import DiffMatchPatch from 'diff-match-patch';

/**
 * Converts form data into a TextSuggestion object using section info and computes diffs.
 * @param sections Array of section objects with title and text
 * @param fieldName The selected field name (section title)
 * @param currentValue The current value of the field
 * @param newValue The new value for the field
 * @param username The username for the suggestion
 * @returns Array of TextSuggestion objects based on computed diffs
 */
export function formToSuggestion(
  sections: { title: string; text: string }[],
  fieldName: string,
  currentValue: string,
  newValue: string
): Omit<TextSuggestion, 'username'>[] {
  // Find the index of the section with the matching title
  const sectionIndex = sections.findIndex(s => s.title === fieldName);

  // Use diff-match-patch to compute diffs
  const dmp = new DiffMatchPatch();
  const diffs = dmp.diff_main(currentValue, newValue);
  dmp.diff_cleanupSemantic(diffs);

  // Convert diffs into TextSuggestion objects
  const suggestions: Omit<TextSuggestion, 'username'>[] = [];
  let cursor = 0;

  for (const [type, text] of diffs) {
    if (type === 0) {
      // Equal: Move the cursor forward
      cursor += text.length;
    } else if (type === -1) {
      // Deletion: Create a suggestion to remove text
      const textBeforeMatch = currentValue.substring(0, cursor).match(/(\b\w+\b\s+\b\w+\b|\b\w+\b)?$/);
      const textAfterMatch = currentValue.substring(cursor + text.length).match(/^(\b\w+\b\s+\b\w+\b|\b\w+\b)?/);
      const textBefore = textBeforeMatch ? textBeforeMatch[0] : '';
      const textAfter = textAfterMatch ? textAfterMatch[0] : '';

      suggestions.push({
        textToReplace: text,
        textReplacement: '',
        reason: 'Text removed',
        textBefore,
        textAfter,
      });
      cursor += text.length;
    } else if (type === 1) {
      // Insertion: Create a suggestion to add text
      const textBeforeMatch = currentValue.substring(0, cursor).match(/(\b\w+\b\s+\b\w+\b|\b\w+\b)?$/);
      const textAfterMatch = currentValue.substring(cursor).match(/^(\b\w+\b\s+\b\w+\b|\b\w+\b)?/);
      const textBefore = textBeforeMatch ? textBeforeMatch[0] : '';
      const textAfter = textAfterMatch ? textAfterMatch[0] : '';

      suggestions.push({
        textToReplace: '',
        textReplacement: text,
        reason: 'Text added',
        textBefore,
        textAfter,
      });
    }
  }
  console.log('[formToSuggestion] Generated suggestions:', suggestions);
  return suggestions;
}
