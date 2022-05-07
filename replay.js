// Change log
//  - mainline() - In getting articleClass, add p.css-15x2f4g to the
//      Cheerio merge

// External modules used
const {app, BrowserWindow} = require('electron');
const { ipcMain } = require('electron');
const path = require('path');
const mysql = require('mysql2/promise');
const cheerio = require('cheerio')
const fs = require('fs'); // Filesystem functions
const appPath = process.cwd();
//const { getAuthor, adjustTitle, findRecipes } = require('./testcase-lib.js');
//const { getAuthor, adjustTitle, findRecipes } = require('./lib.js');

let replayWindow;

async function mainline() {

    function createWindow () {
        // On app ready, create a browser window and load replay.html.
    
        console.log("createWindow entered")
    
        // Create the browser window.
        replayWindow = new BrowserWindow({
          x: 10,
          y: 50,
          width: 900, 
          height: 450,
          alwaysOnTop: true,
          webPreferences: {
            preload: path.join(__dirname, 'replay-preload.js')
          }
        })
    
        // and load the index.html of the app.
        replayWindow.loadFile('replay.html')
    
        // await launchPup({devtools: true});
        replayWindow.show(); // Focus on replayWindow
    
        // Open the DevTools.
        // replayWindow.webContents.openDevTools()
    
        // Emitted when the window is closed.
        replayWindow.on('closed', function () {
          // Dereference the window object, usually you would store windows
          // in an array if your app supports multi windows, this is the time
          // when you should delete the corresponding element.
          replayWindow = null
        })
    
    }

    // This method will be called when Electron has finished
    // initialization and is ready to create browser windows.
    // Some APIs can only be used after this event occurs.
    app.on('ready', createWindow)

    app.on('activate', function () {
        // On macOS it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (replayWindow === null) {
          createWindow()
        }
    })

    // Connect to the mySQL database
    let connection;
    console.log("Connecting to database")
    try {
        connection = await mysql.createConnection({
            host: 'localhost',
            port: 8889, 
            user: 'root',
            password: 'root',
            database: 'NYTarticles'
        });
        console.log("connected to database")

    } catch(err) {
        console.log("Database connection errer")
        console.log(err)
        return -1
    }

    ipcMain.handle('replay', async (evt, args) => {
        let [seq, tableName, testcase] = args
        console.log(seq + ", " + tableName + ", " + testcase)

        let libName; // name of file containing functions
        if ( testcase && fs.existsSync('./testcase-lib.js') ) {
          // Use test versions of adjustTitle and findRecipes
          console.log("Using testcase-lib.js")
          libName = './testcase-lib.js'
        } else {
          // Use base versions of adjustTitle and findRecipes
          console.log("Using lib.js")
          libName = './lib.js'
        }
        const { getAuthor, adjustTitle, findRecipes } = require(libName);

        let queryResponse = await connection.query(`SELECT html FROM ${tableName} WHERE seq = ${seq}`)
        let $ = cheerio.load(queryResponse[0][0].html)

        // Get the article class, if it exists
        let header = $('header.e12qa4dv0');
        let articleClass = $.merge($('p.css-c2jxua', header),$('p.css-1vhtahu', header))
        articleClass = $.merge(articleClass,$('p.css-1vhog55', header))
        articleClass = $.merge(articleClass,$('p.css-9ogeoa', header))
        articleClass = $.merge(articleClass,$('p.css-hcp891', header))
        articleClass = $.merge(articleClass,$('p.css-15x2f4g', header)).text();
        if (articleClass.length > 0) {
            hasArticleClass = true
        } else {
            hasArticleClass = false
        }

        // Get the article title and note whether it contains ':' or ';'
        let rawTitle = $('h1', header).text();
        if (rawTitle.match(/[;:]/) != null) {
            hasTitlePunct = true;
        } else {
            hasTitlePunct = false;
        }

        // Call adjustTitle to create an articleObj object
        let articleObj = adjustTitle(rawTitle)

        // Add author to the articleObj
        articleObj['author'] = getAuthor($)
        console.log("Prior to findRecipes, author: " + articleObj.author)

        // Call findRecipes to get recipes in the article
        let [ , articleResults] = await findRecipes($, articleObj);
        let recipes = articleResults.recipes;
        let numRecipes = recipes.length;
        for (let i = 0; i<numRecipes; i++) {
            console.log(recipes[i])
        }


        // Create an articleInfo object to send to the renderer process
        //  for displaying the article
        articleInfo = {
            rawTitle: rawTitle,
            hasArticleClass: hasArticleClass,
            hasTitlePunct: hasTitlePunct,
            hasFragmentedTitle: articleResults.hasFragmentedTitle,
            hasUnquantifiedIngredient: articleResults.hasUnquantifiedIngredient,
            recipes: recipes.join('\n')
        }

        // Adjust the window size according to the number of recipes to
        //  to be displayed

        // Get the current window size
        let [w, h] = replayWindow.getSize();

        // Shrink the window size if the current size is more that 450 px
        //  and there are 4 or fewer recipes
        if (h > 450 && numRecipes <= 4) {
            replayWindow.setSize(900, 450);
        }

        // Expand the window size if there are more than 4 recipes
        if (numRecipes > 4) {
            replayWindow.setSize(900, 450+((numRecipes - 4) * 25), true)
        }

        return JSON.stringify(articleInfo)
    })

}

mainline()