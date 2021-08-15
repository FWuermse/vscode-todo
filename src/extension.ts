import * as vscode from "vscode";
import { commands } from "vscode";
import { TreeView, TODO } from "./tree-view";
import {
  TODOData,
  add,
  addBase,
  check,
  createElem,
  createLink,
  edit,
  inputBox,
  remove,
  removeDone,
} from "./util-functions";

// this method is called when the extension is activated
export function activate(context: vscode.ExtensionContext) {
  const treeView: TreeView = new TreeView(context);
  context.globalState.get("todo-hierarchy-tree") || context.globalState.update("todo-hierarchy-tree", []);

  // Register todo view
  vscode.window.registerTreeDataProvider("todo", treeView);
  // Register commands
  context.subscriptions.push(
    commands.registerCommand(
      "todo.check",
      async (todo: TODO) => todo.id && updateGlobalState(context, treeView, check(todo.id))
    )
  );
  // TODO: Make edit either change the label or link but not replace the element causing links to be deleted.
  context.subscriptions.push(
    commands.registerCommand(
      "todo.edit",
      async (todo: TODO) =>
        todo.id && showInputBox(context, treeView, inputBox("New text"), createElem(false), edit, todo)
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
      showInputBox(context, treeView, inputBox("My Todo"), createElem(false), addBase)
    )
  );
  context.subscriptions.push(
    commands.registerCommand("todo.create-dir", async () =>
      showInputBox(context, treeView, inputBox("My dir"), createElem(true), addBase)
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
}

/**
 * Function that modifies the data store (vscode no-sql db)
 * @param context Extension state
 * @param view View to update after modifying
 * @param modFunction
 */
async function updateGlobalState(context: vscode.ExtensionContext, view: TreeView, modFunction: CallableFunction) {
  const todoData: TODOData[] | undefined = context.globalState.get("todo-hierarchy-tree");
  if (!todoData) {
    throw new Error("You checked a todo that doesn't exist");
  }
  const newState = modFunction(todoData);
  context.globalState.update("todo-hierarchy-tree", newState);
  view.refresh();
}

/**
 * Function that takes a data store reference, ui component and modify function to modify the datastore accordingly
 * @param context Extension context
 * @param treeView View of the tree tab
 * @param uiElem UI component for changing Data
 * @param createElem Function to add new Data entry
 * @param modFunction Function to modify data store
 * @param param Optional param for reference while mutating datastore
 * @returns void
 */
const showInputBox = async (
  context: vscode.ExtensionContext,
  treeView: TreeView,
  uiElem: () => Promise<string | undefined>,
  createElem: (name: string) => TODOData,
  modFunction: CallableFunction,
  param?: TODO
) =>
  uiElem().then((inputText: string | undefined) =>
    inputText
      ? updateGlobalState(
          context,
          treeView,
          param ? modFunction(param.id)(createElem(inputText)) : modFunction(createElem(inputText))
        )
      : console.error("Invalid transaction")
  );
