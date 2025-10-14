# dialogue-demo

Uses ProseMirror plus [suggestion-mode package](https://github.com/davefowler/prosemirror-suggestion-mode) for easy diff tracking, visualization, and ui/ux interaction.



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


