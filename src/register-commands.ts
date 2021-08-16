import * as vscode from "vscode";
import { commands } from "vscode";
import { showInputBox, updateGlobalState } from "./extension";
import { TODO, TreeView } from "./tree-view";
import { add, addBase, check, createElem, createLink, inputBox, remove, removeDone } from "./util-functions";

export const register = (context: vscode.ExtensionContext, treeView: TreeView) => {
  context.subscriptions.push(
    commands.registerCommand(
      "todo.check",
      async (todo: TODO) => todo.id && updateGlobalState(context, treeView, check(todo.id))
    )
  );
  context.subscriptions.push(
    commands.registerCommand(
      "todo.uncheck",
      async (todo: TODO) => todo.id && updateGlobalState(context, treeView, check(todo.id))
    )
  );
  context.subscriptions.push(
    commands.registerCommand("todo.dir.add", async (todo: TODO) =>
      showInputBox(context, treeView, inputBox("My todo"), createElem(false), add, todo)
    )
  );
  context.subscriptions.push(
    commands.registerCommand("todo.dir.create-dir", async (todo: TODO) =>
      showInputBox(context, treeView, inputBox("My section"), createElem(true), add, todo)
    )
  );
  context.subscriptions.push(
    commands.registerCommand("todo.dir.add.link", async (todo: TODO) =>
      inputBox("https://mylink.com")().then((url: string | undefined) =>
        url
          ? showInputBox(context, treeView, inputBox("Link name"), createLink(url), add, todo)
          : console.error("Error selecting link")
      )
    )
  );
  context.subscriptions.push(
    commands.registerCommand("todo.add.link", async (todo: TODO) =>
      inputBox("https://mylink.com")().then((url: string | undefined) =>
        url
          ? showInputBox(context, treeView, inputBox("Link name"), createLink(url), addBase, todo)
          : console.error("Error selecting link")
      )
    )
  );
  context.subscriptions.push(
    commands.registerCommand(
      "todo.dir.remove",
      async (todo: TODO) => todo.id && updateGlobalState(context, treeView, remove(todo.id))
    )
  );
  context.subscriptions.push(
    commands.registerCommand("todo.add", async () =>
      showInputBox(context, treeView, inputBox("My todo"), createElem(false), addBase)
    )
  );
  context.subscriptions.push(
    commands.registerCommand("todo.create-dir", async () =>
      showInputBox(context, treeView, inputBox("My section"), createElem(true), addBase)
    )
  );
  context.subscriptions.push(
    commands.registerCommand("todo.remove-done", async () => updateGlobalState(context, treeView, removeDone))
  );
  context.subscriptions.push(
    commands.registerCommand("todo.open.link", async (url: string) =>
      url.startsWith("/")
        ? vscode.window.showTextDocument(vscode.Uri.parse(url))
        : vscode.env.openExternal(vscode.Uri.parse(url))
    )
  );
};
