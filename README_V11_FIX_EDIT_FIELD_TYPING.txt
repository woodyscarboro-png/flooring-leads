Version 11 fix:
- Fixed the edit-window typing problem where text fields lost focus after each typed letter.
- Moved the edit-window field row components out of the LeadModal render path so typing no longer remounts the input field on every keystroke.
- Kept the sortable lead table headers from v10.
- Kept the fixed edit window size and fixed table header layout from prior versions.

Commit summary:
Fix edit fields losing focus while typing
