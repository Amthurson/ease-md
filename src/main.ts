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
  readDir,
  remove,
  rename
} from "@tauri-apps/plugin-fs";
import { dirname, join, extname, pictureDir } from "@tauri-apps/api/path";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { emitTo, listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";

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
const prefsModal = document.querySelector<HTMLDivElement>("#prefsModal")!;
const prefsCloseBtn = document.querySelector<HTMLButtonElement>("#prefsCloseBtn")!;
const prefsNavItems = Array.from(
  document.querySelectorAll<HTMLButtonElement>(".prefs-nav-item")
);
const imageInsertRuleEl = document.querySelector<HTMLSelectElement>("#imageInsertRule")!;
const imageRuleLocalEl = document.querySelector<HTMLInputElement>("#imageRuleLocal")!;
const imageRuleNetworkEl = document.querySelector<HTMLInputElement>("#imageRuleNetwork")!;
const imagePreferRelativeEl = document.querySelector<HTMLInputElement>("#imagePreferRelative")!;
const imageYamlAutoUploadEl = document.querySelector<HTMLInputElement>("#imageYamlAutoUpload")!;
const imageAutoConvertUrlEl = document.querySelector<HTMLInputElement>("#imageAutoConvertUrl")!;
const uploadServiceEl = document.querySelector<HTMLSelectElement>("#uploadService")!;
const picgoPathEl = document.querySelector<HTMLInputElement>("#picgoPath")!;
const pickPicgoBtn = document.querySelector<HTMLButtonElement>("#pickPicgoBtn")!;
const validatePicgoBtn = document.querySelector<HTMLButtonElement>("#validatePicgoBtn")!;
const picgoResultModal = document.querySelector<HTMLDivElement>("#picgoResultModal")!;
const picgoResultTitle = document.querySelector<HTMLHeadingElement>("#picgoResultTitle")!;
const picgoResultBody = document.querySelector<HTMLPreElement>("#picgoResultBody")!;
const picgoResultCloseBtn = document.querySelector<HTMLButtonElement>("#picgoResultCloseBtn")!;
const picgoResultOkBtn = document.querySelector<HTMLButtonElement>("#picgoResultOkBtn")!;
const prefsPanels = Array.from(
  document.querySelectorAll<HTMLElement>(".prefs-panel[data-prefs-panel]")
);
const genStartupModeEl = document.querySelector<HTMLSelectElement>("#genStartupMode")!;
const genAutoSaveEl = document.querySelector<HTMLInputElement>("#genAutoSave")!;
const genSaveOnSwitchEl = document.querySelector<HTMLInputElement>("#genSaveOnSwitch")!;
const genRestoreDraftBtn = document.querySelector<HTMLButtonElement>("#genRestoreDraftBtn")!;
const genLanguageEl = document.querySelector<HTMLSelectElement>("#genLanguage")!;
const genCheckUpdateBtn = document.querySelector<HTMLButtonElement>("#genCheckUpdateBtn")!;
const genAutoCheckUpdateEl = document.querySelector<HTMLInputElement>("#genAutoCheckUpdate")!;
const genIncludePrereleaseEl = document.querySelector<HTMLInputElement>("#genIncludePrerelease")!;
const genCustomizeShortcutBtn = document.querySelector<HTMLButtonElement>("#genCustomizeShortcutBtn")!;
const genResetDialogsBtn = document.querySelector<HTMLButtonElement>("#genResetDialogsBtn")!;
const genDebugModeEl = document.querySelector<HTMLInputElement>("#genDebugMode")!;
const genTelemetryEl = document.querySelector<HTMLInputElement>("#genTelemetry")!;
const genOpenAdvancedBtn = document.querySelector<HTMLButtonElement>("#genOpenAdvancedBtn")!;
const genResetAdvancedBtn = document.querySelector<HTMLButtonElement>("#genResetAdvancedBtn")!;
const mdStrictModeEl = document.querySelector<HTMLInputElement>("#mdStrictMode")!;
const mdHeadingStyleEl = document.querySelector<HTMLSelectElement>("#mdHeadingStyle")!;
const mdUnorderedListStyleEl = document.querySelector<HTMLSelectElement>("#mdUnorderedListStyle")!;
const mdOrderedListStyleEl = document.querySelector<HTMLSelectElement>("#mdOrderedListStyle")!;
const mdInlineMathEl = document.querySelector<HTMLInputElement>("#mdInlineMath")!;
const mdSubscriptEl = document.querySelector<HTMLInputElement>("#mdSubscript")!;
const mdSuperscriptEl = document.querySelector<HTMLInputElement>("#mdSuperscript")!;
const mdHighlightEl = document.querySelector<HTMLInputElement>("#mdHighlight")!;
const mdDiagramsEl = document.querySelector<HTMLInputElement>("#mdDiagrams")!;
const mdSmartPunctuationModeEl = document.querySelector<HTMLSelectElement>("#mdSmartPunctuationMode")!;
const mdSmartQuotesEl = document.querySelector<HTMLInputElement>("#mdSmartQuotes")!;
const mdSmartDashesEl = document.querySelector<HTMLInputElement>("#mdSmartDashes")!;
const mdUnicodePunctuationEl = document.querySelector<HTMLInputElement>("#mdUnicodePunctuation")!;
const mdCodeShowLineNumbersEl = document.querySelector<HTMLInputElement>("#mdCodeShowLineNumbers")!;
const mdCodeWrapEl = document.querySelector<HTMLInputElement>("#mdCodeWrap")!;
const mdCodeIndentEl = document.querySelector<HTMLSelectElement>("#mdCodeIndent")!;
const mdMathAutoNumberEl = document.querySelector<HTMLInputElement>("#mdMathAutoNumber")!;
const mdMathAllowBackslashNewlineEl = document.querySelector<HTMLInputElement>("#mdMathAllowBackslashNewline")!;
const mdMathEnablePhysicsEl = document.querySelector<HTMLInputElement>("#mdMathEnablePhysics")!;
const mdMathExportHtmlModeEl = document.querySelector<HTMLSelectElement>("#mdMathExportHtmlMode")!;
const mdFirstLineIndentEl = document.querySelector<HTMLInputElement>("#mdFirstLineIndent")!;
const mdShowBrEl = document.querySelector<HTMLInputElement>("#mdShowBr")!;
const mdEditWhitespacePolicyEl = document.querySelector<HTMLSelectElement>("#mdEditWhitespacePolicy")!;
const mdExportWhitespacePolicyEl = document.querySelector<HTMLSelectElement>("#mdExportWhitespacePolicy")!;
const edDefaultIndentEl = document.querySelector<HTMLSelectElement>("#edDefaultIndent")!;
const edAlignIndentEl = document.querySelector<HTMLInputElement>("#edAlignIndent")!;
const edPairBracketsQuotesEl = document.querySelector<HTMLInputElement>("#edPairBracketsQuotes")!;
const edPairMarkdownSymbolsEl = document.querySelector<HTMLInputElement>("#edPairMarkdownSymbols")!;
const edShowCurrentMarkdownSourceEl = document.querySelector<HTMLInputElement>("#edShowCurrentMarkdownSource")!;
const edCopyPlainAsMarkdownEl = document.querySelector<HTMLInputElement>("#edCopyPlainAsMarkdown")!;
const edCopyCutWholeLineEl = document.querySelector<HTMLInputElement>("#edCopyCutWholeLine")!;
const edNewlineLfEl = document.querySelector<HTMLInputElement>("#edNewlineLf")!;
const edNewlineCrlfEl = document.querySelector<HTMLInputElement>("#edNewlineCrlf")!;
const edSpellcheckModeEl = document.querySelector<HTMLSelectElement>("#edSpellcheckMode")!;
const edTypewriterCenterEl = document.querySelector<HTMLInputElement>("#edTypewriterCenter")!;
const edTypewriterOffBtn = document.querySelector<HTMLButtonElement>("#edTypewriterOffBtn")!;
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

function preferSecureImageUrl(src: string) {
  if (!src) {
    return src;
  }
  if (/^http:\/\//i.test(src)) {
    return src.replace(/^http:\/\//i, "https://");
  }
  return src;
}

function guessImageExtensionFromPath(pathValue: string) {
  const clean = pathValue.split("?")[0].split("#")[0].toLowerCase();
  const match = clean.match(/\.([a-z0-9]+)$/i);
  return getExtensionFromMime(`image/${match?.[1] ?? "png"}`);
}

async function resolveImageForDisplay(rawSrc: string) {
  if (!rawSrc) {
    return rawSrc;
  }
  let normalized = rawSrc.replace(/\\/g, "/");
  if (/^http:\/\//i.test(normalized)) {
    normalized = preferSecureImageUrl(normalized);
  }
  if (/^https?:\/\/asset\.localhost\//i.test(normalized)) {
    try {
      const encoded = normalized.replace(/^https?:\/\/asset\.localhost\//i, "");
      normalized = decodeURIComponent(encoded);
    } catch {
      normalized = normalized.replace(/^https?:\/\/asset\.localhost\//i, "");
    }
  }
  if (/^file:\/\//i.test(normalized)) {
    try {
      normalized = decodeURIComponent(normalized.replace(/^file:\/\//i, ""));
    } catch {
      normalized = normalized.replace(/^file:\/\//i, "");
    }
    normalized = normalized.replace(/^\/([a-z]:\/)/i, "$1");
  }
  normalized = normalized.replace(/\\/g, "/");
  if (/^(https?:|data:|blob:)/i.test(normalized)) {
    return normalized;
  }
  if (/^tauri:\/\//i.test(normalized) || /^asset:\/\//i.test(normalized)) {
    return normalized;
  }
  let absolutePath: string | null = null;
  if (
    /^[a-z]:\//i.test(normalized) ||
    normalized.startsWith("//") ||
    normalized.startsWith("/")
  ) {
    absolutePath = normalized;
  } else if (currentPath) {
    absolutePath = await join(await dirname(currentPath), normalized);
  }
  if (!absolutePath) {
    return normalized;
  }
  try {
    const bytes = await readFile(absolutePath);
    return bytesToDataUrl(bytes, guessImageExtensionFromPath(absolutePath));
  } catch {
    return normalized;
  }
}

async function decorateImages(html: string) {
  const container = document.createElement("div");
  container.innerHTML = html;
  const images = Array.from(container.querySelectorAll("img"));
  for (const img of images) {
    const raw = img.getAttribute("src") ?? "";
    const display = await resolveImageForDisplay(raw);
    if (display !== raw) {
      img.setAttribute("data-original", raw);
      img.setAttribute("src", display);
    }
  }
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
  const originalSrc = (node.attrs.original ?? node.attrs.src ?? "") as string;
  textarea.value = formatImageMarkdown(preferSecureImageUrl(originalSrc), node.attrs.alt ?? "");
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

async function applyImageMeta() {
  if (!imageMetaEditor || !imageMetaState || !editor) {
    hideImageMeta();
    return;
  }
  const parsed = parseImageMarkdown(imageMetaEditor.value ?? "");
  if (!parsed) {
    hideImageMeta();
    return;
  }
  const displaySrc = await resolveImageForDisplay(parsed.src);
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
const PREFS_KEY = "ease-md:prefs";
const MAX_RECENTS = 20;

let editor: Editor | null = null;
let currentPath: string | null = null;
let isDirty = false;
let isSourceMode = false;
let draftTimer: number | undefined;
let autoSaveTimer: number | undefined;
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
let sourceSnippetEl: HTMLDivElement | null = null;
let currentContext:
  | { type: "text" }
  | { type: "image"; imagePath?: string; imageRaw?: string; imagePos?: number }
  | { type: "tree"; targetPath: string; isFile: boolean } = { type: "text" };
let filesViewMode: "tree" | "list" = "tree";
let createdDirs = new Set<string>();

type Preferences = {
  genStartupMode: "new" | "restore" | "none";
  genAutoSave: boolean;
  genSaveOnSwitch: boolean;
  genLanguage: "system" | "zh-CN" | "en-US";
  genAutoCheckUpdate: boolean;
  genIncludePrerelease: boolean;
  genDebugMode: boolean;
  genTelemetry: boolean;
  imageInsertRule: "local" | "upload";
  imageRuleLocal: boolean;
  imageRuleNetwork: boolean;
  imagePreferRelative: boolean;
  imageYamlAutoUpload: boolean;
  imageAutoConvertUrl: boolean;
  uploadService: "picgo-app";
  picgoPath: string;
  mdStrictMode: boolean;
  mdHeadingStyle: "atx" | "setext";
  mdUnorderedListStyle: "-" | "*" | "+";
  mdOrderedListStyle: "dot" | "paren";
  mdInlineMath: boolean;
  mdSubscript: boolean;
  mdSuperscript: boolean;
  mdHighlight: boolean;
  mdDiagrams: boolean;
  mdSmartPunctuationMode: "input" | "off";
  mdSmartQuotes: boolean;
  mdSmartDashes: boolean;
  mdUnicodePunctuation: boolean;
  mdCodeShowLineNumbers: boolean;
  mdCodeWrap: boolean;
  mdCodeIndent: 2 | 4 | 8;
  mdMathAutoNumber: boolean;
  mdMathAllowBackslashNewline: boolean;
  mdMathEnablePhysics: boolean;
  mdMathExportHtmlMode: "svg" | "mathml";
  mdFirstLineIndent: boolean;
  mdShowBr: boolean;
  mdEditWhitespacePolicy: "preserve" | "compact";
  mdExportWhitespacePolicy: "preserve" | "compact";
  edDefaultIndent: 2 | 4 | 6 | 8;
  edAlignIndent: boolean;
  edPairBracketsQuotes: boolean;
  edPairMarkdownSymbols: boolean;
  edShowCurrentMarkdownSource: boolean;
  edCopyPlainAsMarkdown: boolean;
  edCopyCutWholeLine: boolean;
  edNewlineStyle: "lf" | "crlf";
  edSpellcheckMode: "auto" | "off" | "en-US" | "zh-CN";
  edTypewriterCenter: boolean;
};

type PicgoUploadResponse = {
  success: boolean;
  url: string | null;
  stdout: string;
  stderr: string;
};

const defaultPreferences: Preferences = {
  genStartupMode: "new",
  genAutoSave: false,
  genSaveOnSwitch: false,
  genLanguage: "system",
  genAutoCheckUpdate: false,
  genIncludePrerelease: false,
  genDebugMode: false,
  genTelemetry: true,
  imageInsertRule: "local",
  imageRuleLocal: true,
  imageRuleNetwork: true,
  imagePreferRelative: false,
  imageYamlAutoUpload: false,
  imageAutoConvertUrl: false,
  uploadService: "picgo-app",
  picgoPath: "",
  mdStrictMode: true,
  mdHeadingStyle: "atx",
  mdUnorderedListStyle: "-",
  mdOrderedListStyle: "dot",
  mdInlineMath: false,
  mdSubscript: false,
  mdSuperscript: false,
  mdHighlight: false,
  mdDiagrams: true,
  mdSmartPunctuationMode: "input",
  mdSmartQuotes: false,
  mdSmartDashes: false,
  mdUnicodePunctuation: false,
  mdCodeShowLineNumbers: false,
  mdCodeWrap: true,
  mdCodeIndent: 4,
  mdMathAutoNumber: false,
  mdMathAllowBackslashNewline: true,
  mdMathEnablePhysics: false,
  mdMathExportHtmlMode: "svg",
  mdFirstLineIndent: false,
  mdShowBr: true,
  mdEditWhitespacePolicy: "preserve",
  mdExportWhitespacePolicy: "preserve",
  edDefaultIndent: 2,
  edAlignIndent: false,
  edPairBracketsQuotes: true,
  edPairMarkdownSymbols: false,
  edShowCurrentMarkdownSource: false,
  edCopyPlainAsMarkdown: true,
  edCopyCutWholeLine: false,
  edNewlineStyle: "crlf",
  edSpellcheckMode: "auto",
  edTypewriterCenter: false
};

let preferences: Preferences = { ...defaultPreferences };

function normalizeFsPath(pathValue: string) {
  return pathValue.replace(/\\/g, "/").toLowerCase();
}

function loadPreferences() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) {
      return { ...defaultPreferences };
    }
    const parsed = JSON.parse(raw);
    const merged = {
      ...defaultPreferences,
      ...parsed
    } as Preferences;
    if (merged.mdCodeIndent !== 2 && merged.mdCodeIndent !== 4 && merged.mdCodeIndent !== 8) {
      merged.mdCodeIndent = 4;
    }
    if (![2, 4, 6, 8].includes(merged.edDefaultIndent)) {
      merged.edDefaultIndent = 2;
    }
    if (!["lf", "crlf"].includes(merged.edNewlineStyle)) {
      merged.edNewlineStyle = "crlf";
    }
    if (!["auto", "off", "en-US", "zh-CN"].includes(merged.edSpellcheckMode)) {
      merged.edSpellcheckMode = "auto";
    }
    if (!["new", "restore", "none"].includes(merged.genStartupMode)) {
      merged.genStartupMode = "new";
    }
    if (!["system", "zh-CN", "en-US"].includes(merged.genLanguage)) {
      merged.genLanguage = "system";
    }
    return merged;
  } catch {
    return { ...defaultPreferences };
  }
}

function savePreferences() {
  localStorage.setItem(PREFS_KEY, JSON.stringify(preferences));
}

function setActivePrefsTab(tab: string) {
  const hasPanel = prefsPanels.some((panel) => panel.dataset.prefsPanel === tab);
  const activeTab = hasPanel ? tab : "image";
  prefsNavItems.forEach((item) => {
    item.classList.toggle("active", item.dataset.prefsTab === activeTab);
  });
  prefsPanels.forEach((panel) => {
    panel.classList.toggle("hidden", panel.dataset.prefsPanel !== activeTab);
  });
}

function applyMarkdownPreferences() {
  md.set({
    typographer: preferences.mdSmartPunctuationMode !== "off",
    breaks: preferences.mdShowBr
  });
  if (editorHost) {
    editorHost.classList.toggle("md-code-wrap", preferences.mdCodeWrap);
    editorHost.classList.toggle(
      "md-first-line-indent",
      preferences.mdFirstLineIndent
    );
    editorHost.classList.toggle(
      "md-code-lines",
      preferences.mdCodeShowLineNumbers
    );
    editorHost.style.setProperty(
      "--md-code-indent",
      String(preferences.mdCodeIndent)
    );
  }
  sourceEditor.style.tabSize = String(preferences.mdCodeIndent);
}

function toNewlineStyle(text: string) {
  const normalized = text.replace(/\r\n/g, "\n");
  return preferences.edNewlineStyle === "crlf"
    ? normalized.replace(/\n/g, "\r\n")
    : normalized;
}

function getSourceLineBounds(value: string, cursor: number) {
  const start = value.lastIndexOf("\n", Math.max(0, cursor - 1)) + 1;
  const endIndex = value.indexOf("\n", cursor);
  const end = endIndex === -1 ? value.length : endIndex;
  return { start, end };
}

function getSourceCurrentLineIndent(value: string, cursor: number) {
  const { start } = getSourceLineBounds(value, cursor);
  const line = value.slice(start, cursor);
  const match = line.match(/^[ \t]*/);
  return match?.[0] ?? "";
}

function getIndentForNextTab(line: string) {
  const unit = Math.max(1, preferences.edDefaultIndent);
  const width = line.replace(/\t/g, " ").length;
  const remain = unit - (width % unit);
  return " ".repeat(remain === 0 ? unit : remain);
}

function applyEditorPreferences() {
  sourceEditor.spellcheck = preferences.edSpellcheckMode !== "off";
  if (preferences.edSpellcheckMode === "auto") {
    sourceEditor.removeAttribute("lang");
    editorHost.removeAttribute("lang");
  } else {
    sourceEditor.lang = preferences.edSpellcheckMode;
    editorHost.lang = preferences.edSpellcheckMode;
  }
  sourceEditor.style.tabSize = String(preferences.edDefaultIndent);
}

function applyGeneralPreferences() {
  if (preferences.genLanguage === "system") {
    document.documentElement.removeAttribute("lang");
  } else {
    document.documentElement.lang = preferences.genLanguage;
  }
}

function scheduleAutoSave() {
  if (!preferences.genAutoSave) {
    return;
  }
  if (autoSaveTimer) {
    window.clearTimeout(autoSaveTimer);
  }
  autoSaveTimer = window.setTimeout(async () => {
    if (!isDirty) {
      return;
    }
    if (currentPath) {
      await saveFile();
    } else {
      saveDraft();
    }
  }, 900);
}

async function checkForUpdates() {
  try {
    const currentVersion = await invoke<string>("app_version");
    if (!preferences.genAutoCheckUpdate) {
      setStatus(`Current version ${currentVersion}, auto-check is disabled`);
      openPicgoResultModal(
        "检查更新",
        `当前版本: ${currentVersion}\n\n更新源未配置。请按 docs/update-deployment.md 完成更新服务部署后启用自动更新。`
      );
      return;
    }
    setStatus(`Current version ${currentVersion}, update endpoint not configured`);
    openPicgoResultModal(
      "检查更新",
      `当前版本: ${currentVersion}\n自动检查更新已开启，但当前尚未接入发布源。\n请按 docs/update-deployment.md 完成部署。`
    );
  } catch (error) {
    console.error(error);
    setStatus("Check update failed");
  }
}

function ensureSourceSnippet() {
  if (sourceSnippetEl) {
    return sourceSnippetEl;
  }
  const el = document.createElement("div");
  el.className = "current-source-snippet hidden";
  editorPaneEl.appendChild(el);
  sourceSnippetEl = el;
  return el;
}

function hideCurrentSourceSnippet() {
  if (!sourceSnippetEl) {
    return;
  }
  sourceSnippetEl.classList.add("hidden");
}

function updateCurrentSourceSnippet() {
  if (isSourceMode || !preferences.edShowCurrentMarkdownSource || !editor) {
    hideCurrentSourceSnippet();
    return;
  }
  const { $from } = editor.state.selection;
  const depth = Math.max(0, $from.depth);
  const node = $from.node(depth);
  const nodePos = depth > 0 ? $from.before(depth) : 0;
  const dom = editor.view.nodeDOM(nodePos) as HTMLElement | null;
  if (!dom || !node.textContent?.trim()) {
    hideCurrentSourceSnippet();
    return;
  }
  const snippet = ensureSourceSnippet();
  const text = node.textContent.length > 220 ? `${node.textContent.slice(0, 220)}...` : node.textContent;
  snippet.textContent = text;
  const rect = dom.getBoundingClientRect();
  const hostRect = editorPaneEl.getBoundingClientRect();
  snippet.style.left = `${Math.max(8, rect.left - hostRect.left)}px`;
  snippet.style.top = `${Math.max(8, rect.top - hostRect.top - 30)}px`;
  snippet.classList.remove("hidden");
}

function centerSourceCaret() {
  if (!preferences.edTypewriterCenter || !isSourceMode) {
    return;
  }
  const pos = sourceEditor.selectionStart ?? 0;
  const text = sourceEditor.value.slice(0, pos);
  const lines = text.split(/\r?\n/).length - 1;
  const lineHeight = parseFloat(getComputedStyle(sourceEditor).lineHeight || "22");
  const caretTop = lines * lineHeight;
  const viewportCenter = sourceEditor.clientHeight / 2;
  sourceEditor.scrollTo({ top: Math.max(0, caretTop - viewportCenter), behavior: "auto" });
}

function centerEditorCaret() {
  if (!preferences.edTypewriterCenter || isSourceMode || !editor) {
    return;
  }
  const { from } = editor.state.selection;
  const coords = editor.view.coordsAtPos(from);
  const hostRect = editorHost.getBoundingClientRect();
  const caretTop = coords.top - hostRect.top + editorHost.scrollTop;
  const viewportCenter = editorHost.clientHeight / 2;
  editorHost.scrollTo({ top: Math.max(0, caretTop - viewportCenter), behavior: "auto" });
}

function updateTypewriterPosition() {
  if (!preferences.edTypewriterCenter) {
    return;
  }
  if (isSourceMode) {
    centerSourceCaret();
  } else {
    centerEditorCaret();
  }
}

function normalizeHeadingStyle(markdown: string) {
  if (preferences.mdHeadingStyle !== "setext") {
    return markdown;
  }
  return markdown.replace(
    /^(#{1,2})\s+(.+)$/gm,
    (_all, hashes: string, text: string) => {
      const underline = hashes.length === 1 ? "=" : "-";
      return `${text}\n${underline.repeat(Math.max(3, text.length))}`;
    }
  );
}

function normalizeListStyle(markdown: string) {
  const unordered = preferences.mdUnorderedListStyle;
  let updated = markdown.replace(
    /^(\s*)[-*+]\s+/gm,
    (_all, indent: string) => `${indent}${unordered} `
  );
  if (preferences.mdOrderedListStyle === "paren") {
    updated = updated.replace(/^(\s*)(\d+)\.\s+/gm, "$1$2) ");
  } else {
    updated = updated.replace(/^(\s*)(\d+)\)\s+/gm, "$1$2. ");
  }
  return updated;
}

function normalizeWhitespacePolicy(markdown: string) {
  if (preferences.mdExportWhitespacePolicy === "compact") {
    return markdown
      .split("\n")
      .map((line) => line.replace(/[ \t]{2,}/g, " "))
      .join("\n");
  }
  return markdown;
}

function mapNonCodeLines(markdown: string, transform: (line: string) => string) {
  const lines = markdown.split("\n");
  let inFence = false;
  const out = lines.map((line) => {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      return line;
    }
    if (inFence) {
      return line;
    }
    return transform(line);
  });
  return out.join("\n");
}

function normalizeUnicodePunctuation(markdown: string) {
  if (preferences.mdUnicodePunctuation) {
    return markdown;
  }
  const table: Record<string, string> = {
    "，": ",",
    "。": ".",
    "：": ":",
    "；": ";",
    "！": "!",
    "？": "?",
    "（": "(",
    "）": ")",
    "【": "[",
    "】": "]",
    "“": "\"",
    "”": "\"",
    "‘": "'",
    "’": "'"
  };
  return mapNonCodeLines(markdown, (line) =>
    line.replace(/[，。：；！？（）【】“”‘’]/g, (char) => table[char] ?? char)
  );
}

function applySmartPunctuation(markdown: string) {
  if (preferences.mdSmartPunctuationMode === "off") {
    return normalizeUnicodePunctuation(markdown);
  }
  let output = markdown;
  if (preferences.mdSmartDashes) {
    output = mapNonCodeLines(output, (line) =>
      line.replace(/---/g, "—").replace(/--/g, "–")
    );
  }
  if (preferences.mdSmartQuotes) {
    output = mapNonCodeLines(output, (line) =>
      line
        .replace(/"([^"\n]+)"/g, "“$1”")
        .replace(/'([^'\n]+)'/g, "‘$1’")
    );
  }
  return normalizeUnicodePunctuation(output);
}

function syncPrefsForm() {
  genStartupModeEl.value = preferences.genStartupMode;
  genAutoSaveEl.checked = preferences.genAutoSave;
  genSaveOnSwitchEl.checked = preferences.genSaveOnSwitch;
  genLanguageEl.value = preferences.genLanguage;
  genAutoCheckUpdateEl.checked = preferences.genAutoCheckUpdate;
  genIncludePrereleaseEl.checked = preferences.genIncludePrerelease;
  genDebugModeEl.checked = preferences.genDebugMode;
  genTelemetryEl.checked = preferences.genTelemetry;
  imageInsertRuleEl.value = preferences.imageInsertRule;
  imageRuleLocalEl.checked = preferences.imageRuleLocal;
  imageRuleNetworkEl.checked = preferences.imageRuleNetwork;
  imagePreferRelativeEl.checked = preferences.imagePreferRelative;
  imageYamlAutoUploadEl.checked = preferences.imageYamlAutoUpload;
  imageAutoConvertUrlEl.checked = preferences.imageAutoConvertUrl;
  uploadServiceEl.value = preferences.uploadService;
  picgoPathEl.value = preferences.picgoPath;
  mdStrictModeEl.checked = preferences.mdStrictMode;
  mdHeadingStyleEl.value = preferences.mdHeadingStyle;
  mdUnorderedListStyleEl.value = preferences.mdUnorderedListStyle;
  mdOrderedListStyleEl.value = preferences.mdOrderedListStyle;
  mdInlineMathEl.checked = preferences.mdInlineMath;
  mdSubscriptEl.checked = preferences.mdSubscript;
  mdSuperscriptEl.checked = preferences.mdSuperscript;
  mdHighlightEl.checked = preferences.mdHighlight;
  mdDiagramsEl.checked = preferences.mdDiagrams;
  mdSmartPunctuationModeEl.value = preferences.mdSmartPunctuationMode;
  mdSmartQuotesEl.checked = preferences.mdSmartQuotes;
  mdSmartDashesEl.checked = preferences.mdSmartDashes;
  mdUnicodePunctuationEl.checked = preferences.mdUnicodePunctuation;
  mdCodeShowLineNumbersEl.checked = preferences.mdCodeShowLineNumbers;
  mdCodeWrapEl.checked = preferences.mdCodeWrap;
  mdCodeIndentEl.value = String(preferences.mdCodeIndent);
  mdMathAutoNumberEl.checked = preferences.mdMathAutoNumber;
  mdMathAllowBackslashNewlineEl.checked = preferences.mdMathAllowBackslashNewline;
  mdMathEnablePhysicsEl.checked = preferences.mdMathEnablePhysics;
  mdMathExportHtmlModeEl.value = preferences.mdMathExportHtmlMode;
  mdFirstLineIndentEl.checked = preferences.mdFirstLineIndent;
  mdShowBrEl.checked = preferences.mdShowBr;
  mdEditWhitespacePolicyEl.value = preferences.mdEditWhitespacePolicy;
  mdExportWhitespacePolicyEl.value = preferences.mdExportWhitespacePolicy;
  edDefaultIndentEl.value = String(preferences.edDefaultIndent);
  edAlignIndentEl.checked = preferences.edAlignIndent;
  edPairBracketsQuotesEl.checked = preferences.edPairBracketsQuotes;
  edPairMarkdownSymbolsEl.checked = preferences.edPairMarkdownSymbols;
  edShowCurrentMarkdownSourceEl.checked = preferences.edShowCurrentMarkdownSource;
  edCopyPlainAsMarkdownEl.checked = preferences.edCopyPlainAsMarkdown;
  edCopyCutWholeLineEl.checked = preferences.edCopyCutWholeLine;
  edNewlineLfEl.checked = preferences.edNewlineStyle === "lf";
  edNewlineCrlfEl.checked = preferences.edNewlineStyle === "crlf";
  edSpellcheckModeEl.value = preferences.edSpellcheckMode;
  edTypewriterCenterEl.checked = preferences.edTypewriterCenter;
}

function openPreferences(tab: string = "general") {
  prefsModal.classList.remove("hidden");
  setActivePrefsTab(tab);
  syncPrefsForm();
  applyGeneralPreferences();
  applyMarkdownPreferences();
  applyEditorPreferences();
}

function closePreferences() {
  prefsModal.classList.add("hidden");
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

function getBaseName(pathValue: string) {
  const parts = pathValue.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] ?? pathValue;
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
      if (children.length > 0 || createdDirs.has(normalizeFsPath(entryPath))) {
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
    row.dataset.type = node.isFile ? "file" : "folder";
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

    if (node.isFile) {
      row.draggable = true;
      row.addEventListener("dragstart", (event) => {
        event.dataTransfer?.setData("text/plain", node.path);
        event.dataTransfer?.setData("application/x-easemd-path", node.path);
        event.dataTransfer?.setData("application/x-easemd-type", "file");
        event.dataTransfer?.setDragImage(row, 10, 10);
      });
    } else {
      row.addEventListener("dragover", (event) => {
        event.preventDefault();
        row.classList.add("drop-target");
      });
      row.addEventListener("dragleave", () => {
        row.classList.remove("drop-target");
      });
      row.addEventListener("drop", async (event) => {
        event.preventDefault();
        row.classList.remove("drop-target");
        const source =
          event.dataTransfer?.getData("application/x-easemd-path") ||
          event.dataTransfer?.getData("text/plain");
        const type =
          event.dataTransfer?.getData("application/x-easemd-type") || "file";
        if (!source || type !== "file") {
          return;
        }
        const destDir = node.path;
        const srcDir = await dirname(source);
        if (normalizeFsPath(srcDir) === normalizeFsPath(destDir)) {
          return;
        }
        const destPath = await join(destDir, getBaseName(source));
        try {
          await rename(source, destPath);
          if (currentPath === source) {
            setFilePath(destPath);
          }
          await refreshFolderFiles();
          scrollTreeToPath(destPath);
        } catch (error) {
          console.error(error);
          setStatus("Failed to move file");
        }
      });
    }
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
    expandTreeToNode(target);
    target.scrollIntoView({ block: "nearest" });
  }
}

function expandTreeToNode(node: HTMLElement) {
  let currentLi = node.closest("li") as HTMLElement | null;
  while (currentLi) {
    const parentUl = currentLi.parentElement as HTMLElement | null;
    if (parentUl?.classList.contains("folder-tree")) {
      parentUl.classList.remove("collapsed");
    }
    const parentLi = parentUl?.closest("li") as HTMLElement | null;
    const parentRow = parentLi?.querySelector(":scope > .node.folder") as HTMLElement | null;
    if (parentRow) {
      parentRow.dataset.state = "open";
    }
    currentLi = parentLi;
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
  let markdown = turndown.turndown(editor.getHTML());
  markdown = normalizeHeadingStyle(markdown);
  markdown = normalizeListStyle(markdown);
  markdown = normalizeWhitespacePolicy(markdown);
  markdown = applySmartPunctuation(markdown);
  return markdown;
}

async function setMarkdown(markdown: string) {
  if (!editor) {
    return;
  }
  const normalized = markdown.replace(/\t/g, "  ");
  const html = preserveLeadingWhitespace(await decorateImages(md.render(normalized)));
  editor.commands.setContent(html, false);
}

function getSelectedMarkdownFromEditor() {
  if (!editor) {
    return "";
  }
  const { from, to } = editor.state.selection;
  if (from === to) {
    return "";
  }
  return editor.state.doc.textBetween(from, to, "\n", "\n").trim();
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
    await setMarkdown(draft.text);
    isDirty = true;
    setDirtyFlag();
    setStatus("Draft restored");
  }
}

function setEditorContent(text: string) {
  void setMarkdown(text);
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
    if (checkDirty && isDirty) {
      if (preferences.genSaveOnSwitch) {
        const saved = await saveFile();
        if (!saved) {
          return;
        }
      } else if (!(await maybeSaveBeforeLeave())) {
        return;
      }
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
    await writeTextFile(currentPath, toNewlineStyle(content));
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
    await writeTextFile(path, toNewlineStyle(content));
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
    hideCurrentSourceSnippet();
    sourceEditor.value = getMarkdown();
    sourceEditor.focus();
  } else {
    void setMarkdown(sourceEditor.value);
    editor?.commands.focus();
    updateCodeLanguagePicker();
    updateCurrentSourceSnippet();
  }
  applyEditorPreferences();
  updateWordCount();
  updateOutline();
  updateTypewriterPosition();
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
    try {
      await insertImageBytes(bytes, await extname(path));
    } catch {}
    return;
  }
  await openPath(path);
}

async function insertImageBytes(bytes: Uint8Array, extension: string | null | undefined) {
  const cleanExt = (typeof extension === "string" ? extension : "").replace(".", "") || "png";
  const { fullPath, linkPath } = await resolveImageTarget(cleanExt);
  await writeFile(fullPath, bytes);
  let finalLink = linkPath;
  let previewSrc = bytesToDataUrl(bytes, cleanExt);
  if (preferences.imageInsertRule === "upload") {
    if (!preferences.picgoPath.trim()) {
      setStatus("PicGo path is required");
      throw new Error("PicGo path is empty");
    }
    try {
      const uploadedRaw = await invoke<string>("picgo_upload", {
        picgoPath: preferences.picgoPath,
        imagePath: fullPath
      });
      const uploaded = parsePicgoUploadResponse(uploadedRaw);
      if (!uploaded.success) {
        const detail = [uploaded.stderr, uploaded.stdout].filter(Boolean).join("\n");
        throw new Error(detail || "PicGo upload failed");
      }
      finalLink = preferSecureImageUrl(await resolvePicgoUrl(uploaded));
      previewSrc = finalLink;
      setStatus("Image uploaded via PicGo");
    } catch (error) {
      console.error(error);
      setStatus("PicGo upload failed");
      throw error;
    }
  }
  if (isSourceMode) {
    const markdown = formatImageMarkdown(finalLink, `image-${Date.now()}`);
    const start = sourceEditor.selectionStart ?? sourceEditor.value.length;
    const end = sourceEditor.selectionEnd ?? start;
    sourceEditor.setRangeText(`${markdown}\n`, start, end, "end");
    isDirty = true;
    setDirtyFlag();
    updateWordCount();
    scheduleDraftSave();
    scheduleOutline();
  } else {
    editor
      ?.chain()
      .focus()
      .setImage({ src: previewSrc, original: finalLink })
      .run();
  }
  setStatus("Image inserted");
}

function bytesToDataUrl(bytes: Uint8Array, extension: string) {
  const mime = `image/${extension === "jpg" ? "jpeg" : extension}`;
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

function sanitizeExtractedUrl(candidate: string | null | undefined) {
  if (!candidate) {
    return null;
  }
  let value = candidate.trim();
  value = value.replace(/^[<\[(\"']+/, "");
  value = value.replace(/[>\])}\"',.;:!?]+$/, "");
  try {
    const url = new URL(value);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return value;
    }
  } catch {
    return null;
  }
  return null;
}

function extractFirstUrl(text: string) {
  const match = text.match(/https?:\/\/[^\s"'<>]+/i);
  return sanitizeExtractedUrl(match ? match[0] : null);
}

function parsePicgoUploadResponse(raw: string): PicgoUploadResponse {
  const fallbackUrl = extractFirstUrl(raw) ?? null;
  try {
    const parsed = JSON.parse(raw) as Partial<PicgoUploadResponse>;
    return {
      success: Boolean(parsed.success),
      url:
        typeof parsed.url === "string" && parsed.url.length > 0
          ? preferSecureImageUrl(sanitizeExtractedUrl(parsed.url) ?? parsed.url)
          : fallbackUrl ? preferSecureImageUrl(fallbackUrl) : null,
      stdout: typeof parsed.stdout === "string" ? parsed.stdout : raw,
      stderr: typeof parsed.stderr === "string" ? parsed.stderr : ""
    };
  } catch {
    return {
      success: true,
      url: fallbackUrl ? preferSecureImageUrl(fallbackUrl) : null,
      stdout: raw,
      stderr: ""
    };
  }
}

async function resolvePicgoUrl(uploadResult: PicgoUploadResponse) {
  if (uploadResult.url) {
    const normalized = sanitizeExtractedUrl(uploadResult.url) ?? uploadResult.url;
    return normalized;
  }
  try {
    const clip = await navigator.clipboard.readText();
    const url = sanitizeExtractedUrl(extractFirstUrl(clip ?? ""));
    if (url) {
      return url;
    }
  } catch (error) {
    console.error("clipboard.readText failed", error);
  }
  throw new Error("PicGo upload succeeded but URL not found");
}

function openPicgoResultModal(title: string, body: string) {
  picgoResultTitle.textContent = title;
  picgoResultBody.textContent = body;
  picgoResultModal.classList.remove("hidden");
}

function closePicgoResultModal() {
  picgoResultModal.classList.add("hidden");
}

function formatPicgoValidateBody(result: PicgoUploadResponse) {
  const lines: string[] = [];
  if (result.success) {
    lines.push("验证成功");
  } else {
    lines.push("验证失败");
  }
  if (result.url) {
    lines.push("");
    lines.push(`URL: ${result.url}`);
  }
  if (result.stdout?.trim()) {
    lines.push("");
    lines.push("stdout:");
    lines.push(result.stdout.trim());
  }
  if (result.stderr?.trim()) {
    lines.push("");
    lines.push("stderr:");
    lines.push(result.stderr.trim());
  }
  return lines.join("\n");
}

function getExtensionFromMime(mime: string) {
  const normalized = mime.toLowerCase();
  if (normalized.includes("png")) return "png";
  if (normalized.includes("jpeg") || normalized.includes("jpg")) return "jpg";
  if (normalized.includes("gif")) return "gif";
  if (normalized.includes("webp")) return "webp";
  if (normalized.includes("bmp")) return "bmp";
  if (normalized.includes("svg")) return "svg";
  return "png";
}

async function getImageFromPasteEvent(event: ClipboardEvent) {
  const clipboard = event.clipboardData;
  if (!clipboard) {
    return null;
  }

  const files = Array.from(clipboard.files ?? []);
  for (const file of files) {
    if (!file.type.startsWith("image/")) {
      continue;
    }
    const buffer = await file.arrayBuffer();
    return {
      bytes: new Uint8Array(buffer),
      extension: getExtensionFromMime(file.type)
    };
  }

  const items = Array.from(clipboard.items ?? []);
  for (const item of items) {
    if (!item.type.startsWith("image/")) {
      continue;
    }
    const file = item.getAsFile();
    if (!file) {
      continue;
    }
    const buffer = await file.arrayBuffer();
    return {
      bytes: new Uint8Array(buffer),
      extension: getExtensionFromMime(file.type)
    };
  }

  return null;
}

async function getImageFromClipboardApi() {
  const read = (navigator.clipboard as Clipboard & {
    read?: () => Promise<ClipboardItem[]>;
  }).read;
  if (!read) {
    return null;
  }
  try {
    const items = await read.call(navigator.clipboard);
    for (const item of items) {
      const imageType = item.types.find((type) => type.startsWith("image/"));
      if (!imageType) {
        continue;
      }
      const blob = await item.getType(imageType);
      const buffer = await blob.arrayBuffer();
      return {
        bytes: new Uint8Array(buffer),
        extension: getExtensionFromMime(imageType)
      };
    }
  } catch (error) {
    console.error("clipboard.read failed", error);
  }
  return null;
}

async function resolveImageTarget(ext: string) {
  const fileName = `image-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2, 6)}.${ext}`;
  if (currentPath) {
    const baseDir = await dirname(currentPath);
    const assetsDir = await join(baseDir, "assets");
    await mkdir(assetsDir, { recursive: true });
    const fullPath = await join(assetsDir, fileName);
    return { fullPath, linkPath: `assets/${fileName}` };
  }
  const pictures = await pictureDir();
  const targetDir = await join(pictures, "EaseMD");
  await mkdir(targetDir, { recursive: true });
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
      const targetPath = currentContext.targetPath || currentFolder;
      if (!targetPath) {
        break;
      }
      const baseDir = currentContext.isFile
        ? await dirname(targetPath)
        : targetPath;
      const name = window.prompt("New file name");
      if (!name) {
        break;
      }
      const newPath = await join(baseDir, name.endsWith(".md") ? name : `${name}.md`);
      try {
        await writeTextFile(newPath, "");
        await refreshFolderFiles();
        scrollTreeToPath(newPath);
        setStatus("File created");
      } catch (error) {
        console.error(error);
        setStatus("Failed to create file");
      }
      break;
    }
    case "tree_new_folder": {
      if (currentContext.type !== "tree") {
        break;
      }
      const targetPath = currentContext.targetPath || currentFolder;
      if (!targetPath) {
        break;
      }
      const baseDir = currentContext.isFile
        ? await dirname(targetPath)
        : targetPath;
      const name = window.prompt("New folder name");
      if (!name) {
        break;
      }
      const newPath = await join(baseDir, name);
      await mkdir(newPath, { recursive: true });
      createdDirs.add(normalizeFsPath(newPath));
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
        const prevKey = normalizeFsPath(currentContext.targetPath);
        if (createdDirs.delete(prevKey)) {
          createdDirs.add(normalizeFsPath(nextPath));
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
        createdDirs.delete(normalizeFsPath(currentContext.targetPath));
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
        try {
          await insertImageBytes(bytes, await extname(file));
        } catch {}
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
      case "file_preferences":
        openPreferences("general");
        break;
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
    const hasImageInClipboard = (() => {
      const clipboard = event.clipboardData;
      if (!clipboard) {
        return false;
      }
      const files = Array.from(clipboard.files ?? []);
      if (files.some((file) => file.type.startsWith("image/"))) {
        return true;
      }
      const items = Array.from(clipboard.items ?? []);
      return items.some((item) => item.type.startsWith("image/"));
    })();
    if (hasImageInClipboard) {
      event.preventDefault();
    }
    let image = await getImageFromPasteEvent(event);
    if (!image) {
      image = await getImageFromClipboardApi();
    }
    if (!image) {
      return;
    }
    event.preventDefault();
    try {
      await insertImageBytes(image.bytes, image.extension);
    } catch {}
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
      scheduleAutoSave();
      scheduleOutline();
      highlightOutlineByScroll();
      updateCodeLanguagePicker();
    },
    onSelectionUpdate: () => {
      updateCodeLanguagePicker();
      updateCurrentSourceSnippet();
      updateTypewriterPosition();
    },
    onFocus: () => {
      updateCodeLanguagePicker();
      updateCurrentSourceSnippet();
      updateTypewriterPosition();
    },
    onBlur: () => {
      if (!isCodeLanguageInteracting) {
        updateCodeLanguagePicker();
      }
      hideCurrentSourceSnippet();
    }
  });
}

function initPreferencesUI() {
  preferences = loadPreferences();
  setActivePrefsTab("general");
  syncPrefsForm();
  applyGeneralPreferences();
  applyMarkdownPreferences();
  applyEditorPreferences();

  prefsCloseBtn.addEventListener("click", () => closePreferences());
  prefsModal.addEventListener("click", (event) => {
    if (event.target === prefsModal) {
      closePreferences();
    }
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !prefsModal.classList.contains("hidden")) {
      closePreferences();
    }
    if (event.key === "Escape" && !picgoResultModal.classList.contains("hidden")) {
      closePicgoResultModal();
    }
  });
  picgoResultCloseBtn.addEventListener("click", () => closePicgoResultModal());
  picgoResultOkBtn.addEventListener("click", () => closePicgoResultModal());
  picgoResultModal.addEventListener("click", (event) => {
    if (event.target === picgoResultModal) {
      closePicgoResultModal();
    }
  });

  prefsNavItems.forEach((item) => {
    item.addEventListener("click", () => {
      const tab = item.dataset.prefsTab ?? "image";
      setActivePrefsTab(tab);
    });
  });

  const rerenderEditorFromCurrent = async () => {
    if (isSourceMode) {
      return;
    }
    const markdown = getMarkdown();
    await setMarkdown(markdown);
    updateOutline();
    updateWordCount();
    applyMarkdownPreferences();
  };

  const applyEditorState = () => {
    applyEditorPreferences();
    updateCurrentSourceSnippet();
    updateTypewriterPosition();
  };

  genStartupModeEl.addEventListener("change", () => {
    preferences.genStartupMode = genStartupModeEl.value as "new" | "restore" | "none";
    savePreferences();
  });
  genAutoSaveEl.addEventListener("change", () => {
    preferences.genAutoSave = genAutoSaveEl.checked;
    savePreferences();
  });
  genSaveOnSwitchEl.addEventListener("change", () => {
    preferences.genSaveOnSwitch = genSaveOnSwitchEl.checked;
    savePreferences();
  });
  genLanguageEl.addEventListener("change", () => {
    preferences.genLanguage = genLanguageEl.value as "system" | "zh-CN" | "en-US";
    savePreferences();
    applyGeneralPreferences();
  });
  genAutoCheckUpdateEl.addEventListener("change", () => {
    preferences.genAutoCheckUpdate = genAutoCheckUpdateEl.checked;
    savePreferences();
  });
  genIncludePrereleaseEl.addEventListener("change", () => {
    preferences.genIncludePrerelease = genIncludePrereleaseEl.checked;
    savePreferences();
  });
  genDebugModeEl.addEventListener("change", () => {
    preferences.genDebugMode = genDebugModeEl.checked;
    savePreferences();
    setStatus(genDebugModeEl.checked ? "Debug mode enabled" : "Debug mode disabled");
  });
  genTelemetryEl.addEventListener("change", () => {
    preferences.genTelemetry = genTelemetryEl.checked;
    savePreferences();
  });
  genRestoreDraftBtn.addEventListener("click", async () => {
    await maybeRestoreDraft(currentPath, isSourceMode ? sourceEditor.value : getMarkdown());
  });
  genCheckUpdateBtn.addEventListener("click", () => {
    void checkForUpdates();
  });
  genCustomizeShortcutBtn.addEventListener("click", () => {
    setStatus("Shortcut customization UI will be added in a later build");
  });
  genResetDialogsBtn.addEventListener("click", () => {
    setStatus("All warning dialogs reset");
  });
  genOpenAdvancedBtn.addEventListener("click", () => {
    openPicgoResultModal(
      "高级设置",
      "高级设置文件位置:\nlocalStorage key: ease-md:prefs\n\n可直接编辑后重启应用生效。"
    );
  });
  genResetAdvancedBtn.addEventListener("click", () => {
    preferences = { ...defaultPreferences };
    savePreferences();
    syncPrefsForm();
    applyGeneralPreferences();
    applyMarkdownPreferences();
    applyEditorPreferences();
    setStatus("Advanced settings reset");
  });

  imageInsertRuleEl.addEventListener("change", () => {
    preferences.imageInsertRule = imageInsertRuleEl.value as "local" | "upload";
    savePreferences();
  });
  imageRuleLocalEl.addEventListener("change", () => {
    preferences.imageRuleLocal = imageRuleLocalEl.checked;
    savePreferences();
  });
  imageRuleNetworkEl.addEventListener("change", () => {
    preferences.imageRuleNetwork = imageRuleNetworkEl.checked;
    savePreferences();
  });
  imagePreferRelativeEl.addEventListener("change", () => {
    preferences.imagePreferRelative = imagePreferRelativeEl.checked;
    savePreferences();
  });
  imageYamlAutoUploadEl.addEventListener("change", () => {
    preferences.imageYamlAutoUpload = imageYamlAutoUploadEl.checked;
    savePreferences();
  });
  imageAutoConvertUrlEl.addEventListener("change", () => {
    preferences.imageAutoConvertUrl = imageAutoConvertUrlEl.checked;
    savePreferences();
  });
  uploadServiceEl.addEventListener("change", () => {
    preferences.uploadService = uploadServiceEl.value as "picgo-app";
    savePreferences();
  });
  picgoPathEl.addEventListener("change", () => {
    preferences.picgoPath = picgoPathEl.value.trim();
    savePreferences();
  });

  const bindCheck = (
    el: HTMLInputElement,
    apply: (value: boolean) => void,
    rerender = false
  ) => {
    el.addEventListener("change", () => {
      apply(el.checked);
      savePreferences();
      applyMarkdownPreferences();
      if (rerender) {
        void rerenderEditorFromCurrent();
      }
    });
  };
  const bindSelect = (
    el: HTMLSelectElement,
    apply: (value: string) => void,
    rerender = false
  ) => {
    el.addEventListener("change", () => {
      apply(el.value);
      savePreferences();
      applyMarkdownPreferences();
      if (rerender) {
        void rerenderEditorFromCurrent();
      }
    });
  };

  bindCheck(mdStrictModeEl, (value) => {
    preferences.mdStrictMode = value;
  });
  bindSelect(mdHeadingStyleEl, (value) => {
    preferences.mdHeadingStyle = value as "atx" | "setext";
  });
  bindSelect(mdUnorderedListStyleEl, (value) => {
    preferences.mdUnorderedListStyle = value as "-" | "*" | "+";
  });
  bindSelect(mdOrderedListStyleEl, (value) => {
    preferences.mdOrderedListStyle = value as "dot" | "paren";
  });
  bindCheck(mdInlineMathEl, (value) => {
    preferences.mdInlineMath = value;
  });
  bindCheck(mdSubscriptEl, (value) => {
    preferences.mdSubscript = value;
  });
  bindCheck(mdSuperscriptEl, (value) => {
    preferences.mdSuperscript = value;
  });
  bindCheck(mdHighlightEl, (value) => {
    preferences.mdHighlight = value;
  });
  bindCheck(mdDiagramsEl, (value) => {
    preferences.mdDiagrams = value;
  });
  bindSelect(
    mdSmartPunctuationModeEl,
    (value) => {
      preferences.mdSmartPunctuationMode = value as "input" | "off";
    },
    true
  );
  bindCheck(mdSmartQuotesEl, (value) => {
    preferences.mdSmartQuotes = value;
  });
  bindCheck(mdSmartDashesEl, (value) => {
    preferences.mdSmartDashes = value;
  });
  bindCheck(mdUnicodePunctuationEl, (value) => {
    preferences.mdUnicodePunctuation = value;
  });
  bindCheck(mdCodeShowLineNumbersEl, (value) => {
    preferences.mdCodeShowLineNumbers = value;
  });
  bindCheck(mdCodeWrapEl, (value) => {
    preferences.mdCodeWrap = value;
  });
  bindSelect(mdCodeIndentEl, (value) => {
    preferences.mdCodeIndent = Number(value) as 2 | 4 | 8;
  });
  bindCheck(mdMathAutoNumberEl, (value) => {
    preferences.mdMathAutoNumber = value;
  });
  bindCheck(mdMathAllowBackslashNewlineEl, (value) => {
    preferences.mdMathAllowBackslashNewline = value;
  });
  bindCheck(mdMathEnablePhysicsEl, (value) => {
    preferences.mdMathEnablePhysics = value;
  });
  bindSelect(mdMathExportHtmlModeEl, (value) => {
    preferences.mdMathExportHtmlMode = value as "svg" | "mathml";
  });
  bindCheck(mdFirstLineIndentEl, (value) => {
    preferences.mdFirstLineIndent = value;
  });
  bindCheck(
    mdShowBrEl,
    (value) => {
      preferences.mdShowBr = value;
    },
    true
  );
  bindSelect(mdEditWhitespacePolicyEl, (value) => {
    preferences.mdEditWhitespacePolicy = value as "preserve" | "compact";
  });
  bindSelect(mdExportWhitespacePolicyEl, (value) => {
    preferences.mdExportWhitespacePolicy = value as "preserve" | "compact";
  });

  bindSelect(edDefaultIndentEl, (value) => {
    preferences.edDefaultIndent = Number(value) as 2 | 4 | 6 | 8;
  });
  bindCheck(edAlignIndentEl, (value) => {
    preferences.edAlignIndent = value;
  });
  bindCheck(edPairBracketsQuotesEl, (value) => {
    preferences.edPairBracketsQuotes = value;
  });
  bindCheck(edPairMarkdownSymbolsEl, (value) => {
    preferences.edPairMarkdownSymbols = value;
  });
  bindCheck(edShowCurrentMarkdownSourceEl, (value) => {
    preferences.edShowCurrentMarkdownSource = value;
  });
  bindCheck(edCopyPlainAsMarkdownEl, (value) => {
    preferences.edCopyPlainAsMarkdown = value;
  });
  bindCheck(edCopyCutWholeLineEl, (value) => {
    preferences.edCopyCutWholeLine = value;
  });
  bindSelect(edSpellcheckModeEl, (value) => {
    preferences.edSpellcheckMode = value as "auto" | "off" | "en-US" | "zh-CN";
  });
  bindCheck(edTypewriterCenterEl, (value) => {
    preferences.edTypewriterCenter = value;
  });
  edNewlineLfEl.addEventListener("change", () => {
    if (!edNewlineLfEl.checked) {
      return;
    }
    preferences.edNewlineStyle = "lf";
    savePreferences();
  });
  edNewlineCrlfEl.addEventListener("change", () => {
    if (!edNewlineCrlfEl.checked) {
      return;
    }
    preferences.edNewlineStyle = "crlf";
    savePreferences();
  });
  edTypewriterOffBtn.addEventListener("click", () => {
    preferences.edTypewriterCenter = false;
    savePreferences();
    syncPrefsForm();
    applyEditorState();
  });

  [
    edDefaultIndentEl,
    edAlignIndentEl,
    edPairBracketsQuotesEl,
    edPairMarkdownSymbolsEl,
    edShowCurrentMarkdownSourceEl,
    edCopyPlainAsMarkdownEl,
    edCopyCutWholeLineEl,
    edSpellcheckModeEl,
    edTypewriterCenterEl
  ].forEach((el) => {
    el.addEventListener("change", applyEditorState);
  });

  pickPicgoBtn.addEventListener("click", async () => {
    const file = await open({
      multiple: false,
      filters: [{ name: "Executable", extensions: ["exe", "cmd", "bat"] }]
    });
    if (!file || Array.isArray(file)) {
      return;
    }
    preferences.picgoPath = file;
    picgoPathEl.value = file;
    savePreferences();
  });

  validatePicgoBtn.addEventListener("click", async () => {
    const picgoPath = preferences.picgoPath.trim();
    if (!picgoPath) {
      setStatus("PicGo path is required");
      openPicgoResultModal("验证结果", "PicGo 路径未配置。");
      return;
    }
    try {
      const raw = await invoke<string>("picgo_validate_upload", {
        picgoPath
      });
      const result = parsePicgoUploadResponse(raw);
      const title = result.success ? "验证成功" : "验证失败";
      openPicgoResultModal(title, formatPicgoValidateBody(result));
      setStatus(result.success ? "PicGo validate passed" : "PicGo validation failed");
    } catch (error) {
      console.error(error);
      openPicgoResultModal("验证失败", String(error));
      setStatus("PicGo validation failed");
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
  scheduleAutoSave();
  scheduleOutline();
  updateTypewriterPosition();
});

sourceEditor.addEventListener("scroll", () => hideImageMeta());
sourceEditor.addEventListener("click", () => updateTypewriterPosition());
sourceEditor.addEventListener("keyup", () => updateTypewriterPosition());
sourceEditor.addEventListener("keydown", (event) => {
  if (!isSourceMode) {
    return;
  }
  const start = sourceEditor.selectionStart ?? 0;
  const end = sourceEditor.selectionEnd ?? start;
  const hasSelection = start !== end;

  if (preferences.edCopyCutWholeLine && (event.key === "c" || event.key === "x") && (event.ctrlKey || event.metaKey)) {
    if (!hasSelection) {
      event.preventDefault();
      const value = sourceEditor.value;
      const { start: lineStart, end: lineEnd } = getSourceLineBounds(value, start);
      const lineText = value.slice(lineStart, lineEnd);
      navigator.clipboard.writeText(lineText).catch(() => {});
      if (event.key === "x") {
        const removeEnd = lineEnd < value.length ? lineEnd + 1 : lineEnd;
        sourceEditor.setRangeText("", lineStart, removeEnd, "start");
        isDirty = true;
        setDirtyFlag();
        updateWordCount();
        scheduleDraftSave();
        scheduleOutline();
      }
      return;
    }
  }

  if (event.key === "Tab") {
    event.preventDefault();
    const value = sourceEditor.value;
    const before = value.slice(0, start);
    const insert = preferences.edAlignIndent
      ? getIndentForNextTab(before.slice(before.lastIndexOf("\n") + 1))
      : " ".repeat(preferences.edDefaultIndent);
    sourceEditor.setRangeText(insert, start, end, "end");
    return;
  }

  if (event.key === "Enter") {
    const value = sourceEditor.value;
    const indent = getSourceCurrentLineIndent(value, start);
    if (indent.length > 0) {
      event.preventDefault();
      sourceEditor.setRangeText(`\n${indent}`, start, end, "end");
    }
    return;
  }

  const pairMap: Record<string, string> = {
    "\"": "\"",
    "'": "'",
    "(": ")",
    "[": "]",
    "{": "}",
    "*": "*",
    "_": "_",
    "`": "`",
    "~": "~"
  };
  const pair = pairMap[event.key];
  if (!pair) {
    return;
  }
  const isBracketOrQuote = ["\"", "'", "(", "[", "{"].includes(event.key);
  const isMarkdownPair = ["*", "_", "`", "~"].includes(event.key);
  if (
    (isBracketOrQuote && !preferences.edPairBracketsQuotes) ||
    (isMarkdownPair && !preferences.edPairMarkdownSymbols)
  ) {
    return;
  }
  event.preventDefault();
  if (hasSelection) {
    const selected = sourceEditor.value.slice(start, end);
    sourceEditor.setRangeText(`${event.key}${selected}${pair}`, start, end, "select");
    sourceEditor.selectionStart = start + 1;
    sourceEditor.selectionEnd = end + 1;
  } else {
    sourceEditor.setRangeText(`${event.key}${pair}`, start, end, "start");
    sourceEditor.selectionStart = start + 1;
    sourceEditor.selectionEnd = start + 1;
  }
});

editorHost.addEventListener("copy", (event) => {
  if (!preferences.edCopyPlainAsMarkdown || isSourceMode || !editor) {
    return;
  }
  const markdown = getSelectedMarkdownFromEditor();
  if (!markdown) {
    return;
  }
  event.preventDefault();
  event.clipboardData?.setData("text/plain", markdown);
});

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
    updateCurrentSourceSnippet();
    updateTypewriterPosition();
  });
  window.addEventListener("resize", () => {
    updateCodeLanguagePicker();
    updateCurrentSourceSnippet();
  });
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
  initPreferencesUI();
  initSidebarWidth();
  setSidebarCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1");
  createdDirs = new Set<string>();
  renderRecent();
  syncRecentMenu(loadRecent());
  updateOutline();
  updateWordCount();
  setDirtyFlag();
  initTheme();
  let openedFromQuery = false;
  try {
    const url = new URL(window.location.href);
    const openPathParam = url.searchParams.get("open");
    if (openPathParam) {
      const decoded = decodeURIComponent(openPathParam);
      void openPath(decoded, { updateFolder: false, checkDirty: false });
      openedFromQuery = true;
      url.searchParams.delete("open");
      window.history.replaceState({}, "", url.toString());
    }
  } catch {}
  if (!openedFromQuery && preferences.genStartupMode === "restore") {
    const recents = loadRecent();
    if (recents.length > 0) {
      void openPath(recents[0], { updateFolder: true, checkDirty: false });
    }
  }
  void setupWindowHandlers();
}

try {
  initApp();
} catch (error) {
  console.error(error);
  setStatus("Init failed");
}



