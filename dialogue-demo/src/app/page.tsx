"use client";

import React, { useState } from "react";

import SuggestionEditor from "@/components/proseMirror";
import { TextSuggestion } from "@/components/proseMirror";
import { getBoldSectionsText } from "@/utils/sectionUtils";
import { formToSuggestion } from "@/utils/formToSuggestion";
import { validateSectionsFromHtml } from "../utils/validateSections";

export default function Home() {
  const [styleMode, setStyleMode] = useState<'yellow' | 'pink'>('yellow');
  const [isStyleDropdownOpen, setIsStyleDropdownOpen] = useState(false);
  // Track all new suggestions to apply
  const [newSuggestions, setNewSuggestions] = useState<TextSuggestion[]>([]);
  // Selected field (section title)
  const [field, setField] = useState('');
  // Current value (readonly)
  const [currentValue, setCurrentValue] = useState('');
  // New value (editable)
  const [newValue, setNewValue] = useState('');
  // Store editor content for section extraction
  const [editorContent, setEditorContent] = useState<string>('');
  // Validation state
  const [validationResult, setValidationResult] = useState<{ valid: boolean; errors: string[] } | null>(null);
  // Section titles and text
  const [sectionOptions, setSectionOptions] = useState<{ title: string; text: string }[]>([]);

  // Initial content from ProseMirrorDemo 
  const initialContent = `
    <b>Background</b>
    <p>This is a background that George generated for the study. This should give someone a good idea of the reasons behind this study.
    Hypothetically should this text be editable at all ?</p>
    <br />
    <b>Objectives</b>
    <p>This are objectives that George generated for the study. This should give someone a good idea of the goals behind this study. Hypothetically should this text be editable at all ? Hmmm.</p>
    <ol>
      <li>This is text for the first objective</li>
      <li>This is text for the second objective</li>
      <li>This is text for the third objective</li>
    </ol>
    <br />
    <b>Methodology</b>
    <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum</p>
  `;

  // Populate sectionOptions on initial render
  React.useEffect(() => {
    const sections = getBoldSectionsText(initialContent);
    setSectionOptions(sections);
    if (sections.length > 0) {
      setField(sections[0].title);
      setCurrentValue(sections[0].text);
      setNewValue('');
    }
  }, []);

  // Handler for content change from ProseMirrorDemo
  const handleEditorContentChange = (content: string) => {
    setEditorContent(content);
    //console.log('Editor content updated in page.tsx:');
  };

  // Validate button handler
  const handleValidateSections = () => {
    const result = validateSectionsFromHtml(editorContent);
    setValidationResult(result);
  };

  // Only update sectionOptions when editorContent changes, not currentValue/newValue
  React.useEffect(() => {
    if (!editorContent || editorContent.trim().length === 0) return;
    const sections = getBoldSectionsText(editorContent);
    setSectionOptions(sections);
    // Do not update currentValue/newValue here
  }, [editorContent]);

  // When field changes, update currentValue and newValue to current section text
  const handleFieldChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedTitle = e.target.value;
    setField(selectedTitle);
    // Extract latest section text from editorContent
    if (!editorContent || editorContent.trim().length === 0) return;
    const sections = getBoldSectionsText(editorContent);
    const section = sections.find(s => s.title === selectedTitle);
    const text = section ? section.text : '';
  setCurrentValue(text);
  setNewValue('');
  };

  // When dropdown is opened, refresh sectionOptions from latest editorContent (fallback to initialContent)
  const handleFieldDropdownOpen = () => {
    if (!editorContent || editorContent.trim().length === 0) return;
    const sections = getBoldSectionsText(editorContent);
    setSectionOptions(sections);
    // Only change field/currentValue if current field is missing
    if (sections.length > 0 && !sections.some(s => s.title === field)) {
      setField(sections[0].title);
      setCurrentValue(sections[0].text);
      setNewValue('');
    }
  };

  const handleSuggestionSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Use formToSuggestion to create suggestion from form data and section info
    const suggestions = formToSuggestion(sectionOptions, field, currentValue, newValue);
    const username = "User"; // Pass username explicitly
    const suggestionsWithUsername = suggestions.map(suggestion => ({ ...suggestion, username }));
    setNewSuggestions(prev => [...prev, ...suggestionsWithUsername]);
    // Do not clear the form fields after submission
  };


  return (
    <main className="bg-pageBg h-screen overflow-hidden">
      <div className="flex flex-col md:flex-row h-full">
        <section className="w-full md:w-1/2 bg-page-bg p-6 flex flex-col h-full">

          {/* Custom Suggestion Form (matches provided design) */}
          <div className="bg-card rounded-lg shadow-sm p-8 mb-6 flex-1 flex flex-col items-center justify-center min-h-[200px]">
            <form className="w-full max-w-lg space-y-4" onSubmit={handleSuggestionSubmit}>
              <h2 className="text-lg font-bold mb-2">Add a Suggestion </h2>
              <div>
                <label className="block text-sm font-medium mb-1">Field</label>
                <select
                  name="field"
                  value={field}
                  onChange={handleFieldChange}
                  onClick={handleFieldDropdownOpen}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-left hover:bg-gray-50 transition-colors focus:outline-none font-medium text-sm "
                  required
                >
                  {sectionOptions.map(section => (
                    <option key={section.title} value={section.title}>{section.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Current Value</label>
                <textarea
                  name="currentValue"
                  value={currentValue}
                  onChange={e => {
                    setCurrentValue(e.target.value);
                    if (e.target) {
                      e.target.style.height = 'auto';
                      e.target.style.height = e.target.scrollHeight + 'px';
                    }
                  }}
                  className="w-full text-black resize-none focus:outline-none"
                  rows={1}
                  style={{ minHeight: '48px', overflowWrap: 'break-word' }}
                  ref={el => {
                    if (el) {
                      el.style.height = 'auto';
                      el.style.height = el.scrollHeight + 'px';
                    }
                  }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">New Value</label>
                <textarea
                  name="newValue"
                  value={newValue}
                  onChange={e => {
                    setNewValue(e.target.value);
                    if (e.target) {
                      e.target.style.height = 'auto';
                      e.target.style.height = e.target.scrollHeight + 'px';
                    }
                  }}
                  className="w-full border rounded px-3 py-2 resize-none focus:outline-none"
                  required
                  placeholder="The new value for the field"
                  rows={1}
                  style={{ minHeight: '48px', overflowWrap: 'break-word' }}
                  ref={el => {
                    if (el) {
                      el.style.height = 'auto';
                      el.style.height = el.scrollHeight + 'px';
                    }
                  }}
                />
              </div>
              <div className="flex flex-col items-end gap-2">
                <button type="submit" className="p-3 bg-black hover:bg-gray-800 text-white rounded-md font-small">Add Suggestion</button>
              </div>
            </form>
          </div>

          {/* Form with white background */}
          <div className="bg-card rounded-lg p-6 shadow-sm">
            <form className="space-y-4">
              <div>
                <input className="w-full border-border rounded px-3 py-2 focus:outline-none focus:border-transparent" name="single" placeholder="Ask George (get a mock response)" type="text" />
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  className="p-3 bg-black text-white rounded-md font-small"
                  // onClick={async () => {
                  //   // Dynamically import default suggestions from JSON file
                  //   const resp = await fetch("/default-suggestions.json");
                  //   if (resp.ok) {
                  //     const defaultSuggestions = await resp.json();
                  //     if (Array.isArray(defaultSuggestions) && defaultSuggestions.length > 0) {
                  //       setNewSuggestions(prev => [...prev, ...defaultSuggestions]);
                  //     } else {
                  //       alert("No default suggestions found");
                  //     }
                  //   } else {
                  //     alert("Failed to load default suggestions");
                  //   }
                  // }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                </button>
              </div>
            </form>
          </div>
        </section>
  <section className="w-full md:w-1/2 bg-card border-l border-gray-300 flex flex-col h-full overflow-y-auto relative px-10">
          {/* Fixed floating action buttons at the top right */}
          <div className="fixed top-6 right-6 z-50">
            <div className="flex items-center gap-3">
              {/* Style selector dropdown */}
              <div className="relative">
                <button
                   onClick={() => setIsStyleDropdownOpen(!isStyleDropdownOpen)}
                  className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors bg-white"
                >
                  {/*George icon */}
                  <svg className="w-6 h-6" viewBox="0 0 255 255" xmlns="http://www.w3.org/2000/svg">
                    <path d="M0 0 C4.62 0 9.24 0 14 0 C14.33 18.15 14.66 36.3 15 55 C27.54 42.46 40.08 29.92 53 17 C54.65 18.32 56.3 19.64 58 21 C58 21.66 58 22.32 58 23 C58.639375 23.2475 59.27875 23.495 59.9375 23.75 C62 25 62 25 62.83409119 26.83746338 C63 29 63 29 61.71559143 30.88568115 C60.72630898 31.85830902 60.72630898 31.85830902 59.71704102 32.85058594 C58.97619766 33.59105164 58.23535431 34.33151733 57.47206116 35.09442139 C56.65757004 35.88310608 55.84307892 36.67179077 55.00390625 37.484375 C54.18123764 38.29996887 53.35856903 39.11556274 52.51097107 39.95587158 C49.87294754 42.56583985 47.21809526 45.15792426 44.5625 47.75 C42.77425751 49.51317443 40.98713284 51.27748335 39.20117188 53.04296875 C34.81561757 57.37755194 30.40776621 61.68754829 26 66 C43.16 66.33 60.32 66.66 78 67 C78 71.95 78 76.9 78 82 C60.84 82.33 43.68 82.66 26 83 C38.26053663 96.11914278 38.26053663 96.11914278 50.8125 108.9375 C51.58658203 109.71544922 52.36066406 110.49339844 53.15820312 111.29492188 C53.89619141 112.03162109 54.63417969 112.76832031 55.39453125 113.52734375 C56.36676636 114.49788696 56.36676636 114.49788696 57.35864258 115.48803711 C58.9414371 117.08616271 58.9414371 117.08616271 61 118 C60.45015228 121.87511727 58.72444669 123.59576506 55.9375 126.25 C55.20402344 126.95640625 54.47054687 127.6628125 53.71484375 128.390625 C53.14894531 128.92171875 52.58304688 129.4528125 52 130 C48.98984706 128.6489735 46.88032534 127.13664313 44.546875 124.8125 C43.928125 124.19632812 43.309375 123.58015625 42.671875 122.9453125 C42.03765625 122.30335938 41.4034375 121.66140625 40.75 121 C39.77546875 120.03707031 39.77546875 120.03707031 38.78125 119.0546875 C37.86085937 118.13042969 37.86085937 118.13042969 36.921875 117.1875 C36.36081055 116.62417969 35.79974609 116.06085938 35.22167969 115.48046875 C34 114 34 114 34 112 C33.443125 111.79375 32.88625 111.5875 32.3125 111.375 C29.73916861 109.84491107 28.26949645 107.99204548 26.4375 105.65625 C24.3283276 103.22611659 21.87083291 101.29200393 19.35546875 99.296875 C18.90816406 98.86890625 18.46085938 98.4409375 18 98 C18 97.34 18 96.68 18 96 C17.34 96 16.68 96 16 96 C16 95.34 16 94.68 16 94 C15.34 94 14.68 94 14 94 C14 110.83 14 127.66 14 145 C9.05 145 4.1 145 -1 145 C-1.33 128.17 -1.66 111.34 -2 94 C-13.88 105.88 -25.76 117.76 -38 130 C-41.49353838 128.25323081 -43.13945763 127.08594785 -45.75 124.375 C-46.36359375 123.74335938 -46.9771875 123.11171875 -47.609375 122.4609375 C-48.06828125 121.97882813 -48.5271875 121.49671875 -49 121 C-41.19686673 105.39373345 -25.33783702 95.33783702 -13 83 C-54.58 82.67 -96.16 82.34 -139 82 C-139 77.05 -139 72.1 -139 67 C-97.75 66.67 -56.5 66.34 -14 66 C-15.65 64.35 -17.3 62.7 -19 61 C-19.95095606 59.98280297 -20.89420907 58.95825776 -21.82421875 57.921875 C-22.29537109 57.40109375 -22.76652344 56.8803125 -23.25195312 56.34375 C-24.22200412 55.26679543 -25.19072101 54.18863791 -26.15820312 53.109375 C-28.75886077 50.15625262 -28.75886077 50.15625262 -32 48 C-32 47.34 -32 46.68 -32 46 C-32.83144531 45.67708984 -32.83144531 45.67708984 -33.6796875 45.34765625 C-36.80423859 43.53289173 -38.75278757 41.15315214 -41.125 38.4375 C-44.16488178 34.71412066 -44.16488178 34.71412066 -48 32 C-48 31.34 -48 30.68 -48 30 C-49.485 29.505 -49.485 29.505 -51 29 C-49.52278578 25.54798361 -47.56205999 23.35038064 -44.875 20.75 C-44.15054688 20.04359375 -43.42609375 19.3371875 -42.6796875 18.609375 C-42.12539062 18.07828125 -41.57109375 17.5471875 -41 17 C-35.85170256 21.30627256 -31.04247928 25.82311931 -26.31640625 30.5859375 C-25.26585304 31.63861313 -25.26585304 31.63861313 -24.19407654 32.71255493 C-21.98116973 34.93101136 -19.77178584 37.15293815 -17.5625 39.375 C-16.05296686 40.88955466 -14.54320343 42.40387985 -13.03320312 43.91796875 C-9.35280298 47.60933099 -5.67528043 51.30354069 -2 55 C-1.98969254 54.3257045 -1.97938507 53.651409 -1.96876526 52.9566803 C-1.86094231 45.96556418 -1.74632557 38.97458333 -1.62768555 31.98364258 C-1.58425876 29.37136656 -1.54258962 26.75906072 -1.50268555 24.14672852 C-1.44516993 20.40111281 -1.38142236 16.65564831 -1.31640625 12.91015625 C-1.29969376 11.73413345 -1.28298126 10.55811066 -1.26576233 9.34645081 C-1.24581711 8.26540573 -1.22587189 7.18436066 -1.20532227 6.07055664 C-1.18977798 5.11347305 -1.1742337 4.15638947 -1.15821838 3.17030334 C-1 1 -1 1 0 0 Z " fill="#BA4E89" transform="translate(159,56)"/>
                  </svg>
                  

                  {/* Mode indicator - pink A or yellow square */}
                  {styleMode === 'yellow' ? (
                    <div className="w-4 h-4 bg-yellow-400 rounded-sm"></div>
                  ) : (
                    <div className="w-4 h-4 flex items-center justify-center">
                      <span className="text-sm font-medium text-primary">A</span>
                    </div>
                  )}
                  
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {/* Dropdown menu */}
                {isStyleDropdownOpen && (
                  <div className="absolute top-full left-0 mt-1 w-40 bg-white border border-gray-300 rounded-md shadow-lg z-10">
                    <button
                      onClick={() => {
                        setStyleMode('yellow');
                        setIsStyleDropdownOpen(false);
                      }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-gray-50 transition-colors"
                    >
                      <div className="w-4 h-4 bg-yellow-400 rounded-sm"></div>
                      <span className="text-sm">Yellow highlight</span>
                    </button>
                    <button
                      onClick={() => {
                        setStyleMode('pink');
                        setIsStyleDropdownOpen(false);
                      }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-gray-50 transition-colors"
                    >
                      <div className="w-4 h-4 flex items-center justify-center">
                        <span className="text-sm font-medium text-primary">A</span>
                      </div>
                      <span className="text-sm">Pink text</span>
                    </button>
                  </div>
                )}
              </div>
              
              
              {/* Save button
              <button className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors text-sm font-medium bg-white">
                Save
              </button>
              
        
              <button className="px-4 py-2 bg-primary hover:bg-gray-800 text-white rounded-md font-medium text-sm">
                Publish
              </button> */}
            </div>
          </div>
          
          {/* Main document heading, description, and prose editor aligned with reduced left padding */}
          <div className="flex flex-col items-start w-full pt-16" >
            <div 
              className="text-2xl font-bold mb-2 focus:outline-none"
              contentEditable
              suppressContentEditableWarning={true}
              style={{paddingLeft: 0}}
            >
              {"Landing Page A/B Test"}
            </div>
            <div 
              className="text-gray-600 mb-4 focus:outline-none"
              contentEditable
              suppressContentEditableWarning={true}
              style={{paddingLeft: 0}}
            >
              {"This is a short description of what the study is about. It should sound really good and concise."}
            </div>
            {/* Editor for current page */}
            <div className="w-full focus-outline-none" >
              <SuggestionEditor
                initialContent={initialContent}
                newSuggestions={newSuggestions}
                styleMode={styleMode}
                onContentChange={handleEditorContentChange}
              />
            </div>
            {/* Validate Button and Results */}
            <div className="w-full flex flex-col items-center mt-6">
              <button
                type="button"
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors text-sm font-medium bg-white"
                onClick={handleValidateSections}
              >
                Validate Sections
              </button>
              {validationResult && (
                <div className={`mt-4 w-full max-w-lg p-4 rounded ${validationResult.valid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {validationResult.valid ? (
                    <span>All sections are valid!</span>
                  ) : (
                    <ul className="list-disc pl-5">
                      {validationResult.errors.map((err, idx) => (
                        <li key={idx}>{err}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>

  );
}

