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
}>(({ defaultValue, onTextChange }, ref) => {
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
        modules: {
          toolbar: [
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
        if (mounted) {
          onTextChangeRef.current?.(...args);
        }
      });
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
  }, [ref]);

  return <div ref={containerRef}></div>;
});

Editor.displayName = 'Editor';

type Props = {
  initial?: string;
  onApplyNewContent?: (applyFn: (newContent: string) => void) => void;
};

/**
 * TrackedQuill Component
 * 
 * Behavior:
 * - User changes: Automatically accepted, no diff visualization, no Accept/Discard buttons
 * - LLM changes: Show diff visualization with Accept/Discard buttons for review
 */
export default function TrackedQuill({ initial = "Start typing here...", onApplyNewContent }: Props) {
  const [original, setOriginal] = useState<string>(initial);
  const [originalDelta, setOriginalDelta] = useState<any>(null);
  const [hasEdits, setHasEdits] = useState(false);
  
  // Use a ref to access the quill instance directly
  const quillRef = useRef<any>(null);
  const applyingRef = useRef(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Track the actual user content separate from display content
  const userContentRef = useRef<string>(initial);
  const lastDisplayedDiffsRef = useRef<any[]>([]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Register the applyNewContent function with parent
  useEffect(() => {
    if (onApplyNewContent) {
      onApplyNewContent(applyNewContent);
    }
  }, [onApplyNewContent]);

  const applyNewContent = (newContent: string) => {
    if (!quillRef.current) return;
    
    // Clear any pending formatting timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    
    applyingRef.current = true;
    
    // Trim leading whitespace to ensure LLM content starts from the first line
    const trimmedNewContent = newContent.replace(/^\s+/, '');
    
    // Compare the new LLM content against the current user content (not original placeholder)
    const currentUserContent = extractUserContent();
    const dmp = new DiffMatchPatch();
    const diffs = dmp.diff_main(currentUserContent, trimmedNewContent);
    dmp.diff_cleanupSemantic(diffs);
    
    // Get current content with existing user formatting
    const currentContents = quillRef.current.getContents();
    const userOps: any[] = [];
    
    // Extract existing user content ops (excluding diff markers) to preserve formatting
    if (currentContents && currentContents.ops) {
      for (const op of currentContents.ops) {
        if (typeof op.insert === 'string') {
          const isStrikethrough = op.attributes && op.attributes.strike;
          if (!isStrikethrough) {
            // Clean the attributes to remove our diff markers but keep user formatting
            if (op.attributes) {
              const cleanAttributes = { ...op.attributes };
              delete cleanAttributes.background;
              delete cleanAttributes.strike;
              
              if (Object.keys(cleanAttributes).length > 0) {
                userOps.push({ insert: op.insert, attributes: cleanAttributes });
              } else {
                userOps.push({ insert: op.insert });
              }
            } else {
              userOps.push({ insert: op.insert });
            }
          }
        } else {
          userOps.push(op); // embeds, etc.
        }
      }
    }
    
    // Apply the diff formatting while preserving existing user formatting
    const newOps: any[] = [];
    let userOpIndex = 0;
    let charCountInCurrentOp = 0;
    
    for (const diff of diffs) {
      const type = diff[0];
      const str = diff[1] as string;
      
      if (type === 0) {
        // Equal: preserve existing user formatting
        let remaining = str.length;
        while (remaining > 0 && userOpIndex < userOps.length) {
          const userOp = userOps[userOpIndex];
          if (typeof userOp.insert === 'string') {
            const available = userOp.insert.length - charCountInCurrentOp;
            const toTake = Math.min(remaining, available);
            const text = userOp.insert.substring(charCountInCurrentOp, charCountInCurrentOp + toTake);
            
            if (userOp.attributes) {
              newOps.push({ insert: text, attributes: userOp.attributes });
            } else {
              newOps.push({ insert: text });
            }
            
            remaining -= toTake;
            charCountInCurrentOp += toTake;
            
            if (charCountInCurrentOp >= userOp.insert.length) {
              userOpIndex++;
              charCountInCurrentOp = 0;
            }
          } else {
            newOps.push(userOp);
            userOpIndex++;
          }
        }
      } else if (type === 1) {
        // Insertion: highlight with yellow background, use minimal formatting for new text
        newOps.push({ insert: str, attributes: { background: "#fff59d" } });
      } else if (type === -1) {
        // Deletion: show with strikethrough and highlighting, try to preserve original formatting
        let remaining = str.length;
        while (remaining > 0 && userOpIndex < userOps.length) {
          const userOp = userOps[userOpIndex];
          if (typeof userOp.insert === 'string') {
            const available = userOp.insert.length - charCountInCurrentOp;
            const toTake = Math.min(remaining, available);
            const text = userOp.insert.substring(charCountInCurrentOp, charCountInCurrentOp + toTake);
            
            const attributes = { 
              ...userOp.attributes, 
              background: "#fff59d",
              strike: true
            };
            newOps.push({ insert: text, attributes });
            
            remaining -= toTake;
            charCountInCurrentOp += toTake;
            
            if (charCountInCurrentOp >= userOp.insert.length) {
              userOpIndex++;
              charCountInCurrentOp = 0;
            }
          } else {
            newOps.push(userOp);
            userOpIndex++;
          }
        }
        
        // Handle any remaining deletion text with basic formatting
        if (remaining > 0) {
          newOps.push({ 
            insert: str.substring(str.length - remaining), 
            attributes: { 
              background: "#fff59d",
              strike: true
            } 
          });
        }
      }
    }
    
    // Apply the new content with diff formatting
    const newDelta = new Delta(newOps);
    quillRef.current.setContents(newDelta);
    
    // Update tracking state - the user can now see LLM suggestions vs current content
    // Set hasEdits to true so Accept/Discard buttons appear for LLM changes
    // Update userContentRef to track what would be the clean content (without diff formatting)
    userContentRef.current = trimmedNewContent;
    lastDisplayedDiffsRef.current = diffs;
    setHasEdits(true); // This ensures Accept/Discard buttons show for LLM changes
    applyingRef.current = false;
  };

  // Initialize originalDelta when quill is ready
  useEffect(() => {
    if (quillRef.current && !originalDelta) {
      // Set initial content and capture the delta
      quillRef.current.setText(original);
      // Ensure no background or strike formatting is present in the initial delta
      const length = quillRef.current.getLength();
      if (length > 0) {
        quillRef.current.formatText(0, length, "background", false);
        quillRef.current.formatText(0, length, "strike", false);
      }
      setOriginalDelta(quillRef.current.getContents());
      userContentRef.current = original;
      lastDisplayedDiffsRef.current = [];
    }
  }, [quillRef.current, original, originalDelta]);

  // Extract user content (non-strikethrough text) from editor
  const extractUserContent = (): string => {
    if (!quillRef.current) return "";
    
    const contents = quillRef.current.getContents();
    let userText = "";
    
    if (contents && contents.ops) {
      for (const op of contents.ops) {
        if (typeof op.insert === 'string') {
          const isStrikethrough = op.attributes && op.attributes.strike;
          if (!isStrikethrough) {
            userText += op.insert;
          }
        }
      }
    }
    
    return userText.replace(/\n$/, "");
  };

  const applyDiffFormatting = () => {
    if (!quillRef.current || applyingRef.current) return;
    
    // Store current selection
    const selection = quillRef.current.getSelection();
    
    // Get current user content
    const currentUserContent = extractUserContent();
    userContentRef.current = currentUserContent;
    
    const a = original;
    const b = currentUserContent;

    applyingRef.current = true;

    if (a === b) {
      // No changes - preserve user formatting, just remove diff markers
      const contents = quillRef.current.getContents();
      if (contents && contents.ops) {
        const cleanOps = contents.ops.map((op: any) => {
          if (op.attributes) {
            const cleanAttributes = { ...op.attributes };
            delete cleanAttributes.background;
            delete cleanAttributes.strike;
            
            if (Object.keys(cleanAttributes).length > 0) {
              return { ...op, attributes: cleanAttributes };
            } else {
              return { insert: op.insert };
            }
          }
          return op;
        }).filter((op: any) => !(op.attributes && op.attributes.strike)); // Remove strikethrough ops entirely
        
        const cleanDelta = new Delta(cleanOps);
        quillRef.current.setContents(cleanDelta);
        if (selection) {
          quillRef.current.setSelection(selection.index, selection.length);
        }
      }
      
      lastDisplayedDiffsRef.current = [];
      applyingRef.current = false;
      return;
    }

    const dmp = new DiffMatchPatch();
    const diffs = dmp.diff_main(a, b);
    dmp.diff_cleanupSemantic(diffs);

    // Check if diffs actually changed
    const diffsChanged = JSON.stringify(diffs) !== JSON.stringify(lastDisplayedDiffsRef.current);
    if (!diffsChanged) {
      applyingRef.current = false;
      return;
    }

    // Get the current content with user formatting preserved
    const contents = quillRef.current.getContents();
    const userOps: any[] = [];
    
    // Extract user content ops (excluding strikethrough)
    if (contents && contents.ops) {
      for (const op of contents.ops) {
        if (typeof op.insert === 'string') {
          const isStrikethrough = op.attributes && op.attributes.strike;
          if (!isStrikethrough) {
            // Clean the attributes to remove our diff markers but keep user formatting
            if (op.attributes) {
              const cleanAttributes = { ...op.attributes };
              delete cleanAttributes.background;
              delete cleanAttributes.strike;
              
              if (Object.keys(cleanAttributes).length > 0) {
                userOps.push({ insert: op.insert, attributes: cleanAttributes });
              } else {
                userOps.push({ insert: op.insert });
              }
            } else {
              userOps.push({ insert: op.insert });
            }
          }
        } else {
          userOps.push(op); // embeds, etc.
        }
      }
    }

    // Now apply diff formatting to the clean user content
    const newOps: any[] = [];
    let userOpIndex = 0;
    let charCountInCurrentOp = 0;
    
    for (const diff of diffs) {
      const type = diff[0];
      const str = diff[1] as string;
      
      if (type === 0) {
        // Equal: keep with original user formatting
        let remaining = str.length;
        while (remaining > 0 && userOpIndex < userOps.length) {
          const userOp = userOps[userOpIndex];
          if (typeof userOp.insert === 'string') {
            const available = userOp.insert.length - charCountInCurrentOp;
            const toTake = Math.min(remaining, available);
            const text = userOp.insert.substring(charCountInCurrentOp, charCountInCurrentOp + toTake);
            
            if (userOp.attributes) {
              newOps.push({ insert: text, attributes: userOp.attributes });
            } else {
              newOps.push({ insert: text });
            }
            
            remaining -= toTake;
            charCountInCurrentOp += toTake;
            
            if (charCountInCurrentOp >= userOp.insert.length) {
              userOpIndex++;
              charCountInCurrentOp = 0;
            }
          } else {
            newOps.push(userOp);
            userOpIndex++;
          }
        }
      } else if (type === 1) {
        // Insertion: highlight with yellow background, preserve user formatting
        let remaining = str.length;
        while (remaining > 0 && userOpIndex < userOps.length) {
          const userOp = userOps[userOpIndex];
          if (typeof userOp.insert === 'string') {
            const available = userOp.insert.length - charCountInCurrentOp;
            const toTake = Math.min(remaining, available);
            const text = userOp.insert.substring(charCountInCurrentOp, charCountInCurrentOp + toTake);
            
            const attributes = { ...userOp.attributes, background: "#fff59d" };
            newOps.push({ insert: text, attributes });
            
            remaining -= toTake;
            charCountInCurrentOp += toTake;
            
            if (charCountInCurrentOp >= userOp.insert.length) {
              userOpIndex++;
              charCountInCurrentOp = 0;
            }
          } else {
            newOps.push(userOp);
            userOpIndex++;
          }
        }
      } else if (type === -1) {
        // Deletion: show with strikethrough and highlighting, preserving original formatting
        // Use a simpler approach: track the position and get formatting from original delta
        let originalPos = 0;
        for (let i = 0; i < diffs.indexOf(diff); i++) {
          const prevDiff = diffs[i];
          if (prevDiff[0] !== 1) { // Not an insertion
            originalPos += prevDiff[1].length;
          }
        }
        
        // Try to get the dominant formatting from the original position
        let originalAttributes = {};
        if (originalDelta && originalDelta.ops) {
          let pos = 0;
          for (const op of originalDelta.ops) {
            if (typeof op.insert === 'string') {
              if (pos <= originalPos && originalPos < pos + op.insert.length) {
                originalAttributes = op.attributes || {};
                break;
              }
              pos += op.insert.length;
            }
          }
        }
        
        // Apply deletion formatting while preserving original attributes
        newOps.push({ 
          insert: str, 
          attributes: { 
            ...originalAttributes,
            background: "#fff59d",
            strike: true
          } 
        });
      }
    }

    // Apply the new content
    const newDelta = new Delta(newOps);
    const currentContents = quillRef.current.getContents();
    const diff = currentContents.diff(newDelta);
    
    if (diff && diff.ops && diff.ops.length > 0) {
      const hasOnlyFormattingChanges = diff.ops.every((op: any) => 
        !op.insert || (typeof op.insert === 'string' && op.insert.length === 0) || 
        (op.attributes && Object.keys(op.attributes).some((key: string) => 
          ['background', 'strike', 'color'].includes(key)
        ))
      );
      
      if (hasOnlyFormattingChanges) {
        quillRef.current.updateContents(diff);
      } else {
        quillRef.current.setContents(newDelta);
      }
    }
    
    // Restore selection
    if (selection) {
      const newLength = quillRef.current.getLength();
      const safeIndex = Math.min(selection.index, newLength - 1);
      const safeLength = Math.min(selection.length, newLength - safeIndex);
      
      if (quillRef.current && !applyingRef.current) {
        quillRef.current.setSelection(Math.max(0, safeIndex), safeLength);
      }
    }
    
    lastDisplayedDiffsRef.current = diffs;
    applyingRef.current = false;
  };

  const handleTextChange = (...args: any[]) => {
    if (!quillRef.current || applyingRef.current) return;
    
    // Extract the current user content (non-strikethrough text)
    const currentUserContent = extractUserContent();
    
    // Auto-update the original content to match user changes (no diff visualization)
    setOriginal(currentUserContent);
    userContentRef.current = currentUserContent;
    
    // Update the original delta to match current clean content
    const contents = quillRef.current.getContents();
    if (contents && contents.ops) {
      const cleanOps: any[] = [];
      for (const op of contents.ops) {
        if (typeof op.insert === 'string') {
          const isStrikethrough = op.attributes && op.attributes.strike;
          if (!isStrikethrough) {
            // Keep user formatting, remove only our diff markers
            if (op.attributes) {
              const cleanAttributes = { ...op.attributes };
              delete cleanAttributes.background;
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
          cleanOps.push(op); // embeds, etc.
        }
      }
      const cleanDelta = new Delta(cleanOps);
      setOriginalDelta(cleanDelta);
    }
    
    // Clear any visual diff markers since user changes don't need diff visualization
    lastDisplayedDiffsRef.current = [];
    setHasEdits(false);
  };

  const accept = () => {
    if (!quillRef.current) return;
    
    // Clear any pending formatting timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    
    applyingRef.current = true;
    
    // Get the current user content and clean formatting
    const finalContent = extractUserContent();
    
    // Get current content and remove only diff markers, keeping user formatting
    const contents = quillRef.current.getContents();
    const cleanOps: any[] = [];
    
    if (contents && contents.ops) {
      for (const op of contents.ops) {
        if (typeof op.insert === 'string') {
          const isStrikethrough = op.attributes && op.attributes.strike;
          if (!isStrikethrough) {
            // Keep user formatting, remove only our diff markers
            if (op.attributes) {
              const cleanAttributes = { ...op.attributes };
              delete cleanAttributes.background;
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
          cleanOps.push(op); // embeds, etc.
        }
      }
    }
    
    const cleanDelta = new Delta(cleanOps);
    quillRef.current.setContents(cleanDelta);
    
    // Update our tracking variables
    setOriginal(finalContent);
    setOriginalDelta(cleanDelta);
    userContentRef.current = finalContent;
    lastDisplayedDiffsRef.current = [];
    setHasEdits(false);
    applyingRef.current = false;
  };

  const discard = () => {
    if (!quillRef.current || !originalDelta) return;
    
    // Clear any pending formatting timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    
    applyingRef.current = true;
    
    // Restore the original content with all its formatting
    quillRef.current.setContents(originalDelta);
    userContentRef.current = original;
    lastDisplayedDiffsRef.current = [];
    setHasEdits(false);
    applyingRef.current = false;
  };

  return (
    <div className="flex flex-col gap-2">
      <Editor
        ref={quillRef}
        defaultValue={original}
        onTextChange={handleTextChange}
      />
      
      {/* Accept/Discard buttons only shown when there are LLM-generated edits to review */}
      {hasEdits && (
        <div className="flex gap-2">
          <button 
            className="px-3 py-1 rounded mr-2 bg-green-600 text-white disabled:opacity-50" 
            onClick={accept} 
            disabled={!hasEdits}
          >
            Accept
          </button>
          <button 
            className="px-3 py-1 rounded bg-red-600 text-white disabled:opacity-50" 
            onClick={discard} 
            disabled={!hasEdits}
          >
            Discard
          </button>
        </div>
      )}
    </div>
  );
}
