"use client";

import React, { useEffect, useRef, useState } from 'react';

export interface TextSuggestion {
  textToReplace: string;
  textReplacement: string;
  reason: string;
  textBefore: string;
  textAfter: string;
}

interface SuggestionEditorProps {
  initialContent?: string;
  initialSuggestions?: TextSuggestion[];
  onContentChange?: (content: string) => void;
}

const SuggestionEditor = ({ 
  initialContent, 
  initialSuggestions = [], 
  onContentChange 
}: SuggestionEditorProps) => {
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<any>(null);
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);

  useEffect(() => {
    if (!editorContainerRef.current) return;
    let destroyed = false;
    const loadEditor = async () => {
        const [
          { EditorState },
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
            addSuggestionMarks,
            applySuggestion,
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
        const exampleSchema = new Schema({
          nodes: addListNodes(schema.spec.nodes, 'paragraph block*', 'block'),
          marks: addSuggestionMarks(schema.spec.marks),
        });
        const createSuggestionReasonComponent = (attrs: Record<string, any>) => {
          const reasonDiv = document.createElement('div');
          reasonDiv.className = 'suggestion-info';
          const reason = attrs?.data?.reason;
          if (reason) {
            const reasonLabel = document.createElement('strong');
            reasonLabel.textContent = `${attrs.username}: `;
            reasonLabel.style.fontWeight = '600';
            reasonLabel.style.color = '#111827';
            reasonLabel.style.fontFamily = "'DM Sans', sans-serif";
            const reasonText = document.createElement('span');
            reasonText.textContent = reason;
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
        const state = EditorState.create({
          schema: exampleSchema,
          doc,
          plugins: [
            keymap(baseKeymap),
            suggestionModePlugin({
              username: 'example user',
              inSuggestionMode: false,
              hoverMenuOptions: {
                components: {
                  createInfoComponent: createSuggestionReasonComponent,
                },
              },
            }),
          ],
        });
        const view = new EditorView(editorContainerRef.current!, {
          state,
          dispatchTransaction(tr) {
            const newState = view.state.apply(tr);
            view.updateState(newState);
            if ((window as any).isBoldActive) setIsBold((window as any).isBoldActive());
            if ((window as any).isItalicActive) setIsItalic((window as any).isItalicActive());
            if (onContentChange && tr.docChanged) {
              const serializer = DOMSerializer.fromSchema(exampleSchema);
              const fragment = serializer.serializeFragment(newState.doc.content);
              const tempDiv = document.createElement('div');
              tempDiv.appendChild(fragment);
              onContentChange(tempDiv.innerHTML);
            }
          },
        });
        viewRef.current = view;
        (window as any).toggleBold = () => {
          const command = toggleMark(exampleSchema.marks.strong);
          command(view.state, view.dispatch, view);
        };
        (window as any).toggleItalic = () => {
          const command = toggleMark(exampleSchema.marks.em);
          command(view.state, view.dispatch, view);
        };
        (window as any).isBoldActive = () => {
          const { $from, to, empty } = view.state.selection;
          if (empty) return exampleSchema.marks.strong.isInSet(view.state.storedMarks || $from.marks());
          return view.state.doc.rangeHasMark(view.state.selection.from, to, exampleSchema.marks.strong);
        };
        (window as any).isItalicActive = () => {
          const { $from, to, empty } = view.state.selection;
          if (empty) return exampleSchema.marks.em.isInSet(view.state.storedMarks || $from.marks());
          return view.state.doc.rangeHasMark(view.state.selection.from, to, exampleSchema.marks.em);
        };
        (window as any).acceptAllSuggestions = () => {
          acceptAllSuggestions(view.state, view.dispatch);
        };
        (window as any).rejectAllSuggestions = () => {
          rejectAllSuggestions(view.state, view.dispatch);
        };
        // Apply suggestions if provided
        if (initialSuggestions && initialSuggestions.length > 0) {
          initialSuggestions.forEach((suggestion) => {
            applySuggestion(view, suggestion, 'some suggester');
          });
        }
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
  }, [initialContent, initialSuggestions, onContentChange]);


  const handleBoldToggle = () => {
    if ((window as any).toggleBold) {
      (window as any).toggleBold();
      setIsBold((window as any).isBoldActive());
    }
  };
  const handleItalicToggle = () => {
    if ((window as any).toggleItalic) {
      (window as any).toggleItalic();
      setIsItalic((window as any).isItalicActive());
    }
  };



  return (
    <div className="w-full max-w-4xl mx-auto p-6" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div
        ref={editorContainerRef}
        className="suggestion-mode-pink border border-gray-300 rounded-lg p-4 min-h-[300px] prose max-w-none"
        style={{ fontFamily: "'DM Sans', sans-serif", lineHeight: '1.6' }}
      />
      {/* Accept/Reject buttons - always show if initialSuggestions exist */}
      {initialSuggestions && initialSuggestions.length > 0 && (
        <div className="mt-4 space-x-2">
          <button
            onClick={() => {
              if ((window as any).acceptAllSuggestions) (window as any).acceptAllSuggestions();
            }}
            className="px-4 py-2 bg-gray-400 text-black rounded hover:bg-gray-500 transition-colors"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            Accept All
          </button>
          <button
            onClick={() => {
              if ((window as any).rejectAllSuggestions) (window as any).rejectAllSuggestions();
            }}
            className="px-4 py-2 bg-gray-400 text-black rounded hover:bg-gray-500 transition-colors"
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
