"use client";
import React from 'react';
import SuggestionEditor, { TextSuggestion } from './proseMirror';

interface ProseMirrorDemoProps {
  initialSuggestions?: TextSuggestion[];
}

const ProseMirrorDemo: React.FC<ProseMirrorDemoProps> = ({ initialSuggestions }) => {
  const initialContent = `
    <b>Background</b>
    <p>This is a background that George generated for the study. This should give someone a good idea of the reasons behind this study.<br>
    Hypothetically should this text be editable at all ?</p>
    <b>Objectives</b>
    <p>This are objectives that George generated for the study. This should give someone a good idea of the goals behind this study. Hypothetically should this text be editable at all ? Hmmm.</p>
    <ol>
      <li>This is text for the first objective</li>
      <li>This is text for the second objective</li>
      <li>This is text for the third objective</li>
    </ol>
    <b>Methodology</b>
    <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum</p>
  `;
  return (
    <div className="space-y-6">
      <SuggestionEditor
        initialContent={initialContent}
        initialSuggestions={initialSuggestions}
      />
    </div>
  );
};

export default ProseMirrorDemo;