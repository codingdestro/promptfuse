chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== 'INJECT_PROMPT') return;

  const hostname = window.location.hostname;
  const config = SITE_CONFIG[hostname];

  if (!config) {
    sendResponse({ success: false, reason: 'UNSUPPORTED_PLATFORM' });
    return true;
  }

  function doInject() {
    const el = document.querySelector(config.inputSelector);
    if (!el) {
      sendResponse({ success: false, reason: 'INPUT_NOT_FOUND' });
      return;
    }

    if (config.inputType === 'textarea') {
      el.value = message.text;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      // contenteditable
      el.focus();
      if (document.execCommand) {
        el.focus();
        document.execCommand('selectAll');
        document.execCommand('insertText', false, message.text);
      } else {
        el.textContent = message.text;
        el.dispatchEvent(new InputEvent('input', {
          bubbles: true,
          inputType: 'insertText',
          data: message.text
        }));
      }
    }

    el.focus();
    sendResponse({ success: true, platform: config.name });
  }

  const el = document.querySelector(config.inputSelector);
  if (el) {
    doInject();
  } else {
    // One retry after 100ms
    setTimeout(() => {
      doInject();
    }, 100);
  }

  return true; // keep channel open for async response
});
