"use client";

import React, { useRef, useState, forwardRef, useEffect, useLayoutEffect } from "react";
import DiffMatchPatch from "diff-match-patch";

// Dynamic Quill import to ensure document is available
let Quill: any = null;
let Delta: any = null;

const initializeQuill = async () => {
  if (Quill) return Quill;
  
  const QuillModule = await import("quill");
  Quill = QuillModule.default ?? QuillModule;
  Delta = Quill.import('delta');
  
  // Dynamically import quill css
  try {
    await import("quill/dist/quill.snow.css");
  } catch (e) {
    // ignore; some bundlers may not support CSS imports this way
  }
  
  return Quill;
};

// Editor is an uncontrolled React component
const Editor = forwardRef<any, {
  defaultValue?: any;
  onTextChange?: (...args: any[]) => void;
  disabled?: boolean;
}>(({ defaultValue, onTextChange, disabled }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const defaultValueRef = useRef(defaultValue);
  const onTextChangeRef = useRef(onTextChange);

  useLayoutEffect(() => {
    onTextChangeRef.current = onTextChange;
  });

  useEffect(() => {
    let mounted = true;

    const initEditor = async () => {
      if (!containerRef.current || !mounted) return;

      const QuillClass = await initializeQuill();
      
      const container = containerRef.current;
      const editorContainer = container.appendChild(
        container.ownerDocument.createElement('div'),
      );
      
      const quill = new QuillClass(editorContainer, {
        theme: 'snow',
        readOnly: disabled,
        modules: {
          toolbar: disabled ? false : [
            ["bold", "italic", "underline"], 
            [{ header: [1, 2, false] }], 
            [{ list: "ordered" }, { list: "bullet" }], 
            ["link", "blockquote", "code-block"]
          ],
        },
      });

      if (ref && typeof ref === 'object') {
        ref.current = quill;
      }

      if (defaultValueRef.current) {
        if (typeof defaultValueRef.current === 'string') {
          quill.setText(defaultValueRef.current);
        } else {
          quill.setContents(defaultValueRef.current);
        }
      }

      quill.on(QuillClass.events.TEXT_CHANGE, (...args: any[]) => {
        if (mounted && !disabled) {
          onTextChangeRef.current?.(...args);
        }
      });

      // Handle disabled state changes
      if (disabled) {
        quill.disable();
      } else {
        quill.enable();
      }
    };

    initEditor();

    return () => {
      mounted = false;
      if (ref && typeof ref === 'object' && ref.current) {
        ref.current = null;
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [ref, disabled]);

  // Handle disabled state changes after editor is created
  useEffect(() => {
    if (ref && typeof ref === 'object' && ref.current) {
      if (disabled) {
        ref.current.disable();
      } else {
        ref.current.enable();
      }
    }
  }, [disabled, ref]);

  return <div ref={containerRef}></div>;
});

Editor.displayName = 'Editor';

type Props = {
  initial?: string | any; // Can be string or Delta object for formatted content
  currentFile?: string; // Current filename being edited
  fileContents?: Map<string, any>; // Map of filename to current content (including unsaved edits)
  onContentChange?: (filename: string, content: any, hasChanges: boolean) => void; // Notify parent of content changes
  onApplyNewContent?: (applyFn: (newContent: string) => void) => void; // Function to apply LLM content
  onPendingEditStateChange?: (filename: string, pendingState: {
    hasEdits: boolean;
    original: string;
    originalDelta: any;
    lastDisplayedDiffs: any[];
    userContent: string;
  } | null) => void; // Notify parent of pending edit state changes
  pendingEditState?: {
    hasEdits: boolean;
    original: string;
    originalDelta: any;
    lastDisplayedDiffs: any[];
    userContent: string;
  } | null; // Restored pending edit state for current file
  styleMode?: 'yellow' | 'pink'; // Style mode for LLM diffs
};

/**
 * TrackedQuill Component
 * 
 * Simplified behavior:
 * - User changes: No tracking, no diff visualization, immediate acceptance
 * - LLM changes: Show diff visualization with Accept/Discard buttons
 * - Pending edits: Editor becomes read-only until Accept/Discard is clicked
 */
export default function TrackedQuill({ 
  initial = "Start typing here...", 
  currentFile, 
  fileContents, 
  onContentChange, 
  onApplyNewContent,
  onPendingEditStateChange,
  pendingEditState,
  styleMode = 'yellow'
}: Props) {
  const quillRef = useRef<any>(null);
  const [hasPendingEdits, setHasPendingEdits] = useState(false);
  const [originalContent, setOriginalContent] = useState<any>(null);
  const [currentDiffs, setCurrentDiffs] = useState<any[] | null>(null); // Store current diffs for re-styling
  const isApplyingChangesRef = useRef(false); // Track when we're programmatically updating content
  const lastNotifiedPendingStateRef = useRef<boolean>(false); // Track last notified pending state
  const notificationTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Debounce notifications
  
  // Get initial content for current file
  const getInitialContent = () => {
    if (currentFile && fileContents && fileContents.has(currentFile)) {
      return fileContents.get(currentFile);
    }
    return typeof initial === 'string' ? initial : initial;
  };

  // Handle file switching
  useEffect(() => {
    if (!quillRef.current || !currentFile) return;
    
    // Reset notification tracking when switching files
    lastNotifiedPendingStateRef.current = false;
    
    // Check if we have pending edit state to restore for this file
    if (pendingEditState && pendingEditState.hasEdits) {
      // Restore pending edit state
      isApplyingChangesRef.current = true;
      
      // Restore the content that has diff formatting
      if (fileContents && fileContents.has(currentFile)) {
        const savedContent = fileContents.get(currentFile);
        quillRef.current.setContents(savedContent);
      }
      
      setHasPendingEdits(true);
      // Reconstruct original content from pending state
      if (pendingEditState.originalDelta) {
        setOriginalContent(pendingEditState.originalDelta);
      }
      
      setTimeout(() => {
        isApplyingChangesRef.current = false;
      }, 10);
    } else {
      // No pending edits, load clean content
      const content = getInitialContent();
      
      // Only update if content actually changed to prevent infinite loops
      const currentText = quillRef.current.getText();
      const newText = typeof content === 'string' ? content : 
        (content && content.ops ? content.ops.map((op: any) => typeof op.insert === 'string' ? op.insert : '').join('') : '');
      
      if (currentText !== newText) {
        isApplyingChangesRef.current = true;
        
        // Don't store selection for file switching - let cursor go to end naturally
        if (typeof content === 'string') {
          quillRef.current.setText(content);
        } else {
          quillRef.current.setContents(content);
        }
        
        // Place cursor at the end of content after switching files
        setTimeout(() => {
          if (quillRef.current) {
            const length = quillRef.current.getLength();
            quillRef.current.setSelection(length - 1, 0);
          }
          isApplyingChangesRef.current = false;
        }, 10);
      }
      
      // Reset pending edits state when switching to files without pending edits
      setHasPendingEdits(false);
      setOriginalContent(null);
    }
  }, [currentFile, pendingEditState]);

  // Initialize content when quill is ready (only once)
  useEffect(() => {
    if (!quillRef.current) return;
    
    isApplyingChangesRef.current = true;
    const content = getInitialContent();
    
    // Only set content if it's actually different from current content
    const currentText = quillRef.current.getText();
    const newText = typeof content === 'string' ? content : 
      (content && content.ops ? content.ops.map((op: any) => typeof op.insert === 'string' ? op.insert : '').join('') : '');
    
    if (currentText !== newText) {
      if (typeof content === 'string') {
        quillRef.current.setText(content);
      } else {
        quillRef.current.setContents(content);
      }
    }
    
    // Don't set cursor position on initial load, let it be at the end naturally
    setTimeout(() => {
      isApplyingChangesRef.current = false;
    }, 10);
  }, [quillRef.current]);

  // Register the applyNewContent function with parent
  useEffect(() => {
    if (onApplyNewContent) {
      onApplyNewContent(applyNewContent);
    }
  }, [onApplyNewContent]);

  // Notify parent when pending edit state changes
  useEffect(() => {
    if (onPendingEditStateChange && currentFile && !isApplyingChangesRef.current) {
      // Clear any existing timeout
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
      }
      
      // Debounce the notification to prevent infinite loops
      notificationTimeoutRef.current = setTimeout(() => {
        // Only notify if the pending state actually changed
        if (hasPendingEdits !== lastNotifiedPendingStateRef.current) {
          if (hasPendingEdits && originalContent) {
            const pendingState = {
              hasEdits: true,
              original: "",
              originalDelta: originalContent,
              lastDisplayedDiffs: [],
              userContent: ""
            };
            onPendingEditStateChange(currentFile, pendingState);
          } else {
            onPendingEditStateChange(currentFile, null);
          }
          lastNotifiedPendingStateRef.current = hasPendingEdits;
        }
      }, 10);
    }
    
    return () => {
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
      }
    };
  }, [hasPendingEdits, originalContent, currentFile, onPendingEditStateChange]);

  // Update diff styling when styleMode changes
  useEffect(() => {
    if (!quillRef.current || !hasPendingEdits || !originalContent || !currentDiffs) return;
    
    // Re-apply the current diffs with the new styling
    reApplyDiffsWithNewStyling();
  }, [styleMode]);

  // Function to re-apply current diffs with new styling
  const reApplyDiffsWithNewStyling = () => {
    if (!quillRef.current || !originalContent || !currentDiffs) return;
    
    isApplyingChangesRef.current = true;
    
    // First, get the current content and remove all diff-related styling
    const currentContent = quillRef.current.getContents();
    const cleanedOps: any[] = [];
    
    if (currentContent && currentContent.ops) {
      for (const op of currentContent.ops) {
        if (typeof op.insert === 'string') {
          if (op.attributes) {
            const cleanAttributes = { ...op.attributes };
            // Remove all diff-related styling
            delete cleanAttributes.background;
            delete cleanAttributes.strike;
            if (cleanAttributes.color === "#b43f7f") {
              delete cleanAttributes.color;
            }
            
            if (Object.keys(cleanAttributes).length > 0) {
              cleanedOps.push({ insert: op.insert, attributes: cleanAttributes });
            } else {
              cleanedOps.push({ insert: op.insert });
            }
          } else {
            cleanedOps.push({ insert: op.insert });
          }
        } else {
          cleanedOps.push(op);
        }
      }
    }
    
    // Get the clean text content
    const cleanDelta = new Delta(cleanedOps);
    const cleanText = cleanDelta.ops?.map((op: any) => 
      typeof op.insert === 'string' ? op.insert : ''
    ).join('') || '';
    
    // Now rebuild with current styling mode using the original diffs
    const newOps: any[] = [];
    let currentPos = 0;
    
    for (const diff of currentDiffs) {
      const type = diff[0];
      const text = diff[1] as string;
      
      if (type === 0) {
        // Equal text - preserve existing formatting from original content
        let remainingLength = text.length;
        let textStart = currentPos;
        
        if (originalContent && originalContent.ops) {
          let opCharIndex = 0;
          
          // Find the ops that contain this text range
          for (const op of originalContent.ops) {
            if (typeof op.insert === 'string') {
              const opLength = op.insert.length;
              
              if (opCharIndex + opLength > textStart && remainingLength > 0) {
                // This op overlaps with our text range
                const startInOp = Math.max(0, textStart - opCharIndex);
                const endInOp = Math.min(opLength, textStart + remainingLength - opCharIndex);
                const takeLength = endInOp - startInOp;
                
                if (takeLength > 0) {
                  const opText = op.insert.substring(startInOp, endInOp);
                  if (op.attributes) {
                    newOps.push({ insert: opText, attributes: op.attributes });
                  } else {
                    newOps.push({ insert: opText });
                  }
                  remainingLength -= takeLength;
                  textStart += takeLength;
                }
              }
              opCharIndex += opLength;
            } else {
              // Non-text insert (embed, etc.)
              if (opCharIndex === textStart && remainingLength > 0) {
                newOps.push(op);
              }
              opCharIndex += 1; // Embeds count as 1 character
            }
          }
        }
        
        // If we couldn't map all text to existing ops, add remaining as plain text
        if (remainingLength > 0) {
          newOps.push({ insert: text.substring(text.length - remainingLength) });
        }
        
        currentPos += text.length;
      } else if (type === 1) {
        // Insertion - highlight based on current style mode
        const insertionAttributes = styleMode === 'yellow' 
          ? { background: "#fff59d" }
          : { color: "#b43f7f" };
        newOps.push({ insert: text, attributes: insertionAttributes });
        // Don't advance currentPos for insertions
      } else if (type === -1) {
        // Deletion - show with strikethrough and highlighting, preserve original formatting
        let remainingLength = text.length;
        let textStart = currentPos;
        
        if (originalContent && originalContent.ops) {
          let opCharIndex = 0;
          
          // Find the ops that contain this text range
          for (const op of originalContent.ops) {
            if (typeof op.insert === 'string') {
              const opLength = op.insert.length;
              
              if (opCharIndex + opLength > textStart && remainingLength > 0) {
                // This op overlaps with our text range
                const startInOp = Math.max(0, textStart - opCharIndex);
                const endInOp = Math.min(opLength, textStart + remainingLength - opCharIndex);
                const takeLength = endInOp - startInOp;
                
                if (takeLength > 0) {
                  const opText = op.insert.substring(startInOp, endInOp);
                  const deletionAttributes = styleMode === 'yellow'
                    ? {
                        ...op.attributes,
                        background: "#fff59d",
                        strike: true
                      }
                    : {
                        ...op.attributes,
                        color: "#b43f7f",
                        strike: true
                      };
                  newOps.push({ insert: opText, attributes: deletionAttributes });
                  remainingLength -= takeLength;
                  textStart += takeLength;
                }
              }
              opCharIndex += opLength;
            }
          }
        }
        
        // If we couldn't map all text to existing ops, add remaining with basic deletion formatting
        if (remainingLength > 0) {
          const deletionAttributes = styleMode === 'yellow'
            ? { background: "#fff59d", strike: true }
            : { color: "#b43f7f", strike: true };
          newOps.push({ 
            insert: text.substring(text.length - remainingLength), 
            attributes: deletionAttributes
          });
        }
        
        currentPos += text.length;
      }
    }
    
    const newDelta = new Delta(newOps);
    quillRef.current.setContents(newDelta);
    
    setTimeout(() => {
      isApplyingChangesRef.current = false;
    }, 10);
  };

  const applyNewContent = (newContent: string) => {
    if (!quillRef.current) return;
    
    isApplyingChangesRef.current = true;
    
    // Store current content before applying LLM changes
    const currentContent = quillRef.current.getContents();
    setOriginalContent(currentContent);
    
    // Get current text content
    const currentText = quillRef.current.getText().replace(/\n$/, '');
    
    // Trim leading whitespace from new content
    const trimmedNewContent = newContent.replace(/^\s+/, '');
    
    // Create diff between current text and new LLM content
    const dmp = new DiffMatchPatch();
    const diffs = dmp.diff_main(currentText, trimmedNewContent);
    dmp.diff_cleanupSemantic(diffs);
    
    // Store the diffs for potential re-styling
    setCurrentDiffs(diffs);
    
    // Build new ops while preserving existing formatting
    const newOps: any[] = [];
    let currentPos = 0;
    
    for (const diff of diffs) {
      const type = diff[0];
      const text = diff[1] as string;
      
      if (type === 0) {
        // Equal text - preserve existing formatting
        let remainingLength = text.length;
        let textStart = currentPos;
        
        if (currentContent && currentContent.ops) {
          let opIndex = 0;
          let opCharIndex = 0;
          
          // Find the ops that contain this text range
          for (const op of currentContent.ops) {
            if (typeof op.insert === 'string') {
              const opLength = op.insert.length;
              
              if (opCharIndex + opLength > textStart && remainingLength > 0) {
                // This op overlaps with our text range
                const startInOp = Math.max(0, textStart - opCharIndex);
                const endInOp = Math.min(opLength, textStart + remainingLength - opCharIndex);
                const takeLength = endInOp - startInOp;
                
                if (takeLength > 0) {
                  const opText = op.insert.substring(startInOp, endInOp);
                  if (op.attributes) {
                    newOps.push({ insert: opText, attributes: op.attributes });
                  } else {
                    newOps.push({ insert: opText });
                  }
                  remainingLength -= takeLength;
                  textStart += takeLength;
                }
              }
              opCharIndex += opLength;
            } else {
              // Non-text insert (embed, etc.)
              if (opCharIndex === textStart && remainingLength > 0) {
                newOps.push(op);
              }
              opCharIndex += 1; // Embeds count as 1 character
            }
          }
        }
        
        // If we couldn't map all text to existing ops, add remaining as plain text
        if (remainingLength > 0) {
          newOps.push({ insert: text.substring(text.length - remainingLength) });
        }
        
        currentPos += text.length;
      } else if (type === 1) {
        // Insertion - highlight based on style mode
        const insertionAttributes = styleMode === 'yellow' 
          ? { background: "#fff59d" }
          : { color: "#b43f7f" }; // Using the primary pink color
        newOps.push({ insert: text, attributes: insertionAttributes });
        // Don't advance currentPos for insertions
      } else if (type === -1) {
        // Deletion - show with strikethrough and highlighting, preserve original formatting
        let remainingLength = text.length;
        let textStart = currentPos;
        
        if (currentContent && currentContent.ops) {
          let opCharIndex = 0;
          
          // Find the ops that contain this text range
          for (const op of currentContent.ops) {
            if (typeof op.insert === 'string') {
              const opLength = op.insert.length;
              
              if (opCharIndex + opLength > textStart && remainingLength > 0) {
                // This op overlaps with our text range
                const startInOp = Math.max(0, textStart - opCharIndex);
                const endInOp = Math.min(opLength, textStart + remainingLength - opCharIndex);
                const takeLength = endInOp - startInOp;
                
                if (takeLength > 0) {
                  const opText = op.insert.substring(startInOp, endInOp);
                  const deletionAttributes = styleMode === 'yellow'
                    ? {
                        ...op.attributes,
                        background: "#fff59d",
                        strike: true
                      }
                    : {
                        ...op.attributes,
                        color: "#b43f7f",
                        strike: true
                      };
                  newOps.push({ insert: opText, attributes: deletionAttributes });
                  remainingLength -= takeLength;
                  textStart += takeLength;
                }
              }
              opCharIndex += opLength;
            }
          }
        }
        
        // If we couldn't map all text to existing ops, add remaining with basic deletion formatting
        if (remainingLength > 0) {
          const deletionAttributes = styleMode === 'yellow'
            ? { background: "#fff59d", strike: true }
            : { color: "#b43f7f", strike: true };
          newOps.push({ 
            insert: text.substring(text.length - remainingLength), 
            attributes: deletionAttributes
          });
        }
        
        currentPos += text.length;
      }
    }
    
    const newDelta = new Delta(newOps);
    quillRef.current.setContents(newDelta);
    
    // Set pending edits state
    setHasPendingEdits(true);
    
    // Notify parent of content change with a delay to prevent loops
    setTimeout(() => {
      if (currentFile && onContentChange) {
        onContentChange(currentFile, newDelta, true);
      }
      isApplyingChangesRef.current = false;
    }, 10);
  };

  // Handle text changes - only allow editing non-pending text
  const handleTextChange = (...args: any[]) => {
    if (!quillRef.current || hasPendingEdits || isApplyingChangesRef.current) return;
    
    // For non-pending edits, just update content normally
    const content = quillRef.current.getContents();
    
    // Use setTimeout to avoid infinite update loops
    setTimeout(() => {
      if (currentFile && onContentChange && !isApplyingChangesRef.current) {
        const text = quillRef.current.getText().replace(/\n$/, '');
        const hasChanges = text !== (typeof initial === 'string' ? initial : '');
        onContentChange(currentFile, content, hasChanges);
      }
    }, 0);
  };

  const accept = () => {
    if (!quillRef.current || !hasPendingEdits) return;
    
    isApplyingChangesRef.current = true;
    
    // Remove diff formatting and keep the final content
    const contents = quillRef.current.getContents();
    const cleanOps: any[] = [];
    
    if (contents && contents.ops) {
      for (const op of contents.ops) {
        if (typeof op.insert === 'string') {
          const isStrikethrough = op.attributes && op.attributes.strike;
          if (!isStrikethrough) {
            // Remove diff highlighting but keep other formatting
            if (op.attributes) {
              const cleanAttributes = { ...op.attributes };
              delete cleanAttributes.background;
              // Only remove pink color if it's the diff color
              if (cleanAttributes.color === "#b43f7f") {
                delete cleanAttributes.color;
              }
              delete cleanAttributes.strike;
              
              if (Object.keys(cleanAttributes).length > 0) {
                cleanOps.push({ insert: op.insert, attributes: cleanAttributes });
              } else {
                cleanOps.push({ insert: op.insert });
              }
            } else {
              cleanOps.push({ insert: op.insert });
            }
          }
        } else {
          cleanOps.push(op);
        }
      }
    }
    
    const cleanDelta = new Delta(cleanOps);
    quillRef.current.setContents(cleanDelta);
    
    setHasPendingEdits(false);
    setOriginalContent(null);
    setCurrentDiffs(null); // Clear stored diffs
    
    // Use setTimeout to prevent infinite loops
    setTimeout(() => {
      if (currentFile && onContentChange) {
        onContentChange(currentFile, cleanDelta, true);
      }
      isApplyingChangesRef.current = false;
    }, 10);
  };

  const discard = () => {
    if (!quillRef.current || !originalContent) return;
    
    isApplyingChangesRef.current = true;
    
    // Restore original content
    quillRef.current.setContents(originalContent);
    
    setHasPendingEdits(false);
    setOriginalContent(null);
    setCurrentDiffs(null); // Clear stored diffs
    
    // Use setTimeout to prevent infinite loops
    setTimeout(() => {
      if (currentFile && onContentChange) {
        onContentChange(currentFile, originalContent, false);
      }
      isApplyingChangesRef.current = false;
    }, 10);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="[&_.ql-container]:!border-none [&_.ql-toolbar]:!border-none [&_.ql-toolbar]:!border-b [&_.ql-toolbar]:!border-gray-200 [&_.ql-editor]:!border-none">
        <Editor
          ref={quillRef}
          defaultValue={getInitialContent()}
          onTextChange={handleTextChange}
          disabled={hasPendingEdits}
        />
      </div>
      
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
      
      {hasPendingEdits && (
        <div className="text-sm text-gray-600 bg-yellow-50 p-2 rounded">
          Editor is read-only while LLM changes are pending. Accept or discard to continue editing.
        </div>
      )}
    </div>
  );
}
