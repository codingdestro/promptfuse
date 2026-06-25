const SITE_CONFIG = {
  "chatgpt.com": {
    name: "ChatGPT",
    inputSelector: "#prompt-textarea.ProseMirror",
    inputType: "div",
    submitSelector: "[data-testid='send-button']",
  },
  "claude.ai": {
    name: "Claude",
    inputSelector: ".tiptap.ProseMirror",
    inputType: "contenteditable",
    submitSelector: "button[aria-label='Send message']",
  },
  "chat.deepseek.com": {
    name: "DeepSeek",
    inputSelector: "textarea",
    inputType: "textarea",
    submitSelector: "button.send-btn",
  },
  "gemini.google.com": {
    name: "Gemini",
    inputSelector: "rich-textarea .ql-editor",
    inputType: "contenteditable",
    submitSelector: "button.send-button",
  },
};
