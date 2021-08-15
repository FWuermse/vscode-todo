import { match, __ } from "ts-pattern";
import * as vscode from "vscode";
import { mapDataToTreeItem, mapToParent, TODOData } from "./util-functions";

export class TODO extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    private readonly uuid: string,
    private readonly checked: boolean,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly command?: vscode.Command
  ) {
    super(label, collapsibleState);
    this.tooltip = `${this.label}`;
    this.id = this.uuid;
  }

  contextValue =
    this.collapsibleState !== vscode.TreeItemCollapsibleState.None
      ? "todo-dir"
      : this.checked
      ? "checked"
      : "unchecked";
}

export class TreeView implements vscode.TreeDataProvider<TODO> {
  private _onDidChangeTreeData: vscode.EventEmitter<TODO | undefined | void> = new vscode.EventEmitter<
    TODO | undefined | void
  >();
  readonly onDidChangeTreeData: vscode.Event<TODO | undefined | void> = this._onDidChangeTreeData.event;

  constructor(private context: vscode.ExtensionContext) {}

  /**
   * This is an overwrite of TreeDataProvider in order to display custom items
   * @param element Currently selected treeView implementation
   * @returns Selected item
   */
  getTreeItem(element: TODO): vscode.TreeItem {
    return element;
  }

  /**
   * This is an overwrite of TreeDataProvider that is called on vscode update events
   */
  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  // This is an overwrite of TreeDataProvider that is triggered whenever a folder is getting expanded
  getChildren(todo?: TODO): vscode.ProviderResult<TODO[]> {
    // Read from vscode nos-ql db
    const todoData: TODOData[] | undefined = this.context.globalState.get("todo-hierarchy-tree");
    // If reading was unsuccessful return no further todos
    if (!todoData) {
      return [];
    }
    // Todo exists whenever the current node is not the root node
    if (todo) {
      const parent: TODOData = todoData
        .map((entry: TODOData) => mapToParent(entry)(todo.id))
        .filter((entry) => entry)[0];
      const children: TODOData[] | undefined = match(parent)
        .with(undefined, () => undefined)
        .with({ label: __.string, uuid: __.string, checked: __.boolean }, () => [])
        .with({ name: __.string, id: __.string, content: __ }, (elem) => elem.content)
        .exhaustive();
      return children ? mapDataToTreeItem(children) : [];
    }
    // Set new todos
    return mapDataToTreeItem(todoData);
  }
}
