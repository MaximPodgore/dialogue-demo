"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import { Highlight } from "@tiptap/extension-highlight";
import { Link } from "@tiptap/extension-link";
import DiffMatchPatch from "diff-match-patch";

// Types for pending edit state
interface PendingEditState {
  hasEdits: boolean;
  original: string;
  originalContent: any;
  lastDisplayedDiffs: any[];
  userContent: string;
}

interface TiptapEditorProps {
  initial?: string | any;
  currentFile?: string;
  fileContents?: Map<string, any>;
  onContentChange?: (filename: string, content: any, hasChanges: boolean) => void;
  onApplyNewContent?: (applyFn: (newContent: string) => void) => void;
  onPendingEditStateChange?: (filename: string, pendingState: PendingEditState | null) => void;
  pendingEditState?: PendingEditState | null;
  styleMode?: 'yellow' | 'pink';
}

export default function TiptapEditor({
  initial = "Start typing here...",
  currentFile,
  fileContents,
  onContentChange,
  onApplyNewContent,
  onPendingEditStateChange,
  pendingEditState,
  styleMode = 'yellow'
}: TiptapEditorProps) {
  const [hasPendingEdits, setHasPendingEdits] = useState(false);
  const [originalContent, setOriginalContent] = useState<any>(null);
  const [currentDiffs, setCurrentDiffs] = useState<any[] | null>(null);
  const isApplyingChangesRef = useRef(false);
  const dmp = useRef(new DiffMatchPatch());

  // Get initial content for current file
  const getInitialContent = () => {
    if (currentFile && fileContents && fileContents.has(currentFile)) {
      return fileContents.get(currentFile);
    }
    return typeof initial === 'string' ? initial : initial;
  };

  // Initialize Tiptap editor
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disable some features we don't need
        history: false, // We'll handle history ourselves
      }),
      TextStyle,
      Color,
      Highlight.configure({
        multicolor: true,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-500 underline cursor-pointer',
        },
      }),
    ],
    content: getInitialContent(),
    editable: true,
    immediatelyRender: false, // Fix SSR hydration issues
    onUpdate: ({ editor }) => {
      if (isApplyingChangesRef.current || hasPendingEdits) return;
      
      const content = editor.getJSON();
      const text = editor.getText();
      
      // Notify parent of content changes
      setTimeout(() => {
        if (currentFile && onContentChange && !isApplyingChangesRef.current) {
          const hasChanges = text !== (typeof initial === 'string' ? initial : '');
          onContentChange(currentFile, content, hasChanges);
        }
      }, 0);
    },
  });

  // Handle file switching
  useEffect(() => {
    if (!editor || !currentFile) return;
    
    // Check if we have pending edit state to restore for this file
    if (pendingEditState && pendingEditState.hasEdits) {
      // Restore pending edit state
      isApplyingChangesRef.current = true;
      
      // Restore the content that has diff formatting
      if (fileContents && fileContents.has(currentFile)) {
        const savedContent = fileContents.get(currentFile);
        editor.commands.setContent(savedContent);
      }
      
      setHasPendingEdits(true);
      setOriginalContent(pendingEditState.originalContent);
      
      setTimeout(() => {
        isApplyingChangesRef.current = false;
      }, 10);
    } else {
      // No pending edits, load clean content
      const content = getInitialContent();
      
      // Only update if content actually changed
      const currentText = editor.getText();
      const newText = typeof content === 'string' ? content : 
        (content && content.content ? JSON.stringify(content) : '');
      
      if (currentText !== newText) {
        isApplyingChangesRef.current = true;
        
        if (typeof content === 'string') {
          editor.commands.setContent(content);
        } else {
          editor.commands.setContent(content);
        }
        
        // Place cursor at the end of content after switching files
        setTimeout(() => {
          if (editor) {
            const { from } = editor.state.selection;
            const endPos = editor.state.doc.content.size;
            editor.commands.setTextSelection(endPos);
          }
          isApplyingChangesRef.current = false;
        }, 10);
      }
      
      // Reset pending edits state when switching to files without pending edits
      setHasPendingEdits(false);
      setOriginalContent(null);
    }
  }, [currentFile, pendingEditState, editor]);

  // Initialize content when editor is ready
  useEffect(() => {
    if (!editor) return;
    
    isApplyingChangesRef.current = true;
    const content = getInitialContent();
    
    // Only set content if it's actually different from current content
    const currentText = editor.getText();
    const newText = typeof content === 'string' ? content : 
      (content && content.content ? JSON.stringify(content) : '');
    
    if (currentText !== newText) {
      if (typeof content === 'string') {
        editor.commands.setContent(content);
      } else {
        editor.commands.setContent(content);
      }
    }
    
    setTimeout(() => {
      isApplyingChangesRef.current = false;
    }, 10);
  }, [editor]);

  // Register the applyNewContent function with parent
  useEffect(() => {
    if (onApplyNewContent) {
      onApplyNewContent(applyNewContent);
    }
  }, [onApplyNewContent]);

  // Function to re-apply current diffs with new styling
  const reApplyDiffsWithNewStyling = useCallback(() => {
    if (!editor || !originalContent || !currentDiffs) return;
    
    isApplyingChangesRef.current = true;
    
    // Get the clean text content
    const cleanText = editor.getText();
    
    // Now rebuild with current styling mode using the original diffs
    const newContent: any[] = [];
    let currentPos = 0;
    
    for (const diff of currentDiffs) {
      const type = diff[0];
      const text = diff[1] as string;
      
      if (type === 0) {
        // Equal text - preserve original formatting from originalContent
        let remainingLength = text.length;
        let textStart = currentPos;
        
        if (originalContent && originalContent.content) {
          // Find the content that contains this text range
          for (const block of originalContent.content) {
            if (block.content) {
              let blockCharIndex = 0;
              
              for (const node of block.content) {
                if (node.type === 'text' && node.text) {
                  const nodeLength = node.text.length;
                  
                  if (blockCharIndex + nodeLength > textStart && remainingLength > 0) {
                    // This node overlaps with our text range
                    const startInNode = Math.max(0, textStart - blockCharIndex);
                    const endInNode = Math.min(nodeLength, textStart + remainingLength - blockCharIndex);
                    const takeLength = endInNode - startInNode;
                    
                    if (takeLength > 0) {
                      const nodeText = node.text.substring(startInNode, endInNode);
                      newContent.push({
                        type: 'text',
                        text: nodeText,
                        marks: node.marks || undefined
                      });
                      remainingLength -= takeLength;
                      textStart += takeLength;
                    }
                  }
                  blockCharIndex += nodeLength;
                }
              }
            }
          }
        }
        
        // If we couldn't map all text to existing content, add remaining as plain text
        if (remainingLength > 0) {
          newContent.push({
            type: 'text',
            text: text.substring(text.length - remainingLength)
          });
        }
        
        currentPos += text.length;
      } else if (type === 1) {
        // Insertion - highlight based on current style mode
        const marks = styleMode === 'yellow' 
          ? [{ type: 'highlight', attrs: { color: '#fff59d' } }]
          : [{ type: 'textStyle', attrs: { color: '#b43f7f' } }];
        
        newContent.push({
          type: 'text',
          text: text,
          marks: marks
        });
        // Don't advance currentPos for insertions
      } else if (type === -1) {
        // Deletion - show with strikethrough and highlighting, preserve original formatting
        let remainingLength = text.length;
        let textStart = currentPos;
        
        if (originalContent && originalContent.content) {
          // Find the content that contains this text range
          for (const block of originalContent.content) {
            if (block.content) {
              let blockCharIndex = 0;
              
              for (const node of block.content) {
                if (node.type === 'text' && node.text) {
                  const nodeLength = node.text.length;
                  
                  if (blockCharIndex + nodeLength > textStart && remainingLength > 0) {
                    // This node overlaps with our text range
                    const startInNode = Math.max(0, textStart - blockCharIndex);
                    const endInNode = Math.min(nodeLength, textStart + remainingLength - blockCharIndex);
                    const takeLength = endInNode - startInNode;
                    
                    if (takeLength > 0) {
                      const nodeText = node.text.substring(startInNode, endInNode);
                      const deletionMarks = styleMode === 'yellow'
                        ? [
                            ...(node.marks || []),
                            { type: 'highlight', attrs: { color: '#fff59d' } },
                            { type: 'strike' }
                          ]
                        : [
                            ...(node.marks || []),
                            { type: 'textStyle', attrs: { color: '#b43f7f' } },
                            { type: 'strike' }
                          ];
                      
                      newContent.push({
                        type: 'text',
                        text: nodeText,
                        marks: deletionMarks
                      });
                      remainingLength -= takeLength;
                      textStart += takeLength;
                    }
                  }
                  blockCharIndex += nodeLength;
                }
              }
            }
          }
        }
        
        // If we couldn't map all text to existing content, add remaining with basic deletion formatting
        if (remainingLength > 0) {
          const deletionMarks = styleMode === 'yellow'
            ? [
                { type: 'highlight', attrs: { color: '#fff59d' } },
                { type: 'strike' }
              ]
            : [
                { type: 'textStyle', attrs: { color: '#b43f7f' } },
                { type: 'strike' }
              ];
          
          newContent.push({
            type: 'text',
            text: text.substring(text.length - remainingLength),
            marks: deletionMarks
          });
        }
        
        currentPos += text.length;
      }
    }
    
    const newDoc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: newContent
        }
      ]
    };
    
    editor.commands.setContent(newDoc);
    
    setTimeout(() => {
      isApplyingChangesRef.current = false;
    }, 10);
  }, [editor, originalContent, currentDiffs, styleMode]);

  // Notify parent when pending edit state changes
  useEffect(() => {
    if (onPendingEditStateChange && currentFile && !isApplyingChangesRef.current) {
      if (hasPendingEdits && originalContent) {
        const pendingState: PendingEditState = {
          hasEdits: true,
          original: "",
          originalContent: originalContent,
          lastDisplayedDiffs: [],
          userContent: ""
        };
        onPendingEditStateChange(currentFile, pendingState);
      } else {
        onPendingEditStateChange(currentFile, null);
      }
    }
  }, [hasPendingEdits, originalContent, currentFile, onPendingEditStateChange]);

  // Update diff styling when styleMode changes
  useEffect(() => {
    if (!editor || !hasPendingEdits || !originalContent || !currentDiffs) return;
    
    // Re-apply the current diffs with the new styling
    reApplyDiffsWithNewStyling();
  }, [styleMode, editor, hasPendingEdits, originalContent, currentDiffs, reApplyDiffsWithNewStyling]);

  const applyNewContent = useCallback((newContent: string) => {
    if (!editor) return;
    
    isApplyingChangesRef.current = true;
    
    // Store current content before applying LLM changes
    const currentContent = editor.getJSON();
    setOriginalContent(currentContent);
    
    // Get current text content
    const currentText = editor.getText().replace(/\n$/, '');
    
    // Trim leading whitespace from new content
    const trimmedNewContent = newContent.replace(/^\s+/, '');
    
    // Create diff between current text and new LLM content
    const diffs = dmp.current.diff_main(currentText, trimmedNewContent);
    dmp.current.diff_cleanupSemantic(diffs);
    
    // Store the diffs for potential re-styling
    setCurrentDiffs(diffs);
    
    // Build new content while preserving existing formatting
    const newContentNodes: any[] = [];
    let currentPos = 0;
    
    for (const diff of diffs) {
      const type = diff[0];
      const text = diff[1] as string;
      
      if (type === 0) {
        // Equal text - preserve original formatting from currentContent
        let remainingLength = text.length;
        let textStart = currentPos;
        
        if (currentContent && currentContent.content) {
          // Find the content that contains this text range
          for (const block of currentContent.content) {
            if (block.content) {
              let blockCharIndex = 0;
              
              for (const node of block.content) {
                if (node.type === 'text' && node.text) {
                  const nodeLength = node.text.length;
                  
                  if (blockCharIndex + nodeLength > textStart && remainingLength > 0) {
                    // This node overlaps with our text range
                    const startInNode = Math.max(0, textStart - blockCharIndex);
                    const endInNode = Math.min(nodeLength, textStart + remainingLength - blockCharIndex);
                    const takeLength = endInNode - startInNode;
                    
                    if (takeLength > 0) {
                      const nodeText = node.text.substring(startInNode, endInNode);
                      newContentNodes.push({
                        type: 'text',
                        text: nodeText,
                        marks: node.marks || undefined
                      });
                      remainingLength -= takeLength;
                      textStart += takeLength;
                    }
                  }
                  blockCharIndex += nodeLength;
                }
              }
            }
          }
        }
        
        // If we couldn't map all text to existing content, add remaining as plain text
        if (remainingLength > 0) {
          newContentNodes.push({
            type: 'text',
            text: text.substring(text.length - remainingLength)
          });
        }
        
        currentPos += text.length;
      } else if (type === 1) {
        // Insertion - highlight based on style mode
        const marks = styleMode === 'yellow' 
          ? [{ type: 'highlight', attrs: { color: '#fff59d' } }]
          : [{ type: 'textStyle', attrs: { color: '#b43f7f' } }];
        
        newContentNodes.push({
          type: 'text',
          text: text,
          marks: marks
        });
        // Don't advance currentPos for insertions
      } else if (type === -1) {
        // Deletion - show with strikethrough and highlighting, preserve original formatting
        let remainingLength = text.length;
        let textStart = currentPos;
        
        if (currentContent && currentContent.content) {
          // Find the content that contains this text range
          for (const block of currentContent.content) {
            if (block.content) {
              let blockCharIndex = 0;
              
              for (const node of block.content) {
                if (node.type === 'text' && node.text) {
                  const nodeLength = node.text.length;
                  
                  if (blockCharIndex + nodeLength > textStart && remainingLength > 0) {
                    // This node overlaps with our text range
                    const startInNode = Math.max(0, textStart - blockCharIndex);
                    const endInNode = Math.min(nodeLength, textStart + remainingLength - blockCharIndex);
                    const takeLength = endInNode - startInNode;
                    
                    if (takeLength > 0) {
                      const nodeText = node.text.substring(startInNode, endInNode);
                      const deletionMarks = styleMode === 'yellow'
                        ? [
                            ...(node.marks || []),
                            { type: 'highlight', attrs: { color: '#fff59d' } },
                            { type: 'strike' }
                          ]
                        : [
                            ...(node.marks || []),
                            { type: 'textStyle', attrs: { color: '#b43f7f' } },
                            { type: 'strike' }
                          ];
                      
                      newContentNodes.push({
                        type: 'text',
                        text: nodeText,
                        marks: deletionMarks
                      });
                      remainingLength -= takeLength;
                      textStart += takeLength;
                    }
                  }
                  blockCharIndex += nodeLength;
                }
              }
            }
          }
        }
        
        // If we couldn't map all text to existing content, add remaining with basic deletion formatting
        if (remainingLength > 0) {
          const deletionMarks = styleMode === 'yellow'
            ? [
                { type: 'highlight', attrs: { color: '#fff59d' } },
                { type: 'strike' }
              ]
            : [
                { type: 'textStyle', attrs: { color: '#b43f7f' } },
                { type: 'strike' }
              ];
          
          newContentNodes.push({
            type: 'text',
            text: text.substring(text.length - remainingLength),
            marks: deletionMarks
          });
        }
        
        currentPos += text.length;
      }
    }
    
    const newDoc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: newContentNodes
        }
      ]
    };
    
    editor.commands.setContent(newDoc);
    
    // Set pending edits state
    setHasPendingEdits(true);
    
    // Notify parent of content change with a delay to prevent loops
    setTimeout(() => {
      if (currentFile && onContentChange) {
        onContentChange(currentFile, newDoc, true);
      }
      isApplyingChangesRef.current = false;
    }, 10);
  }, [editor, currentFile, onContentChange, styleMode]);

  const accept = useCallback(() => {
    if (!editor || !hasPendingEdits) return;
    
    isApplyingChangesRef.current = true;
    
    // Remove diff formatting and keep the final content
    const content = editor.getJSON();
    
    // Clean the content by removing diff-related marks
    const cleanContent = (node: any): any => {
      if (node.type === 'text' && node.marks) {
        const cleanMarks = node.marks.filter((mark: any) => {
          // Remove highlight marks and pink text color
          if (mark.type === 'highlight') return false;
          if (mark.type === 'textStyle' && mark.attrs?.color === '#b43f7f') return false;
          return true;
        });
        
        return {
          ...node,
          marks: cleanMarks.length > 0 ? cleanMarks : undefined
        };
      }
      
      if (node.content) {
        return {
          ...node,
          content: node.content.map(cleanContent)
        };
      }
      
      return node;
    };
    
    const cleanedContent = cleanContent(content);
    editor.commands.setContent(cleanedContent);
    
    setHasPendingEdits(false);
    setOriginalContent(null);
    setCurrentDiffs(null);
    
    setTimeout(() => {
      if (currentFile && onContentChange) {
        onContentChange(currentFile, cleanedContent, true);
      }
      isApplyingChangesRef.current = false;
    }, 10);
  }, [editor, hasPendingEdits, currentFile, onContentChange]);

  const discard = useCallback(() => {
    if (!editor || !originalContent) return;
    
    isApplyingChangesRef.current = true;
    
    // Restore original content
    editor.commands.setContent(originalContent);
    
    setHasPendingEdits(false);
    setOriginalContent(null);
    setCurrentDiffs(null);
    
    setTimeout(() => {
      if (currentFile && onContentChange) {
        onContentChange(currentFile, originalContent, false);
      }
      isApplyingChangesRef.current = false;
    }, 10);
  }, [editor, originalContent, currentFile, onContentChange]);

  // Update editor editable state based on pending edits
  useEffect(() => {
    if (editor) {
      editor.setEditable(!hasPendingEdits);
    }
  }, [editor, hasPendingEdits]);

  if (!editor) {
    return <div>Loading editor...</div>;
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Toolbar */}
      <div className="border border-gray-200 rounded-t-md p-2 bg-gray-50">
        <div className="flex gap-1">
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`px-2 py-1 rounded text-sm ${
              editor.isActive('bold') ? 'bg-gray-200' : 'hover:bg-gray-100'
            }`}
            disabled={hasPendingEdits}
          >
            Bold
          </button>
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`px-2 py-1 rounded text-sm ${
              editor.isActive('italic') ? 'bg-gray-200' : 'hover:bg-gray-100'
            }`}
            disabled={hasPendingEdits}
          >
            Italic
          </button>
          <button
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={`px-2 py-1 rounded text-sm ${
              editor.isActive('strike') ? 'bg-gray-200' : 'hover:bg-gray-100'
            }`}
            disabled={hasPendingEdits}
          >
            Strike
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={`px-2 py-1 rounded text-sm ${
              editor.isActive('heading', { level: 1 }) ? 'bg-gray-200' : 'hover:bg-gray-100'
            }`}
            disabled={hasPendingEdits}
          >
            H1
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`px-2 py-1 rounded text-sm ${
              editor.isActive('heading', { level: 2 }) ? 'bg-gray-200' : 'hover:bg-gray-100'
            }`}
            disabled={hasPendingEdits}
          >
            H2
          </button>
          <button
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`px-2 py-1 rounded text-sm ${
              editor.isActive('bulletList') ? 'bg-gray-200' : 'hover:bg-gray-100'
            }`}
            disabled={hasPendingEdits}
          >
            List
          </button>
        </div>
      </div>
      
      {/* Editor */}
      <div className="border border-gray-200 border-t-0 rounded-b-md min-h-[300px] p-4">
        <EditorContent editor={editor} />
      </div>
      
      {/* Accept/Discard buttons */}
      {hasPendingEdits && (
        <div className="flex gap-2">
          <button 
            className="px-3 py-1 rounded mr-2 bg-green-600 text-white" 
            onClick={accept}
          >
            Accept
          </button>
          <button 
            className="px-3 py-1 rounded bg-red-600 text-white" 
            onClick={discard}
          >
            Discard
          </button>
        </div>
      )}
      
      {/* Status message */}
      {hasPendingEdits && (
        <div className="text-sm text-gray-600 bg-yellow-50 p-2 rounded">
          Editor is read-only while LLM changes are pending. Accept or discard to continue editing.
        </div>
      )}
    </div>
  );
}
