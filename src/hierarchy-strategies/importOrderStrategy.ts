import * as vscode from "vscode";
import * as path from "path";
import { IHierarchyStrategy } from "./index";

interface ImportGraph {
  [filePath: string]: Set<string>;
}

export class ImportOrderStrategy implements IHierarchyStrategy {
  private importGraph: ImportGraph = {};
  private importCache: Map<string, Set<string>> = new Map();
  private pathAliases: Map<string, string> | null = null;
  private baseUrl: string | null = null;

  getName(): string {
    return "Import Order";
  }

  sort(tabs: readonly vscode.Tab[]): vscode.Tab[] {
    // Build import graph
    this.buildImportGraph(tabs);

    // Calculate import scores (depth in dependency graph)
    const scores = this.calculateImportScores(tabs);

    // Sort by import score (most imported files first), then alphabetically
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

      const depthA = scores.get(pathA) || 0;
      const depthB = scores.get(pathB) || 0;

      // Lower depths (importers) come first
      if (depthA !== depthB) {
        return depthA - depthB;
      }

      // Same score, sort alphabetically
      return pathA.localeCompare(pathB);
    });
  }

  private buildImportGraph(tabs: readonly vscode.Tab[]): void {
    this.importGraph = {};

    for (const tab of tabs) {
      const filePath = this.getTabPath(tab);
      if (!filePath) {
        continue;
      }

      const imports = this.extractImports(filePath);
      this.importGraph[filePath] = imports;
    }
  }

  private extractImports(filePath: string): Set<string> {
    // Check cache first
    if (this.importCache.has(filePath)) {
      return this.importCache.get(filePath)!;
    }

    const imports = new Set<string>();

    // Try to get document from open documents first, then read from disk
    let text: string | undefined;
    const document = this.findOpenDocument(filePath);

    if (document) {
      text = document.getText();
    } else {
      // Read from disk if not in open documents
      try {
        const fs = require("fs");
        text = fs.readFileSync(filePath, "utf8");
      } catch {
        this.importCache.set(filePath, imports);
        return imports;
      }
    }

    if (!text) {
      this.importCache.set(filePath, imports);
      return imports;
    }
    const importPatterns = [
      // ES6 imports: import { x } from './file'
      /import\s+(?:[\w*\s{},]*)\s+from\s+['"]([^'"]+)['"]/g,
      // CommonJS: require('./file')
      /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
      // Dynamic imports: import('./file')
      /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    ];

    for (const pattern of importPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const importPath = match[1];
        const resolvedPath = this.resolveImportPath(filePath, importPath);
        if (resolvedPath) {
          imports.add(resolvedPath);
        }
      }
    }

    this.importCache.set(filePath, imports);
    return imports;
  }

  private loadPathAliases(): void {
    if (this.pathAliases !== null) {
      return; // Already loaded
    }

    this.pathAliases = new Map();
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
      return;
    }

    // Try tsconfig.json first, then jsconfig.json
    const configFiles = [
      "tsconfig.json",
      "tsconfig.app.json",
      "tsconfig.node.json",
      "jsconfig.json",
    ];
    const fs = require("fs");

    for (const configFile of configFiles) {
      const configPath = path.join(workspaceRoot, configFile);
      if (!fs.existsSync(configPath)) {
        continue;
      }

      try {
        const content = fs.readFileSync(configPath, "utf8");
        // Strip comments from JSON (tsconfig allows them)
        const stripped = content
          .replace(/\/\*[\s\S]*?\*\//g, "") // multi-line comments
          .replace(/\/\/.*/g, ""); // single-line comments
        const config = JSON.parse(stripped);
        const compilerOptions = config.compilerOptions || {};

        // Skip if no paths defined
        if (
          !compilerOptions.paths ||
          Object.keys(compilerOptions.paths).length === 0
        ) {
          continue;
        }

        this.baseUrl = compilerOptions.baseUrl
          ? path.resolve(workspaceRoot, compilerOptions.baseUrl)
          : workspaceRoot;

        const paths = compilerOptions.paths;
        for (const [alias, targets] of Object.entries(paths)) {
          if (Array.isArray(targets) && targets.length > 0) {
            // Remove trailing /* from alias and target
            const cleanAlias = alias.replace(/\/\*$/, "");
            const cleanTarget = (targets[0] as string).replace(/\/\*$/, "");
            this.pathAliases.set(cleanAlias, cleanTarget);
          }
        }
        break; // Found paths, stop looking
      } catch {
        // Ignore parse errors
      }
    }
  }

  private resolveImportPath(
    fromFile: string,
    importPath: string,
  ): string | undefined {
    // Handle relative imports
    if (importPath.startsWith(".") || importPath.startsWith("/")) {
      const dir = path.dirname(fromFile);
      const resolved = path.resolve(dir, importPath);
      return this.resolveWithExtensions(resolved);
    }

    // Try to resolve path aliases
    this.loadPathAliases();
    if (this.pathAliases && this.baseUrl) {
      for (const [alias, target] of this.pathAliases) {
        if (importPath === alias || importPath.startsWith(alias + "/")) {
          const remainder = importPath.slice(alias.length);
          const resolved = path.join(this.baseUrl, target + remainder);
          return this.resolveWithExtensions(resolved);
        }
      }
    }

    // Skip node_modules imports
    return undefined;
  }

  private resolveWithExtensions(resolved: string): string | undefined {
    // Try common extensions if no extension provided
    const extensions = [".ts", ".tsx", ".js", ".jsx", ""];
    for (const ext of extensions) {
      const testPath = resolved + ext;
      if (this.fileExists(testPath)) {
        return testPath;
      }
    }

    // Try index files
    for (const ext of [".ts", ".tsx", ".js", ".jsx"]) {
      const testPath = path.join(resolved, `index${ext}`);
      if (this.fileExists(testPath)) {
        return testPath;
      }
    }

    return undefined;
  }

  private fileExists(filePath: string): boolean {
    try {
      const fs = require("fs");
      return fs.existsSync(filePath);
    } catch {
      return false;
    }
  }

  private findOpenDocument(filePath: string): vscode.TextDocument | undefined {
    return vscode.workspace.textDocuments.find(
      (doc) => doc.uri.fsPath === filePath,
    );
  }

  private calculateImportScores(
    tabs: readonly vscode.Tab[],
  ): Map<string, number> {
    const depths = new Map<string, number>();
    const tabPaths = new Set(
      tabs
        .map((tab) => this.getTabPath(tab))
        .filter((p) => p !== undefined) as string[],
    );

    // Count incoming edges (how many files import each file)
    const incomingCount = new Map<string, number>();
    for (const filePath of tabPaths) {
      incomingCount.set(filePath, 0);
    }

    for (const [importer, imports] of Object.entries(this.importGraph)) {
      for (const imported of imports) {
        if (incomingCount.has(imported)) {
          incomingCount.set(imported, (incomingCount.get(imported) || 0) + 1);
        }
      }
    }

    // Topological sort using Kahn's algorithm to calculate depths
    // Files with no incoming edges (not imported) start at depth 0
    const queue: string[] = [];
    for (const [filePath, count] of incomingCount) {
      if (count === 0) {
        queue.push(filePath);
        depths.set(filePath, 0);
      }
    }

    // BFS to assign depths
    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentDepth = depths.get(current) || 0;
      const imports = this.importGraph[current] || new Set();

      for (const imported of imports) {
        if (!tabPaths.has(imported)) {
          continue;
        }

        const newCount = (incomingCount.get(imported) || 1) - 1;
        incomingCount.set(imported, newCount);

        // Update depth to be max of current depth + 1
        const existingDepth = depths.get(imported) || 0;
        depths.set(imported, Math.max(existingDepth, currentDepth + 1));

        if (newCount === 0) {
          queue.push(imported);
        }
      }
    }

    // Handle any remaining files (cycles) - assign max depth + 1
    const maxDepth = Math.max(...Array.from(depths.values()), 0);
    for (const filePath of tabPaths) {
      if (!depths.has(filePath)) {
        depths.set(filePath, maxDepth + 1);
      }
    }

    return depths;
  }

  private getTabPath(tab: vscode.Tab): string | undefined {
    const input = tab.input as any;
    return input?.uri?.fsPath;
  }

  clearCache(): void {
    this.importCache.clear();
    this.importGraph = {};
    this.pathAliases = null;
    this.baseUrl = null;
  }
}
