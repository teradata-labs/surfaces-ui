---
"@surfaces-ui/chat": minor
"@surfaces-ui/components": patch
---

A host can offer buttons under a reply and choices in the composer. A new `actions` part (`ChatActions`, drawn by `ActionsCard`) holds a row of buttons, or several alternatives one row each with buttons for the whole set after them; a press reaches `MessageList`'s new `onPartAction(partId, actionId, choiceId?)`, a disabled button stays reachable by keyboard with its reason read, and `outcome` replaces the buttons once handled. `ChatComposer` takes `context` (`ComposerContext`: chips for what a message is about that is not data, removable through `onClear`) and `toggles` (`ComposerToggle`: checkboxes for the next message). Nothing changes without them.
