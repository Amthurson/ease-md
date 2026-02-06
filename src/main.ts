import "./style.css";

import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import { TextSelection } from "@tiptap/pm/state";
import { common, createLowlight } from "lowlight";
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
  readDir,
  remove,
  rename
} from "@tauri-apps/plugin-fs";
import { dirname, join, extname, pictureDir } from "@tauri-apps/api/path";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { emitTo, listen } from "@tauri-apps/api/event";
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
const editorPaneEl = document.querySelector<HTMLElement>(".editor-pane")!;
const sidebarToggleBtn = document.querySelector<HTMLButtonElement>("#sidebarToggleBtn")!;
const appWindow = getCurrentWindow();

const SIDEBAR_WIDTH_KEY = "ease-md:sidebar-width";
const SIDEBAR_COLLAPSED_KEY = "ease-md:sidebar-collapsed";
const SIDEBAR_MIN = 200;
const SIDEBAR_MAX = 420;
let resizeGuide: HTMLDivElement | null = null;
const lowlight = createLowlight(common);
const CODE_LANGUAGES = ["plaintext", ...lowlight.listLanguages().sort()];

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  breaks: true
});
md.set({
  highlight: (code, lang) => {
    if (lang && hljs.getLanguage(lang)) {
      return `<pre class="hljs"><code class="language-${lang}">${hljs.highlight(code, { language: lang }).value}</code></pre>`;
    }
    return `<pre class="hljs"><code class="language-plaintext">${md.utils.escapeHtml(code)}</code></pre>`;
  }
});
const turndown = new TurndownService({ codeBlockStyle: "fenced" });
turndown.addRule("codeBlockWithLanguage", {
  filter: (node) =>
    node.nodeName === "PRE" &&
    node.firstChild?.nodeName === "CODE",
  replacement: (_content, node) => {
    const code = node.firstChild as HTMLElement | null;
    const text = code?.textContent ?? "";
    const className = code?.getAttribute("class") ?? "";
    const langMatch =
      className.match(/language-([a-z0-9_+-]+)/i) ??
      className.match(/lang(?:uage)?-([a-z0-9_+-]+)/i);
    const lang = langMatch?.[1]?.toLowerCase() ?? "";
    const fence = `\`\`\`${lang}`;
    return `\n\n${fence}\n${text.replace(/\n$/, "")}\n\`\`\`\n\n`;
  }
});
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

function preserveLeadingWhitespace(html: string) {
  const container = document.createElement("div");
  container.innerHTML = html;
  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        const parent = node.parentElement;
        if (!parent) {
          return NodeFilter.FILTER_REJECT;
        }
        if (parent.closest("pre, code")) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );
  const nodes: Text[] = [];
  while (walker.nextNode()) {
    nodes.push(walker.currentNode as Text);
  }
  nodes.forEach((textNode) => {
    const value = textNode.nodeValue ?? "";
    if (!value) {
      return;
    }
    const withTabs = value.replace(/\t/g, "  ");
    const lines = withTabs.split(/\r?\n/);
    const rebuilt = lines
      .map((line) => line.replace(/^[ ]+/g, (match) => "\u00a0".repeat(match.length)))
      .join("\n");
    if (rebuilt !== value) {
      textNode.nodeValue = rebuilt;
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
let hoverTimer: number | null = null;
let hoverTooltip: HTMLDivElement | null = null;
let codeLanguagePickerEl: HTMLDivElement | null = null;
let codeLanguageListEl: HTMLUListElement | null = null;
let codeLanguageInputEl: HTMLInputElement | null = null;
let isCodeLanguageInteracting = false;
let currentContext:
  | { type: "text" }
  | { type: "image"; imagePath?: string; imageRaw?: string; imagePos?: number }
  | { type: "tree"; targetPath: string; isFile: boolean } = { type: "text" };
let filesViewMode: "tree" | "list" = "tree";
let createdDirs = new Set<string>();

function normalizeFsPath(pathValue: string) {
  return pathValue.replace(/\\/g, "/").toLowerCase();
}

function ensureHoverTooltip() {
  if (hoverTooltip) {
    return hoverTooltip;
  }
  const el = document.createElement("div");
  el.className = "hover-tooltip hidden";
  document.body.appendChild(el);
  hoverTooltip = el;
  return el;
}

function hideHoverTooltip() {
  if (hoverTimer) {
    window.clearTimeout(hoverTimer);
    hoverTimer = null;
  }
  if (hoverTooltip) {
    hoverTooltip.classList.add("hidden");
  }
}

function scheduleHoverTooltip(target: HTMLElement, text: string) {
  hideHoverTooltip();
  hoverTimer = window.setTimeout(() => {
    const tooltip = ensureHoverTooltip();
    const rect = target.getBoundingClientRect();
    tooltip.textContent = text;
    tooltip.style.left = `${Math.min(rect.left, window.innerWidth - 360)}px`;
    tooltip.style.top = `${rect.bottom + 8}px`;
    tooltip.classList.remove("hidden");
    hoverTimer = null;
  }, 3000);
}

function normalizeCodeLanguage(value: unknown) {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!raw) {
    return "plaintext";
  }
  return CODE_LANGUAGES.includes(raw) ? raw : "plaintext";
}

function ensureCodeLanguagePicker() {
  if (codeLanguagePickerEl && codeLanguageListEl && codeLanguageInputEl) {
    return {
      wrapper: codeLanguagePickerEl,
      list: codeLanguageListEl,
      input: codeLanguageInputEl
    };
  }

  const wrapper = document.createElement("div");
  wrapper.className = "code-language-picker hidden";
  wrapper.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
    isCodeLanguageInteracting = true;
  });
  wrapper.addEventListener("pointerup", () => {
    isCodeLanguageInteracting = false;
  });
  wrapper.addEventListener("pointerleave", () => {
    isCodeLanguageInteracting = false;
  });

  const label = document.createElement("span");
  label.className = "code-language-label";
  label.textContent = "Language";

  const input = document.createElement("input");
  input.className = "code-language-input";
  input.type = "text";
  input.placeholder = "Select language";
  input.autocomplete = "off";

  const list = document.createElement("ul");
  list.className = "code-language-list";

  const refreshOptions = (query = "") => {
    const normalized = query.trim().toLowerCase();
    list.innerHTML = "";
    CODE_LANGUAGES.filter((lang) =>
      normalized ? lang.includes(normalized) : true
    ).forEach((language) => {
      const option = document.createElement("li");
      option.className = "code-language-option";
      option.textContent = language;
      option.dataset.value = language;
      list.appendChild(option);
    });
  };
  refreshOptions();

  input.addEventListener("input", () => {
    refreshOptions(input.value);
    wrapper.classList.add("open");
  });

  input.addEventListener("focus", () => {
    refreshOptions(input.value);
    wrapper.classList.add("open");
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      const first = list.querySelector<HTMLLIElement>(".code-language-option");
      if (first?.dataset?.value) {
        applyCodeLanguage(first.dataset.value);
        wrapper.classList.remove("open");
      }
    }
  });

  list.addEventListener("mousedown", (event) => {
    event.preventDefault();
  });

  list.addEventListener("click", (event) => {
    const target = event.target as HTMLElement | null;
    const value = target?.dataset?.value;
    if (!value) {
      return;
    }
    applyCodeLanguage(value);
    wrapper.classList.remove("open");
  });

  wrapper.appendChild(label);
  wrapper.appendChild(input);
  wrapper.appendChild(list);
  document.body.appendChild(wrapper);

  codeLanguagePickerEl = wrapper;
  codeLanguageListEl = list;
  codeLanguageInputEl = input;
  return { wrapper, list, input };
}

function hideCodeLanguagePicker() {
  if (!codeLanguagePickerEl) {
    return;
  }
  if (isCodeLanguageInteracting) {
    return;
  }
  codeLanguagePickerEl.classList.add("hidden");
}

function applyCodeLanguage(value: string) {
  if (!editor || isSourceMode) {
    return;
  }
  const language = normalizeCodeLanguage(value);
  editor
    .chain()
    .focus()
    .updateAttributes("codeBlock", {
      language: language === "plaintext" ? null : language
    })
    .run();
  if (codeLanguageInputEl) {
    codeLanguageInputEl.value = language;
  }
}

function getActiveCodeBlockPos() {
  if (!editor) {
    return null;
  }
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth >= 0; depth -= 1) {
    const node = $from.node(depth);
    if (node.type.name === "codeBlock") {
      return { pos: $from.before(depth), language: normalizeCodeLanguage(node.attrs.language) };
    }
  }
  return null;
}

function updateCodeLanguagePicker() {
  if (!editor || isSourceMode) {
    hideCodeLanguagePicker();
    return;
  }
  const active = getActiveCodeBlockPos();
  if (!active) {
    hideCodeLanguagePicker();
    return;
  }

  const codeDom = editor.view.nodeDOM(active.pos) as HTMLElement | null;
  if (!codeDom || !codeDom.getBoundingClientRect) {
    hideCodeLanguagePicker();
    return;
  }

  const blockRect = codeDom.getBoundingClientRect();
  const { wrapper, input } = ensureCodeLanguagePicker();
  const isEditing = document.activeElement === input;
  if (!isEditing && input.value !== active.language) {
    input.value = active.language;
  }
  if (!isEditing) {
    wrapper.classList.remove("open");
  }

  wrapper.classList.remove("hidden");
  const top = blockRect.bottom + 8;
  const pickerWidth = wrapper.offsetWidth || 150;
  const leftRaw = blockRect.right - pickerWidth;
  const left = Math.max(8, Math.min(leftRaw, window.innerWidth - pickerWidth - 8));
  wrapper.style.top = `${Math.max(8, Math.min(top, window.innerHeight - 40))}px`;
  wrapper.style.left = `${left}px`;
  wrapper.style.right = "auto";
  wrapper.classList.remove("hidden");
  if (codeLanguageListEl) {
    codeLanguageListEl.style.minWidth = `${input.offsetWidth}px`;
  }
}

function setStatus(message: string) {
  statusMsgEl.textContent = message;
}

function openInNewWindow(path: string) {
  const label = `viewer-${Date.now()}`;
  const encoded = encodeURIComponent(path);
  const win = new WebviewWindow(label, {
    url: `tauri://localhost/index.html?open=${encoded}`,
    title: "Ease MD",
    width: 960,
    height: 640
  });
  win.once("tauri://error", (event) => {
    console.error("new window error", event);
    setStatus("Failed to open new window");
  });
}

function setDirtyFlag() {
  dirtyFlagEl.textContent = isDirty ? "Unsaved" : "Saved";
  dirtyFlagEl.style.color = isDirty ? "var(--accent-strong)" : "var(--muted)";
}

function setFilePath(path: string | null) {
  currentPath = path;
  const label = path ? path.split(/[/\\]/).pop() ?? path : "Untitled";
  filePathEl.textContent = path ?? "Untitled";
  const title = path ? `${label} - Ease MD` : "Untitled - Ease MD";
  document.title = title;
  try {
    void appWindow.setTitle(title);
  } catch {
    // ignore if unavailable
  }
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
  depth?: number;
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
      if (children.length > 0 || createdDirs.has(entryPath)) {
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

async function scanMarkdownFiles(basePath: string): Promise<TreeNode[]> {
  const entries = await readDir(basePath, { recursive: true });
  const nodes: TreeNode[] = [];
  const walk = (items: any[], base: string) => {
    items.forEach((entry) => {
      const rawPath = toPathString(entry?.path, "");
      const name = entry?.name ?? normalizeName(rawPath || base);
      const fallbackPath = rawPath || `${base.replace(/[/\\]+$/, "")}/${name}`;
      const entryPath = toPathString(entry?.path, fallbackPath);
      const isDir = entry?.isDirectory === true || Array.isArray(entry?.children);
      if (isDir) {
        if (entry?.children) {
          walk(entry.children, entryPath);
        }
        return;
      }
      if (!isMarkdownFile(name)) {
        return;
      }
      nodes.push({
        name,
        path: entryPath,
        isFile: true,
        children: []
      });
    });
  };
  walk(entries, basePath);
  return nodes.sort((a, b) => a.name.localeCompare(b.name));
}

function renderTree(
  nodes: TreeNode[],
  container: HTMLElement,
  depth = 0,
  rootPath: string | null = null
) {
  const isRootLevel = depth === 0;
  const isSecondLevelOrDeeper = depth >= 2;
  const list = document.createElement("ul");
  list.className = "folder-tree";
  if (isSecondLevelOrDeeper) {
    list.classList.add("collapsed");
  }
  nodes.forEach((node) => {
    const item = document.createElement("li");
    const row = document.createElement("div");
    row.className = `node ${node.isFile ? "file" : "folder"}`;
    if (!node.isFile) {
      row.classList.add("collapsible");
      row.dataset.state = isSecondLevelOrDeeper ? "closed" : "open";
    }
    if (currentPath && node.isFile && node.path === currentPath) {
      row.classList.add("active");
    }
    row.dataset.path = node.path;
    const label = document.createElement("span");
    label.className = "label";
    label.textContent = node.name;
    row.appendChild(label);
    row.addEventListener("mouseenter", () => {
      if (!node.isFile) {
        return;
      }
      if (label.scrollWidth <= label.clientWidth) {
        return;
      }
      scheduleHoverTooltip(label, node.name);
    });
    row.addEventListener("mouseleave", () => {
      hideHoverTooltip();
    });
    row.addEventListener("click", (event) => {
      event.stopPropagation();
      hideHoverTooltip();
      const target = event.currentTarget as HTMLElement;
      const filePath = target.dataset.path ?? "";
      if (!node.isFile) {
        const nested = item.querySelector(":scope > ul.folder-tree") as HTMLElement | null;
        if (nested) {
          const isOpen = !nested.classList.contains("collapsed");
          nested.classList.toggle("collapsed", isOpen);
          row.dataset.state = isOpen ? "closed" : "open";
        }
        return;
      }
      if (filePath) {
        void openPath(filePath, { updateFolder: false });
      }
    });
    item.appendChild(row);
    if (node.children.length > 0) {
      renderTree(node.children, item, depth + 1, rootPath ?? null);
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

function scrollTreeToPath(path: string | null) {
  if (!path) {
    return;
  }
  const escaped = typeof (window as any).CSS?.escape === "function"
    ? (window as any).CSS.escape(path)
    : path.replace(/"/g, '\\"');
  const target = folderListEl.querySelector(
    `.folder-tree .node[data-path="${escaped}"]`
  ) as HTMLElement | null;
  if (target) {
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
    if (filesViewMode === "list") {
      const files = await scanMarkdownFiles(currentFolder);
      if (files.length === 0) {
        const empty = document.createElement("li");
        empty.textContent = "No markdown files.";
        empty.style.opacity = "0.6";
        folderListEl.appendChild(empty);
        return;
      }
      renderTree(files, folderListEl, 1, currentFolder);
      return;
    }

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
    renderTree([rootNode], folderListEl, 0, currentFolder);
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
  const normalized = markdown.replace(/\t/g, "  ");
  const html = preserveLeadingWhitespace(decorateImages(md.render(normalized)));
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
    const text = document.createElement("span");
    text.className = "outline-text";
    text.textContent = heading.text;
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
    if (!Array.isArray(parsed)) {
      return [];
    }
    return Array.from(new Set(parsed));
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

async function maybeSaveBeforeLeave(): Promise<boolean> {
  if (!isDirty) {
    return true;
  }
  let shouldSave = false;
  try {
    shouldSave = await confirm("Current document has unsaved changes. Save before leaving?", {
      title: "Ease MD",
      kind: "warning"
    });
  } catch (error) {
    console.error("dialog confirm failed, fallback to browser confirm", error);
    shouldSave = window.confirm("Current document has unsaved changes. Save before leaving?");
  }
  if (!shouldSave) {
    return true;
  }
  return saveFile();
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
  updateCodeLanguagePicker();
}

async function openPath(
  path: string,
  options: { updateFolder?: boolean; checkDirty?: boolean } = {}
) {
  const updateFolder = options.updateFolder ?? false;
  const checkDirty = options.checkDirty ?? true;
  try {
    if (checkDirty && !(await maybeSaveBeforeLeave())) {
      return;
    }
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
  const result = await open({
    multiple: false,
    filters: [{ name: "Markdown", extensions: ["md", "markdown", "mdx"] }]
  });
  if (!result || Array.isArray(result)) {
    return;
  }
  await openPath(result, { updateFolder: true });
}

async function saveFile(): Promise<boolean> {
  if (!currentPath) {
    return saveFileAs();
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
    return true;
  } catch (error) {
    console.error(error);
    setStatus("Failed to save");
    return false;
  }
}

async function saveFileAs(): Promise<boolean> {
  const path = await save({
    filters: [{ name: "Markdown", extensions: ["md", "markdown", "mdx"] }]
  });
  if (!path) {
    return false;
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
    return true;
  } catch (error) {
    console.error(error);
    setStatus("Failed to save");
    return false;
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
  if (!(await maybeSaveBeforeLeave())) {
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
    hideCodeLanguagePicker();
    sourceEditor.value = getMarkdown();
    sourceEditor.focus();
  } else {
    setMarkdown(sourceEditor.value);
    editor?.commands.focus();
    updateCodeLanguagePicker();
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

function setSidebarCollapsed(collapsed: boolean) {
  document.body.classList.toggle("sidebar-collapsed", collapsed);
  localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0");
  if (sidebarToggleBtn) {
    sidebarToggleBtn.textContent = collapsed ? "⟩" : "⟨";
    sidebarToggleBtn.title = collapsed ? "Expand sidebar" : "Collapse sidebar";
  }
}

function toggleSidebarCollapsed() {
  const collapsed = document.body.classList.contains("sidebar-collapsed");
  setSidebarCollapsed(!collapsed);
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
  contextMenu.classList.remove("hidden");
  const rect = contextMenu.getBoundingClientRect();
  const maxX = window.innerWidth - rect.width - 8;
  const maxY = window.innerHeight - rect.height - 8;
  const nextX = Math.max(8, Math.min(x, maxX));
  const nextY = Math.max(8, Math.min(y, maxY));
  contextMenu.style.left = `${nextX}px`;
  contextMenu.style.top = `${nextY}px`;
}

function closeContextMenu() {
  contextMenu.classList.add("hidden");
  contextMenu.style.left = "-9999px";
  contextMenu.style.top = "-9999px";
}

function getImageContext(target: HTMLElement | null) {
  if (!editor || !target) {
    return null;
  }
  const img = target.closest(".image-node img") as HTMLImageElement | null;
  if (!img) {
    return null;
  }
  const pos = editor.view.posAtDOM(img, 0);
  const resolved = editor.state.doc.resolve(pos);
  let node = resolved.nodeAfter;
  let nodePos = resolved.pos;
  if (!node || node.type.name !== "image") {
    node = resolved.nodeBefore;
    nodePos = resolved.pos - (node?.nodeSize ?? 0);
  }
  if (!node || node.type.name !== "image") {
    return null;
  }
  const raw = (node.attrs.original ?? node.attrs.src ?? "") as string;
  return {
    pos: nodePos,
    raw,
    path: raw ? resolveImageFilePath(raw) : null
  };
}

function resolveImageFilePath(raw: string) {
  const normalized = raw.replace(/\\/g, "/");
  if (!normalized || /^(https?:|data:|blob:)/i.test(normalized)) {
    return null;
  }
  if (/^tauri:\/\//i.test(normalized) || /^asset:\/\//i.test(normalized)) {
    return null;
  }
  if (/^[a-zA-Z]:\//.test(normalized) || normalized.startsWith("/")) {
    return normalized;
  }
  if (!currentPath) {
    return null;
  }
  return join(dirname(currentPath), normalized);
}

function renderContextMenu(items: { label?: string; action?: string; separator?: boolean }[]) {
  contextMenu.innerHTML = "";
  items.forEach((item) => {
    if (item.separator) {
      const sep = document.createElement("div");
      sep.className = "menu-separator";
      contextMenu.appendChild(sep);
      return;
    }
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = item.label ?? "";
    if (item.action) {
      button.dataset.action = item.action;
    }
    contextMenu.appendChild(button);
  });
}

function buildContextMenuItems() {
  if (currentContext.type === "image") {
    return [
      { label: "Copy Image Markdown", action: "image_copy_markdown" },
      { label: "Copy Image Path", action: "image_copy_path" },
      { label: "Delete Image File", action: "image_delete" },
      { separator: true },
      { label: "Heading 1", action: "heading1" },
      { label: "Heading 2", action: "heading2" },
      { label: "Heading 3", action: "heading3" },
      { label: "Bold", action: "bold" },
      { label: "Italic", action: "italic" },
      { label: "Quote", action: "blockquote" },
      { label: "Code Block", action: "codeblock" },
      { label: "Table", action: "table" },
      { label: "Divider", action: "hr" },
      { label: "Bullet List", action: "bullet" },
      { label: "Ordered List", action: "ordered" },
      { label: "Link", action: "link" },
      { label: "Image", action: "image" }
    ];
  }
  if (currentContext.type === "tree") {
    const isFile = currentContext.isFile;
    const listLabel = `${filesViewMode === "list" ? "✓ " : ""}Document List`;
    const treeLabel = `${filesViewMode === "tree" ? "✓ " : ""}Document Tree`;
    return [
      ...(isFile
        ? [
            { label: "Open", action: "tree_open" },
            { label: "Open in New Window", action: "tree_open_new" },
            { separator: true }
          ]
        : []),
      { label: "New File", action: "tree_new_file" },
      { label: "New Folder", action: "tree_new_folder" },
      { separator: true },
      { label: "Search", action: "tree_search" },
      { separator: true },
      { label: listLabel, action: "tree_view_list" },
      { label: treeLabel, action: "tree_view_tree" },
      { separator: true },
      { label: "Rename", action: "tree_rename" },
      { label: "Delete", action: "tree_delete" },
      { separator: true },
      { label: "Properties", action: "tree_props" },
      { label: "Copy Path", action: "tree_copy_path" },
      { label: "Open File Location", action: "tree_open_location" }
    ];
  }
  return [
    { label: "Heading 1", action: "heading1" },
    { label: "Heading 2", action: "heading2" },
    { label: "Heading 3", action: "heading3" },
    { label: "Bold", action: "bold" },
    { label: "Italic", action: "italic" },
    { label: "Quote", action: "blockquote" },
    { label: "Code Block", action: "codeblock" },
    { label: "Table", action: "table" },
    { label: "Divider", action: "hr" },
    { label: "Bullet List", action: "bullet" },
    { label: "Ordered List", action: "ordered" },
    { label: "Link", action: "link" },
    { label: "Image", action: "image" }
  ];
}

async function handleContextAction(action: string) {
  if (!editor) {
    return;
  }
  const chain = editor.chain().focus();
  switch (action) {
    case "image_copy_markdown": {
      if (!currentContext.imageRaw) {
        break;
      }
      const markdown = formatImageMarkdown(currentContext.imageRaw, "");
      await navigator.clipboard.writeText(markdown);
      setStatus("Image markdown copied");
      break;
    }
    case "image_copy_path": {
      if (!currentContext.imageRaw) {
        break;
      }
      await navigator.clipboard.writeText(currentContext.imageRaw);
      setStatus("Image path copied");
      break;
    }
    case "image_delete": {
      if (!currentContext.imagePos) {
        break;
      }
      const confirmed = window.confirm("Delete image file?");
      if (!confirmed) {
        break;
      }
      try {
        if (currentContext.imagePath) {
          await remove(currentContext.imagePath);
        }
        const pos = currentContext.imagePos;
        editor.commands.setNodeSelection(pos);
        editor.commands.deleteSelection();
        setStatus("Image deleted");
      } catch (error) {
        console.error(error);
        setStatus("Failed to delete image");
      }
      break;
    }
    case "tree_open": {
      if (currentContext.type === "tree" && currentContext.isFile) {
        await openPath(currentContext.targetPath, { updateFolder: false });
      }
      break;
    }
    case "tree_open_new": {
      if (currentContext.type === "tree" && currentContext.isFile) {
        openInNewWindow(currentContext.targetPath);
      }
      break;
    }
    case "tree_new_file": {
      if (currentContext.type !== "tree") {
        break;
      }
      const baseDir = currentContext.isFile
        ? await dirname(currentContext.targetPath)
        : currentContext.targetPath;
      const name = window.prompt("New file name");
      if (!name) {
        break;
      }
      const newPath = await join(baseDir, name.endsWith(".md") ? name : `${name}.md`);
      await writeTextFile(newPath, "");
      await refreshFolderFiles();
      scrollTreeToPath(newPath);
      break;
    }
    case "tree_new_folder": {
      if (currentContext.type !== "tree") {
        break;
      }
      const baseDir = currentContext.isFile
        ? await dirname(currentContext.targetPath)
        : currentContext.targetPath;
      const name = window.prompt("New folder name");
      if (!name) {
        break;
      }
      const newPath = await join(baseDir, name);
      await mkdir(newPath, { recursive: true });
      createdDirs.add(newPath);
      await refreshFolderFiles();
      scrollTreeToPath(newPath);
      break;
    }
    case "tree_search": {
      setStatus("Search is not available yet.");
      break;
    }
    case "tree_view_list": {
      filesViewMode = "list";
      await refreshFolderFiles();
      break;
    }
    case "tree_view_tree": {
      filesViewMode = "tree";
      await refreshFolderFiles();
      break;
    }
    case "tree_rename": {
      if (currentContext.type !== "tree") {
        break;
      }
      const name = window.prompt("Rename to", normalizeName(currentContext.targetPath));
      if (!name) {
        break;
      }
      const parent = await dirname(currentContext.targetPath);
      const nextPath = await join(parent, name);
      await rename(currentContext.targetPath, nextPath);
      if (!currentContext.isFile) {
        if (createdDirs.delete(currentContext.targetPath)) {
          createdDirs.add(nextPath);
        }
      }
      await refreshFolderFiles();
      break;
    }
    case "tree_delete": {
      if (currentContext.type !== "tree") {
        break;
      }
      const confirmed = window.confirm("Delete this item?");
      if (!confirmed) {
        break;
      }
      await remove(currentContext.targetPath, { recursive: !currentContext.isFile });
      if (!currentContext.isFile) {
        createdDirs.delete(currentContext.targetPath);
      }
      await refreshFolderFiles();
      break;
    }
    case "tree_props": {
      setStatus("Properties are not available yet.");
      break;
    }
    case "tree_copy_path": {
      if (currentContext.type === "tree") {
        await navigator.clipboard.writeText(currentContext.targetPath);
        setStatus("Path copied");
      }
      break;
    }
    case "tree_open_location": {
      if (currentContext.type === "tree") {
        try {
          const path = currentContext.targetPath.replace(/\//g, "\\");
          await invoke("reveal_in_folder", { path });
        } catch (error) {
          console.error(error);
          setStatus("Failed to open location");
        }
      }
      break;
    }
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
      updateCodeLanguagePicker();
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

  await listen<string>("open-path", async (event) => {
    if (event.payload) {
      await openPath(event.payload, { updateFolder: false, checkDirty: false });
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
      StarterKit.configure({ codeBlock: false }),
      CodeBlockLowlight.configure({ lowlight }),
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
      updateCodeLanguagePicker();
    },
    onSelectionUpdate: () => {
      updateCodeLanguagePicker();
    },
    onFocus: () => {
      updateCodeLanguagePicker();
    },
    onBlur: () => {
      if (!isCodeLanguageInteracting) {
        updateCodeLanguagePicker();
      }
    }
  });
}

toggleSourceBtn.addEventListener("click", () => {
  toggleSourceMode();
});

themeBtn.addEventListener("click", () => {
  toggleTheme();
});

sidebarToggleBtn.addEventListener("click", () => {
  toggleSidebarCollapsed();
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
folderListEl.addEventListener("scroll", () => hideHoverTooltip());
window.addEventListener("blur", () => hideHoverTooltip());

editorHost.addEventListener("contextmenu", (event) => {
  event.preventDefault();
  const imageContext = getImageContext(event.target as HTMLElement | null);
  if (imageContext) {
    currentContext = {
      type: "image",
      imagePath: imageContext.path ?? undefined,
      imageRaw: imageContext.raw ?? undefined,
      imagePos: imageContext.pos ?? undefined
    };
    if (typeof imageContext.pos === "number") {
      editor?.commands.setNodeSelection(imageContext.pos);
    }
  } else {
    currentContext = { type: "text" };
  }
  renderContextMenu(buildContextMenuItems());
  openContextMenu(event.clientX, event.clientY);
});

folderListEl.addEventListener("contextmenu", (event) => {
  event.preventDefault();
  const target = event.target as HTMLElement | null;
  const row = target?.closest(".node") as HTMLElement | null;
  if (row?.dataset?.path) {
    currentContext = {
      type: "tree",
      targetPath: row.dataset.path,
      isFile: row.classList.contains("file")
    };
  } else if (currentFolder) {
    currentContext = {
      type: "tree",
      targetPath: currentFolder,
      isFile: false
    };
  } else {
    return;
  }
  renderContextMenu(buildContextMenuItems());
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

  document.addEventListener("pointerdown", (event) => {
    const target = event.target as HTMLElement | null;
    if (target && contextMenu.contains(target)) {
      return;
    }
    closeContextMenu();
  });
  window.addEventListener(
    "scroll",
    (event) => {
      const target = event.target as HTMLElement | null;
      if (target && contextMenu.contains(target)) {
        return;
      }
      closeContextMenu();
    },
    true
  );
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeContextMenu();
    }
  });
  window.addEventListener("blur", () => closeContextMenu());
  editorHost.addEventListener("scroll", () => {
    hideImageMeta();
    highlightOutlineByScroll();
    updateCodeLanguagePicker();
  });
  window.addEventListener("resize", () => updateCodeLanguagePicker());
  window.addEventListener("click", (event) => {
    if (!codeLanguagePickerEl) {
      return;
    }
    const target = event.target as HTMLElement | null;
    if (target && codeLanguagePickerEl.contains(target)) {
      return;
    }
    codeLanguagePickerEl.classList.remove("open");
    updateCodeLanguagePicker();
  });

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
        updateCodeLanguagePicker();
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
  setSidebarCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1");
  createdDirs = new Set<string>();
  renderRecent();
  syncRecentMenu(loadRecent());
  updateOutline();
  updateWordCount();
  setDirtyFlag();
  initTheme();
  try {
    const url = new URL(window.location.href);
    const openPathParam = url.searchParams.get("open");
    if (openPathParam) {
      const decoded = decodeURIComponent(openPathParam);
      void openPath(decoded, { updateFolder: false, checkDirty: false });
      url.searchParams.delete("open");
      window.history.replaceState({}, "", url.toString());
    }
  } catch {}
  void setupWindowHandlers();
}

try {
  initApp();
} catch (error) {
  console.error(error);
  setStatus("Init failed");
}



