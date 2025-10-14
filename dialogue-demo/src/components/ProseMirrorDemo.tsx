"use client";
import React from 'react';
import SuggestionEditor, { TextSuggestion } from './proseMirror';

interface ProseMirrorDemoProps {}

const ProseMirrorDemo: React.FC<ProseMirrorDemoProps> = () => {
  // Static demo content and suggestions
  const initialContent = `<p>Welcome to the ProseMirror demo. Edit this text and try bold/italic formatting or suggestions!</p>`;
  const initialSuggestions: TextSuggestion[] = [
    {
      textToReplace: 'ProseMirror',
      textReplacement: 'ProseMirror Editor',
      reason: 'Clarify the editor name',
      textBefore: 'Welcome to the ',
      textAfter: ' demo.',
    },
    {
      textToReplace: 'Edit this text',
      textReplacement: 'Feel free to edit this text',
      reason: 'Encourage editing',
      textBefore: '',
      textAfter: ' and try bold/italic formatting or suggestions!',
    },
  ];
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