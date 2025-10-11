"use client";

import React, { useEffect, useRef, useState } from "react";
import DiffMatchPatch from "diff-match-patch";

type Props = {
  initial?: string;
};

export default function TrackedQuill({ initial = "Start typing here..." }: Props) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const quillRef = useRef<any>(null);
  const applyingRef = useRef(false);
  const [original, setOriginal] = useState<string>(initial);
  const [hasEdits, setHasEdits] = useState(false);

  useEffect(() => {
    let mounted = true;
    if (!editorRef.current) return;

    let onChange: ((...args: any[]) => void) | null = null;

    (async () => {
      // Dynamically import Quill so `document` is only used on client
      const QuillModule = await import("quill");
      const Quill = QuillModule.default ?? QuillModule;

      // dynamically import quill css so bundler includes it client-side
      try {
        await import("quill/dist/quill.snow.css");
      } catch (e) {
        // ignore; some bundlers may not support CSS imports this way
      }

      const toolbarOptions = [["bold", "italic", "underline"], [{ header: [1, 2, false] }], [
        { list: "ordered" },
        { list: "bullet" },
      ], ["link", "blockquote", "code-block"]];

      // If the toolbar container exists but is empty, fall back to the toolbar options array
      const toolbarContainer = toolbarRef.current && toolbarRef.current.childElementCount > 0 ? toolbarRef.current : toolbarOptions;

      quillRef.current = new Quill(editorRef.current!, {
        theme: "snow",
        modules: {
          toolbar: toolbarContainer,
        },
      });

      // register Link format if available
      try {
        const LinkModule = await import("quill/formats/link");
        const Link = LinkModule?.default ?? LinkModule;
        if (Link) Quill.register(Link, true);
      } catch (e) {
        // optional
      }

      // initialize content
      quillRef.current.setText(original);

      const dmp = new DiffMatchPatch();

  const onChangeHandler = () => {
      if (!mounted) return;
      if (applyingRef.current) return; // ignore programmatic edits

      const q = quillRef.current!;
      const text = q.getText();

      // strip the trailing newline Quill always has
      const b = text.replace(/\n$/, "");
      const a = original;

      // compute diffs using diff-match-patch
      const diffs = dmp.diff_main(a, b);
      dmp.diff_cleanupSemantic(diffs);

      // Reset formats across the whole document
      applyingRef.current = true;
      q.removeFormat(0, q.getLength());

      // determine whether any changes exist
      const noChange = diffs.length === 1 && diffs[0][0] === 0;
      if (noChange) {
        setHasEdits(false);
        applyingRef.current = false;
        return;
      }

      setHasEdits(true);

      // Walk through diffs to apply highlights and deleted markers.
      // We'll track the current index within `b` (the new text) where inserts and equals advance the cursor.

      // highlight for both: yellow
      let posInB = 0;
      let posInA = 0;
      for (const diff of diffs) {
        const type = diff[0];
        const str = diff[1] as string;
        if (type === 0) {
          // equal: advance both
          posInA += str.length;
          posInB += str.length;
        } else if (type === 1) {
          // insertion in b: highlight this range in the editor
          const start = posInB;
          const length = str.length;
          if (length > 0) q.formatText(start, length, "background", "#fff59d");
          posInB += length;
        } else if (type === -1) {
          // deletion from a: insert a lightweight marker at current posInB showing deleted text
          const deletedText = str;
          if (deletedText.length > 0) {
            // insert marker with strike-through and background
            q.insertText(posInB, deletedText, { strike: true, background: "#fff59d" });
            // Advance posInA by deleted length; posInB does not advance because deletion is not in b
            posInA += deletedText.length;
            // After inserting the marker, the quill document has changed length; move cursor after inserted marker
            posInB += deletedText.length;
          }
        }
      }

      applyingRef.current = false;
      };

      // expose handler to outer scope so cleanup can remove it
      onChange = onChangeHandler;

      // register handler
      quillRef.current.on("text-change", onChangeHandler);
    })();

    return () => {
      mounted = false;
      if (onChange && quillRef.current) quillRef.current.off("text-change", onChange);
      quillRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorRef, original]);

  const accept = () => {
    if (!quillRef.current) return;
    const text = quillRef.current.getText().replace(/\n$/, "");
    applyingRef.current = true;
    quillRef.current.setText(text);
    setOriginal(text);
    setHasEdits(false);
    applyingRef.current = false;
  };

  const discard = () => {
    if (!quillRef.current) return;
    applyingRef.current = true;
    quillRef.current.setText(original);
    setHasEdits(false);
    applyingRef.current = false;
  };

  return (
    <div className="flex flex-col gap-2">
      <div ref={toolbarRef} className="mb-2" />
      <div ref={editorRef} className="min-h-[220px] border border-gray-200 rounded bg-white" aria-label="Tracked editor" />
      <div className="flex gap-2">
        <button className="px-3 py-1 rounded mr-2 bg-green-600 text-white disabled:opacity-50" onClick={accept} disabled={!hasEdits}>
          Accept
        </button>
        <button className="px-3 py-1 rounded bg-red-600 text-white disabled:opacity-50" onClick={discard} disabled={!hasEdits}>
          Discard
        </button>
      </div>
    </div>
  );
}
