// This script executes in the renderer.js process before its web content 
// begins loading. It runs within the renderer context, but is
// granted more privileges by having access to Node.js APIs.  It uses the
// contextBridge module to expose specific ipcRenderer functions to the renderer process
// in order to make possible communication between the main process and the
// renderer process.  This script also exposes clipboard.write functions.

const { contextBridge, ipcRenderer, clipboard } = require('electron');

// Define functions to be exposed to the renderer process
contextBridge.exposeInMainWorld(
    'electron',
    {
        getLastDate: () => ipcRenderer.invoke('getLastDate'),
        send: (channel, data) => {
          // whitelist channels
          let validChannels = ['mainAOT', 'article-open', 'author-search', 
                                'captcha-solved', 'process-date', 'dialog-error', 
                                'reset-window'];
          if (validChannels.includes(channel)) {
              ipcRenderer.send(channel, data);
          }
        },
        onDisplaySpinner: (fn) => {
            ipcRenderer.on('display-spinner', (event, ...args) => fn(...args));
        },
        onProgressBar: (fn) => {
            ipcRenderer.on('progress-bar', (event, ...args) => fn(...args));
        },
        onKeywordDiv: (fn) => {
          ipcRenderer.on('keyword-div', (event, ...args) => fn(...args));
        },
        onProcessEnd: (fn) => {
          ipcRenderer.on('process-end', (event, ...args) => fn(...args));
        },
        onArticleDisplay: (fn) => {
          ipcRenderer.on('article-display', (event, ...args) => fn(...args));
        },
        onEnableSearchButtons: (fn) => {
          ipcRenderer.on('enable-searchButtons', (event, ...args) => fn(...args));
        },
        onCaptchaDetected: (fn) => {
          ipcRenderer.on('captcha-detected', (event, ...args) => fn(...args));
        },
        clipboardWriteHTML: (arg) => {
          clipboard.writeHTML(arg);
        },
        clipboardWriteText: (arg) => {
          clipboard.writeText(arg);
        }
    }
)