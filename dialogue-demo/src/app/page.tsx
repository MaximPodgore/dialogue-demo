"use client";

import { useRef, useState } from "react";
import TrackedQuill from "../components/TrackedQuill";
import DocumentPageTabs from "../components/DocumentPageTabs";
import { getDocument, getPageNames, pageToDelta } from "../utils/documentPages";
import mockResponse from "../data/mock-llm-response.json";

export default function Home() {
  const applyNewContentRef = useRef<((newContent: string) => void) | null>(null);
  const docName = "Landing_Page_AB_Test";
  const document = getDocument(docName);
  const pageNames = getPageNames(docName);
  const [currentPage, setCurrentPage] = useState<string>(pageNames[0] || "");
  const [pageContents, setPageContents] = useState<Map<string, any>>(new Map());
  const [unsavedPages, setUnsavedPages] = useState<Set<string>>(new Set());
  
  // Store pending edit states per page (for LLM-generated edits that need accept/reject)
  const [pagePendingEdits, setPagePendingEdits] = useState<Map<string, {
    hasEdits: boolean;
    original: string;
    originalDelta: any;
    lastDisplayedDiffs: any[];
    userContent: string;
  }>>(new Map());

  // Handle tab selection
  const handlePageSelect = (pageName: string) => {
    setCurrentPage(pageName);
  };

  // Handle content changes in TrackedQuill
  const handleContentChange = (pageName: string, content: any, hasChanges: boolean) => {
    setPageContents(prev => {
      const newMap = new Map(prev);
      newMap.set(pageName, content);
      return newMap;
    });
    setUnsavedPages(prev => {
      const newSet = new Set(prev);
      if (hasChanges) {
        newSet.add(pageName);
      } else {
        newSet.delete(pageName);
      }
      return newSet;
    });
  };

  // Handle pending edit state changes (for LLM-generated edits)
  const handlePendingEditStateChange = (pageName: string, pendingState: {
    hasEdits: boolean;
    original: string;
    originalDelta: any;
    lastDisplayedDiffs: any[];
    userContent: string;
  } | null) => {
    setPagePendingEdits(prev => {
      const newMap = new Map(prev);
      if (pendingState) {
        newMap.set(pageName, pendingState);
      } else {
        newMap.delete(pageName);
      }
      return newMap;
    });
  };

  const getMockLLMResponse = () => {
    return mockResponse.response;
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const llmText = getMockLLMResponse();
    if (applyNewContentRef.current) {
      applyNewContentRef.current(llmText);
    }
  };

  const handleApplyNewContentRegistration = (applyFn: (newContent: string) => void) => {
    applyNewContentRef.current = applyFn;
  };

  return (
    <main className="bg-pageBg h-screen overflow-hidden">
      <div className="flex flex-col md:flex-row h-full">
        <section className="w-full md:w-1/2 bg-placeholder p-6 flex flex-col h-full">
          {/* Lavender placeholder box */}
          <div className="bg-lavender border-dotted border-2 border-fuchsia-600 opacity-65 p-8 mb-6 flex-1 flex items-center justify-center min-h-[200px]">
            <span className="text-muted text-lg">placeholder</span>
          </div>

          <h2 className="text-medium font-semibold mb-4">Get mock LLM response</h2>

          {/* Form with white background */}
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <form className="space-y-4" onSubmit={handleFormSubmit}>
              <div>
                <input className="w-full border-border rounded px-3 py-2" name="single" placeholder="Reply to George" type="text" />
              </div>
              <div className="flex justify-end">
                <button type="submit" className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded font-small">
                  Send message
                </button>
              </div>
            </form>
          </div>
        </section>
        <section className="w-full md:w-1/2 bg-white p-6 flex flex-col h-full overflow-y-auto">
          {/* Main document heading and description */}
          <div className="mb-2">
            <h1 className="text-2xl font-bold mb-2">
              {document?.title || "No Document"}
            </h1>
            <p className="text-gray-600 mb-4">
              {document?.description}
            </p>
          </div>
          {/* Tabs for sub-pages */}
          <DocumentPageTabs
            pageNames={pageNames}
            currentPage={currentPage}
            onSelect={handlePageSelect}
          />
          {/* Editor for current page */}
          <div className="w-full h-full min-h-[300px] flex-1">
            {currentPage ? (
              <TrackedQuill
                currentFile={currentPage}
                fileContents={pageContents}
                onContentChange={handleContentChange}
                onPendingEditStateChange={handlePendingEditStateChange}
                pendingEditState={pagePendingEdits.get(currentPage) || null}
                onApplyNewContent={handleApplyNewContentRegistration}
                initial={pageToDelta(getDocument(docName)?.pages[currentPage] || { title: '', segments: [] })}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                <p>Select a page to start editing</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

