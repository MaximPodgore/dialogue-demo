// Utility to extract bold/strong section titles and their following text from HTML
export function getBoldSectionsText(html: string, doc?: any) {
  const parser = new window.DOMParser();
  const docHtml = parser.parseFromString(html, 'text/html');
  const sections: { title: string; text: string }[] = [];
  let currentTitle: string | null = null;
  let currentText = '';

  function walk(node: Node) {
    if (node.nodeType === 1) {
      const element = node as HTMLElement;
      if (element.tagName === 'B' || element.tagName === 'STRONG') {
        if (currentTitle !== null) {
          sections.push({ title: currentTitle, text: currentText.trim() });
        }
        currentTitle = element.textContent || '';
        currentText = '';
      } else {
        if (currentTitle !== null) {
          if (["P", "DIV", "LI", "BR"].includes(element.tagName)) {
            currentText += ' ';
          }
          for (let i = 0; i < node.childNodes.length; i++) {
            walk(node.childNodes[i]);
          }
        } else {
          for (let i = 0; i < node.childNodes.length; i++) {
            walk(node.childNodes[i]);
          }
        }
      }
    } else if (node.nodeType === 3 && currentTitle !== null) {
      const textContent = node.textContent || '';

      if (doc) {
        try {
          const isSuggestionMarkPresent = doc.marks?.some((mark: any) =>
            mark.type.name === 'suggestion' &&
            (mark.attrs.type === 'insertion' || mark.attrs.type === 'deletion')
          );

          if (!isSuggestionMarkPresent) {
            currentText += textContent;
          } else {
            console.warn('Text rejected due to suggestion mark:', { textContent });
          }
        } catch (error) {
          console.error('Error in mark checking logic:', error);
          currentText += textContent; // Fallback to appending text
        }
      } else {
        currentText += textContent; // Append text if no filtering is applied
      }
    }
  }

  walk(docHtml.body);
  if (currentTitle !== null) {
    sections.push({ title: currentTitle, text: currentText.trim() });
  }

  return sections;
}