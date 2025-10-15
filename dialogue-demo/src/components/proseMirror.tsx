"use client";

import React, { useEffect, useRef, useState } from 'react';
import { processSuggestionRejection } from "../utils/suggestionRejection";

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
  onContentChange?: (content: string) => void;
  styleMode?: 'yellow' | 'pink';
  className?: string;
}

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

  // Store loaded modules and schema for reuse
  const modulesRef = useRef<any>(null);
  const schemaRef = useRef<any>(null);

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
      const suggestionPlugin = suggestionModePlugin({
        username: 'example user',
        inSuggestionMode: false,
        hoverMenuOptions: {
          components: {
            createInfoComponent: createSuggestionReasonComponent,
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
            const serializer = DOMSerializer.fromSchema(exampleSchema);
            const fragment = serializer.serializeFragment(newState.doc.content);
            const tempDiv = document.createElement('div');
            tempDiv.appendChild(fragment);
            const html = tempDiv.innerHTML;
            onContentChange(html);
          }
        },
      });
      viewRef.current = view;
      if (onContentChange) {
        const serializer = DOMSerializer.fromSchema(exampleSchema);
        const fragment = serializer.serializeFragment(view.state.doc.content);
        const tempDiv = document.createElement('div');
        tempDiv.appendChild(fragment);
        const html = tempDiv.innerHTML;
        onContentChange(html);
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

  // Apply all new suggestions each time newSuggestions changes
  // Move suggestion rejection logic to a utility function for readability
  useEffect(() => {
    processSuggestionRejection(
      viewRef.current,
      modulesRef.current,
      schemaRef.current,
      newSuggestions
    );
  }, [newSuggestions]);

  return (
    <div className={`w-full max-w-4xl mx-auto ${suggestionModeClass}`} style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div
        ref={editorContainerRef}
        className={`${className} min-h-[300px] prose max-w-none`}
        style={{ fontFamily: "'DM Sans', sans-serif", lineHeight: '1.6', border: 'none', outline: 'none', boxShadow: 'none', padding: 0 }}
      />
      {/* Accept/Reject buttons - always show if newSuggestions exist */}
      {newSuggestions && newSuggestions.length > 0 && (
        <div className="mt-4 space-x-2">
          <button
            onClick={() => {
              if ((window as any).acceptAllSuggestions) (window as any).acceptAllSuggestions();
            }}
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors text-sm font-medium bg-white"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            Accept All
          </button>
          <button
            onClick={() => {
              if ((window as any).rejectAllSuggestions) (window as any).rejectAllSuggestions();
            }}
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
