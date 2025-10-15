import { getBoldSectionsText } from "./sectionUtils";

export const MIN_TEXT_LENGTH = 2;
export const MAX_TEXT_LENGTH = 5;

export interface Section {
  title: string;
  text: string;
}

export interface SectionValidationResult {
  errors: string[];
  valid: boolean;
}

export function validateSectionsFromHtml(html: string): SectionValidationResult {
  const sections = getBoldSectionsText(html);
  const errors: string[] = [];
  let valid = true;
  for (const section of sections) {
    if (section.text.length < MIN_TEXT_LENGTH) {
      errors.push(`Section "${section.title}" is too short (min ${MIN_TEXT_LENGTH} chars).`);
      valid = false;
    } else if (section.text.length > MAX_TEXT_LENGTH) {
      errors.push(`Section "${section.title}" is too long (max ${MAX_TEXT_LENGTH} chars).`);
      valid = false;
    }
  }
  return { errors, valid };
}
