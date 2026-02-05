import "./style.css";

import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import { TextSelection } from "@tiptap/pm/state";
import MarkdownIt from "markdown-it";
import hljs from "highlight.js";
import TurndownService from "turndown";
import { open, save, confirm } from "@tauri-apps/plugin-dialog";
import {
  readTextFile,
  writeTextFile,
  readFile,
  writeFile,
  mkdir,
  exists,
  readDir
} from "@tauri-apps/plugin-fs";
import { dirname, join, extname, pictureDir } from "@tauri-apps/api/path";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";

const editorHost = document.querySelector<HTMLDivElement>("#editor")!;
const statusMsgEl = document.querySelector<HTMLSpanElement>("#statusMsg")!;
const wordCountEl = document.querySelector<HTMLSpanElement>("#wordCount")!;
const dirtyFlagEl = document.querySelector<HTMLSpanElement>("#dirtyFlag")!;
const filePathEl = document.querySelector<HTMLDivElement>("#filePath")!;
const recentListEl = document.querySelector<HTMLUListElement>("#recentList")!;
const outlineListEl = document.querySelector<HTMLUListElement>("#outlineList")!;
const filesTab = document.querySelector<HTMLButtonElement>("#filesTab")!;
const outlineTab = document.querySelector<HTMLButtonElement>("#outlineTab")!;
const filesPane = document.querySelector<HTMLDivElement>("#filesPane")!;
const outlinePane = document.querySelector<HTMLDivElement>("#outlinePane")!;
const contextMenu = document.querySelector<HTMLDivElement>("#contextMenu")!;
const sidebarResizer = document.querySelector<HTMLDivElement>("#sidebarResizer")!;
const folderPathEl = document.querySelector<HTMLDivElement>("#folderPath")!;
const folderListEl = document.querySelector<HTMLUListElement>("#folderList")!;
const toggleSourceBtn = document.querySelector<HTMLButtonElement>(
  "#toggleSourceBtn"
)!;
const sourceEditor = document.querySelector<HTMLTextAreaElement>("#sourceEditor")!;
const themeBtn = document.querySelector<HTMLButtonElement>("#themeBtn")!;
const themeIcon = document.querySelector<HTMLSpanElement>("#themeIcon")!;

const SIDEBAR_WIDTH_KEY = "ease-md:sidebar-width";
const SIDEBAR_MIN = 200;
const SIDEBAR_MAX = 420;
let resizeGuide: HTMLDivElement | null = null;

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true
});
md.set({
  highlight: (code, lang) => {
    if (lang && hljs.getLanguage(lang)) {
      return `<pre class="hljs"><code>${hljs.highlight(code, { language: lang }).value}</code></pre>`;
    }
    return `<pre class="hljs"><code>${md.utils.escapeHtml(code)}</code></pre>`;
  }
});
const turndown = new TurndownService({ codeBlockStyle: "fenced" });
turndown.addRule("imageWithOriginal", {
  filter: (node) =>
    node.nodeName === "IMG" && (node as HTMLElement).getAttribute("data-original"),
  replacement: (_content, node) => {
    const element = node as HTMLElement;
    const src = element.getAttribute("data-original") ?? element.getAttribute("src") ?? "";
    const alt = element.getAttribute("alt") ?? "";
    return formatImageMarkdown(src, alt);
  }
});

function formatImageMarkdown(src: string, alt = "") {
  const safeAlt = alt ?? "";
  return `![${safeAlt}](${src})`;
}

function parseImageMarkdown(value: string) {
  const match = value.trim().match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
  if (!match) {
    return null;
  }
  return { alt: match[1], src: match[2] };
}

function resolveImageForDisplay(rawSrc: string) {
  if (!rawSrc) {
    return rawSrc;
  }
  const normalized = rawSrc.replace(/\\/g, "/");
  if (/^(https?:|data:|blob:)/i.test(normalized)) {
    return normalized;
  }
  if (/^tauri:\/\//i.test(normalized) || /^asset:\/\//i.test(normalized)) {
    return normalized;
  }
  if (currentPath) {
    return convertFileSrc(join(dirname(currentPath), normalized));
  }
  return normalized;
}

function decorateImages(html: string) {
  const container = document.createElement("div");
  container.innerHTML = html;
  container.querySelectorAll("img").forEach((img) => {
    const raw = img.getAttribute("src") ?? "";
    const display = resolveImageForDisplay(raw);
    if (display !== raw) {
      img.setAttribute("data-original", raw);
      img.setAttribute("src", display);
    }
  });
  return container.innerHTML;
}

let imageMetaEditor: HTMLTextAreaElement | null = null;
let imageMetaState: { pos: number; node: any; img: HTMLImageElement } | null =
  null;

function ensureImageMetaEditor() {
  if (imageMetaEditor) {
    return imageMetaEditor;
  }
  const textarea = document.createElement("textarea");
  textarea.className = "image-meta-editor hidden";
  textarea.spellcheck = false;
  textarea.rows = 2;
  textarea.addEventListener("blur", () => applyImageMeta());
  textarea.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      applyImageMeta();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      hideImageMeta();
    }
  });
  document.body.appendChild(textarea);
  imageMetaEditor = textarea;
  return textarea;
}

function showImageMeta(node: any, pos: number, img: HTMLImageElement) {
  const textarea = ensureImageMetaEditor();
  const rect = img.getBoundingClientRect();
  textarea.style.left = `${rect.left}px`;
  textarea.style.top = `${rect.bottom + 6}px`;
  textarea.style.width = `${Math.min(rect.width, window.innerWidth - rect.left - 16)}px`;
  textarea.value = formatImageMarkdown(node.attrs.original ?? node.attrs.src, node.attrs.alt ?? "");
  textarea.classList.remove("hidden");
  textarea.focus();
  textarea.select();
  imageMetaState = { pos, node, img };
}

function hideImageMeta() {
  if (!imageMetaEditor) {
    return;
  }
  imageMetaEditor.classList.add("hidden");
  imageMetaState = null;
}

function applyImageMeta() {
  if (!imageMetaEditor || !imageMetaState || !editor) {
    hideImageMeta();
    return;
  }
  const parsed = parseImageMarkdown(imageMetaEditor.value ?? "");
  if (!parsed) {
    hideImageMeta();
    return;
  }
  const displaySrc = resolveImageForDisplay(parsed.src);
  editor.view.dispatch(
    editor.state.tr.setNodeMarkup(imageMetaState.pos, undefined, {
      ...imageMetaState.node.attrs,
      src: displaySrc,
      original: parsed.src,
      alt: parsed.alt
    })
  );
  hideImageMeta();
}

const ImageWithMarkdown = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      original: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-original"),
        renderHTML: (attributes) => {
          if (!attributes.original) {
            return {};
          }
          return { "data-original": attributes.original };
        }
      }
    };
  },
  addNodeView() {
    return ({ node, editor, getPos }) => {
      const wrapper = document.createElement("span");
      wrapper.className = "image-node";
      wrapper.contentEditable = "false";

      const img = document.createElement("img");
      img.src = node.attrs.src;
      img.alt = node.attrs.alt ?? "";
      img.draggable = false;

      img.addEventListener("click", (event) => {
        event.preventDefault();
        if (typeof getPos === "function") {
          const pos = getPos();
          if (typeof pos === "number") {
            editor.commands.setNodeSelection(pos);
            showImageMeta(node, pos, img);
          }
        }
      });

      wrapper.appendChild(img);

      return {
        dom: wrapper,
        update: (updatedNode) => {
          if (updatedNode.type.name !== node.type.name) {
            return false;
          }
          img.src = updatedNode.attrs.src;
          img.alt = updatedNode.attrs.alt ?? "";
          return true;
        },
        selectNode: () => {
          wrapper.classList.add("ProseMirror-selectednode");
        },
        deselectNode: () => {
          wrapper.classList.remove("ProseMirror-selectednode");
        }
      };
    };
  }
});

const RECENT_KEY = "ease-md:recent-files";
const DRAFT_KEY = "ease-md:draft";
const THEME_KEY = "ease-md:theme";
const MAX_RECENTS = 20;

let editor: Editor | null = null;
let currentPath: string | null = null;
let isDirty = false;
let isSourceMode = false;
let draftTimer: number | undefined;
let outlineTimer: number | undefined;
let outlineHeadings: { level: number; text: string; pos?: number; line?: number }[] = [];
let currentFolder: string | null = null;
let allowClose = false;

function setStatus(message: string) {
  statusMsgEl.textContent = message;
}

function setDirtyFlag() {
  dirtyFlagEl.textContent = isDirty ? "Unsaved" : "Saved";
  dirtyFlagEl.style.color = isDirty ? "var(--accent-strong)" : "var(--muted)";
}

function setFilePath(path: string | null) {
  currentPath = path;
  const label = path ? path.split(/[/\\]/).pop() ?? path : "Untitled";
  filePathEl.textContent = path ?? "Untitled";
  document.title = path ? `Ease MD 鈥?${label}` : "Ease MD";
}

function setFolder(path: string | null) {
  currentFolder = path;
  folderPathEl.textContent = path ?? "No folder selected.";
  void refreshFolderFiles();
}

function isMarkdownFile(name: string) {
  const lower = name.toLowerCase();
  return (
    lower.endsWith(".md") ||
    lower.endsWith(".markdown") ||
    lower.endsWith(".mdx")
  );
}

function normalizeName(pathOrName: string) {
  const raw = typeof pathOrName === "string" ? pathOrName : String(pathOrName);
  const parts = raw.split(/[/\\]/);
  return parts[parts.length - 1] ?? raw;
}

type TreeNode = {
  name: string;
  path: string;
  children: TreeNode[];
  isFile: boolean;
};

function toPathString(value: unknown, fallback: string) {
  if (typeof value === "string") {
    return value;
  }
  if (value && typeof value === "object") {
    const maybePath = (value as { path?: unknown }).path;
    if (typeof maybePath === "string") {
      return maybePath;
    }
    if (maybePath && typeof maybePath === "object") {
      const nested = (maybePath as { path?: unknown }).path;
      if (typeof nested === "string") {
        return nested;
      }
    }
  }
  return fallback;
}

async function scanDirTree(basePath: string): Promise<TreeNode[]> {
  const entries = await readDir(basePath, { recursive: false });
  const nodes: TreeNode[] = [];

  for (const entry of entries) {
    const rawPath = toPathString(entry?.path, "");
    const name = entry?.name ?? normalizeName(rawPath || basePath);
    const fallbackPath = rawPath || `${basePath.replace(/[/\\]+$/, "")}/${name}`;
    const entryPath = toPathString(entry?.path, fallbackPath);
    const isDir = entry?.isDirectory === true || Array.isArray(entry?.children);

    if (isDir) {
      let children: TreeNode[] = [];
      try {
        children = await scanDirTree(entryPath);
      } catch (error) {
        console.error("scanDirTree child failed", entryPath, error);
      }
      if (children.length > 0) {
        nodes.push({
          name,
          path: entryPath,
          isFile: false,
          children
        });
      }
      continue;
    }

    if (!isMarkdownFile(name)) {
      continue;
    }

    nodes.push({
      name,
      path: entryPath,
      isFile: true,
      children: []
    });
  }

  return nodes.sort((a, b) => {
    if (a.isFile !== b.isFile) {
      return a.isFile ? 1 : -1;
    }
    return a.name.localeCompare(b.name);
  });
}

function renderTree(nodes: TreeNode[], container: HTMLElement) {
  const list = document.createElement("ul");
  list.className = "folder-tree";
  nodes.forEach((node) => {
    const item = document.createElement("li");
    const row = document.createElement("div");
    row.className = `node ${node.isFile ? "file" : "folder"}`;
    if (currentPath && node.isFile && node.path === currentPath) {
      row.classList.add("active");
    }
    row.dataset.path = node.path;
    const label = document.createElement("span");
    label.className = "label";
    label.textContent = node.name;
    row.appendChild(label);
    row.addEventListener("click", (event) => {
      event.stopPropagation();
      const target = event.currentTarget as HTMLElement;
      const filePath = target.dataset.path ?? "";
      if (node.isFile && filePath) {
        void openPath(filePath, { updateFolder: false });
      }
    });
    item.appendChild(row);
    if (node.children.length > 0) {
      renderTree(node.children, item);
    }
    list.appendChild(item);
  });
  container.appendChild(list);
}

function updateTreeActive(path: string | null) {
  folderListEl
    .querySelectorAll(".folder-tree .node.active")
    .forEach((node) => node.classList.remove("active"));
  if (!path) {
    return;
  }
  const escaped = typeof (window as any).CSS?.escape === "function"
    ? (window as any).CSS.escape(path)
    : path.replace(/"/g, '\\"');
  const target = folderListEl.querySelector(
    `.folder-tree .node.file[data-path="${escaped}"]`
  ) as HTMLElement | null;
  if (target) {
    target.classList.add("active");
    target.scrollIntoView({ block: "nearest" });
  }
}

async function refreshFolderFiles() {
  folderListEl.innerHTML = "";
  if (!currentFolder) {
    const empty = document.createElement("li");
    empty.textContent = "No folder selected.";
    empty.style.opacity = "0.6";
    folderListEl.appendChild(empty);
    return;
  }
  try {
    const tree = await scanDirTree(currentFolder);
    const rootNode: TreeNode = {
      name: normalizeName(currentFolder),
      path: currentFolder,
      children: tree,
      isFile: false
    };
    if (tree.length === 0) {
      const empty = document.createElement("li");
      empty.textContent = "No markdown files.";
      empty.style.opacity = "0.6";
      folderListEl.appendChild(empty);
      return;
    }
    renderTree([rootNode], folderListEl);
  } catch (error) {
    console.error(error);
    const failed = document.createElement("li");
    failed.textContent = "Failed to load folder.";
    failed.style.opacity = "0.6";
    folderListEl.appendChild(failed);
  }
}

function getMarkdown() {
  if (!editor) {
    return "";
  }
  return turndown.turndown(editor.getHTML());
}

function setMarkdown(markdown: string) {
  if (!editor) {
    return;
  }
  const html = decorateImages(md.render(markdown));
  editor.commands.setContent(html, false);
}

function scheduleOutline() {
  if (outlineTimer) {
    window.clearTimeout(outlineTimer);
  }
  outlineTimer = window.setTimeout(updateOutline, 200);
}

function updateOutline() {
  const headings: { level: number; text: string; pos?: number; line?: number }[] = [];
  if (isSourceMode) {
    const lines = sourceEditor.value.split(/\r?\n/);
    lines.forEach((line, index) => {
      const match = /^(#{1,6})\s+(.*)$/.exec(line);
      if (!match) {
        return;
      }
      headings.push({
        level: match[1].length,
        text: match[2].trim() || "Untitled",
        line: index
      });
    });
  } else {
    editor?.state.doc.descendants((node, pos) => {
      if (node.type.name === "heading") {
        headings.push({
          level: node.attrs.level ?? 1,
          text: node.textContent.trim() || "Untitled",
          pos
        });
      }
    });
  }

  outlineHeadings = headings;
  outlineListEl.innerHTML = "";
  if (headings.length === 0) {
    const empty = document.createElement("li");
    empty.textContent = "No headings yet.";
    empty.style.opacity = "0.6";
    outlineListEl.appendChild(empty);
    return;
  }

  headings.forEach((heading) => {
    const item = document.createElement("li");
    item.className = "outline-item";
    if (typeof heading.pos === "number") {
      item.dataset.pos = String(heading.pos);
    }
    if (typeof heading.line === "number") {
      item.dataset.line = String(heading.line);
    }
    item.style.paddingLeft = `${Math.max(0, heading.level - 1) * 12}px`;
    const depth = document.createElement("span");
    depth.className = "outline-depth";
    depth.textContent = `H${heading.level}`;
    const text = document.createElement("span");
    text.className = "outline-text";
    text.textContent = heading.text;
    item.appendChild(depth);
    item.appendChild(text);
    item.addEventListener("click", () => {
      if (isSourceMode) {
        const line = heading.line ?? 0;
        const lineHeight = parseFloat(getComputedStyle(sourceEditor).lineHeight || "20");
        sourceEditor.scrollTo({ top: line * lineHeight, behavior: "auto" });
        sourceEditor.focus();
        return;
      }
      if (!editor || typeof heading.pos !== "number") {
        return;
      }
      const anchor = Math.min(heading.pos + 1, editor.state.doc.content.size);
      editor.commands.focus();
      editor.view.dispatch(
        editor.state.tr.setSelection(
          TextSelection.create(editor.state.doc, anchor)
        )
      );
      scrollEditorToPos(anchor);
    });
    outlineListEl.appendChild(item);
  });

  if (!isSourceMode) {
    highlightOutlineByScroll();
  }
}

function scrollEditorToPos(pos: number) {
  if (!editor) {
    return;
  }
  const coords = editor.view.coordsAtPos(pos);
  const containerRect = editorHost.getBoundingClientRect();
  const targetTop = coords.top - containerRect.top + editorHost.scrollTop - 12;
  editorHost.scrollTo({ top: Math.max(0, targetTop), behavior: "auto" });
}

function highlightOutlineByScroll() {
  if (!editor || outlineHeadings.length === 0) {
    return;
  }
  const headings = outlineHeadings.filter((heading) => typeof heading.pos === "number") as {
    level: number;
    text: string;
    pos: number;
  }[];
  if (headings.length === 0) {
    return;
  }
  const containerRect = editorHost.getBoundingClientRect();
  const topBoundary = containerRect.top + 12;
  let active = headings[0];
  for (const heading of headings) {
    const coords = editor.view.coordsAtPos(heading.pos);
    if (coords.top <= topBoundary + 8) {
      active = heading;
    } else {
      break;
    }
  }
  outlineListEl
    .querySelectorAll(".outline-item.active")
    .forEach((node) => node.classList.remove("active"));
  const target = outlineListEl.querySelector(
    `.outline-item[data-pos="${active.pos}"]`
  ) as HTMLElement | null;
  if (target) {
    target.classList.add("active");
    target.scrollIntoView({ block: "nearest" });
  }
}

function updateWordCount() {
  const text = isSourceMode ? sourceEditor.value.trim() : editor?.getText()?.trim() ?? "";
  const words = text ? text.split(/\s+/).length : 0;
  wordCountEl.textContent = `${words} word${words === 1 ? "" : "s"}`;
}

function loadRecent(): string[] {
  const raw = localStorage.getItem(RECENT_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function syncRecentMenu(list: string[]) {
  invoke("set_recent_menu", { recents: list }).catch((error) => {
    console.error("sync recent menu failed", error);
  });
}

function saveRecent(list: string[]) {
  localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  syncRecentMenu(list);
}

function addRecent(path: string) {
  const existing = loadRecent().filter((item) => item !== path);
  const next = [path, ...existing].slice(0, MAX_RECENTS);
  saveRecent(next);
  renderRecent(next);
}

function renderRecent(list = loadRecent()) {
  recentListEl.innerHTML = "";
  if (list.length === 0) {
    const empty = document.createElement("li");
    empty.textContent = "No recent files yet.";
    empty.style.opacity = "0.6";
    recentListEl.appendChild(empty);
    return;
  }
  list.forEach((path) => {
    const item = document.createElement("li");
    item.textContent = path;
    item.addEventListener("click", () => {
      void openPath(path);
    });
    recentListEl.appendChild(item);
  });
}

function draftKey(path: string | null) {
  return path ? `${DRAFT_KEY}:${path}` : `${DRAFT_KEY}:__untitled`;
}

function getDraft(path: string | null) {
  const raw = localStorage.getItem(draftKey(path));
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as { text: string; updatedAt: number };
  } catch {
    return null;
  }
}

function clearDraft(path: string | null) {
  localStorage.removeItem(draftKey(path));
}

function scheduleDraftSave() {
  if (draftTimer) {
    window.clearTimeout(draftTimer);
  }
  draftTimer = window.setTimeout(saveDraft, 600);
}

function saveDraft() {
  const text = isSourceMode ? sourceEditor.value : getMarkdown();
  if (!text.trim()) {
    return;
  }
  localStorage.setItem(
    draftKey(currentPath),
    JSON.stringify({ text, updatedAt: Date.now() })
  );
  setStatus("Draft saved");
}

async function maybeConfirmLoseChanges(): Promise<boolean> {
  if (!isDirty) {
    return true;
  }
  return window.confirm("You have unsaved changes. Continue?");
}

async function maybeRestoreDraft(path: string | null, currentText: string) {
  const draft = getDraft(path);
  if (!draft || draft.text.trim().length === 0) {
    return;
  }
  if (draft.text === currentText) {
    return;
  }
  const confirmRestore = window.confirm(
    "Found an unsaved draft. Restore it?"
  );
  if (confirmRestore) {
    setMarkdown(draft.text);
    isDirty = true;
    setDirtyFlag();
    setStatus("Draft restored");
  }
}

function setEditorContent(text: string) {
  setMarkdown(text);
  sourceEditor.value = text;
  updateWordCount();
  updateOutline();
}

async function openPath(
  path: string,
  options: { updateFolder?: boolean } = {}
) {
  const updateFolder = options.updateFolder ?? false;
  try {
    const pathValue = toPathString(path, "");
    if (!pathValue) {
      throw new Error("Empty path");
    }
    const text = await readTextFile(pathValue);
    setEditorContent(text);
    setFilePath(pathValue);
    if (updateFolder) {
      const folder = await dirname(pathValue);
      setFolder(folder);
    } else {
      updateTreeActive(pathValue);
    }
    addRecent(pathValue);
    isDirty = false;
    setDirtyFlag();
    setStatus("Loaded file");
    await maybeRestoreDraft(pathValue, text);
  } catch (error) {
    console.error(error);
    setStatus("Failed to open file");
  }
}

async function openFile() {
  if (!(await maybeConfirmLoseChanges())) {
    return;
  }
  const result = await open({
    multiple: false,
    filters: [{ name: "Markdown", extensions: ["md", "markdown", "mdx"] }]
  });
  if (!result || Array.isArray(result)) {
    return;
  }
  await openPath(result, { updateFolder: true });
}

async function saveFile() {
  if (!currentPath) {
    await saveFileAs();
    return;
  }
  try {
    const content = isSourceMode ? sourceEditor.value : getMarkdown();
    await writeTextFile(currentPath, content);
    if (!currentFolder) {
      const folder = await dirname(currentPath);
      setFolder(folder);
    } else {
      await refreshFolderFiles();
    }
    isDirty = false;
    setDirtyFlag();
    clearDraft(currentPath);
    setStatus("Saved");
  } catch (error) {
    console.error(error);
    setStatus("Failed to save");
  }
}

async function saveFileAs() {
  const path = await save({
    filters: [{ name: "Markdown", extensions: ["md", "markdown", "mdx"] }]
  });
  if (!path) {
    return;
  }
  try {
    const content = isSourceMode ? sourceEditor.value : getMarkdown();
    await writeTextFile(path, content);
    setFilePath(path);
    const folder = await dirname(path);
    setFolder(folder);
    addRecent(path);
    isDirty = false;
    setDirtyFlag();
    clearDraft(path);
    setStatus("Saved");
  } catch (error) {
    console.error(error);
    setStatus("Failed to save");
  }
}

function newFile() {
  setEditorContent("");
  setFilePath(null);
  isDirty = false;
  setDirtyFlag();
  setStatus("New file");
}

async function newFileWithPrompt() {
  if (!(await maybeConfirmLoseChanges())) {
    return;
  }
  newFile();
  await maybeRestoreDraft(null, "");
}

function setSourceMode(enabled: boolean) {
  isSourceMode = enabled;
  editorHost.classList.toggle("hidden", enabled);
  sourceEditor.classList.toggle("hidden", !enabled);
  if (enabled) {
    sourceEditor.value = getMarkdown();
    sourceEditor.focus();
  } else {
    setMarkdown(sourceEditor.value);
    editor?.commands.focus();
  }
  updateWordCount();
  updateOutline();
}

function toggleSourceMode() {
  setSourceMode(!isSourceMode);
}

function applyTheme(theme: "light" | "dark") {
  document.body.classList.remove("theme-light", "theme-dark");
  document.body.classList.add(`theme-${theme}`);
  localStorage.setItem(THEME_KEY, theme);
  themeIcon.textContent = theme === "dark" ? "☾" : "☀";
}

function initTheme() {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark") {
    applyTheme(stored);
    return;
  }
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(prefersDark ? "dark" : "light");
}

function toggleTheme() {
  const isDark = document.body.classList.contains("theme-dark");
  applyTheme(isDark ? "light" : "dark");
}

function applySidebarWidth(width: number) {
  const clamped = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, width));
  document.documentElement.style.setProperty("--sidebar-width", `${clamped}px`);
  localStorage.setItem(SIDEBAR_WIDTH_KEY, String(clamped));
}

function initSidebarWidth() {
  const stored = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY));
  if (Number.isFinite(stored) && stored > 0) {
    applySidebarWidth(stored);
  }
}

function getResizeGuide() {
  if (resizeGuide) {
    return resizeGuide;
  }
  const guide = document.createElement("div");
  guide.className = "resize-guide";
  document.body.appendChild(guide);
  resizeGuide = guide;
  return guide;
}

function setSidebarTab(target: "files" | "outline") {
  const isFiles = target === "files";
  filesTab.classList.toggle("active", isFiles);
  outlineTab.classList.toggle("active", !isFiles);
  filesPane.classList.toggle("hidden", !isFiles);
  outlinePane.classList.toggle("hidden", isFiles);
}

async function handleDroppedFile(path: string) {
  const lower = path.toLowerCase();
  if (lower.match(/\.(png|jpe?g|gif|webp|bmp|svg)$/)) {
    const bytes = await readFile(path);
    await insertImageBytes(bytes, extname(path));
    return;
  }
  await openPath(path);
}

async function insertImageBytes(bytes: Uint8Array, extension: string) {
  const cleanExt = extension.replace(".", "") || "png";
  const { fullPath, linkPath } = await resolveImageTarget(cleanExt);
  await writeFile(fullPath, bytes);
  editor
    ?.chain()
    .focus()
    .setImage({ src: resolveImageForDisplay(linkPath), original: linkPath })
    .run();
  setStatus("Image inserted");
}

async function resolveImageTarget(ext: string) {
  const fileName = `image-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2, 6)}.${ext}`;
  if (currentPath) {
    const baseDir = await dirname(currentPath);
    const assetsDir = await join(baseDir, "assets");
    if (!(await exists(assetsDir))) {
      await mkdir(assetsDir, { recursive: true });
    }
    const fullPath = await join(assetsDir, fileName);
    return { fullPath, linkPath: `assets/${fileName}` };
  }
  const pictures = await pictureDir();
  const targetDir = await join(pictures, "EaseMD");
  if (!(await exists(targetDir))) {
    await mkdir(targetDir, { recursive: true });
  }
  const fullPath = await join(targetDir, fileName);
  return { fullPath, linkPath: fullPath };
}

function openContextMenu(x: number, y: number) {
  contextMenu.style.left = `${x}px`;
  contextMenu.style.top = `${y}px`;
  contextMenu.classList.remove("hidden");
}

function closeContextMenu() {
  contextMenu.classList.add("hidden");
}

async function handleContextAction(action: string) {
  if (!editor) {
    return;
  }
  const chain = editor.chain().focus();
  switch (action) {
    case "heading1":
      chain.toggleHeading({ level: 1 }).run();
      break;
    case "heading2":
      chain.toggleHeading({ level: 2 }).run();
      break;
    case "heading3":
      chain.toggleHeading({ level: 3 }).run();
      break;
    case "bold":
      chain.toggleBold().run();
      break;
    case "italic":
      chain.toggleItalic().run();
      break;
    case "blockquote":
      chain.toggleBlockquote().run();
      break;
    case "codeblock":
      chain.toggleCodeBlock().run();
      break;
    case "table":
      chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
      break;
    case "hr":
      chain.setHorizontalRule().run();
      break;
    case "bullet":
      chain.toggleBulletList().run();
      break;
    case "ordered":
      chain.toggleOrderedList().run();
      break;
    case "link": {
      const url = window.prompt("Link URL");
      if (url) {
        chain.extendMarkRange("link").setLink({ href: url }).run();
      }
      break;
    }
    case "image": {
      const file = await open({
        multiple: false,
        filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"] }]
      });
      if (file && !Array.isArray(file)) {
        const bytes = await readFile(file);
        await insertImageBytes(bytes, extname(file));
      }
      break;
    }
    default:
      break;
  }
}

async function setupWindowHandlers() {
  const appWindow = getCurrentWindow();
  await appWindow.onCloseRequested(async (event) => {
    if (allowClose) {
      return;
    }
    event.preventDefault();
    let shouldClose = !isDirty;
    if (!shouldClose) {
      try {
        shouldClose = await confirm("You have unsaved changes. Quit?", {
          title: "Ease MD",
          kind: "warning"
        });
      } catch (error) {
        console.error("close confirm failed", error);
        shouldClose = true;
      }
    }
    if (shouldClose) {
      allowClose = true;
      await appWindow.close();
      setTimeout(() => {
        allowClose = false;
      }, 500);
    }
  });

  await appWindow.onDragDropEvent(async (event) => {
    if (event.payload.type === "drop" && event.payload.paths.length > 0) {
      if (!(await maybeConfirmLoseChanges())) {
        return;
      }
      await handleDroppedFile(event.payload.paths[0]);
    }
  });

  await listen<string>("menu:action", async (event) => {
    const action = event.payload;
    switch (action) {
      case "file_new":
        await newFileWithPrompt();
        break;
      case "file_open":
        await openFile();
        break;
      case "file_open_folder": {
        const result = await open({ directory: true, multiple: false });
        if (result && !Array.isArray(result)) {
          setFolder(result);
        }
        break;
      }
      case "file_save":
        await saveFile();
        break;
      case "file_save_as":
        await saveFileAs();
        break;
      case "view_toggle_preview":
        toggleSourceMode();
        break;
      case "view_toggle_theme":
        toggleTheme();
        break;
      default:
        break;
    }
  });

  await listen<string>("menu:open-recent", async (event) => {
    if (event.payload) {
      await openPath(event.payload);
    }
  });

  window.addEventListener("paste", async (event) => {
    const items = event.clipboardData?.items;
    if (!items) {
      return;
    }
    for (const item of items) {
      if (!item.type.startsWith("image/")) {
        continue;
      }
      const file = item.getAsFile();
      if (!file) {
        continue;
      }
      const buffer = await file.arrayBuffer();
      const extension = file.type.split("/")[1] ?? "png";
      await insertImageBytes(new Uint8Array(buffer), extension);
      event.preventDefault();
      break;
    }
  });
}

function initEditor() {
  editor = new Editor({
    element: editorHost,
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false, autolink: true, linkOnPaste: true }),
      ImageWithMarkdown,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell
    ],
    content: "<h1>Welcome to Ease MD</h1><p>Start writing in Markdown.</p>",
    onUpdate: () => {
      isDirty = true;
      setDirtyFlag();
      updateWordCount();
      scheduleDraftSave();
      scheduleOutline();
      highlightOutlineByScroll();
    }
  });
}

toggleSourceBtn.addEventListener("click", () => {
  toggleSourceMode();
});

themeBtn.addEventListener("click", () => {
  toggleTheme();
});

filesTab.addEventListener("click", () => setSidebarTab("files"));
outlineTab.addEventListener("click", () => setSidebarTab("outline"));


sidebarResizer.addEventListener("mousedown", (event) => {
  event.preventDefault();
  const guide = getResizeGuide();
  const layoutRect = sidebarResizer.parentElement?.getBoundingClientRect();
  const startX = event.clientX;
  const startWidth =
    layoutRect?.left != null
      ? startX - layoutRect.left
      : sidebarResizer.getBoundingClientRect().left;
  const start = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, startWidth));

  guide.style.left = `${event.clientX}px`;
  guide.style.display = "block";

  function onMove(moveEvent: MouseEvent) {
    const delta = moveEvent.clientX - startX;
    const next = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, start + delta));
    guide.style.left = `${next}px`;
  }

  function onUp(upEvent: MouseEvent) {
    const delta = upEvent.clientX - startX;
    const next = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, start + delta));
    applySidebarWidth(next);
    guide.style.display = "none";
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
  }

  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
});

sourceEditor.addEventListener("input", () => {
  if (!isSourceMode) {
    return;
  }
  isDirty = true;
  setDirtyFlag();
  updateWordCount();
  scheduleDraftSave();
  scheduleOutline();
});

sourceEditor.addEventListener("scroll", () => hideImageMeta());

editorHost.addEventListener("contextmenu", (event) => {
  event.preventDefault();
  openContextMenu(event.clientX, event.clientY);
});

contextMenu.addEventListener("click", async (event) => {
  const target = event.target as HTMLElement | null;
  const action = target?.dataset?.action;
  if (!action) {
    return;
  }
  closeContextMenu();
  await handleContextAction(action);
});

  window.addEventListener("click", () => closeContextMenu());
  window.addEventListener("blur", () => closeContextMenu());
  editorHost.addEventListener("scroll", () => hideImageMeta());
  editorHost.addEventListener("scroll", () => highlightOutlineByScroll());

function shouldHandleShortcut(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null;
  if (!target) {
    return true;
  }
  if (target === sourceEditor) {
    return true;
  }
  if (target.closest("input, textarea, select, button")) {
    return false;
  }
  return target.closest("#editor") !== null || editor?.isFocused === true;
}

function handleShortcut(event: KeyboardEvent) {
  if (!editor || !shouldHandleShortcut(event)) {
    return;
  }
  if (isSourceMode) {
    return;
  }
  const isMod = event.ctrlKey || event.metaKey;
  if (!isMod) {
    return;
  }
  const key = event.key.toLowerCase();
  const shift = event.shiftKey;

  switch (key) {
    case "b":
      event.preventDefault();
      editor.chain().focus().toggleBold().run();
      return;
    case "i":
      event.preventDefault();
      editor.chain().focus().toggleItalic().run();
      return;
    case "k":
      event.preventDefault();
      if (shift) {
        editor.chain().focus().toggleCodeBlock().run();
      } else {
        const url = window.prompt("Link URL");
        if (url) {
          editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
        }
      }
      return;
    case "q":
      if (shift) {
        event.preventDefault();
        editor.chain().focus().toggleBlockquote().run();
      }
      return;
    case "l":
      if (shift) {
        event.preventDefault();
        editor.chain().focus().toggleBulletList().run();
      }
      return;
    case "o":
      if (shift) {
        event.preventDefault();
        editor.chain().focus().toggleOrderedList().run();
      }
      return;
    case "t":
      if (shift) {
        event.preventDefault();
        editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
      }
      return;
    case "h":
      if (shift) {
        event.preventDefault();
        editor.chain().focus().setHorizontalRule().run();
      }
      return;
    case "1":
    case "2":
    case "3":
    case "4":
    case "5":
    case "6":
      event.preventDefault();
      editor.chain().focus().toggleHeading({ level: Number(key) }).run();
      return;
    default:
      break;
  }
}

window.addEventListener("keydown", (event) => {
  if (!editor) {
    return;
  }
  const isMod = event.ctrlKey || event.metaKey;
  if (!isMod) {
    return;
  }
  const key = event.key.toLowerCase();
  if (key === "s") {
    event.preventDefault();
    if (event.shiftKey) {
      void saveFileAs();
    } else {
      void saveFile();
    }
    return;
  }
  if (key === "o") {
    event.preventDefault();
    void openFile();
    return;
  }
  if (key === "n") {
    event.preventDefault();
    void newFileWithPrompt();
    return;
  }
  if (key === "p") {
    event.preventDefault();
    toggleSourceMode();
    return;
  }
  if (key === "t" && event.shiftKey) {
    handleShortcut(event);
    return;
  }
  handleShortcut(event);
});

function initApp() {
  setStatus("JS loaded");
  initEditor();
  initSidebarWidth();
  renderRecent();
  syncRecentMenu(loadRecent());
  updateOutline();
  updateWordCount();
  setDirtyFlag();
  initTheme();
  void setupWindowHandlers();
}

try {
  initApp();
} catch (error) {
  console.error(error);
  setStatus("Init failed");
}



