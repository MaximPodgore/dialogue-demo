"use client";

import React, { useEffect, useRef, useState } from 'react';
import { applySuggestion } from "../utils/applySuggestion";
import { acceptSuggestionsInRange, rejectSuggestionsInRange } from 'prosemirror-suggestion-mode';
import type { Command } from 'prosemirror-state';
import { getBoldSectionsTextFromDoc } from "../utils/sectionUtils";

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

  // Initialize editor only once, have to use dynamic imports
  useEffect(() => {
    if (!editorContainerRef.current) return;
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
            //on load, turns bold/strong text (section titles) into uneditable text
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
      // Ported createButtonsComponent from package so that our button clicks update our suggestion tracking
      const createButtonsComponent = (
        from: number,
        to: number,
        handler: { dispatch: (command: Command) => void }
      ): { dom: HTMLElement } => {
        const container = document.createElement('div');
        container.className = 'flex gap-2'; 

        const acceptButton = document.createElement('button');
        acceptButton.textContent = 'Accept';
        acceptButton.className = 'bg-transparent text-black border border-gray-300 px-3 py-1.5 pl-8 rounded-md text-sm font-medium relative transition-all duration-150 ease-in-out hover:bg-gray-50 hover:border-gray-400';
        const acceptIcon = document.createElement('span');
        acceptIcon.className = 'absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 bg-no-repeat bg-contain';
        acceptIcon.style.backgroundImage = "url('data:image/svg+xml,%3Csvg xmlns=\"http://www.w3.org/2000/svg\" fill=\"none\" viewBox=\"0 0 24 24\" stroke-width=\"2\" stroke=\"%23000\"%3E%3Cpath stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M5 13l4 4L19 7\"/%3E%3C/svg%3E')";
        acceptButton.appendChild(acceptIcon);
        acceptButton.onclick = () => {
          console.log('Accept button clicked');
          const suggestionData = getSuggestionTextFromRange(
            viewRef.current.state.doc,
            from,
            to
          );
          console.log('Suggestion data:', suggestionData);
          handler.dispatch(acceptSuggestionsInRange(from, to));
          setPersistentSuggestions((prev) => {
            const updated = prev.filter((s) => {
              const isMatch = 
                (suggestionData.textReplacement === s.textReplacement &&
                 suggestionData.suggestionType === 'insert') ||
                (suggestionData.textToReplace === s.textToReplace &&
                 suggestionData.suggestionType === 'delete');
              console.log('Comparing:',
                '\n  Found:', suggestionData,
                '\n  Expected:', { textToReplace: s.textToReplace, textReplacement: s.textReplacement },
                '\n  isMatch:', isMatch
              );
              return !isMatch;
            });
            console.log('Updated persistentSuggestions after accept:', updated);
            return updated;
          });
        };

        const rejectButton = document.createElement('button');
        rejectButton.textContent = 'Reject';
        rejectButton.className = 'bg-transparent text-black border border-gray-300 px-3 py-1.5 pl-8 rounded-md text-sm font-medium relative transition-all duration-150 ease-in-out hover:bg-gray-50 hover:border-gray-400';
        const rejectIcon = document.createElement('span');
        rejectIcon.className = 'absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 bg-no-repeat bg-contain';
        rejectIcon.style.backgroundImage = "url('data:image/svg+xml,%3Csvg xmlns=\"http://www.w3.org/2000/svg\" fill=\"none\" viewBox=\"0 0 24 24\" stroke-width=\"2\" stroke=\"%23000\"%3E%3Cpath stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M6 18L18 6M6 6l12 12\"/%3E%3C/svg%3E')";
        rejectButton.appendChild(rejectIcon);
        rejectButton.onclick = () => {
          console.log('Reject button clicked');
          const suggestionData = getSuggestionTextFromRange(
            viewRef.current.state.doc,
            from,
            to
          );
          console.log('Suggestion data:', suggestionData);
          handler.dispatch(rejectSuggestionsInRange(from, to));
          setPersistentSuggestions((prev) => {
            const updated = prev.filter((s) => {
              const isMatch = 
                (suggestionData.textReplacement === s.textReplacement &&
                 suggestionData.suggestionType === 'insert') ||
                (suggestionData.textToReplace === s.textToReplace &&
                 suggestionData.suggestionType === 'delete');
              console.log('Comparing:',
                '\n  Found:', suggestionData,
                '\n  Expected:', { textToReplace: s.textToReplace, textReplacement: s.textReplacement },
                '\n  isMatch:', isMatch
              );
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
            const sectionMap = getBoldSectionsTextFromDoc(newState.doc);
            onContentChange(sectionMap);
          }
        },
      });
      viewRef.current = view;
      if (onContentChange) {
        const sectionMap = getBoldSectionsTextFromDoc(view.state.doc);
        onContentChange(sectionMap);
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
    };
  }, []);

  // Add the new function to handle suggestion text extraction (figuring out which suggestion proseMirror wants to accept/reject)
  /**
   * Get the actual suggestion text from a range, handling both deletions and insertions
   * @param doc - The ProseMirror document
   * @param from - Start position
   * @param to - End position
   * @returns Object with the text content, considering suggestion marks
   */
  function getSuggestionTextFromRange(doc: any, from: number, to: number): {
    textToReplace: string;
    textReplacement: string;
    suggestionType: 'insert' | 'delete' | 'none';
  } {
    let textToReplace = '';
    let textReplacement = '';
    let suggestionType: 'insert' | 'delete' | 'none' = 'none';

    doc.nodesBetween(from, to, (node: any, pos: number) => {
      if (node.isText) {
        const nodeFrom = Math.max(from, pos);
        const nodeTo = Math.min(to, pos + node.nodeSize);
        const start = nodeFrom - pos;
        const end = nodeTo - pos;
        const text = node.text.slice(start, end);

        // Check for suggestion marks
        const insertMark = node.marks.find((m: any) => m.type.name === 'suggestion_insert');
        const deleteMark = node.marks.find((m: any) => m.type.name === 'suggestion_delete');

        if (insertMark) {
          // For insertions, the text is stored in the mark's attrs.text
          textReplacement += insertMark.attrs.text || text;
          suggestionType = 'insert';
          // For insertions, textToReplace is empty (nothing was there before)
        } else if (deleteMark) {
          // For deletions, the original text is in the node's textContent
          textToReplace += text;
          suggestionType = 'delete';
          // For deletions, textReplacement is empty (suggesting deletion)
        } else {
          // No suggestion mark, just regular text
          textToReplace += text;
          textReplacement += text;
        }
      }
    });

    return {
      textToReplace,
      textReplacement,
      suggestionType
    };
  }

  // filter dupes out of newSuggestions and apply unique ones and then update persistentSuggestions
  useEffect(() => {
    if (newSuggestions && Array.isArray(newSuggestions)) {
      //console.log('[SuggestionEditor] Received newSuggestions:', newSuggestions);

      const uniqueSuggestions = newSuggestions.filter((newSuggestion) => {
        const isDuplicate = persistentSuggestions.some(
          (existing) =>
            existing.textToReplace === newSuggestion.textToReplace &&
            existing.textReplacement === newSuggestion.textReplacement &&
            existing.textBefore === newSuggestion.textBefore &&
            existing.textAfter === newSuggestion.textAfter 
        );
        if (isDuplicate) {
          //console.log('[SuggestionEditor] Duplicate suggestion ignored:', newSuggestion);
        } else {
          console.log('[SuggestionEditor] Adding new suggestion to uniqueSuggestions:', newSuggestion);
        }
        return !isDuplicate;
      });
      
      //apply unique suggestions to the editor
      if (viewRef.current && uniqueSuggestions.length > 0) {
        uniqueSuggestions.forEach((suggestion) => {
          if (modulesRef.current && modulesRef.current.applySuggestion) {
            modulesRef.current.applySuggestion(viewRef.current, suggestion, suggestion.username);
          }
        });
      }
      //update persistentSuggestions with uniqueSuggestions
      if (uniqueSuggestions.length > 0) {
        setPersistentSuggestions((prev) => {
          const updatedSuggestions = [...prev, ...uniqueSuggestions];
          console.log('[SuggestionEditor] Updated persistentSuggestions:', updatedSuggestions);
          return updatedSuggestions;
        });
      }
    }
  }, [newSuggestions]);

  // Trigger getBoldSectionsTextFromDoc on document changes, to then call onContentChange
  useEffect(() => {
    if (viewRef.current) {
      const doc = viewRef.current.state.doc;
      const sectionArray = getBoldSectionsTextFromDoc(doc);
      console.log('[SuggestionEditor] Extracted sectionArray on document change:', sectionArray);
      if (onContentChange) onContentChange(sectionArray);
    }
  }, [persistentSuggestions]);

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


