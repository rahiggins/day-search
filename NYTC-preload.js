// This script executes in the NYTCooking-renderer.js process before its
// web content begins loading. It runs within the renderer context, but is
// granted more privileges by having access to Node.js APIs.  It uses the
// contextBridge module to expose specific ipcRenderer functions to the renderer process
// in order to make possible communication between the main process and the
// renderer process.  This script also exposes clipboard.write functions.

const { contextBridge, ipcRenderer } = require('electron');

// Define functions to be exposed to the NYTCooking-renderer process
contextBridge.exposeInMainWorld(
    'NYTC',
    {
        send: (channel, data) => {
          // whitelist channels
          let validChannels = ['stop-NYTCooking', 'close-NYTCooking', 'article-open',
                                'write-HTML'];
          if (validChannels.includes(channel)) {
              ipcRenderer.send(channel, data);
          }
        },
        getSearchArgs: () => ipcRenderer.invoke('getSearchArgs'),
        onProgressBar: (fn) => {
            ipcRenderer.on('progress-bar', (event, ...args) => fn(...args));
        },
        onClearMessages: (fn) => {
          ipcRenderer.on('clear-messages', (event, ...args) => fn(...args));
        },
        onDisplayRecipe: (fn) => {
          ipcRenderer.on('display-recipe', (event, ...args) => fn(...args));
        },
        onNoResults: (fn) => {
          ipcRenderer.on('no-results', (event, ...args) => fn(...args));
        },
        onSetName: (fn) => {
          ipcRenderer.on('set-name', (event, ...args) => fn(...args));
        }
    }
)