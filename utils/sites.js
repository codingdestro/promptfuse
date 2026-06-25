const SITE_CONFIG = {
  'chat.openai.com': {
    name: 'ChatGPT',
    inputSelector: '#prompt-textarea',
    inputType: 'textarea',
    submitSelector: "[data-testid='send-button']"
  },
  'claude.ai': {
    name: 'Claude',
    inputSelector: ".ProseMirror[contenteditable='true']",
    inputType: 'contenteditable',
    submitSelector: "button[aria-label='Send message']"
  },
  'chat.deepseek.com': {
    name: 'DeepSeek',
    inputSelector: 'textarea#chat-input',
    inputType: 'textarea',
    submitSelector: 'button.send-btn'
  },
  'gemini.google.com': {
    name: 'Gemini',
    inputSelector: 'rich-textarea .ql-editor',
    inputType: 'contenteditable',
    submitSelector: 'button.send-button'
  }
};
