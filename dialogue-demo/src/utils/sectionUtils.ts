// Utility to extract bold section titles and their text from a ProseMirror doc
export function getBoldSectionsTextFromDoc(doc: any) {
  const sections: { title: string; text: string }[] = [];
  let currentTitle: string | null = null;
  let currentText = "";

  function isBold(node: any): boolean {
    return node.marks?.some((mark: any) => mark.type.name === "bold" || mark.type.name === "strong");
  }

  function hasInsertionSuggestion(node: any): boolean {
    return node.marks?.some((mark: any) => mark.type.name === "suggestion_insert");
  }

  function processNode(node: any) {
    if (!node) return;

    // If text node
    if (node.isText) {
      // Skip inserted suggestions
      if (hasInsertionSuggestion(node)) return;

      // If text is bold, start new section
      if (isBold(node)) {
        if (currentTitle !== null) {
          sections.push({ title: currentTitle, text: currentText.trim() });
        }
        currentTitle = node.text?.trim() || "";
        currentText = "";
      } else if (currentTitle !== null) {
        // Regular text belongs to current section
        currentText += node.text || "";
      }
      return;
    }

    // Otherwise, if this node has children
    if (node.content?.content) {
      node.content.content.forEach(processNode);
    }
  }

  processNode(doc);

  if (currentTitle !== null) {
    sections.push({ title: currentTitle, text: currentText.trim() });
  }

  return sections;
}
