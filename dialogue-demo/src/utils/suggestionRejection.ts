export interface TextSuggestion {
  textToReplace: string;
  textBefore: string;
  textAfter: string;
  username?: string;
}

export interface SuggestionApplyModules {
  applySuggestion: (view: any, suggestion: TextSuggestion, username: string) => void;
}

export function processSuggestionRejection(
  view: any,
  modules: SuggestionApplyModules,
  schema: any,
  newSuggestions: TextSuggestion[]
) {
  if (!view || !modules || !schema || !newSuggestions || newSuggestions.length === 0) {
    console.log('[processSuggestionRejection] Skipping: missing view/modules/schema/suggestions');
    return;
  }
  const { applySuggestion } = modules;
  newSuggestions.forEach((suggestion) => {
    console.log('[processSuggestionRejection] Processing suggestion');
    const { textToReplace, textBefore, textAfter, username } = suggestion;
    let docText = '';
    type PosMapEntry = { pos: number; node: any };
    let posMap: PosMapEntry[] = [];
    view.state.doc.descendants((node: any, pos: number) => {
      if (node.isText && typeof node.text === 'string') {
        docText += node.text;
        for (let i = 0; i < node.text.length; i++) {
          posMap.push({ pos: pos + i, node });
        }
      } else if (node.isLeaf && typeof node.textContent === 'string') {
        docText += node.textContent;
        for (let i = 0; i < node.textContent.length; i++) {
          posMap.push({ pos: pos + i, node });
        }
      }
    });
    let matchIndices: number[] = [];
    let idx = docText.indexOf(textToReplace);
    while (idx !== -1) {
      matchIndices.push(idx);
      idx = docText.indexOf(textToReplace, idx + 1);
    }
    if (matchIndices.length === 0) {
      console.log('[processSuggestionRejection] No match found, applying suggestion:', suggestion);
      applySuggestion(view, suggestion, username || 'Not specified');
      return;
    }
    matchIndices.forEach((replaceIdx) => {
      let beforeOk = true;
      let afterOk = true;
      if (textBefore) {
        beforeOk = false;
        const beforeIdx = docText.lastIndexOf(textBefore, replaceIdx);
        if (beforeIdx !== -1 && beforeIdx + textBefore.length === replaceIdx) {
          beforeOk = true;
          //console.log('[processSuggestionRejection] textBefore matches for suggestion:', suggestion);
        } else {
          //console.log('[processSuggestionRejection] textBefore does NOT match for suggestion:', suggestion);
        }
      }
      if (textAfter) {
        afterOk = false;
        const afterIdx = docText.indexOf(textAfter, replaceIdx + textToReplace.length);
        if (afterIdx !== -1 && replaceIdx + textToReplace.length === afterIdx) {
          afterOk = true;
          //console.log('[processSuggestionRejection] textAfter matches for suggestion:', suggestion);
        } else {
          //console.log('[processSuggestionRejection] textAfter does NOT match for suggestion:', suggestion);
        }
      }
      if (beforeOk && afterOk) {
        let isBoldInReplace = false;
        for (let i = replaceIdx; i < replaceIdx + textToReplace.length; i++) {
          const { node } = posMap[i] as PosMapEntry;
          if (node.marks && node.marks.some((m: any) => m.type.name === 'strong')) {
            isBoldInReplace = true;
            console.log('Rejecting [processSuggestionRejection], Bold detected in replacement text for suggestion');
            break;
          }
        }
        if (!isBoldInReplace) {
          console.log('[processSuggestionRejection] Applying suggestion (no bold detected):', suggestion);
          applySuggestion(view, suggestion, username || 'Not specified');
        } else {
          console.log('[processSuggestionRejection] Suggestion not applied due to bold text:', suggestion);
        }
      } else {
        console.log('[processSuggestionRejection] Suggestion applied (even tho it couldnt match beforeText/afterText):', suggestion);
      }
    });
  });
}
