"use client";
import React from 'react';
import SuggestionEditor, { TextSuggestion } from './proseMirror';

interface ProseMirrorDemoProps {
  initialSuggestions?: TextSuggestion[];
}

interface ProseMirrorDemoProps {
  initialSuggestions?: TextSuggestion[];
  styleMode: 'yellow' | 'pink';
}

import { useState } from 'react';

const MIN_TEXT_LENGTH = 2;
const MAX_TEXT_LENGTH = 5;

const ProseMirrorDemo: React.FC<ProseMirrorDemoProps> = ({ initialSuggestions, styleMode }) => {
  const initialContent = `
    <b>Background</b>
    <p>This is a background that George generated for the study. This should give someone a good idea of the reasons behind this study.<br>
    Hypothetically should this text be editable at all ?</p>
    <br />
    <b>Objectives</b>
    <p>This are objectives that George generated for the study. This should give someone a good idea of the goals behind this study. Hypothetically should this text be editable at all ? Hmmm.</p>
    <ol>
      <li>This is text for the first objective</li>
      <li>This is text for the second objective</li>
      <li>This is text for the third objective</li>
    </ol>
    <br />
    <b>Methodology</b>
    <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum</p>
  `;

  const suggestionModeClass = styleMode === 'yellow' ? 'suggestion-mode-yellow' : 'suggestion-mode-pink';
  const [toast, setToast] = useState<string | null>(null);
  const [editorContent, setEditorContent] = useState<string>(initialContent);
  const [isPressed, setIsPressed] = useState(false);

  // Only validate on button click

  // Recursively walk DOM to extract bold sections and their following content
  const getBoldSectionsText = (html: string) => {
    const parser = new window.DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const sections: { title: string; text: string }[] = [];
  let currentTitle: string | null = null;
    let currentText = '';

    // Helper to walk nodes in order
    function walk(node: Node) {
      if (node.nodeType === 1 && ((node as HTMLElement).tagName === 'B' || (node as HTMLElement).tagName === 'STRONG')) {
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
            // Recursively walk children
            for (let i = 0; i < node.childNodes.length; i++) {
              walk(node.childNodes[i]);
            }
            // Add a space after block elements
            if (["P","DIV","LI","BR"].includes((node as HTMLElement).tagName)) {
              currentText += ' ';
            }
          }
        } else {
          // If not in a bold section, keep walking children
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
  };

  const handleValidate = () => {
    setIsPressed(true);
    setTimeout(() => setIsPressed(false), 150);
    const sections = getBoldSectionsText(editorContent);
    const errors: string[] = [];
    let hasError = false;
    for (const section of sections) {
      if (section.text.length < MIN_TEXT_LENGTH) {
        errors.push(`Section "${section.title}" is too short (min ${MIN_TEXT_LENGTH} chars).`);
        hasError = true;
      } else if (section.text.length > MAX_TEXT_LENGTH) {
        errors.push(`Section "${section.title}" is too long (max ${MAX_TEXT_LENGTH} chars).`);
        hasError = true;
      }
    }
    if (hasError) {
      setToast(errors.join(' '));
      return false;
    }
    setToast(null);
    return true;
  };

  return (
    <div className="space-y-6">
      <SuggestionEditor
        initialContent={initialContent}
        initialSuggestions={initialSuggestions}
        className={suggestionModeClass}
        onContentChange={setEditorContent}
      />
      <button
        className={`px-4 py-2 bg-primary text-white rounded transition-transform duration-150 ${isPressed ? 'scale-95' : ''}`}
        onClick={handleValidate}
        style={{ outline: 'none' }}
      >
        Validate Text Length
      </button>
      {toast && (
        <div className="fixed top-8 right-8 bg-red-500 text-white px-4 py-2 rounded shadow-lg z-50">
          {toast}
          <button
            className="ml-4 text-white underline"
            onClick={() => setToast(null)}
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
};

export default ProseMirrorDemo;