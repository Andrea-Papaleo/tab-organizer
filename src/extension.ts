// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { TabOrganizer } from "./tabOrganizer";

export function activate(context: vscode.ExtensionContext) {
  console.log("Tab Organizer extension is now active");

  const organizer = new TabOrganizer(context);

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand("tabOrganizer.organize", () => {
      organizer.organize();
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("tabOrganizer.toggleAutoOrganize", () => {
      organizer.toggleAutoOrganize();
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("tabOrganizer.setStrategy", () => {
      organizer.setStrategy();
    }),
  );
}

// This method is called when your extension is deactivated
export function deactivate() {}
