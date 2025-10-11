# dialogue-demo


## 1st Option - Quill.js

Rich Text editing provided by Quill.js. Features toolbar and delta change functionality

Used diff-match-patch for easy diff tracking.

- Onchange, diff-match-patch calculates all changes and then we step through and apply manual styling (doesnt preserve italics and more atm)

- On save, original text var is now replaced with current text. HasEdits is now False

- On discard, current text is set to original text. HasEdits is now False




## 2nd Option - Tiptap 
has undo and redo func
has more edit history because it has premium ai edit func



## Constant functionality:

Might stick with diff-match-patch for both RTE options, surprisingly easy and doesnt require built in versioning/edit tracking of RTE

applyDiff used on llm calls  
additions - highlighted in yellow  
deletions- strikethrough and highlighted in yellow  

## Todo

- Atomic diff/save editing
- Llm diff functionality 
- Tiptap
- Better styling