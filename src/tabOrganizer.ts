import * as vscode from "vscode";
import {
  IHierarchyStrategy,
  FileSystemStrategy,
  ImportOrderStrategy,
} from "./hierarchy-strategies";
import { AlphabeticalStrategy } from "./hierarchy-strategies/alphabeticalStrategy";

export class TabOrganizer {
  private autoOrganize: boolean = false;
  private disposables: vscode.Disposable[] = [];
  private currentStrategy: IHierarchyStrategy;

  constructor(private context: vscode.ExtensionContext) {
    this.currentStrategy = this.loadStrategy();
    this.loadConfiguration();
    this.setupEventListeners();
  }

  private loadStrategy(): IHierarchyStrategy {
    const config = vscode.workspace.getConfiguration("tabOrganizer");
    const strategyName = config.get<string>("sortStrategy", "fileSystem");

    switch (strategyName) {
      case "imports":
        return new ImportOrderStrategy();
      case "alphabetical":
        return new AlphabeticalStrategy();
      case "fileSystem":
      default:
        return new FileSystemStrategy();
    }
  }

  private loadConfiguration() {
    const config = vscode.workspace.getConfiguration("tabOrganizer");
    this.autoOrganize = config.get("autoOrganize", false);
  }

  private setupEventListeners() {
    if (this.autoOrganize) {
      const listener = vscode.window.tabGroups.onDidChangeTabs(() => {
        this.organize();
      });
      this.disposables.push(listener);
    }

    // Listen for configuration changes
    const configListener = vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("tabOrganizer.sortStrategy")) {
        this.currentStrategy = this.loadStrategy();
      }
      if (e.affectsConfiguration("tabOrganizer.autoOrganize")) {
        this.loadConfiguration();
        this.setupEventListeners();
      }
    });
    this.disposables.push(configListener);
  }

  async organize() {
    const tabGroups = vscode.window.tabGroups.all;

    for (const group of tabGroups) {
      const tabs = group.tabs.filter((tab) => tab.input);
      if (tabs.length === 0) {
        continue;
      }

      const sortedTabs = this.currentStrategy.sort(tabs);

      // Create a map of tab to its current index
      const currentIndices = new Map<vscode.Tab, number>();
      tabs.forEach((tab, index) => {
        currentIndices.set(tab, index);
      });

      // Process tabs from end to start to avoid position shifts
      for (let targetIndex = sortedTabs.length - 1; targetIndex >= 0; targetIndex--) {
        const tab = sortedTabs[targetIndex];
        const currentIndex = currentIndices.get(tab);

        if (currentIndex === undefined || currentIndex === targetIndex) {
          continue;
        }

        // Activate the tab
        const input = tab.input as vscode.TabInputText;
        if (!input.uri) {
          continue;
        }

        await vscode.window.showTextDocument(input.uri, {
          viewColumn: group.viewColumn,
          preserveFocus: false,
        });

        // Calculate moves needed
        const delta = currentIndex - targetIndex;
        const command = delta > 0
          ? "workbench.action.moveEditorLeftInGroup"
          : "workbench.action.moveEditorRightInGroup";

        // Execute move commands
        for (let i = 0; i < Math.abs(delta); i++) {
          await vscode.commands.executeCommand(command);
          await this.delay(10); // Small delay for VS Code to process
        }

        // Update indices after move
        for (const [t, idx] of currentIndices) {
          if (delta > 0 && idx >= targetIndex && idx < currentIndex) {
            currentIndices.set(t, idx + 1);
          } else if (delta < 0 && idx > currentIndex && idx <= targetIndex) {
            currentIndices.set(t, idx - 1);
          }
        }
        currentIndices.set(tab, targetIndex);
      }
    }

    vscode.window.showInformationMessage(
      `Tabs organized using ${this.currentStrategy.getName()} strategy`,
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async setStrategy() {
    const strategies: Array<{ label: string; value: string; description: string }> = [
      {
        label: "File System",
        value: "fileSystem",
        description: "Sort by directory structure",
      },
      {
        label: "Imports",
        value: "imports",
        description: "Sort by import dependencies",
      },
      {
        label: "Alphabetical",
        value: "alphabetical",
        description: "Sort alphabetically by filename",
      },
    ];

    const currentStrategyValue = vscode.workspace
      .getConfiguration("tabOrganizer")
      .get<string>("sortStrategy", "fileSystem");

    const items: vscode.QuickPickItem[] = strategies.map((s) => ({
      label: s.value === currentStrategyValue ? `$(check) ${s.label}` : s.label,
      description: s.value,  // Store value in description for retrieval
      detail: s.description,
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: "Select a sorting strategy",
    });

    if (selected && selected.description) {
      await vscode.workspace
        .getConfiguration("tabOrganizer")
        .update("sortStrategy", selected.description, true);

      // Explicitly reload strategy to ensure change takes effect
      this.currentStrategy = this.loadStrategy();

      vscode.window.showInformationMessage(
        `Sorting strategy set to: ${selected.label.replace("$(check) ", "")}`,
      );
    }
  }

  toggleAutoOrganize() {
    this.autoOrganize = !this.autoOrganize;
    const config = vscode.workspace.getConfiguration("tabOrganizer");
    config.update("autoOrganize", this.autoOrganize, true);

    vscode.window.showInformationMessage(
      `Auto-organize: ${this.autoOrganize ? "ON" : "OFF"}`,
    );
  }

  dispose() {
    this.disposables.forEach((d) => d.dispose());
  }
}
