import { EditorView } from 'prosemirror-view';
import { suggestionTransactionKey } from 'prosemirror-suggestion-mode';
import { Node } from 'prosemirror-model';
import { Command, EditorState, Transaction } from 'prosemirror-state';

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
  username: string
): boolean => {
  const newData: Record<string, any> = {};
  if (suggestion.reason && suggestion.reason.length > 0) newData.reason = suggestion.reason;

  const tr = view.state.tr.setMeta(suggestionTransactionKey, {
    inSuggestionMode: true,
    data: newData,
    username,
    skipSuggestionOperation: false,
  });
  console.log("Suggestion textReplacement:", suggestion.textReplacement);
  if (!suggestion.textReplacement || suggestion.textReplacement.trim() === '') {
    // Use deletion if textReplacement is null or empty string
    tr.delete(from, to);
  } else {
    tr.replaceWith(from, to, view.state.schema.text(suggestion.textReplacement));
  }
  dispatch(tr);
  console.log('[applySuggestion] Applied suggestion:', {
    from,
    to,
    suggestion,
    username,
  });
  return true;
};

export const createApplySuggestionCommand = (
  {
    textToReplace = '',
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
    if (textToReplace === undefined || textToReplace === null) {
      console.warn('[applySuggestion] Type error - Undefined or null textToReplace');
      return false;
    }
    console.log('TextSuggestion values', {
      textToReplace,
      textReplacement,
      reason,
      textBefore,
      textAfter,
    });
    const searchText = textBefore + textToReplace + textAfter;
    console.log('Searchtext:', searchText);
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
    console.log('[applySuggestion] Searching for matches:', {
      searchText,
      pattern,
      docText,
    });
    while ((match = regex.exec(docText)) !== null) {
      if (match.index === regex.lastIndex) {
        regex.lastIndex++;
      }
      matchCount++;
      if (matchCount > MAX_MATCHES) {
        console.warn('[applySuggestion] Too many matches found, stopping');
        break;
      }
      matches.push({
        index: match.index,
        length: match[0].length,
      });
      console.log('[applySuggestion] Found match:', {
        match: match[0],
        index: match.index,
        length: match[0].length,
        matchCount,
      });
    }
    console.log('[applySuggestion] Total matches found:', matches.length, matches);
    if (!dispatch) return matches.length === 1;
    if (!view) return false;
    if (matches.length > 0) {
      if (matches.length > 1) {
        console.warn('[applySuggestion] Multiple matches found, only applying the first', matches);
      }
      const applyingMatch = matches[0];
      const textMatchStart = applyingMatch.index + textBefore.length;
      const textMatchEnd = textMatchStart + textToReplace.length;
      console.log('[applySuggestion] Applying match:', {
        applyingMatch,
        textMatchStart,
        textMatchEnd,
      });
      const docRange = findDocumentRange(state.doc, textMatchStart, textMatchEnd);
      console.log('[applySuggestion] Document range:', docRange);
      if (!dispatch) return true;
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
    console.warn('[applySuggestion] No matches found for suggestion', {
      suggestion: { textToReplace, textReplacement, reason, textBefore, textAfter },
      username,
      docText,
    });
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
  console.log('This is suggestion made it to applySuggestion:', suggestion);
  const command = createApplySuggestionCommand(suggestion, username);
  if (dryRun) return command(view.state);
  return command(view.state, view.dispatch, view);
};
