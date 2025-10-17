"use client";

import React, { useEffect, useRef, useState } from 'react';
import { processSuggestionRejection } from "../utils/suggestionRejection";
import { applySuggestion } from "../utils/applySuggestion";
import type { EditorView } from 'prosemirror-view';
import { acceptSuggestionsInRange, rejectSuggestionsInRange } from 'prosemirror-suggestion-mode';
import type { Command } from 'prosemirror-state';
import { get } from 'http';
import { getBoldSectionsText } from "../utils/sectionUtils";

export interface TextSuggestion {
  textToReplace: string;
  textReplacement: string;
  reason: string;
  textBefore: string;
  textAfter: string;
  username: string;
}

interface SuggestionEditorProps {
  initialContent?: string;
  newSuggestions?: TextSuggestion[];
  onContentChange?: (content: { title: string; text: string; }[]) => void;
  styleMode?: 'yellow' | 'pink';
  className?: string;
}

// Ensure modulesRef and schemaRef are declared outside the function
const modulesRef = React.createRef<any>();
const schemaRef = React.createRef<any>();

const SuggestionEditor = ({ 
  initialContent, 
  newSuggestions = [], 
  onContentChange,
  styleMode = 'yellow',
  className = '',
}: SuggestionEditorProps) => {
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<any>(null);

  // Style mode class
  const suggestionModeClass = styleMode === 'yellow' ? 'suggestion-mode-yellow' : 'suggestion-mode-pink';

  // Add a state to maintain the persistent list of suggestions
  const [persistentSuggestions, setPersistentSuggestions] = useState<TextSuggestion[]>([]);
  // Add a state to track newUniqueSuggestions
  const [newUniqueSuggestions, setNewUniqueSuggestions] = useState<TextSuggestion[]>([]);

  // Use a ref to store the latest persistentSuggestions
  const persistentSuggestionsRef = useRef(persistentSuggestions);

  // Update the persistentSuggestions ref whenever persistentSuggestions state changes
  useEffect(() => {
    persistentSuggestionsRef.current = persistentSuggestions;
  }, [persistentSuggestions]);

  // Initialize editor only once
  useEffect(() => {
    if (!editorContainerRef.current) return;
    let destroyed = false;
    const loadEditor = async () => {
      const [
        { EditorState, Plugin },
        { EditorView },
        { Schema, DOMParser, DOMSerializer },
        { schema },
        { baseKeymap, toggleMark },
        { keymap },
        { addListNodes },
        {
          suggestionModePlugin,
          acceptAllSuggestions,
          rejectAllSuggestions,
          addSuggestionMarks
        },
      ] = await Promise.all([
        import('prosemirror-state'),
        import('prosemirror-view'),
        import('prosemirror-model'),
        import('prosemirror-schema-basic'),
        import('prosemirror-commands'),
        import('prosemirror-keymap'),
        import('prosemirror-schema-list'),
        import('prosemirror-suggestion-mode'),
      ]);
      await import('prosemirror-suggestion-mode/style/suggestion-mode.css');
      const { strong } = (await import('prosemirror-schema-basic')).marks;
      const strongUneditableSpec = {
        ...strong,
        attrs: { ...strong.attrs, uneditable: { default: true } },
        toDOM: (node: any) => [
          'strong',
          { contenteditable: 'false', 'data-uneditable': 'true' },
          0 as any,
        ] as [string, Record<string, any>, number],
      };
      const suggestionMarks = addSuggestionMarks(schema.spec.marks);
      const marks = {
        ...suggestionMarks,
        strong: strongUneditableSpec,
      };
      const exampleSchema = new Schema({
        nodes: addListNodes(schema.spec.nodes, 'paragraph block*', 'block'),
        marks,
      });
      schemaRef.current = exampleSchema;
      modulesRef.current = {
        DOMParser,
        DOMSerializer,
        toggleMark,
        suggestionModePlugin,
        acceptAllSuggestions,
        rejectAllSuggestions,
        applySuggestion,
      };
      const createSuggestionReasonComponent = (attrs: Record<string, any>) => {
        const reasonDiv = document.createElement('div');
        reasonDiv.className = 'suggestion-info';
        const reason = attrs?.data?.reason;
        if (reason) {
          const reasonLabel = document.createElement('span');
          reasonLabel.textContent = `${attrs.username}: `;
          reasonLabel.style.fontWeight = '600';
          reasonLabel.style.color = '#111827';
          reasonLabel.style.fontFamily = "'DM Sans', sans-serif";
          const reasonText = document.createElement('span');
          reasonText.textContent = reason;
          reasonText.style.fontWeight = '400';
          reasonText.style.color = '#374151';
          reasonText.style.fontFamily = "'DM Sans', sans-serif";
          reasonDiv.appendChild(reasonLabel);
          reasonDiv.appendChild(reasonText);
        }
        return { dom: reasonDiv };
      };
      const defaultContent = ``;
      const content = initialContent || defaultContent;
      const parser = DOMParser.fromSchema(exampleSchema);
      const htmlDoc = new window.DOMParser().parseFromString(content, 'text/html');
      const doc = parser.parse(htmlDoc.body);
      const uneditablePlugin = new Plugin({
        props: {
          handleDOMEvents: {
            beforeinput(view, event) {
              const sel = view.state.selection;
              if (sel.empty) {
                const marks = view.state.storedMarks || sel.$from.marks();
                if (marks.some(m => m.type.name === 'strong')) {
                  event.preventDefault();
                  return true;
                }
              } else {
                let blocked = false;
                view.state.doc.nodesBetween(sel.from, sel.to, (node, pos, parent, index) => {
                  if (node.marks && node.marks.some(m => m.type.name === 'strong')) blocked = true;
                });
                if (blocked) {
                  event.preventDefault();
                  return true;
                }
              }
              return false;
            },
          },
          decorations(state) {
            return null;
          },
        },
      });
      // Ported createButtonsComponent from hoverMenu.ts and attached setPersistentSuggestions
      const createButtonsComponent = (
        from: number,
        to: number,
        handler: { dispatch: (command: Command) => void }
      ): { dom: HTMLElement } => {
        const container = document.createElement('div');
        container.className = 'hover-menu-buttons';

        const acceptButton = document.createElement('button');
        acceptButton.textContent = 'Accept';
        acceptButton.className = 'accept-button';
        acceptButton.onclick = () => {
          console.log('Accept button clicked');
          console.log('Current persistentSuggestions before accept:', persistentSuggestionsRef.current);
          handler.dispatch(acceptSuggestionsInRange(from, to));
          setPersistentSuggestions((prev) => {
            const updated = prev.filter((s) => {
              const textInRange = viewRef.current.state.doc.textBetween(from, to, '');
              const isMatch = textInRange === s.textToReplace || textInRange === s.textReplacement;
              console.log('Text in range:', textInRange, 'Expected textToReplace:', s.textToReplace, 'Expected textReplacement:', s.textReplacement, 'isMatch:', isMatch);
              return !isMatch;
            });
            console.log('Updated persistentSuggestions after accept:', updated);
            return updated;
          });
        };

        const rejectButton = document.createElement('button');
        rejectButton.textContent = 'Reject';
        rejectButton.className = 'reject-button';
        rejectButton.onclick = () => {
          console.log('Reject button clicked');
          console.log('Current persistentSuggestions before reject:', persistentSuggestionsRef.current);
          handler.dispatch(rejectSuggestionsInRange(from, to));
          setPersistentSuggestions((prev) => {
            const updated = prev.filter((s) => {
              const textInRange = viewRef.current.state.doc.textBetween(from, to, '');
              const isMatch = textInRange === s.textToReplace || textInRange === s.textReplacement;
              console.log('Text in range:', textInRange, 'Expected textToReplace:', s.textToReplace, 'Expected textReplacement:', s.textReplacement, 'isMatch:', isMatch);
              return !isMatch;
            });
            console.log('Updated persistentSuggestions after reject:', updated);
            return updated;
          });
        };

        container.appendChild(acceptButton);
        container.appendChild(rejectButton);
        return { dom: container };
      };

      const suggestionPlugin = suggestionModePlugin({
        username: 'example user',
        inSuggestionMode: false,
        hoverMenuOptions: {
          components: {
            createInfoComponent: createSuggestionReasonComponent,
            createButtonsComponent,
          },
        },
      });
      const state = EditorState.create({
        schema: exampleSchema,
        doc,
        plugins: [
          keymap(baseKeymap),
          uneditablePlugin,
          suggestionPlugin,
        ],
      });
      const view = new EditorView(editorContainerRef.current!, {
        state,
        dispatchTransaction(tr) {
          const newState = view.state.apply(tr);
          view.updateState(newState);
          if (onContentChange && tr.docChanged) {
            const sectionArray = extractTextWithDeletions(newState.doc);
            onContentChange(sectionArray);
          }
        },
      });
      viewRef.current = view;
      if (onContentChange) {
        const sectionArray = extractTextWithDeletions(view.state.doc);
        onContentChange(sectionArray);
      }
      (window as any).acceptAllSuggestions = () => {
        acceptAllSuggestions(view.state, view.dispatch);
      };
      (window as any).rejectAllSuggestions = () => {
        rejectAllSuggestions(view.state, view.dispatch);
      };
    };
    loadEditor().catch(console.error);
    return () => {
      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
      }
      if (editorContainerRef.current) {
        editorContainerRef.current.innerHTML = '';
      }
      destroyed = true;
    };
  }, []);

  // Update newUniqueSuggestions when newSuggestions changes
  useEffect(() => {
    if (newSuggestions && Array.isArray(newSuggestions)) {
      console.log('[SuggestionEditor] Received newSuggestions:', newSuggestions);
      const uniqueSuggestions = newSuggestions.filter((newSuggestion) => {
        const isDuplicate = persistentSuggestions.some(
          (existing) =>
            existing.textToReplace === newSuggestion.textToReplace &&
            existing.textReplacement === newSuggestion.textReplacement
        );
        if (isDuplicate) {
          console.log('[SuggestionEditor] Duplicate suggestion ignored:', newSuggestion);
        } else {
          console.log('[SuggestionEditor] Adding new suggestion to uniqueSuggestions:', newSuggestion);
        }
        return !isDuplicate;
      });
      setNewUniqueSuggestions(uniqueSuggestions);
    }
  }, [newSuggestions]);

  // Modify the function to include deletion suggestions and exclude addition/insertion suggestions
  // Refine extractTextWithDeletions to extract text only within each bold section
  // Fix the issue by ensuring parentHtml and text are defined before calling includes
  // Modify extractTextWithDeletions to return a hashmap of title to text
  const extractTextWithDeletions = (doc: any) => {
    const serializer = modulesRef.current?.DOMSerializer.fromSchema(schemaRef.current);
    if (!serializer || !doc.content) return {};

    const fragment = serializer.serializeFragment(doc.content);
    const tempDiv = document.createElement('div');
    tempDiv.appendChild(fragment);
    const html = tempDiv.innerHTML;

    const sections = getBoldSectionsText(html, doc);
    console.log('[sectionUtils] Extracted sections with deletions:', sections);
    return sections;
  };

  // Update persistentSuggestions when newUniqueSuggestions changes
  useEffect(() => {
    if (newUniqueSuggestions.length > 0) {
      setPersistentSuggestions((prev) => {
        const updatedSuggestions = [...prev, ...newUniqueSuggestions];
        console.log('[SuggestionEditor] Updated persistentSuggestions:', updatedSuggestions);
        return updatedSuggestions;
      });

    }
  }, [newUniqueSuggestions]);

  // Trigger extractTextWithDeletions on document changes
  useEffect(() => {
    if (viewRef.current) {
      const doc = viewRef.current.state.doc;
      const sectionMap = extractTextWithDeletions(doc);
      console.log('[SuggestionEditor] Extracted sectionMap on document change:', sectionMap);
      if (onContentChange) onContentChange(sectionMap);
    }
  }, [persistentSuggestions]);

  // Apply suggestions from the newUniqueSuggestions
  useEffect(() => {
    if (viewRef.current && newUniqueSuggestions.length > 0) {
      newUniqueSuggestions.forEach((suggestion) => {
        if (modulesRef.current && modulesRef.current.applySuggestion) {
          modulesRef.current.applySuggestion(viewRef.current, suggestion, suggestion.username);
        }
      });
    }
  }, [newUniqueSuggestions]);

  // Accept all suggestions and update the persistent list
  const acceptAll = () => {
    if ((window as any).acceptAllSuggestions) {
      (window as any).acceptAllSuggestions();
      setPersistentSuggestions([]); // Clear the list after accepting all
    }
  };

  // Reject all suggestions and update the persistent list
  const rejectAll = () => {
    if ((window as any).rejectAllSuggestions) {
      (window as any).rejectAllSuggestions();
      setPersistentSuggestions([]); // Clear the list after rejecting all
    }
  };

  // Add a function to get the current persistentSuggestions
  const getPersistentSuggestions = () => {
    console.log('Current persistentSuggestions:', persistentSuggestions);
    return persistentSuggestions;
  };

  return (
    <div className={`w-full max-w-4xl mx-auto ${suggestionModeClass}`} style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div
        ref={editorContainerRef}
        className={`${className} min-h-[300px] prose max-w-none`}
        style={{ fontFamily: "'DM Sans', sans-serif", lineHeight: '1.6', border: 'none', outline: 'none', boxShadow: 'none', padding: 0 }}
      />
      {/* Accept/Reject buttons - always show if newSuggestions exist */}
      {persistentSuggestions.length > 0 && (
        <div className="mt-4 space-x-2">
          <button
            onClick={acceptAll}
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors text-sm font-medium bg-white"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            Accept All
          </button>
          <button
            onClick={rejectAll}
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors text-sm font-medium bg-white"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            Reject All
          </button>
        </div>
      )}
    </div>
  );
}
export default SuggestionEditor;

// Ensure extractTextWithDeletions is defined before exporting
const extractTextWithDeletions = (doc: any) => {
  const serializer = modulesRef.current?.DOMSerializer.fromSchema(schemaRef.current);
  if (!serializer || !doc.content) return {};

  const fragment = serializer.serializeFragment(doc.content);
  const tempDiv = document.createElement('div');
  tempDiv.appendChild(fragment);
  const html = tempDiv.innerHTML;

  const sections = getBoldSectionsText(html, doc);
  const sectionMap: Record<string, string> = {};

  sections.forEach(({ title, text }) => {
    let filteredText = '';
    doc.descendants((node: any, pos: number, parent: any) => {
      if (
        node.text &&
        (!node.marks || !node.marks.some((mark: any) => mark.type.name === 'suggestion' && mark.attrs.type === 'insertion'))
      ) {
        const parentHtml = parent ? serializer.serializeFragment(parent.content).outerHTML : '';
        if (parentHtml && text && parentHtml.includes(text)) {
          filteredText += node.text;
        }
      }
    });
    sectionMap[title] = String(filteredText.trim());
  });

  return sectionMap;
};

export { extractTextWithDeletions };
