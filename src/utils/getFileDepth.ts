import * as vscode from "vscode";

export function getFileDepth(uri: vscode.Uri): number {
  return uri.path.split("/").filter((p) => p.length > 0).length;
}
