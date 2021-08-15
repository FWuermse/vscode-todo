import * as vscode from "vscode";
import { register } from "./register-commands";
import { TreeView, TODO } from "./tree-view";
import { TODOData } from "./util-functions";

// this method is called when the extension is activated
export function activate(context: vscode.ExtensionContext) {
  const treeView: TreeView = new TreeView(context);
  context.globalState.get("todo-hierarchy-tree") || context.globalState.update("todo-hierarchy-tree", []);

  // Register todo view
  vscode.window.registerTreeDataProvider("todo", treeView);
  // Register commands
  register(context, treeView);
}

/**
 * Function that modifies the data store (vscode no-sql db)
 * @param context Extension state
 * @param view View to update after modifying
 * @param modFunction
 */
export async function updateGlobalState(
  context: vscode.ExtensionContext,
  view: TreeView,
  modFunction: CallableFunction
) {
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
export const showInputBox = async (
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
