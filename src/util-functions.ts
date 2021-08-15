import * as vscode from "vscode";
import { match, __ } from "ts-pattern";
import { window } from "vscode";
import { v4 as uuidv4 } from "uuid";
import { TODO } from "./tree-view";

type TODOData =
  | undefined
  | { label: string; uuid: string; checked: boolean }
  | { label: string; uuid: string; url: string; checked: boolean }
  | { name: string; id: string; content: TODOData[] };

type Add = (dirId: string) => (elem: TODOData) => (dataStore: TODOData[]) => TODOData[];
const add: Add = (id) => (elem) => (dataStore) =>
  dataStore.map((todoData: TODOData) =>
    match(todoData)
      .with(undefined, () => todoData)
      .with({ label: __.string, uuid: __.string, checked: __.boolean }, () => todoData)
      .with({ name: __.string, id: id, content: __ }, (subDir) => ({
        name: subDir.name,
        id: subDir.id,
        content: subDir.content.concat(elem),
      }))
      .with({ name: __.string, id: __.string, content: __ }, (subDir) => ({
        name: subDir.name,
        id: subDir.id,
        content: add(id)(elem)(subDir.content),
      }))
      .exhaustive()
  );

type AddBase = (elem: TODOData) => (dataStore: TODOData[]) => TODOData[];
const addBase: AddBase = (elem) => (dataStore) => dataStore.concat(elem);

type Check = (id: string) => (dataStore: TODOData[]) => TODOData[];
const check: Check = (id) => (dataStore) =>
  dataStore.map((todoData: TODOData) =>
    match(todoData)
      .with(undefined, () => todoData)
      .with({ label: __.string, uuid: id, checked: __.boolean }, (elem) => ({
        label: elem.label,
        uuid: elem.uuid,
        checked: !elem.checked,
      }))
      .with({ label: __.string, uuid: __.string, checked: __.boolean }, () => todoData)
      .with({ name: __.string, id: __.string, content: __ }, (subDir) => ({
        name: subDir.name,
        id: subDir.id,
        content: check(id)(subDir.content),
      }))
      .exhaustive()
  );

type CreateElem = (isDirectory: boolean) => (name: string) => TODOData;
const createElem: CreateElem = (isDirectory) =>
  isDirectory
    ? (name: string) => ({ name: name, id: uuidv4(), content: [] })
    : (name: string) => ({ label: name, uuid: uuidv4(), checked: false });

type CreateLink = (url: string) => (name: string) => TODOData;
const createLink: CreateLink = (url) => (name) => ({ label: name, uuid: uuidv4(), url: url, checked: false });

type Edit = (id: string) => (elem: TODOData) => (dataStore: TODOData[]) => TODOData[];
const edit: Edit = (id) => (elem) => (dataStore) =>
  dataStore.map((todoData: TODOData) =>
    match(todoData)
      .with(undefined, () => todoData)
      .with({ label: __.string, uuid: id, checked: __.boolean }, () => elem)
      .with({ label: __.string, uuid: __.string, checked: __.boolean }, () => todoData)
      .with({ name: __.string, id: __.string, content: __ }, (subDir) => ({
        name: subDir.name,
        id: subDir.id,
        content: edit(id)(elem)(subDir.content),
      }))
      .exhaustive()
  );

type InputBox = (suggestion: string) => () => Promise<string | undefined>;
const inputBox: InputBox = (suggestion) => async () =>
  await window.showInputBox({
    placeHolder: suggestion,
  });

type MapDataToTreeItem = (todoData: TODOData[]) => TODO[];
const mapDataToTreeItem: MapDataToTreeItem = (todoData: TODOData[]) =>
  todoData.map((entry: TODOData) =>
    match(entry)
      .with(undefined, () => new TODO("...", "", false, vscode.TreeItemCollapsibleState.None))
      .with(
        { label: __.string, uuid: __.string, checked: true },
        (elem) => new TODO(strikeThrough(elem.label), elem.uuid, elem.checked, vscode.TreeItemCollapsibleState.None)
      )
      .with(
        { label: __.string, uuid: __.string, url: __.string, checked: __.boolean },
        (elem) =>
          new TODO(elem.label, elem.uuid, elem.checked, vscode.TreeItemCollapsibleState.None, {
            command: "todo.open.link",
            title: "Open Link",
            arguments: [elem.url],
          })
      )
      .with(
        { label: __.string, uuid: __.string, checked: __.boolean },
        (elem) => new TODO(elem.label, elem.uuid, elem.checked, vscode.TreeItemCollapsibleState.None)
      )
      .with(
        { name: __.string, id: __.string, content: __ },
        (elem) => new TODO(elem.name, elem.id, false, vscode.TreeItemCollapsibleState.Collapsed)
      )
      .exhaustive()
  );

type MapToParent = (entry: TODOData) => (id: string | undefined) => TODOData;
const mapToParent: MapToParent = (entry: TODOData) => (id: string | undefined) =>
  id
    ? match(entry)
        .with(undefined, () => undefined)
        .with({ label: __.string, uuid: __.string, checked: __.boolean }, () => undefined)
        .with({ name: __.string, id: __.string, content: [] }, () => undefined)
        .with({ name: __.string, id: __.string, content: __ }, (elem) =>
          elem.id === id
            ? elem
            : elem.content
                .map((elem: TODOData) => mapToParent(elem)(id))
                .reduce((prev: TODOData, current: TODOData) => prev || current)
        )
        .exhaustive()
    : // False in case no id was defined
      undefined;

type Remove = (id: string) => (dataStore: TODOData[]) => TODOData[];
const remove: Remove = (id) => (dataStore) =>
  dataStore
    .filter((todoData: TODOData) =>
      match(todoData)
        .with(undefined, () => true)
        .with({ label: __.string, uuid: __.string, checked: __.boolean }, () => true)
        .with({ name: __.string, id: id, content: __ }, () => false)
        .with({ name: __.string, id: __.string, content: __ }, () => true)
        .exhaustive()
    )
    .map((elem: TODOData) =>
      match(elem)
        .with(undefined, () => elem)
        .with({ label: __.string, uuid: __.string, checked: __.boolean }, () => elem)
        .with({ name: __.string, id: __.string, content: __ }, (subDir) => ({
          name: subDir.name,
          id: subDir.id,
          content: remove(id)(subDir.content),
        }))
        .exhaustive()
    );

type RemoveDone = (dataStore: TODOData[]) => TODOData[];
const removeDone: RemoveDone = (dataStore) =>
  dataStore
    .filter((todoData: TODOData) =>
      match(todoData)
        .with(undefined, () => true)
        .with({ label: __.string, uuid: __.string, checked: true }, () => false)
        .with({ label: __.string, uuid: __.string, checked: __.boolean }, () => true)
        .with({ name: __.string, id: __.string, content: __ }, () => true)
        .exhaustive()
    )
    .map((elem: TODOData) =>
      match(elem)
        .with(undefined, () => elem)
        .with({ label: __.string, uuid: __.string, checked: __.boolean }, () => elem)
        .with({ name: __.string, id: __.string, content: __ }, (subDir) => ({
          name: subDir.name,
          id: subDir.id,
          content: removeDone(subDir.content),
        }))
        .exhaustive()
    );

type StrikeThrough = (text: string) => string;
const strikeThrough: StrikeThrough = (text: string) =>
  text
    .split("")
    .map((char) => char + "\u0336")
    .join("");

export {
  TODOData,
  add,
  addBase,
  check,
  createElem,
  createLink,
  edit,
  inputBox,
  mapDataToTreeItem,
  mapToParent,
  remove,
  removeDone,
  strikeThrough,
};
