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
  initial?: string | any; // Can be string or Delta object for formatted content
  currentFile?: string; // Current filename being edited
  fileContents?: Map<string, any>; // Map of filename to current content (including unsaved edits)
  onContentChange?: (filename: string, content: any, hasChanges: boolean) => void; // Notify parent of content changes
  onApplyNewContent?: (applyFn: (newContent: string) => void) => void;
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
};

/**
 * TrackedQuill Component
 * 
 * Behavior:
 * - User changes: Automatically accepted, no diff visualization, no Accept/Discard buttons
 * - LLM changes: Show diff visualization with Accept/Discard buttons for review
 * - File switching: Maintains separate edit state for each file
 * 
 * Props:
 * - initial: Can be a string or Delta object for formatted placeholder content
 * - currentFile: Current filename being edited
 * - fileContents: Map of filename to current content (including unsaved edits)
 * - onContentChange: Callback when content changes
 */
export default function TrackedQuill({ 
  initial = "Start typing here...", 
  currentFile, 
  fileContents, 
  onContentChange, 
  onApplyNewContent, 
  onPendingEditStateChange,
  pendingEditState 
}: Props) {
  // Convert initial to a standardized format and extract plain text
  const getInitialContent = () => {
    // If currentFile is provided and we have content for it, use that
    if (currentFile && fileContents && fileContents.has(currentFile)) {
      const content = fileContents.get(currentFile);
      if (content) {
        // Extract plain text from the delta
        let text = '';
        if (content.ops) {
          for (const op of content.ops) {
            if (typeof op.insert === 'string') {
              text += op.insert;
            }
          }
        }
        return {
          text: text.replace(/\n$/, ''), // Remove trailing newline if present
          delta: content
        };
      }
    }
    
    // Fallback to initial prop
    if (typeof initial === 'string') {
      return {
        text: initial,
        delta: null
      };
    } else {
      // If it's a Delta object, extract plain text for comparison purposes
      let text = '';
      if (initial && initial.ops) {
        for (const op of initial.ops) {
          if (typeof op.insert === 'string') {
            text += op.insert;
          }
        }
      }
      return {
        text: text.replace(/\n$/, ''), // Remove trailing newline if present
        delta: initial
      };
    }
  };

  const initialContent = getInitialContent();
  
  // Initialize state, potentially from restored pending edit state
  const getInitialStateFromPending = () => {
    if (pendingEditState) {
      return {
        original: pendingEditState.original,
        originalDelta: pendingEditState.originalDelta,
        hasEdits: pendingEditState.hasEdits,
        userContent: pendingEditState.userContent,
        lastDisplayedDiffs: pendingEditState.lastDisplayedDiffs
      };
    }
    return {
      original: initialContent.text,
      originalDelta: initialContent.delta,
      hasEdits: false,
      userContent: initialContent.text,
      lastDisplayedDiffs: []
    };
  };

  const initialState = getInitialStateFromPending();
  const [original, setOriginal] = useState<string>(initialState.original);
  const [originalDelta, setOriginalDelta] = useState<any>(initialState.originalDelta);
  const [hasEdits, setHasEdits] = useState(initialState.hasEdits);
  
  // Use a ref to access the quill instance directly
  const quillRef = useRef<any>(null);
  const applyingRef = useRef(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const switchingFilesRef = useRef(false); // Track when we're switching files
  
  // Track the actual user content separate from display content
  const userContentRef = useRef<string>(initialState.userContent);
  const lastDisplayedDiffsRef = useRef<any[]>(initialState.lastDisplayedDiffs);

  // Handle file switching
  useEffect(() => {
    if (!quillRef.current || !currentFile) return;
    
    switchingFilesRef.current = true; // Prevent notifications during file switch
    
    // Check if we have pending edit state to restore
    if (pendingEditState) {
      // Restore pending edit state
      setOriginal(pendingEditState.original);
      setOriginalDelta(pendingEditState.originalDelta);
      setHasEdits(pendingEditState.hasEdits);
      userContentRef.current = pendingEditState.userContent;
      lastDisplayedDiffsRef.current = pendingEditState.lastDisplayedDiffs;
    } else {
      // No pending edits, use clean content
      const newContent = getInitialContent();
      
      // Update state to match new file
      setOriginal(newContent.text);
      setOriginalDelta(newContent.delta);
      setHasEdits(false);
      userContentRef.current = newContent.text;
      lastDisplayedDiffsRef.current = [];
    }
    
    // Update editor content
    applyingRef.current = true;
    const content = getInitialContent();
    if (content.delta) {
      quillRef.current.setContents(content.delta);
    } else {
      quillRef.current.setText(content.text);
    }
    applyingRef.current = false;
    
    // Allow notifications after file switch is complete
    setTimeout(() => {
      switchingFilesRef.current = false;
    }, 0);
  }, [currentFile, fileContents]);

  // Remove the separate pendingEditState effect to avoid circular dependencies

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Helper function to notify parent of pending edit state changes
  const notifyPendingEditStateChange = (newHasEdits: boolean) => {
    if (!currentFile || !onPendingEditStateChange || switchingFilesRef.current) return;
    
    if (newHasEdits) {
      onPendingEditStateChange(currentFile, {
        hasEdits: newHasEdits,
        original,
        originalDelta,
        lastDisplayedDiffs: lastDisplayedDiffsRef.current,
        userContent: userContentRef.current
      });
    } else {
      onPendingEditStateChange(currentFile, null);
    }
  };

  // Watch for hasEdits changes to notify parent
  useEffect(() => {
    notifyPendingEditStateChange(hasEdits);
  }, [hasEdits, original, originalDelta, currentFile]);

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
    
    // Store the diff-formatted content in parent's fileContents for restoration
    if (currentFile && onContentChange) {
      onContentChange(currentFile, newDelta, true); // hasChanges = true for pending edits
    }
    
    applyingRef.current = false;
  };

  // Initialize originalDelta when quill is ready
  useEffect(() => {
    if (quillRef.current && !originalDelta) {
      // Set initial content - use Delta if provided, otherwise plain text
      if (initialContent.delta) {
        quillRef.current.setContents(initialContent.delta);
        setOriginalDelta(initialContent.delta);
      } else {
        quillRef.current.setText(original);
        // Ensure no background or strike formatting is present in the initial delta
        const length = quillRef.current.getLength();
        if (length > 0) {
          quillRef.current.formatText(0, length, "background", false);
          quillRef.current.formatText(0, length, "strike", false);
        }
        setOriginalDelta(quillRef.current.getContents());
      }
      userContentRef.current = original;
      lastDisplayedDiffsRef.current = [];
    }
  }, [quillRef.current, original, originalDelta, initialContent]);

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
      
      // Notify parent of content change
      if (currentFile && onContentChange) {
        const hasChanges = currentUserContent !== original;
        onContentChange(currentFile, cleanDelta, hasChanges);
      }
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
    
    // Notify parent of content change
    if (currentFile && onContentChange) {
      const hasChanges = finalContent !== original;
      onContentChange(currentFile, cleanDelta, hasChanges);
    }
    
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
    
    // Notify parent of content restoration
    if (currentFile && onContentChange) {
      const hasChanges = false; // When discarding, we're back to original
      onContentChange(currentFile, originalDelta, hasChanges);
    }
    
    applyingRef.current = false;
  };

  return (
    <div className="flex flex-col gap-2">
      <Editor
        ref={quillRef}
        defaultValue={initialContent.delta || original}
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
