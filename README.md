# Tab Organizer

Organize your open editor tabs based on different hierarchical strategies.

## Features

### Multiple Sorting Strategies

- **File System**: Sort tabs by directory structure depth, keeping related files together
- **Import Order**: Sort tabs by import dependencies - files that import others come first, creating a logical flow from entry points to utilities
- **Alphabetical**: Simple alphabetical sorting by filename

### Commands

- **Organize Tabs by Hierarchy** (`Ctrl+Shift+O` / `Cmd+Shift+O`): Manually organize all open tabs
- **Toggle Auto-Organize Tabs**: Enable/disable automatic organization when tabs change
- **Tab Organizer: Set Sorting Strategy**: Quickly switch between sorting strategies via a picker

### Smart Import Resolution

The Import Order strategy intelligently resolves:
- ES6 imports (`import { x } from './file'`)
- CommonJS requires (`require('./file')`)
- Dynamic imports (`import('./file')`)
- Path aliases from tsconfig.json/jsconfig.json (e.g., `@/components`)

Works correctly with git worktrees and symlinked directories through suffix path matching.

## Extension Settings

This extension contributes the following settings:

- `tabOrganizer.autoOrganize`: Enable/disable automatic tab organization when tabs change (default: `false`)
- `tabOrganizer.sortStrategy`: Strategy for organizing tabs - `fileSystem`, `imports`, or `alphabetical` (default: `fileSystem`)
- `tabOrganizer.aliasConfigFiles`: Config files to check for path aliases (default: `["tsconfig.json", "tsconfig.app.json", "tsconfig.node.json", "jsconfig.json"]`)

### Example Configuration

```json
{
  "tabOrganizer.autoOrganize": true,
  "tabOrganizer.sortStrategy": "imports",
  "tabOrganizer.aliasConfigFiles": [
    "tsconfig.json",
    "tsconfig.app.json"
  ]
}
```

## Known Issues

- Import resolution only works for files that are open as tabs
- The Import Order strategy requires files to be saved to detect imports (unsaved changes are not analyzed)

## Release Notes

### 0.0.1

Initial release:
- File System, Import Order, and Alphabetical sorting strategies
- Configurable alias config files for path resolution
- Support for git worktrees and symlinked directories
- Auto-organize option
- Quick strategy picker command

---

## Following extension guidelines

Ensure that you've read through the extensions guidelines and follow the best practices for creating your extension.

- [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)

**Enjoy!**
