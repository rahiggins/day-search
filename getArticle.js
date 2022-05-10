// getArticles iterates backwards through the local NYT Food and Drink 
//  web site, starting on 3/29/2006, which is the last day before the
//  advent of Today's Paper pages.
//
// For each article, it retrieves the article's HTML, parses the article
//  for recipes (using testcase-lib.js, if it exists), and displays the
//  article title and discovered recipes, along with these attributes
//  of the article and its recipes:
//  - hasArticleClass, if there is a designation preceeding the article
//     title, e.g. 'The Minimalist'
//  - hasTitlePunct, if the title contains colons or semicolons
//  - isNotSolved, if the discovered recipes do not match the expected
//     recipes, which can be specified in the article display
//  - hasFragmentedTitle, if a recipe name is split across multiple
//     <p> elements
//  - hasUnquantifiedIngredient, if a recipe includes ingredients that 
//     do not start with a numeric quantity
//
// The display allows the discovered recipe names to be edited to specify
//  the expected recipe names and allows the attibutes to be changed.  The
//  display allows four actions: Skip, Save, Save and Quit, and Quit.
//
// The Skip action advances to the next article without saving the 
//  current article.
//
// The Save actions insert the article and its attributes into a mySQL 
//  database.
//
// The Quit actions terminate getArticles.

// Change log
//  - mainline() - In getting articleClass, add p.css-15x2f4g to the
//      Cheerio merge

// External modules used
const {app, BrowserWindow} = require('electron');
const { ipcMain } = require('electron');
const path = require('path');
const mysql = require('mysql2/promise');
const needle = require('needle')
const puppeteer = require('puppeteer')
const cheerio = require('cheerio')
const fs = require('fs'); // Filesystem functions
const appPath = process.cwd();

// Global variables
let getArticleWindow;   // Browser window
let dayPage;            // Chrome instance tab
let articleInfo;        // Object with article information passed to the 
//                          renderer process to display an article

// Choose source for the article parsing routines:
//  getAuthor
//  recipeParse
//  para
//  adjustTitle
//  findRecipes
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

let waitUntil = "domcontentloaded"  // puppeteer goto waitUntil value
debug = true;

function Log (text) {
    // If debugging, write text to console.log
    if (debug) {
        console.log(text)
    }
}

function createWindow () {
    // On app ready, create a browser window and load getArticle.html.

    console.log("createWindow entered")

    // Create the browser window.
    getArticleWindow = new BrowserWindow({
      x: 10,
      y: 50,
      width: 900, 
      height: 450,
      alwaysOnTop: true,
      webPreferences: {
        preload: path.join(__dirname, 'getArticle-preload.js')
      }
    })

    // and load the index.html of the app.
    getArticleWindow.loadFile('getArticle.html')

    // await launchPup({devtools: true});
    getArticleWindow.show(); // Focus on getArticleWindow

    // Open the DevTools.
    // getArticleWindow.webContents.openDevTools()

    // Emitted when the window is closed.
    getArticleWindow.on('closed', function () {
      // Dereference the window object, usually you would store windows
      // in an array if your app supports multi windows, this is the time
      // when you should delete the corresponding element.
      getArticleWindow = null
    })

}


async function connectPup () {
    // Connect Puppeteer to an existing instance of Chrome that is logged in   
    //  to nytimes.com and create a new page
    // Called from createWindow in Mainline
  
    console.log("connectPup: entered");
  
    // If already connected to Chrome, just exit
    if (typeof browser != 'undefined') {
      if (browser.isConnected()) {
        console.log("Already connected")
        return 0
      }
    }
  
    // Try to obtain the remote-debugging Chrome endpoint.  If successful, connect
    //  puppeteer to the remote-debugging instance of Chrome, create a new page
    //  and return 0. If unsuccessful, return -1, terminating the application.
    let url = "http://127.0.0.1:9222/json/version"
    try {
        let resp = await needle("get", url);
        Log(resp.body.webSocketDebuggerUrl)
        browser = await puppeteer.connect({
            browserWSEndpoint: resp.body.webSocketDebuggerUrl,
            defaultViewport: null
        });
        dayPage = await browser.newPage();
        dayPage.setDefaultNavigationTimeout(0);
        await dayPage.waitForTimeout(250);
      
        console.log("connectPup: exiting");
        return 0
      } catch (e) {
        console.error("Unable to obtain webSocketDebuggerUrl: " + e.code)
        console.log(e)
        return -1
      }
  }

async function mainline() {
    // Main process 

    async function getYear(year) {
        // Get the table rows from the local NYT Food and Drink web page
        //  for the specified year
        // Input: year (string)
        // Output: {
        //  valid: boolean,
        //  func: a Cheerio query function bound to the year's web page,
        //  rows: a Cheerio object comprising the table rows of the web page
        // }

        // The URL of the local NYT Food and Drink web page
        //  for the specified year
        let url = 'http://localhost:8888/R/index.php?y=' + year

        // Get the web page; return {valid: false} if the page does not exist
        resp = await needle("get", url, {follow_max: 10});
        if (resp.body.includes("The stuff in the URL following the question mark does not compute")) {            
            console.log("No such year - " + year)
            return {valid: false}
        }

        // Create a Cheerio query function for the web page
        let $ = cheerio.load(resp.body);
    
        return {
            valid: true,
            func: $,
            rows: $('tr')
        }
    }

    function createDateRowIndices($, tableRows) {
        // Create an array of $('tr') indices comprising the rows specifying
        //  a date (dd/dd/dddd)
        // Input:   $, a query function bound to the year's web page
        //          tableRows, a Cheerio object comprising the table 
        //           rows of the web page
        // Output:  dateRowIndices, an array of the indices in the tableRows
        //           object of rows that contain a 'dd/dd/dddd' date
        let dateRowIndices = [];

        // Filter tableRows for rows that match dd/dd/dddd
        let tableCol1 = $(tableRows).filter((i, row) => {
            //let rowDataElements = $('td', row);
            //let dayRow = $(rowDataElements[0]).text().match(/\d{2}\/\d{2}\/\d{4}/)
            let dayRow = $('td', row).eq(0).text().match(/\d{2}\/\d{2}\/\d{4}/)

            if (dayRow != null) {
                // If the row matches dd/dd/dddd, add its index to the
                //  dateRowIndices array
                dateRowIndices.push(i)
            }
            return dayRow != null
        })

        return dateRowIndices
    }

    async function getArticleDisplayResponse() {
        // This function is called after 'article-display' is sent to
        //  the renderer process.  It returns a promise that is resolved
        //  when the renderer process sends 'next' back to the main
        //  process, which it does when a Skip/Save/Quit button is clicked.
        console.log("getArticleDisplayResponse entered")

        return new Promise(function (resolve) {
            ipcMain.once('next', () => {
                // ipcMain.once is needed because this function is called
                //  repeatedly
                console.log("next entered")
                resolve();
            })
        })
    }

    // This method will be called when Electron has finished
    // initialization and is ready to create browser windows.
    // Some APIs can only be used after this event occurs.
    app.on('ready', createWindow)

    app.on('activate', function () {
        // On macOS it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (getArticleWindow === null) {
          createWindow()
        }
    })

    app.on('will-quit', function () {
        // When the application is quitting, close the tab it opened in the
        //  connected Chrome instance
        dayPage.close()
    })

    ipcMain.on('quit', async (event, arg) => {
        // A Quit button was clicked, so quit the app
        Log("quit entered")
        app.quit()
    })

    ipcMain.handle('save-article', async (evt, arg) => {
        // A Save button was clicked. Save the article and its associated
        //  information to the database.  Return 'true' to the renderer
        //  process when the database save is complete.
        //
        // Input: a stringified articleResponse object - 
        //          { 
        //              hasArticleClass: boolean,
        //              hasTitlePunct: boolean,
        //              isNotSolved: boolean,
        //              hasFragmentedTitle: boolean,
        //              hasUnquantifiedIngredient: boolean,
        //              expectedRecipes: string, newline-delimited recipe
        //                  names, only present if isNotSolved is true
        //          }
        // Output: 'true'

        function bx(b) {
            // Because mySQL does not have a boolean datatype, transform
            //  'true' to 1 and 'false' to 0.  Supposedly, mySQL does this
            //  automatically, but there must be a trick to it.
            if (b) {
                return 1
            } else {
                return 0
            }
        }

        Log("Handling save-article")
        console.log(arg)

        // Parse arg to articleResponse object
        let articleResponse = JSON.parse(arg);
        console.log(articleResponse);

        // If the article is solved, set expectedRecipes to zero-length string
        if (!articleResponse.isNotSolved) {
            articleResponse['expectedRecipes'] = ''
        }

        console.log("articleInfo:")
        console.log(articleInfo)

        // Increment to article sequence number
        seq++

        // Insert the article and its associated information into the database
        let sql = `INSERT INTO articles 
        (seq, date, Name, URL, hasArticleClass, hasTitlePunct, isNotSolved, hasFragmentedTitle, hasUnquantifiedIngredient, discoveredRecipes, expectedRecipes, html) 
        VALUES ('${seq}', '${date}', '${articleInfo.name.replace(/'/g, "\\'")}', '${articleInfo.URL}', '${bx(articleResponse.hasArticleClass)}', '${bx(articleResponse.hasTitlePunct)}', '${bx(articleResponse.isNotSolved)}', '${bx(articleResponse.hasFragmentedTitle)}', '${bx(articleResponse.hasUnquantifiedIngredient)}', '${articleInfo.recipes.replace(/'/g, "\\'")}', '${articleResponse.expectedRecipes.replace(/'/g, "\\'")}', '${html.replace(/'/g, "\\'")}' )`
        try {
            await connection.query(sql)
            console.log("1 record inserted");
        } catch(err) {
            console.log(err)
        }

        // Return a value to the renderer process
        return true
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
    
    // Connect to Chrome
    if (await connectPup() < 0) {
        console.error("Unable to connect to Chrome, terminating")
        app.exit()
    };
    
    // Get the startObj object, which specifies the starting point for
    //  retireving articles
    let startObjFile = appPath + '/startObj.txt'
    let startObj = JSON.parse(fs.readFileSync(startObjFile, 'utf8'));
    Log("startObj:");
    Log(startObj);

    // dateRowIndices is an array of indices in the array of NYT Food and
    //  Drink table rows specifying rows that contain a mm-dd-yyyy
    //  date in the first table data element.  These rows are the start of
    //  the rows containing the articles for the given date.
    let dateRowIndices = startObj.dateArray;

    // dateIndex is the next dateRowIndices index to be processed, i.e. the next date
    //  processed
    let dateIndex = startObj.dateIndex;

    // seq if the sequence number of the last article inserted into the database
    let seq = startObj.seq;

    // Get to specified year's local NYT Food and Drink web page table rows
    let yearObj = await getYear(startObj.year)
    if (yearObj.valid) {
        $ = yearObj.func;
        tableRows = yearObj.rows
    } else {
        return -1
    }
    console.log("Table rows: " + tableRows.length.toString())

    // Define mainline()-scope variables
    let startRowIndex;      // Index in tableRows array
    let dayRows;            // NYT Food and Drink web page table rows for the day
    let date;               // yyyy-mm-dd
    let lastDate = 'first time';  // After first time, save index, seq, etc
    let html;               // Article HTML
    let hasArticleClass;    // Boolean, 'true' if a descriptor precedes the title
    let hasTitlePunct;      // Boolean, 'true' if the title includes ";" or ';'
    let thereIsMore = true; // Boolean, 'false' if there are no more NYT Food and Drink web page table rows             

    // While there are more dates to be preocessed ...
    while (thereIsMore) {
        // ... process a date

        startRowIndex = dateRowIndices[dateIndex];

        // If processing the first date in a new year ...
        if (startObj.objNew) {
            // ... slice the rows of the last day of the year
            dayRows = $(tableRows).slice(startRowIndex);
            startObj.objNew = false;
        } else {
            // ... otherwise, slice the rows between the next date to be processed
            //  and the previous date processed
            let endRowIndex = dateRowIndices[dateIndex+1];    // index of the subsequent date

            // Rows of the date to be processed
            dayRows = $(tableRows).slice(startRowIndex, endRowIndex); 
        }
        console.log("dayRows length: " + $(dayRows).length.toString())

        // Create an array of URLs for the date's articles 
        let articleUrls = $(dayRows).filter( (i, row) => {
            // Iterate through the rows of the date being processed and 
            //  filter for the rows containing 'article' or 'pairing' in
            //  the second data element of the row

            // Get the row's data elements
            let rowDataElements = $('td', row);

            // For the first row, which contains the date ...
            if (i == 0) {

                // ... get the date and transform it from mm/dd/yyyy to yyyy-mm-dd
                date = $(rowDataElements[0]).text().replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$3-$1-$2');

                if (lastDate == 'first time') {

                    // First time, record the date
                    lastDate = date;
                    
                } else {

                    // After first time, when a new date is encountered -
                    //   update startObj and save it
                    console.log("New date: " + lastDate + ", " + date)
                    startObj.dateIndex = dateIndex;
                    startObj.seq = seq;
                    fs.writeFileSync(startObjFile, JSON.stringify(startObj), 'utf8');
                    lastDate = date;
                    
                }
            }

            // Output only rows whose 2nd date element contains 'article' or 'pairing'
            return $(rowDataElements[1]).text().match(/article|pairing/) != null

        }).map( (i, row) => {

            // Map rows containing 'article' or 'pairing' to the article's URL
            let rowDataElements = $('td', row);
            return $('a', rowDataElements[2]).attr('href')

        }).toArray();   // ... and convert Cheerio collection to array

        console.log("Article URLs:")
        for (let i = 0; i < articleUrls.length; i++) {
            console.log(articleUrls[i])
        }

        // Define regex to match the part of a URL between the last '/' and
        //  '.html'
        let nameRX = new RegExp('((?:[^\\/](?!(\\|/)))+)\.html$')

        console.log("Number of articleUrls: " + articleUrls.length.toString())
        for (let i = 0; i < articleUrls.length; i++) {
            // For each article URL ...
            console.log(articleUrls[i])

            // Go to the article
            await dayPage.goto(articleUrls[i], {waitUntil: waitUntil});
            console.log("After page.goto")
            
            // Create a Cheerio query function based to the article's HTML
            html = await dayPage.content();
            let $ = cheerio.load(html)

            // Get the article title and note whether it contains ':' or ';'
            let header = $('header.e12qa4dv0');
            let rawTitle = $('h1', header).text();
            if (rawTitle.match(/[;:]/) != null) {
                hasTitlePunct = true;
            } else {
                hasTitlePunct = false;
            }

            // Call adjustTitle to create an articleObj object
            let articleObj = adjustTitle(rawTitle)

            // Get the article class, if it exists
            let [hasArticleClass, articleClass] = getArticleClass($)

            // Add author to the articleObj
            articleObj['author'] = getAuthor($)
            console.log("Prior to findRecipes, author: " + articleObj.author)

            // Call findRecipes to get recipes in the article
            let [ , articleResults] = await findRecipes($, articleObj);
            let recipes = articleResults.recipes;
            let numRecipes = recipes.length;
            Log("Number of recipes returned by findRecipes: " + numRecipes.toString())
            for (let i = 0; i<numRecipes; i++) {
                console.log(recipes[i])
            }


            // Create an articleInfo object to send to the renderer process
            //  for displaying the article
            articleInfo = {
                seq: seq+1,
                date: date,
                name: articleUrls[i].match(nameRX)[1],
                URL: articleUrls[i],
                articleClass: articleClass,
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
            let [w, h] = getArticleWindow.getSize();

            // Shrink the window size if the current size is more that 450 px
            //  and there are 4 or fewer recipes
            if (h > 450 && numRecipes <= 4) {
                getArticleWindow.setSize(900, 450);
            }

            // Expand the window size if there are more than 4 recipes
            if (numRecipes > 4) {
                getArticleWindow.setSize(900, 450+((numRecipes - 4) * 25), true)
            }

            // Tell the renderer process to display the article and its associated
            //  information
            getArticleWindow.webContents.send('article-display', JSON.stringify(articleInfo));

            // Wait for the renderer process to register a button click
            await getArticleDisplayResponse();
            console.log("back from send article-display")
        
        }
        console.log("After articlesURLs loop, dateIndex: " + dateIndex.toString())

        // Check for year complete, i.e. the first date of the year 
        //  has been processed; if not, decrement dateIndex to process the
        //  next previous date 
        if (dateIndex == 0) {
            // If the year is complete ...
            console.log("Year finished")

            // Set the year to the previous year
            startObj.year = (Number(startObj.year)-1).toString();

            // Get the previous year's data
            let yearObj = await getYear(startObj.year)

            if (yearObj.valid) {
                // If a previous year is available ...

                // Set the Cheerio query function and the table rows Cheerio
                //  object for the next year to be processed
                $ = yearObj.func;
                tableRows = yearObj.rows

                // Update the startObj for the next year
                
                // Create an array of indices corresponding to the tableRows
                //  entries that start a new date
                startObj.dateArray = createDateRowIndices($, tableRows);

                // Set dateIndex to the last date of the year
                startObj.dateIndex = startObj.dateArray.length - 1;

                // Indicate that this is a new year
                startObj.objNew = true;

                console.log(startObj);
                console.log(JSON.stringify(startObj));

                // Write the next year's startObj to the app directory
                fs.writeFileSync(startObjFile, JSON.stringify(startObj), 'utf8');

                // Set dateIndex and dateRowIndices for the next year and repeat processing
                dateIndex = startObj.dateIndex;
                dateRowIndices = startObj.dateArray
            } else {
                // If there are no more years to process, exit the loop
                console.log("No more years")
                thereIsMore = false
            }
        } else {
            // If the year is not complete, decrement dateIndex to get the 
            //  previous date, i.e. the next daate to process
            dateIndex--
        }
    }

    // All years completely processed, close the browser tab,
    //  disconnect from the Chrome instance,
    //  and exit mainline()
    await dayPage.close()
    browser.disconnect()
    return

}

mainline()