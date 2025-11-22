import * as vscode from "vscode";
import { IHierarchyStrategy } from "./index";

export class AlphabeticalStrategy implements IHierarchyStrategy {
  getName(): string {
    return "Alphabetical";
  }

  sort(tabs: readonly vscode.Tab[]): vscode.Tab[] {
    return [...tabs].sort((a, b) => {
      const pathA = this.getTabPath(a);
      const pathB = this.getTabPath(b);

      if (!pathA && !pathB) {
        return 0;
      }
      if (!pathA) {
        return 1;
      }
      if (!pathB) {
        return -1;
      }

      return pathA.localeCompare(pathB, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });
  }

  private getTabPath(tab: vscode.Tab): string | undefined {
    const input = tab.input as any;
    return input?.uri?.fsPath;
  }
}
