// Utility to extract bold/strong section titles and their following text from HTML
export function getBoldSectionsText(html: string) {
  const parser = new window.DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const sections: { title: string; text: string }[] = [];
  let currentTitle: string | null = null;
  let currentText = '';

  function walk(node: Node) {
    if (
      node.nodeType === 1 &&
      ((node as HTMLElement).tagName === 'B' || (node as HTMLElement).tagName === 'STRONG')
    ) {
      if (currentTitle !== null) {
        sections.push({ title: currentTitle, text: currentText.trim() });
      }
      currentTitle = node.textContent || '';
      currentText = '';
    } else {
      if (currentTitle !== null) {
        if (node.nodeType === 3) {
          currentText += node.textContent || '';
        } else if (node.nodeType === 1) {
          for (let i = 0; i < node.childNodes.length; i++) {
            walk(node.childNodes[i]);
          }
          if (["P", "DIV", "LI", "BR"].includes((node as HTMLElement).tagName)) {
            currentText += ' ';
          }
        }
      } else {
        if (node.nodeType === 1) {
          for (let i = 0; i < node.childNodes.length; i++) {
            walk(node.childNodes[i]);
          }
        }
      }
    }
  }
  walk(doc.body);
  if (currentTitle !== null) {
    sections.push({ title: currentTitle, text: currentText.trim() });
  }
  return sections;
}