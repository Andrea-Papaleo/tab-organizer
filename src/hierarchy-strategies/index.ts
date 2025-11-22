import * as vscode from "vscode";

export interface IHierarchyStrategy {
  sort(tabs: readonly vscode.Tab[]): vscode.Tab[];
  getName(): string;
}

export { FileSystemStrategy } from "./fileSystemStrategy";
export { ImportOrderStrategy } from "./importOrderStrategy";
