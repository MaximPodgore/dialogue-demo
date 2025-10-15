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
  if (!view || !modules || !schema || !newSuggestions || newSuggestions.length === 0) return;
  const { applySuggestion } = modules;
  newSuggestions.forEach((suggestion) => {
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
      applySuggestion(view, suggestion, username || 'Not specified');
      return;
    }
    if (matchIndices.length === 1) {
      const replaceIdx = matchIndices[0];
      let isBoldInReplace = false;
      for (let i = replaceIdx; i < replaceIdx + textToReplace.length; i++) {
        const { node } = posMap[i] as PosMapEntry;
        if (node.marks && node.marks.some((m: any) => m.type.name === 'strong')) {
          isBoldInReplace = true;
          console.log('Bold detected in replacement text for suggestion:', suggestion);
          break;
        }
      }
      if (!isBoldInReplace) {
        applySuggestion(view, suggestion, username || 'George, Dialogue AI');
      }
      return;
    }
    for (const replaceIdx of matchIndices) {
      let beforeOk = true;
      let afterOk = true;
      if (textBefore) {
        beforeOk = false;
        const beforeIdx = docText.lastIndexOf(textBefore, replaceIdx);
        if (beforeIdx !== -1 && beforeIdx + textBefore.length === replaceIdx) {
          beforeOk = true;
        }
      }
      if (textAfter) {
        afterOk = false;
        const afterIdx = docText.indexOf(textAfter, replaceIdx + textToReplace.length);
        if (afterIdx !== -1 && replaceIdx + textToReplace.length === afterIdx) {
          afterOk = true;
        }
      }
      if (beforeOk && afterOk) {
        let isBoldInReplace = false;
        for (let i = replaceIdx; i < replaceIdx + textToReplace.length; i++) {
          const { node } = posMap[i] as PosMapEntry;
          if (node.marks && node.marks.some((m: any) => m.type.name === 'strong')) {
            isBoldInReplace = true;
            console.log('Bold detected in replacement text for suggestion:', suggestion);
            break;
          }
        }
        if (!isBoldInReplace) {
          applySuggestion(view, suggestion, username || 'Not specified');
          break;
        }
      }
    }
  });
}
