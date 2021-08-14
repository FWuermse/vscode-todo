import { match, __ } from 'ts-pattern';
import * as vscode from 'vscode';

export type TODOData =
	| undefined
	| {label: string, uuid: string, checked: boolean}
	| {name: string, id: string, content: TODOData[]};

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

  contextValue = this.collapsibleState !== vscode.TreeItemCollapsibleState.None?
    'todo-dir': this.checked?
    'checked': 'unchecked';
}

export class TreeView implements vscode.TreeDataProvider<TODO>{

  private _onDidChangeTreeData: vscode.EventEmitter<TODO | undefined | void> = new vscode.EventEmitter<TODO | undefined | void>();
	readonly onDidChangeTreeData: vscode.Event<TODO | undefined | void> = this._onDidChangeTreeData.event;

  constructor(private context: vscode.ExtensionContext) { }

  /**
   * This is an overwrite of TreeDataProvider in order to display cursom items
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
    // Read from vscode nosql db
    const todoData: TODOData[]|undefined = this.context.globalState.get('todo-hirachie-tree');
    // If reading was unsuccessful return no further todos
    if (!todoData) {
      return [];
    }
    // Todo exists whenever the current node is not the root node
    if (todo) {
      const parent: TODOData = todoData.map((entry: TODOData) => mapToParent(entry)(todo.id)).filter((entry) => entry)[0];
      const children: TODOData[]|undefined = match(parent)
          .with(undefined, () => undefined)
          .with({label: __.string, uuid: __.string, checked: __.boolean}, () => [])
          .with({name: __.string, id: __.string, content: __}, (elem) => elem.content)
          .exhaustive();
      return children? mapDataToTreeItem(children): [];
    }
    // Set new todos
    return mapDataToTreeItem(todoData);
  }
}

type MapDataToTreeItem = (todoData: TODOData[]) => TODO[];
const mapDataToTreeItem: MapDataToTreeItem = (todoData: TODOData[]) =>
todoData.map((entry: TODOData) =>
  match(entry)
    .with(undefined, () => new TODO('...', '', false, vscode.TreeItemCollapsibleState.None))
    .with({label: __.string, uuid: __.string, checked: true}, (elem) =>
      new TODO(strikeThrough(elem.label), elem.uuid, elem.checked, vscode.TreeItemCollapsibleState.None))
    .with({label: __.string, uuid: __.string, checked: __.boolean}, (elem) =>
      new TODO(elem.label, elem.uuid, elem.checked, vscode.TreeItemCollapsibleState.None))
    .with({name: __.string, id: __.string, content: __}, (elem) =>
      new TODO(elem.name, elem.id, false, vscode.TreeItemCollapsibleState.Collapsed))
    .exhaustive());

type MapToParent = (entry: TODOData) => (id: string | undefined) => TODOData;
const mapToParent: MapToParent = (entry: TODOData) => (id: string | undefined) =>
  id? match(entry)
    .with(undefined, () => undefined)
    .with({label: __.string, uuid: __.string, checked: __.boolean}, () => undefined)
    .with({name: __.string, id: __.string, content: []}, () => undefined)
    .with({name: __.string, id: __.string, content: __}, (elem) => elem.id === id? elem: elem.content
        .map((elem: TODOData) => mapToParent(elem)(id))
        .reduce((prev: TODOData, current: TODOData) => prev || current))
    .exhaustive():
    // False in case no id was defined
  undefined;

type StrikeThrough = (text: string) => string;
const strikeThrough: StrikeThrough = (text: string) =>
  text
    .split('')
    .map(char => char + '\u0336')
    .join('');
