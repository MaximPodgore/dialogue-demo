"use client";

import { useState, useRef } from "react";
import TrackedQuill from "../components/TrackedQuill";

export default function Home() {
  const [currentText, setCurrentText] = useState("Start typing here...");
  const applyNewContentRef = useRef<((newContent: string) => void) | null>(null);

  const getMockLLMResponse = () => {
    // Mock LLM response - this will not change for any reason in the current implementation
    return `This is a mock LLM response that simulates what an AI language model might return.
      It includes some sample text that demonstrates how the diff tracking works when new content is applied to the editor.
      You can see insertions highlighted in yellow and deletions shown with strikethrough formatting.`
      ;
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const llmText = getMockLLMResponse();
    
    // Apply the new content as a diff instead of replacing the component
    if (applyNewContentRef.current) {
      applyNewContentRef.current(llmText);
    } else {
      // Fallback: if the apply function is not available, update the text state
      setCurrentText(llmText);
    }
  };

  const handleApplyNewContentRegistration = (applyFn: (newContent: string) => void) => {
    applyNewContentRef.current = applyFn;
  };

  return (
    <main className="p-6 bg-pageBg">
      <div className="flex flex-col md:flex-row gap-6 min-h-[60vh] items-stretch">
        <section className="w-full md:w-1/2 bg-placeholder p-6 rounded-md shadow-sm flex flex-col">
          <h2 className="text-lg font-semibold mb-4 text-primary">Get mock LLM response</h2>
          <form className="space-y-4" onSubmit={handleFormSubmit}>
            <div>
              <label className="block mb-1 text-muted">Input</label>
              <input className="w-full border border-border rounded px-3 py-2" name="single" type="text" />
            </div>
            <div>
              <button type="submit" className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded font-medium">
                Send message
              </button>
            </div>
          </form>
        </section>
        <section className="w-full md:w-1/2 bg-card p-6 rounded-md shadow-sm flex flex-col">
          <h2 className="text-lg font-semibold mb-4 text-primary">Editable</h2>
          <div className="w-full h-full min-h-[300px] flex-1">
            {/* TrackedQuill is a client component that shows insert/delete highlights */}
            <TrackedQuill 
              initial={currentText} 
              onApplyNewContent={handleApplyNewContentRegistration}
            />
          </div>
        </section>
      </div>
    </main>
  );
}

