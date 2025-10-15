import { TextSuggestion } from "@/components/proseMirror";

/**
 * Converts form data into a TextSuggestion object using section info and string matching.
 * @param sections Array of section objects with title and text
 * @param fieldName The selected field name (section title)
 * @param currentValue The current value of the field
 * @param newValue The new value for the field
 * @param username The username for the suggestion
 * @returns TextSuggestion object
 */
export function formToSuggestion(
  sections: { title: string; text: string }[],
  fieldName: string,
  currentValue: string,
  newValue: string,
  username: string
): TextSuggestion {
  // Find the index of the section with the matching title
  const sectionIndex = sections.findIndex(s => s.title === fieldName);

  // textBefore: field name
  const textBefore = fieldName;

  // textAfter: title of next section, or null if none
  let textAfter: string | null = null;
  if (sectionIndex !== -1 && sectionIndex < sections.length - 1) {
    textAfter = sections[sectionIndex + 1].title;
  }

  return {
    textToReplace: currentValue,
    textReplacement: newValue,
    reason: "User wanted it this way",
    textBefore,
    textAfter: textAfter || "",
    username,
  };
}
