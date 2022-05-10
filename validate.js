// External modules used
const {app, BrowserWindow} = require('electron');
const { ipcMain } = require('electron');
const path = require('path');
const mysql = require('mysql2/promise');
const cheerio = require('cheerio')
const fs = require('fs'); // Filesystem functions
const appPath = process.cwd();

let validateWindow;
let debug = true;

function Log (text) {
  // If debugging, write text to console.log
  if (debug) {
      console.log(text)
  }
}

// Define a method to determine if two arrays are equal (https://stackoverflow.com/a/14853974)
// Warn if overriding existing method
if (Array.prototype.equals)
    console.warn("Overriding existing Array.prototype.equals. Possible causes: New API defines the method, there's a framework conflict or you've got double inclusions in your code.");
// attach the .equals method to Array's prototype to call it on any array
Array.prototype.equals = function (array) {
    // if the other array is a falsy value, return
    if (!array) {
      return false;
    }

    // compare lengths - can save a lot of time 
    if (this.length != array.length) {
      return false;
    }        

    for (var i = 0, l=this.length; i < l; i++) {
        // Check if we have nested arrays
        if (this[i] instanceof Array && array[i] instanceof Array) {
            // recurse into the nested arrays
            if (!this[i].equals(array[i])) {
              return false; 
            }                      
        }           
        else if (this[i] != array[i]) {
            // Warning - two different object instances will never be equal: {x:20} != {x:20}
            return false;   
        }           
    } 
    return true;
}
// Hide method from for-in loops (huh?)
Object.defineProperty(Array.prototype, "equals", {enumerable: false});

function bx(num) {
  // Convert MySQL boolean values [0, 1] to [false, true]
  if (num == 1) {
    return true
  } else {
    return false
  }
}

async function mainline() {

    function createWindow () {
        // On app ready, create a browser window and load replay.html.
    
        console.log("createWindow entered")
    
        // Create the browser window.
        validateWindow = new BrowserWindow({
          x: 10,
          y: 50,
          width: 1200, 
          height: 750,
          alwaysOnTop: true,
          webPreferences: {
            preload: path.join(__dirname, 'validate-preload.js')
          }
        })
    
        // and load the index.html of the app.
        validateWindow.loadFile('validate.html')
    
        // await launchPup({devtools: true});
        validateWindow.show(); // Focus on validateWindow
    
        // Open the DevTools.
        // validateWindow.webContents.openDevTools()
    
        // Emitted when the window is closed.
        validateWindow.on('closed', function () {
          // Dereference the window object, usually you would store windows
          // in an array if your app supports multi windows, this is the time
          // when you should delete the corresponding element.
          validateWindow = null
        })
    
    }

    // This method will be called when Electron has finished
    // initialization and is ready to create browser windows.
    // Some APIs can only be used after this event occurs.
    app.on('ready', createWindow)

    app.on('activate', function () {
        // On macOS it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (validateWindow === null) {
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

    let libName; // name of file containing functions
    if ( fs.existsSync('./testcase-lib.js') ) {
      // Use test versions of adjustTitle and findRecipes
      console.log("Using testcase-lib.js")
      libName = './testcase-lib.js'
    } else {
      // Use base versions of adjustTitle and findRecipes
      console.log("Using lib.js")
      libName = './lib.js'
    }
    const { getArticleClass, getAuthor, adjustTitle, findRecipes } = require(libName);

    let table = "articles";
    let maxResult = await connection.query(`SELECT MAX(seq) FROM ${table}`)
    let max = maxResult[0][0]['MAX(seq)'];
    console.log("Max seq: " + max.toString())

    let cols = 'Name, hasArticleClass, isNotSolved, discoveredRecipes, expectedRecipes, html'
    let allGood = true
    for (let seq = 1; seq <= max; seq++ ) {
        row = await connection.query(`SELECT ${cols} FROM ${table} WHERE seq = ${seq}`)
        dbResult = row[0][0];

        let $ = cheerio.load(dbResult.html)
        
        // Get article title and create articleObj with key 'title'
        let header = $('header.e12qa4dv0');
        let rawTitle = $('h1', header).text();
        let articleObj = adjustTitle(rawTitle);

        // Add hasArticleClass to the articleObj
        articleObj['hasArticleClass'] = getArticleClass($)[0];
        
        // Add author to the articleObj
        articleObj['author'] = getAuthor($)

        // Call findRecipes to get recipes in the article
        let [ , articleResults] = await findRecipes($, articleObj);

        if (dbResult.isNotSolved) {
            if (dbResult.expectedRecipes.split('\n').equals(articleResults.recipes)) {
                console.log("Artcile solved: seq: " + seq.toString() + ", Name: " + dbResult.Name )
                allGood = false;
            }
        } else {
            if (!dbResult.discoveredRecipes.split('\n').equals(articleResults.recipes)
                || articleObj.hasArticleClass != dbResult.hasArticleClass) {
                console.log("Different results: seq: " + seq.toString() + ", Name: " + dbResult.Name )
                console.log("articleObj.hasArticleClass: " + articleObj.hasArticleClass);
                console.log("dbResult.hasArticleClass: " + dbResult.hasArticleClass)
                console.log("dbResults: " + dbResult.discoveredRecipes)
                console.log("articleResults: " + articleResults.recipes)
                allGood = false;
                validateWindow.webContents.send('article-display', 
                  JSON.stringify(

                    {
                      seq: seq,
                      name: dbResult.Name,
                      dbClass: bx(dbResult.hasArticleClass),
                      articleClass: articleObj.hasArticleClass,
                      dbResult: dbResult.discoveredRecipes.split('\n'),
                      articleResults: articleResults.recipes
                    }

                  )
                )
            }
        }
    }
    if (allGood) {
        console.log("All results as expected")
        validateWindow.webContents.send('Ok-display');
    }
    
}

mainline()