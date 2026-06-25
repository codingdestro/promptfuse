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
  "t3.chat": {
    name: "T3Chat",
    inputSelector: "#chat-input",
    inputType: "textarea",
    submitSelector: "button.send-button",
  },
  "grok.com": {
    name: "Grok",
    inputSelector: ".tiptap.ProseMirror",
    inputType: "contenteditable",
    submitSelector: "button",
  },
  "chat.qwen.ai": {
    name: "Qwen",
    inputSelector: ".message-input-textarea",
    inputType: "textarea",
    submitSelector: "button",
  },
};
