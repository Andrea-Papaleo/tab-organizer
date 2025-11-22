import * as vscode from "vscode";
import * as path from "path";
import { IHierarchyStrategy } from "./index";

export class FileSystemStrategy implements IHierarchyStrategy {
  getName(): string {
    return "File System Hierarchy";
  }

  sort(tabs: readonly vscode.Tab[]): vscode.Tab[] {
    const workspaceRoot = this.getWorkspaceRoot();

    return [...tabs].sort((a, b) => {
      const pathA = this.getTabPath(a);
      const pathB = this.getTabPath(b);

      // Handle tabs without valid paths
      if (!pathA && !pathB) {
        return 0;
      }
      if (!pathA) {
        return 1;
      }
      if (!pathB) {
        return -1;
      }

      // Get relative paths from workspace root
      const relativeA = workspaceRoot
        ? path.relative(workspaceRoot, pathA)
        : pathA;
      const relativeB = workspaceRoot
        ? path.relative(workspaceRoot, pathB)
        : pathB;

      // Calculate depth (number of directory separators)
      const depthA = this.getPathDepth(relativeA);
      const depthB = this.getPathDepth(relativeB);

      // Sort by depth first (shallower files come first)
      if (depthA !== depthB) {
        return depthA - depthB;
      }

      // Within same depth, check for parent-child relationships
      const dirA = path.dirname(relativeA);
      const dirB = path.dirname(relativeB);

      if (dirA !== dirB) {
        // If A's directory is a parent of B's directory, A comes first
        if (dirB.startsWith(dirA + path.sep)) {
          return -1;
        }
        // If B's directory is a parent of A's directory, B comes first
        if (dirA.startsWith(dirB + path.sep)) {
          return 1;
        }
      }

      // Same depth and no parent-child relationship, sort alphabetically
      return relativeA.localeCompare(relativeB, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });
  }

  private getTabPath(tab: vscode.Tab): string | undefined {
    const input = tab.input as any;
    return input?.uri?.fsPath;
  }

  private getPathDepth(relativePath: string): number {
    if (relativePath === "." || relativePath === "") {
      return 0;
    }
    return relativePath.split(path.sep).length - 1;
  }

  private getWorkspaceRoot(): string | undefined {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    return workspaceFolders && workspaceFolders.length > 0
      ? workspaceFolders[0].uri.fsPath
      : undefined;
  }
}
