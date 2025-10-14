# dialogue-demo


## 1st Option - Quill.js

Rich Text editing with real-time diff visualization using Quill.js. Features toolbar, delta operations, and smart change tracking.

TrackedQuill component maintains separate user content and display layers:
- **User Content**: Extracted from editor, excluding diff markers (strikethrough text)
- **Display Layer**: Shows diffs with yellow highlighting for additions, strikethrough for deletions
- **Original State**: Preserved with Delta format for clean restoration

**Change Detection Flow:**
- Text changes trigger debounced diff calculation (10ms for deletions, 25ms for additions)
- diff-match-patch compares original vs current user content
- Diffs applied as formatting overlays while preserving user formatting (bold, italic, etc.)
- Visual feedback: additions highlighted yellow, deletions shown as yellow strikethrough

**State Management:**
- Accept: User content becomes new original, diff markers cleared, hasEdits = false
- Discard: Editor restored to original Delta state, hasEdits = false
- Smart formatting preservation during diff application and state transitions




## 2nd Option - Tiptap 
has undo and redo func
has more edit history because it has premium ai edit func



## Constant functionality:

Might stick with diff-match-patch for both RTE options, surprisingly easy and doesnt require built in versioning/edit tracking of RTE

applyDiff used on llm calls  
additions - highlighted in yellow  
deletions- strikethrough and highlighted in yellow  

## Todo

- [x] Llm diff functionality 
- [x] Better styling
  - [x] Add dm sans font 
  - [x] Need big placeholder with color and make background color correct 
  - [x] Make left side only take up 40% hw
- [x] Better default text for plan and llm response
- [x] How to make the placeholders store formatting
- [x] toggling multipage edits
- [x] Big save button on top
- [x] ui toggle between highlight/pink text
  - [x] make it clean
- [x] Remove quill component box styling
- [x] Make file title and description editable

  
After prose mirror:
- [x] LLM inline comment capabilities
- [x] Atomic diff/save functionality +ui
- [ ] LLM form
- [ ] Structured minisections per page / uneditable titles (takes thinking)
- [ ] React form validation




- [ ] Text size option support
- [ ] Support for ctr-b/i shortcuts
- [ ] Version history far down the road, but possible since I'm tracking and updating all edits


