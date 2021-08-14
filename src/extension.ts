import * as vscode from 'vscode';
import { v4 as uuidv4 } from 'uuid';
import { window, commands } from 'vscode';
import { TreeView, TODO, TODOData } from './tree-view';
import { match, __ } from 'ts-pattern';

// this method is called when the extension is activated
export function activate(context: vscode.ExtensionContext) {

	const treeView: TreeView = new TreeView(context);
	context.globalState.get('todo-hirachie-tree') || context.globalState.update('todo-hirachie-tree', []);

	// Register todo view
	vscode.window.registerTreeDataProvider('todo', treeView);
	// Register commands for checking
	context.subscriptions.push(commands.registerCommand('todo.check', async (todo: TODO) => todo.id && updateGlobalState(context, treeView, check(todo.id))));
	context.subscriptions.push(commands.registerCommand('todo.uncheck', async (todo: TODO) => todo.id && updateGlobalState(context, treeView, check(todo.id))));
	context.subscriptions.push(commands.registerCommand('todo.dir.add', async (todo: TODO) => showInputBox(context, treeView, inputBox, createElem(false), add, todo)));
	context.subscriptions.push(commands.registerCommand('todo.dir.create-dir', async (todo: TODO) => showInputBox(context, treeView, inputBox, createElem(true), add, todo)));
	context.subscriptions.push(commands.registerCommand('todo.add', async () => showInputBox(context, treeView, inputBox, createElem(false), addBase)));
	context.subscriptions.push(commands.registerCommand('todo.create-dir', async () => showInputBox(context, treeView, inputBox, createElem(true), addBase)));
	context.subscriptions.push(commands.registerCommand('todo.remove-done', async () => updateGlobalState(context, treeView, removeDone)));
}

/**
 * Function that modifies the data sotore (vscode nosql db)
 * @param context Extension state
 * @param view View to update after modifiying
 * @param modFunction 
 */
async function updateGlobalState(context: vscode.ExtensionContext, view: TreeView, modFunction: CallableFunction) {
	const todoData: TODOData[] | undefined = context.globalState.get('todo-hirachie-tree');
	if (!todoData) {
		throw new Error('You checked a todo that doesnt exist');
	}
	const newState = modFunction(todoData);
	context.globalState.update('todo-hirachie-tree', newState);
	view.refresh();
}

/**
 * Function that takes a data store reference, ui component and modify function to modify the datastore
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
	uiElem: () => Promise<string|undefined>,
	createElem: (name: string) => TODOData,
	modFunction: CallableFunction,
	param?: TODO
) => uiElem().then((inputText: string|undefined) => inputText? updateGlobalState(
		context,
		treeView,
		param ?
			modFunction (createElem(inputText)) (param.id):
			modFunction (createElem(inputText))
): console.error('Invalid transaction'));

type InputBox = () => Promise<string|undefined>;
const inputBox: InputBox = async () => await window.showInputBox({
	placeHolder: 'For example: Install GNOME!',
});

type CreateElem = (isDirectory: boolean) => (name: string) => TODOData;
const createElem: CreateElem = (isDirectory) => isDirectory ?
	(name: string) => ({ name: name, id: uuidv4(), content: [] }):
	(name: string) => ({ label: name, uuid: uuidv4(), checked: false });

// 
type Check = (id: string) => (dataStore: TODOData[]) => TODOData[];
const check: Check = (id) => (dataStore) => dataStore
	.map((todoData: TODOData) => match(todoData)
		.with(undefined, () => todoData)
		.with({ label: __.string, uuid: id, checked: __.boolean }, (elem) => (
			{ label: elem.label, uuid: elem.uuid, checked: !elem.checked }))
		.with({ label: __.string, uuid: __.string, checked: __.boolean }, () => todoData)
		.with({ name: __.string, id: __.string, content: __ }, (subDir) => (
			{ name: subDir.name, id: subDir.id, content: check(id)(subDir.content) }))
		.exhaustive());

type Add = (elem: TODOData) => (dirId: string) => (dataStore: TODOData[]) => TODOData[];
const add: Add = (elem) => (id) => (dataStore) => dataStore
	.map((todoData: TODOData) => match(todoData)
		.with(undefined, () => todoData)
		.with({ label: __.string, uuid: __.string, checked: __.boolean }, () => todoData)
		.with({ name: __.string, id: id, content: __ }, (subDir) => (
			{ name: subDir.name, id: subDir.id, content: subDir.content.concat(elem) }))
		.with({ name: __.string, id: __.string, content: __ }, (subDir) => (
			{ name: subDir.name, id: subDir.id, content: add(elem)(id)(subDir.content) }))
		.exhaustive());

type AddBase = (elem: TODOData) => (dataStore: TODOData[]) => TODOData[];
const addBase: AddBase = (elem) => (dataStore) => dataStore.concat(elem);

type RemoveDone = (dataStore: TODOData[]) => TODOData[];
const removeDone: RemoveDone = (dataStore) => dataStore
	.filter((todoData: TODOData) => match(todoData)
		.with(undefined, () => true)
		.with({ label: __.string, uuid: __.string, checked: true }, () => false)
		.with({ label: __.string, uuid: __.string, checked: __.boolean }, () => true)
		.with({ name: __.string, id: __.string, content: __ }, () => true)
		.exhaustive())
	.map((elem: TODOData) => match(elem)
		.with(undefined, () => elem)
		.with({ label: __.string, uuid: __.string, checked: __.boolean }, () => elem)
		.with({ name: __.string, id: __.string, content: __ }, (subDir) => (
			{ name: subDir.name, id: subDir.id, content: removeDone(subDir.content) }))
		.exhaustive());
