// This script executes in the validate-renderer.js process before its web content 
// begins loading. It runs within the renderer context, but is
// granted more privileges by having access to Node.js APIs.  It uses the
// contextBridge module to expose specific ipcRenderer functions to the renderer process
// in order to make possible communication between the main process and the
// renderer process.

const { contextBridge, ipcRenderer } = require('electron');

// Define functions to be exposed to the renderer process
contextBridge.exposeInMainWorld(
    'validate',
    {
        onOkDisplay: (fn) => {
          ipcRenderer.on('Ok-display', (event, ...args) => fn(...args));
        },
        onArticleDisplay: (fn) => {
          ipcRenderer.on('article-display', (event, ...args) => fn(...args));
        }
    }
)