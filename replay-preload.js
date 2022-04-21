// This script executes in the replay-renderer.js process before its web content 
// begins loading. It runs within the renderer context, but is
// granted more privileges by having access to Node.js APIs.  It uses the
// contextBridge module to expose specific ipcRenderer functions to the renderer process
// in order to make possible communication between the main process and the
// renderer process.

const { contextBridge, ipcRenderer } = require('electron');

// Define functions to be exposed to the renderer process
contextBridge.exposeInMainWorld(
    'replay',
    {
        send: (channel, data) => {
          // whitelist channels
          let validChannels = ['replay'];
          if (validChannels.includes(channel)) {
              ipcRenderer.send(channel, data);
          }
        },
        invoke: (channel, data) => {
          // whitelist channels
          let validChannels = ['replay'];
          if (validChannels.includes(channel)) {
            return ipcRenderer.invoke(channel, data);
          }
        },
        onArticleDisplay: (fn) => {
          ipcRenderer.on('article-display', (event, ...args) => fn(...args));
        }
    }
)