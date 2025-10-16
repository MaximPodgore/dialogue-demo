import { EditorView } from 'prosemirror-view';
import { suggestionTransactionKey } from 'prosemirror-suggestion-mode';
import { Node } from 'prosemirror-model';
import { Command, EditorState, Transaction } from 'prosemirror-state';
import DiffMatchPatch from 'diff-match-patch';

export type TextSuggestion = {
  textToReplace: string;
  textReplacement: string;
  reason?: string;
  textBefore?: string;
  textAfter?: string;
  username?: string;
};

const applySuggestionToRange = (
  view: EditorView,
  dispatch: (tr: Transaction) => void,
  from: number,
  to: number,
  suggestion: TextSuggestion,
  username: string,
): boolean => {
  const newData: Record<string, any> = {};
  if (suggestion.reason && suggestion.reason.length > 0) newData.reason = suggestion.reason;

  const tr = view.state.tr.setMeta(suggestionTransactionKey, {
    inSuggestionMode: true,
    data: newData,
    username,
    skipSuggestionOperation: false,
  });

  // Extract current text in range
  const currentText = view.state.doc.textBetween(from, to, '\n', '\n');
  const newText = suggestion.textReplacement;

  // Use diff-match-patch to compute diffs
  const dmp = new DiffMatchPatch();
  const diffs = dmp.diff_main(currentText, newText);
  dmp.diff_cleanupSemantic(diffs);

  let docText = view.state.doc.textBetween(from, to, '\n', '\n');
  let searchStart = 0;
  let docPos = from;
  for (const diff of diffs) {
    const [type, text] = diff;
    if (!text) continue;
    // Ignore diffs that are only whitespace or newlines
    if (/^\s*$/.test(text)) {
      if (type === 0) searchStart += text.length;
      continue;
    }
    if (type === 0 || type === -1) {
      // For equal and deletion, find the next occurrence of text in docText
      const foundIdx = docText.indexOf(text, searchStart);
      if (foundIdx === -1) {
        console.warn('[applySuggestion] Could not find text for diff placement:', text);
        continue;
      }
      const range = findDocumentRange(view.state.doc, from + foundIdx, from + foundIdx + text.length);
      if (type === 0) {
        // Equal: just move searchStart and docPos forward
        searchStart = foundIdx + text.length;
        docPos = range.to;
      } else if (type === -1) {
        // Deletion: delete the text at the found position
        tr.delete(range.from, range.to);
        searchStart = foundIdx + text.length;
        // docPos does not advance for deletion
      }
    } else if (type === 1) {
      // Insertion: insert new text with suggestion mark at current docPos
      let marks: readonly any[] = [];
      if (view.state.schema.marks && view.state.schema.marks.suggestion) {
        try {
          // Replace 'attrs' with 'Attr' to fix the error
          marks = [view.state.schema.marks.suggestion.create({ username, ...Attr })];
        } catch (e) {
          console.warn('[applySuggestion] Failed to create suggestion mark:', e);
        }
      } else {
        console.warn('[applySuggestion] suggestion mark not found in schema, inserting plain text');
      }
      tr.insert(docPos, view.state.schema.text(text, marks));
      // Do NOT advance docPos for insertions
    }
  }
  dispatch(tr);
  console.log('[applySuggestion] Applied suggestion with diff:', {
    from,
    to,
    suggestion,
    username,
    diffs,
  });
  return true;
};

export const createApplySuggestionCommand = (
  {
    textToReplace,
    textReplacement = '',
    reason = '',
    textBefore = '',
    textAfter = '',
  }: TextSuggestion,
  username: string
): Command => {
  return (
    state: EditorState,
    dispatch?: (tr: Transaction) => void,
    view?: EditorView
  ): boolean => {
    if (textToReplace === undefined) {
      console.warn('[applySuggestion] Type error - Undefined textToReplace');
      return false;
    }

    // If both textBefore and textAfter are provided, use Quill-style diff logic
    if (textBefore && textAfter) {
      const docText = state.doc.textContent;
      const beforeIdx = docText.indexOf(textBefore);
      if (beforeIdx === -1) {
        console.warn('[applySuggestion] textBefore not found');
        return false;
      }
      const afterIdx = docText.indexOf(textAfter, beforeIdx + textBefore.length);
      if (afterIdx === -1) {
        console.warn('[applySuggestion] textAfter not found');
        return false;
      }
      const innerStart = beforeIdx + textBefore.length;
      const innerEnd = afterIdx;
      const docRange = findDocumentRange(state.doc, innerStart, innerEnd);
      if (!dispatch) return true;
      if (!view) return false;
      // Use diff logic between innerStart and innerEnd
      return applySuggestionToRange(
        view,
        dispatch,
        docRange.from,
        docRange.to,
        {
          textToReplace: state.doc.textBetween(docRange.from, docRange.to, '\n', '\n'),
          textReplacement,
          reason,
          textBefore,
          textAfter,
        },
        username
      );
    }

    // Fallback to original strict matching
    const searchText = textBefore + textToReplace + textAfter;
    if (searchText.length === 0) {
      if (state.doc.textContent.trim().replace(/\u200B/g, '').length > 0) {
        console.warn('[applySuggestion] No text to match, but doc is not empty');
        return false;
      }
      if (!dispatch) return true;
      return applySuggestionToRange(
        view!,
        dispatch,
        0,
        0,
        {
          textToReplace,
          textReplacement,
          reason,
          textBefore,
          textAfter,
        },
        username
      );
    }

    const pattern = escapeRegExp(searchText);
    const regex = new RegExp(pattern, 'g');
    let match;
    let matches: { index: number; length: number }[] = [];
    let matchCount = 0;
    const MAX_MATCHES = 1000;
    const docText = state.doc.textContent;
    while ((match = regex.exec(docText)) !== null) {
      if (match.index === regex.lastIndex) {
        regex.lastIndex++;
      }
      matchCount++;
      if (matchCount > MAX_MATCHES) {
        break;
      }
      matches.push({
        index: match.index,
        length: match[0].length,
      });
    }
    if (!dispatch) return matches.length === 1;
    if (!view) return false;
    if (matches.length > 0) {
      const applyingMatch = matches[0];
      const textMatchStart = applyingMatch.index + textBefore.length;
      const textMatchEnd = textMatchStart + textToReplace.length;
      const docRange = findDocumentRange(state.doc, textMatchStart, textMatchEnd);
      return applySuggestionToRange(
        view,
        dispatch,
        docRange.from,
        docRange.to,
        {
          textToReplace,
          textReplacement,
          reason,
          textBefore,
          textAfter,
        },
        username
      );
    }
    return false;
  };
};

function findDocumentRange(
  doc: Node,
  textStart: number,
  textEnd: number
): { from: number; to: number } {
  if (doc.nodesBetween && typeof doc.nodesBetween === 'function') {
    try {
      let currentTextPos = 0;
      let startPos: number | null = null;
      let endPos: number | null = null;
      doc.nodesBetween(0, doc.content.size, (node, nodeStartPos) => {
        if (startPos !== null && endPos !== null) return false;
        if (node.isText && typeof node.text === 'string') {
          const nodeTextEndPos = currentTextPos + node.text.length;
          if (
            startPos === null &&
            textStart >= currentTextPos &&
            textStart <= nodeTextEndPos
          ) {
            const offsetInNode = textStart - currentTextPos;
            startPos = nodeStartPos + offsetInNode;
          }
          if (
            endPos === null &&
            textEnd >= currentTextPos &&
            textEnd <= nodeTextEndPos
          ) {
            const offsetInNode = textEnd - currentTextPos;
            endPos = nodeStartPos + offsetInNode;
          }
          currentTextPos = nodeTextEndPos;
        }
        return true;
      });
      if (startPos !== null && endPos !== null) {
        return { from: startPos, to: endPos };
      }
    } catch (e) {
      console.warn('[applySuggestion] Error in nodesBetween, falling back', e);
    }
  }
  return { from: textStart, to: textEnd };
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const applySuggestion = (
  view: EditorView,
  suggestion: TextSuggestion,
  username: string,
  dryRun: boolean = false
): boolean => {
  const command = createApplySuggestionCommand(suggestion, username);
  if (dryRun) return command(view.state);
  return command(view.state, view.dispatch, view);
};
