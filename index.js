// This application searches nytimes.com for articles published on a particular 
// Sunday or Wednesday.  For Sundays, the search is for articles in the Magazine 
// section.  For Wednesdays, the search is for articles in the Food section. After the
// the day-specific section search, the full day is searched for these keywords:
// [cooking.nytimes.com, tablespoon, shaken, recipe, yield:]

// Each article found by these searches is examined for the presence of recipes.

// The functions that parse an article to identify its title and author and to identify 
//  recipes reside in a separate file -- lib.js.  When the application is started,
//  the application checks for the existence of a file named testcase-lib.js.
//  If it exists, fuctions in that file are used, instead of the functions in lib.js.

// These search results are displayed:
//  - Articles that contain recipes, along with the names of the recipes
//  - Search results that consist of an NYT Cooking page

// For articles that contain recipes, these are displayed:
//  - an article sequence number, date and article title
//  - discovered recipe names, displayed in a textarea element
//  - checkboxes for these attributes:
//    - hasArticleClass
//    - hasTitlePunct
//    - isNotSolved
//    - hasUnquantifiedIngredient
//    - hasFragmentedTitle

//  Buttons are displayed for ViewArticle and Save.
//  The ViewArticle button opens the article in a Chrome instance so that the recipe
//    names displayed in the textarea element can be verified.
//  The Save button stores the article's HTML and attributes in the NYTarticles database.

// The recipe names displayed in the textarea element can be modified to match the
//  actual recipe names as displayed in the article.  If the textarea element is
//  modified, the original textarea contents and the modified contents are saved to
//  the NYTarticles database, and the isNotSolved attribute is stored as 'true'.

// When the Save button is clicked, the article is saved to the NYTarticles database,
//  and the article display is changed to display these:
//    - the adjusted article title (as a link to the article)
//    - the author
//    - an element listing the article's recipe name(s)
//    - the recipe names, i.e. the discovered recipe names, as modified

// For each recipe displayed, a 'Search' button is displayed next to the recipe name.

// For articles that contain more than one recipe, a 'Search All' button is
//  is displayed next to the article title.

// The adjusted article title name and the list of recipe names element can be clicked to copy their
//  HTML to the clipboard to be pasted into an NYT Food and Drink table.

// When a 'Search' or 'Search All' button is clicked, a new browser window and a new Chrome page are
//  created.  In the new Chrome page, cooking.nytimes.com is searched for the author name.  The search
//  results are filtered for recipes that match, exactly of fuzzily, the article's recipe name(s).
//  A fuzzy match is a search result recipe that has two significant words in common with an article's
//  recipe name. Recipe matches are displayed in the new browser window, separated by match type:
//  exact of fuzzy.

// This apppication requires an instance of Chrome enabled for remote debugging.
//  First start Chrome by executing Remote_debug_Chrome.sh in the Terminal app
//  and use that instance of Chrome to log in to nytimes.com.  Then start this
//  application.

// The following are replaced:

      // TESTCASE

      // The application provides an option to write the HTML of each article examined
      //  to ~/Library/Application Support/day-search/testcase/mm-dd-yyyy and an option
      //  to process one of those HTML files as described above, instead of processing 
      //  all the day's articles.

      // The functions that parse an article to identify its title and to identify 
      //  recipes reside in a separate file -- lib.js.  When the option to read an
      //  HTML file is taken, the application checks for the existence of a file
      //  named testcase-lib.js.  If it exists, fuctions in that file are used, instead
      //  of the functions in lib.js.

      // When the application fails to parse an article correctly, the day search can
      //  be repeated with the write-to-testcase option.  Then the lib.js file can
      //  duplicated as testcase-lib.js, and testcase-lib.js can be modified to 
      //  attempt to parse the article correctly.  If the attempt is successful,
      //  lib.js can be replaced by testcase-lib.js.

      // VALIDATE

      // The application provides an option to examine a set of reference articles
      //  for recipes and to compare the recipes found to the recipes known to 
      //  be in the article.  For articles where there is a discrepancy between the 
      //  recipes found and the recipies known to exist, both sets of recipes are 
      //  displayed.

      // The reference articles are in 
      //  ~/Library/Application Support/day-search/testcase/solvedTestcases

      // The validate option uses testcase-lib.js, if it exists.
//


// INCORPORATE getArticle PROCESSING

// This version replaces the TESTCASE and VALIDATE version updates with
//  processing from the getArticle application.  To wit:
//
//   - The option to process a /testcase instance is replaced by 
//      the replay application.
//
//   - The option to validate /testcase instances is replaced by
//      the validate application.


//  RESTRUCTURE SEARCH

// This version restructures the search for articles and article examination for
//  recipes to allow the examination process to be interrupted and restarted from
//  the point of interruption.
//
// In mid-2023, nytimes.com started blocking users it suspected of being robots. One
//  criterion for being a robot is navigating between pages too quickly.  To avoid that,
//  a delay is introduced bwfore each page navigation.  Nonetheless, this script is 
//  likely to be blocked at some point while examining articles for recipes.
//
// To allow the restart of a date after being blocked, processing is restructured
//  to perform all the section and keyword searches before examining any articles
//  for recipes.  After the searches, before examining any articles, information
//  about the unique articles returned by the searches is written to the
//  application's user data folder.
//
// During the examination of articles for recipes, articles found to contain recipes are
//  displayed in the mainWindow.  If the application is blocked, information about the
//  displayed articles and the recipes found therein is written to the user data folder,
//  along with the lastDate object.
//
// The lastDate object, which contains the last date processed and the last database sequence
//  number assigned, is extended to include an indicator of incomplete processing and the
//  index of the article that triggered the blocking.
//
// When the application is blocked during the processing of a date, the next time the
//  application is started, the lastDate object indicates that the processing was
//  incomplete.  The application restarts processing that date, restoring the articles
//  previously displayed to the mainWindow and proceeding with the examination of 
//  articles for recipes from the article that triggered the blocking.


// Version single-search 0.1
// Version validate 0.2
// Version incorporate getArticle processing 0.3
// Version restructure-search 0.1

// Code structure:
//
//  Global variable definitions
//  Function definitions
//   function Log
//   function launchPup
//   function connectPup
//   function login
//   function getRandomInt
//
//   function processSectionOrKeywords
//     function searchResultsNum
//
//  function processDate
//     function displayRecipeArticles
// 
//  function authorSearch
//    function replaceProblematics
//    function normalizeRecipeName
//    function isFuzzy
//    function displayRecipe
//      function extractFromNoscript
//      function downloadImage
//    NYTCooking.on('closed')
//    ipcMain.handleOnce('getSearchArgs')
//
//  function mainline
//    function createWindow
//      mainWindow.on('closed')
//    function closePages
//    ipcMain.handle('getNextDate')
//    ipcMain.on('process-date')
//    ipcMain.on('stop-NYTCooking')
//    ipcMain.on('close-NYTCooking')
//    ipcMain.on('author-search')
//    ipcMain.on('mainAOT')
//    ipcMain.on('mainFocus')
//    ipcMain.on('article-open')
//    ipcMain.on('dialog-error')
//    ipcMain.on('reset-window')
//    ipcMain.on('write-HTML')
//    ipcMain.on('write-text')
//    app.on('ready')
//      calls createWindow
//    app.on('will-quit')
//    app.on('window-all-closed')
//    app.on('activate')
//    ipcMain.handle('save-article')
//      function bx

// Program flow:
//
//   Mainline
//    issues mysql.createConnection
//    app.on('ready')
//      calls createWindow
//    createWindow
//      calls connectPup
//    ipcMain.handle('getNextDate')
//      issues fs.readFileSync
//    ipcMain.on('process-date')
//      calls processDate
//    processDate
//      calls processSectionOrKeywords
//        calls searchResultsNum
//      calls displayRecipeArticles
//        calls adjustTitle
//        calls getArticleClass
//        calls getAuthor
//        calls findRecipes
//    ipcMain.handle('save-article')
//      calls bx
//      issues connection.query(sql)
//    ipcMain.on('author-search')
//      calls authorSearch
//    authorSearch
//      calls normalizeRecipeName
//        calls replaceProblematics
//      calls isFuzzy
//      calls displayRecipe
//        calls extractFromNoscript
//        calls downloadImage

// Data structures
//
// lastDateObj
//  { 
//    lastStoredDate: <string> YYYY-MM-DD
//    seq: <number>
//    complete: <boolean>
//    lastArticle: <number>
//  }
//
// articleObj
//  {
//    ID: <string>
//    title: <string>
//    isBeverage: <boolean>
//    isPairing: <boolean>
//    isRecipe: <boolean>
//    beverageType: <string>
//    author: <string>
//    link: <URL> 
//    keyword: <string>
//  }
//
// articleInfo
//  {
//    ID: <string>
//    seq: <number>
//    date: <string>
//    name: <string>
//    URL: <string>
//    articleClass: <string>
//    type: <string>
//    rawTitle: <string>
//    title: <string>
//    author: <string>
//    keyword: <string>
//    hasArticleClass: <boolean>
//    hasTitlePunct: <boolean>
//    hasFragmentedTitle: <boolean>
//    hasUnquantifiedIngredient: <boolean>
//    recipes: <string>
//  }
//
// articleResponse
//  { 
//      hasArticleClass: boolean,
//      hasTitlePunct: boolean,
//      isNotSolved: boolean,
//      hasFragmentedTitle: boolean,
//      hasUnquantifiedIngredient: boolean,
//      expectedRecipes: string, newline-delimited recipe
//          names, only present if isNotSolved is true
//  }
//
//  htmlObj
//   {
//      <article sequence number, stringified>: article HTML
//    }
//
//  articleDataObj
//   {
//      href: string,
//      recipeName: string,
//      author: string,
//      time: string,
//      dlImg: file path
//    }

// Modules used here
const {app, BrowserWindow, dialog, clipboard} = require('electron');
const { ipcMain } = require('electron');
const path = require('path');
const fs = require('fs'); // Filesystem functions
const https = require('https'); // HTTP protocol over TLS/SSL functions
const { exec } = require('child_process');
const mysql = require('mysql2/promise');
const needle = require('needle'); // HTTP client
const puppeteer = require('puppeteer'); // Chrome API
const cheerio = require('cheerio'); // core jQuery
const pos = require('pos');  // Part Of Speech classification
const dayjs = require('dayjs'); // Date utilities
const customParseFormat = require('dayjs/plugin/customParseFormat')
dayjs.extend(customParseFormat)

// Choose source for the article parsing routines:
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

// Get path to application data and set paths to lastDate.txt and images
const appDataPath = app.getPath('userData');
console.log("appDataPath: " + appDataPath);
const lastDateFile = path.join(appDataPath, 'LastDate.txt');  // Last date processed
const imagesDirectory = path.join(appDataPath, 'images')  // Temp folder for recipe images
const cachedImagesDir = path.join(__dirname, "cachedImages") // Cached generic recipe images

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow

// Global variables
let browser;              // Puppeteer browser
let dayPage;              // Day search page
let NYTCookingID = null;  // NYT Cooking window ID
let NYTCookingPage;       // NYT Cooking page
let lastAuthor = null;    // Last author searched at NYT Cooking

//                        // lastStoredDateObj values
let lastStoredDate;       // Last date successfully processed (if complete == true)
//                        //  or date to restart (if complete == false)
let seq;                  // Article sequence number in the NYTarticles database
let complete;             // <false> if all articles have not been parsed for recipes
let lastArticle;          // Last element of foundArticlesArray successfully parsed

let lastDateObj;
let lastDateObjString;

let dateToSearch;         // YYYY-MM-DD
let debug = true;         // Used by Log function
let articlePageIsOpen = false;  // true while an articlePage is open
let htmlObj = new Object; // Article HTML needed in ipcMain.handle('save-article')

let articleObj;               // Initial description of an article
let articleUrlsFound = [];    // Array of unique article URLs found
let articlesFoundArray = [];  // Array of objects describing articles found
let articlesSkipped;          // Count of articles previously found and so skipped
let articlesDisplayed;        // Count of articles displayed
let displayedArticleInfoArray = []; // Array of articleInfo objects displayed in mainWindow
let lastKeyword;
let dateDir;
let articlesFoundArrayFile;
let displayedArticleInfoArrayFile;
let htmlObjFile;

let waitUntil = "networkidle2"  // puppeteer goto waitUntil value
let lastRandom = 0          // Last value generated by function getRandomInt

// Function definitions

function Log (text) {
  // If debugging, write text to console.log
  if (debug) {
      console.log(text)
  }
}

async function launchPup (opt) {
  // Launch Puppeteer and create a page
  // Called from Mainline
  //
  // This function is currently unused.  See function connectPup.

  console.log("launchPup: entered");
  browser = await puppeteer.launch(opt);
  dayPage = await browser.newPage();
  //await page.setDefaultNavigationTimeout(0);
  dayPage.setDefaultNavigationTimeout(0);
  console.log("launchPup: exiting");
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
      return -1
    }
}

async function login () {
  // Log in to nytimes.com
  // This function is currently unused.  Programmatically logging into nytimes.com seems to
  //  to trigger Captcha displays.  Instead, the app connects to an existing instance of Chrome
  //  that is already manually logged into nytimes.com.

  return new Promise(function (resolve) {
      dayPage.once('framenavigated', async frame => {
          console.log("Frame navigated");
          if (frame.url().includes('myaccount.nytimes.com')) {
              console.log('Login frame navigated')
              await frame.waitForSelector('#username')
             // await frame.type('#username', 'rahiggins@ameritech.net', {delay: 250});

              await frame.waitForTimeout(1000)
              await frame.type('#username', 'rahiggins@ameritech.net', {delay: 500});
              await frame.waitForTimeout(1000)
              await frame.type('#password', '4l9SYcKhRP', {delay: 500});
              await frame.waitForTimeout(2000);
              await frame.click('#myAccountAuth > div.css-1xd1ug7-Container.edabiy60 > div > form > div > div.css-1696vl4-buttonWrapper-Button > button');
              console.log("Clicked login");
              resolve();
          }
      })
  });
}

function getRandomInt(min = 35000, max = 60000, gap = 10000) {
  // Generate a random number of milliseconds between *min* and *max* to be used as
  //  a delay before accessing nytimes.com pages to avoid being blocked as a robot.
  // The number generated must be *gap* seconds or more from the previously returned number, which is
  //  contained in the global variable lastRandom

  let random;

  // Find a millisecond delay *gap* seconds or more from the last delay
  do {
    random = Math.floor(Math.random() * (max - min) + min); // The maximum is exclusive and the minimum is inclusive
  } while (Math.abs(random - lastRandom) < gap)
  console.log("Click delay: " + random.toString() + " ms")

  // Set the found delay as the last delay and return it
  return lastRandom = random
}

//////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////


async function processSectionOrKeywords(url, dayOfWeek, searchDomain, domainType) {
  // Go to a search page listing articles that match the criteria specified in
  //  the url argument.
  // Examine each matching article to determine if the article contains recipes.
  // Pass information about articles that contain recipes to the renderer process to be displayed.
  //
  // Input: url - www.nytimes.com/search with a query string indicating
  //              a date and either a section (Magazine | Food) or a keyword
  //              (cooking.nytimes.com, tablespoon | shaken | recipe | yield:)
  //
  //        dayOfWeek - integer: ( 0 (Sunday) | 3 (Wednesday) )
  //
  //        searchDomain - string: ( 'X section' | 'keyword X' )
  //
  //        domainType - string: ( 'section' | 'keyword' )

  async function searchResultsNum() {
    // Return the number of results in the search page.  The search results are presented in an
    //  ordered list element.

    // Create a Cheerio query function for dayPage
    let $ = cheerio.load(await dayPage.content());

    // Get the list items in the page's ordered list
    let listItems = $('li.css-1l4w6pd', 'ol')

    // Return the number of those list items
    return listItems.length;
  }

  Log("processSectionOrKeywords entered with url: " + url + ", searchDomain: " + searchDomain);

  // First, make the dayPage tab active (bringToFront).
  await dayPage.bringToFront();

  // Go to the search results page
  await dayPage.goto(url, {waitUntil: waitUntil});

  // For section searches, see if the list of search results is empty (2/16/2000 - no 
  //   Food section).  If so, search the Style section instead.
  if (domainType == 'section') {

    // Define constants needed to transform a search URL from section 
    //  Food or Magazine to section Style using string.replace().
    const repl = {
      0: {                                              // For Sundays
        'oS': 'Magazine',                               //  old section
        'oG': 'a913d1fb-3cdf-556b-9a81-f0b996a1a202',   //  old gibberish (identifier)
        'nS': 'Style',                                  //  new section
        'nG': '146e2c45-6586-59ef-bc23-90e88fe2cf0a'    //  new gibberish
      },
      3: {                                              // For Wednesdays
        'oS': 'Food',                                   //  old section
        'oG': '4f379b11-446b-57ae-8e2a-0cff12e0f26e',   //  old gibberish (identifier)
        'nS': 'Style',                                  //  new section
        'nG': '146e2c45-6586-59ef-bc23-90e88fe2cf0a'    //  new gibberish
      }
    }

    // Convert dayOfWeek to string for use as repl object key
    let dOW = dayOfWeek.toString()

    // Get the ordered list of search results
    let ol = await dayPage.$('ol')
    
    // Get number of search results (listitems in the ordered list)
    let sR = await ol.$$('li')
    let numSearchResults = sR.length
    Log("--- Number of search results: " + numSearchResults.toString())
    
    // If there were no search results, the Food/Magazine section might not exist.
    //  Try the Style section instead. 
    if (numSearchResults == 0) {

      // Transform the search URL into a Style section search URL
      url = url.replace(repl[dOW]['oS'], repl[dOW]['nS']).replace(repl[dOW]['oG'], repl[dOW]['nG']);

      // Change the search domain to 'Style section'
      searchDomain = searchDomain.replace(repl[dOW]['oS'], repl[dOW]['nS']);
      Log("Search switched to Style section")
    }

    // Go to the Style section search results
    await dayPage.waitForTimeout(getRandomInt(10000, 20000, 4000))
    await dayPage.goto(url, {waitUntil: waitUntil});
  }

  //
  // The search page will display up to 10 articles, and if there are more
  //  articles that match the search, a "Show More..." button is displayed
  //  at the bottom of the page.  Each time that button is clicked, 10 more 
  //  matching articles are added to the search results page and, if there
  //  are still more undisplayed, another "Show More..." button is displayed
  //  at the bottom of the page, until there are no more undisplayed search
  //  results.
  //
  // Expand the search results by clicking "Show More..." buttons repeatedly
  //  until the search results page does not contain a "Show More..." button.

  // Get number of search results initially displayed
  let currentSearchResultsNum = await searchResultsNum()
  Log("Initial search results: " + currentSearchResultsNum.toString())

  // Look for 'Show More' button and if found, click it 
  do {
      Log("Looking for Show More...")

      // Wait 250ms for Show More button to appear, exit loop if it doesn't appear 
      try {
          await dayPage.waitForSelector('[data-testid="search-show-more-button"]', {timeout: 250});
          Log("Show more found")
      } catch {
          Log("Show more not found, exiting loop")
          break;
      }

      // If button appears, click it...
      let button = await dayPage.$('[data-testid="search-show-more-button"]');
      Log("Pre-click Search Results: " + currentSearchResultsNum.toString())
      await dayPage.waitForTimeout(getRandomInt(10000, 20000, 4000))
      Log("Clicking Show More button");
      await button.click()

      // ... then wait 250ms at a time until the number of search results changes
      do {
          Log("Waiting...")
          await dayPage.waitForTimeout(250);
          newNum = await searchResultsNum();
      } while (currentSearchResultsNum == newNum)

      // Update number of search results and repeat
      currentSearchResultsNum = newNum
      Log("New search results: " + currentSearchResultsNum.toString())

  } while (true)

  // When all search results are shown, create a array of 
  //  search result (i.e. article) objects:
  //  {title:, author:, link:, isBeverage:, isPairing:, isRecipe:}

  // First, create an array of Cheerio objects corresponding to the articles 
  //   returned by the search. Search results are displayed in an ordered list.

  // Create a Cheerio query function based on the search results page.
  let $ = cheerio.load(await dayPage.content());

  // Create array listItems of <li> elements in the search results ordered
  //   list that have attribute data-testid=search-bodega-result.
  let listItems = $('li', 'ol').filter(function (i, el) {
    return $(this).attr('data-testid') === 'search-bodega-result'
  })
  Log("Final search results: " + listItems.length.toString());

  // Next, iterate over the article list items and extract:
  //  - the article title
  //  - the article's author
  //  - the article's href
  // 
  //  Examine the article title to determine if the article is:
  //   - a beverage tasting article,
  //   - a beverage pairing article,
  //   - a stand-alone recipe,
  //   or an ordinary article

  // Define an array of article objects
  let articles = [];
  
  // For each search result article:
  $(listItems).each( async function(i, elem) {
    
    // Get title
    let title = $('h4',this).text().trim();

    // Get href, discard query string (?...), and prefix relative hrefs
    let href = $('a',this).attr('href');
    href = href.substring(0,href.indexOf('?'));
    if (href.startsWith("/")) {
      href = `https://www.nytimes.com${href}`;
    }  

    // Separate article title from prefixes, check prefixes for beverage,
    //  pairing, recipe, etc.  
    // Return:
    //  {title:, isBeverage:, isPairing:, isRecipe:, beverageType:}
    articleObj = adjustTitle(title);

    // Add author and href to articleObj
    articleObj.author = $('p.css-15w69y9',this).text().substring(3);
    articleObj.link = href;

    // Push articleObj onto the articles array
    articles.push(articleObj);

  })

  let articlesNum = articles.length.toString();
  Log("Array articles length: " + articlesNum);

  // For each article, parse the article HTML to identify embedded recipes and display
  //  the article title and its discovered recipes.
  for (a = 0; a<articles.length; a++) {

    // Display progress bar showing progress through this loop
    //mainWindow.webContents.send('progress-bar', [a+1, articlesNum, searchDomain]);

    if (articleUrlsFound.includes(articles[a].link)) {
      // If this article's url is in the array of articles already found,
      //  skip it.
      articlesSkipped++; // Count skipped articles
      continue;
    } else {
      // If not, add this article's url to the array of articles already found
      articleUrlsFound.push(articles[a].link);

      // Add the search domain to this articleObj
      articles[a]['keyword'] = domainType == 'keyword' ? searchDomain.split(' ')[1] : '' ;

      // Add this articleObj to the articles found array
      articlesFoundArray.push( articles[a] )
    }
  }
}


//////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////




async function processDate (dateToSearch) {
  // Search a date (Sunday: Magazine section or Wednesday: Food Section)
  //  for articles. Then search the day for certain keywords.

  // Called from ipcMain.on('process-date')

  // Input: date, <string> 'YYYY-MM-DD'

  // Calls: processSectionOrKeywords
  //        displayRecipeArticles

  Log("processDate entered with dateToSearch: " + dateToSearch);
  
  async function pause(ms) {
    // Pause processing
    // Input: number of milliseconds
    // Output: a Promise that resolves after ms milliseconds
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  async function displayRecipeArticles(artObj, html) {
    // Parse articles to identify recipes.  When recipes are identified,
    //  display the article, its recipe names and its recipe attributes for
    //  saving in the NYTarticles database.

    // Input:
    //  artObj  articleObj
    //  html    the article's HTML
   
    console.log('displayRecipeArticles entered with url: ' + artObj.link + ', title: ' + artObj.title)

    // Define regex to match the part of a URL between the last '/' and
    //  '.html'
    let nameRX = new RegExp('((?:[^\\/](?!(\\|/)))+)\.html$')

    // Create a Cheerio query function for the article page
    let $ = cheerio.load(html)

    // Get the article title and note whether it contains ':' or ';'
    let header = $('header.e12qa4dv0');
    let rawTitle = $('h1', header).text();
    if (rawTitle.match(/[;:]/) != null) {
        hasTitlePunct = true;
    } else {
        hasTitlePunct = false;
    }

    //  // Call adjustTitle to create an articleObj object
    //  let articleObj = adjustTitle(rawTitle);
    //  
    // Get the article class, if it exists
    let [hasArticleClass, articleClass] = getArticleClass($);
    //  
    //  // Add author to the articleObj
    //  articleObj['author'] = getAuthor($);
    console.log("Prior to findRecipes, author: " + artObj.author);

    // Call findRecipes to get recipes in the article
    let [ , articleResults] = await findRecipes($, artObj); 

    // For articles that have recipes, display the article
    if (articleResults.hasRecipes) {

      //let recipes = articleResults.recipes;
      let numRecipes = articleResults.recipes.length;
      Log("Number of recipes returned by findRecipes: " + numRecipes.toString())
      for (let i = 0; i<numRecipes; i++) {
          console.log(articleResults.recipes[i]);
      }

      if (numRecipes > 0) {
        // Create an articleInfo object to send to the renderer process
        //  for displaying the article
        
        // Increment database sequence number
        seq++

        // Create an object (articleInfo) containing information about and attributes of the article
        //  to be passed to the renderer process 
        articleInfo = {
          ID: 'articleInfo',
          seq: seq,
          date: dateToSearch,
          name: artObj.link.match(nameRX)[1],
          URL: artObj.link,
          articleClass: articleClass,
          type: articleResults.type,
          rawTitle: rawTitle,
          title: artObj.title,
          author: artObj.author,
          keyword: artObj.keyword,
          hasArticleClass: hasArticleClass,
          hasTitlePunct: hasTitlePunct,
          hasFragmentedTitle: articleResults.hasFragmentedTitle,
          hasUnquantifiedIngredient: articleResults.hasUnquantifiedIngredient,
          recipes: articleResults.recipes.join('\n')
        }

        // Add articleHTML to htmlObj for use in ipcMain.handle('save-article')
        htmlObj[seq.toString()] = html;
        
        // Adjust the window size according to the number of recipes to
        //  to be displayed
        // Get the current window size
        let [w, h] = mainWindow.getSize();
        // Shrink the window size if the current size is more that 450 px
        //  and there are 4 or fewer recipes
        if (h > 450 && numRecipes <= 4) {
            mainWindow.setSize(900, 450);
        }
        // Expand the window size if there are more than 4 recipes
        if (numRecipes > 4) {
            mainWindow.setSize(900, 450+((numRecipes - 4) * 25), true)
        }
        
        // Tell the renderer process to display the article and its associated
        //  information
        console.log("displayRecipeArticles - Displaying article, articleInfo:")
        console.log(JSON.stringify(articleInfo))
        mainWindow.webContents.send('article-save', JSON.stringify(articleInfo));
        
        // Add the articleInfo object to the displayed article array, used for restart
        displayedArticleInfoArray.push(articleInfo);

      } else {
        console.log("paradox: hasRecipes but numRecipes == 0")
      }
    }

  }

  // If the NYTCooking window ID is not null, close the existing NYTCooking window
  if (NYTCookingID !== null) {
    Log("Closing existing NYTCooking window")
    BrowserWindow.fromId(NYTCookingID).close();
    NYTCookingID = null;
    await NYTCookingPage.close();
  }

  // Path to this date's folder in the Application Support folder.  Objects
  //  related to the processing of this date will be written here.
  dateDir = path.join(appDataPath, dateToSearch);

  // Define paths to files used to restart article processing
  articlesFoundArrayFile = path.join(dateDir, "articlesFoundArray.txt");
  displayedArticleInfoArrayFile = path.join(dateDir, "displayedArticleInfoArray.txt");
  htmlObjFile = path.join(dateDir, "htmlObj.txt");

  let articlesFoundArrayString; // Stringified array of foundArticleObj objects

  if (complete) {
    // The previous date was completed, so start processing a new date
    //  by collecting all the articles in the target section and the
    //  articles found by searching for keywords.

    // Initialize array of urls of articles found, which is used to skip processing
    //  articles already found, and the count of articles displayed and articles skipped
    articleUrlsFound = [];
    articlesDisplayed = 0;
    articlesSkipped = 0;
  
    // Empty the htmlObj object
    htmlObj = {}
  
    //
    // Form the article search URL for the day's section that usually has recipes:
    //  Sunday: Magazine
    //  Wednesday: Food
    //
  
    // Remove hyphens from dateToSearch for use in URL
    let urlDateToSearch = dateToSearch.replace(/-/g, '');
  
    // Get day of week (0-6) of selected date
    let dateToSearchObj = new Date(dateToSearch); // dateToSearchObj is UTC ...
    let dayOfWeek = dateToSearchObj.getUTCDay();  // ... so must use getUTCDay()
  
    // Get search URL for the selected day
    let dayURL;
    if (dayOfWeek == 0) {
        // Sunday URL
        dayURL = `https://www.nytimes.com/search?dropmab=true&endDate=${urlDateToSearch}&query=&sections=Magazine%7Cnyt%3A%2F%2Fsection%2Fa913d1fb-3cdf-556b-9a81-f0b996a1a202&sort=best&startDate=${urlDateToSearch}`
        searchDomain = "Magazine section"
    } else {
        // Wednesday URL
        dayURL = `https://www.nytimes.com/search?dropmab=true&endDate=${urlDateToSearch}&query=&sections=Food%7Cnyt%3A%2F%2Fsection%2F4f379b11-446b-57ae-8e2a-0cff12e0f26e&sort=best&startDate=${urlDateToSearch}`
        searchDomain = "Food section"
    }
  
    // Search the day's recipe section for articles containing embedded recipes
    Log("Searching " + searchDomain)
  
    // Tell the renderer process to display a spinner while expanding the 
    //  search results
    mainWindow.webContents.send('display-spinner');
  
    await processSectionOrKeywords(dayURL, dayOfWeek, searchDomain, 'section');
  
    mainWindow.webContents.send('remove-spinner');
  
    // 
    // Search all the day's articles for articles containing these keywords:
    let keywords = ["cooking.nytimes.com", "Tablespoon", "Shaken", "Recipe", "Yield:"];
  
    for (let k = 0; k < keywords.length; k++) {
      // For each keyword,
    
    
      // Form the search URL specifying the day and the keyword
      let url = `https://www.nytimes.com/search?dropmab=true&endDate=${urlDateToSearch}&query=${keywords[k]}&sort=best&startDate=${urlDateToSearch}`
    
      // Wait a bit before processing each keyword to evade robot detection
      await pause(Math.floor(Math.random() * (10000 - 5000) + 5000))
    
      // Display a 'Searching ...' message for the keyword and a spinner
      mainWindow.webContents.send('show-msg', "Searching for keyword " + keywords[k])
      mainWindow.webContents.send('display-spinner');
    
          
      // Search the day's articles for the keyword
      searchDomain = "keyword " + keywords[k]
      Log("Searching " + searchDomain)
      await processSectionOrKeywords(url, dayOfWeek, searchDomain, 'keyword');
      if (keywords[k] == 'cooking.nytimes.com') {
        console.log("done with keyword cooking.nytimes.com")
      }
    
      // Remove the spinner
      mainWindow.webContents.send('remove-spinner');
    
    }
  
    // Initialize last keyword encountered
    lastKeyword = '';

    console.log("end of processDate");
    Log("Articles found: " + articlesFoundArray.length.toString());
    Log("Articles skipped: " + articlesSkipped.toString());

    // Store the array of found articles in this date's folder.

    if (fs.existsSync(dateDir)) {
      // If the date's folder already exists, delete it and its contents
      fs.rmSync( dateDir, { force: true, recursive: true } )
    }

    // Create the date's folder
    fs.mkdirSync(dateDir);

    // Write the stringified array of found articles to this date's folder
    articlesFoundArrayString = JSON.stringify(articlesFoundArray)
    fs.writeFileSync(articlesFoundArrayFile, articlesFoundArrayString, "utf8");

  } else {
    // A previous processing of this date did not complete. Restart processing
    //  of the date where the previous attempt left off.

    console.log("Restarting " + dateToSearch + " at article number " + lastArticle.toString())
    mainWindow.webContents.send('restart-msg');

    // Restore the array of found articles from the Application Support folder.
    articlesFoundArrayString = fs.readFileSync(articlesFoundArrayFile, "utf8");
    articlesFoundArray = JSON.parse(articlesFoundArrayString);

    // Restore the array of displayed articleInfo objects from the Application Support folder.
    displayedArticleInfoArrayString = fs.readFileSync(displayedArticleInfoArrayFile, "utf8");
    displayedArticleInfoArray = JSON.parse(displayedArticleInfoArrayString);

    // Restore the HTML object from the Application Support folder.
    htmlObjString = fs.readFileSync(htmlObjFile, "utf8");
    htmlObj = JSON.parse(htmlObjString);

    // Redisplay previously displayed articles
    lastKeyword = ''
    for (i = 0; i < displayedArticleInfoArray.length; i++) {

    // If the keyword that yielded this article has changed from the last one,
    //  tell the renderer process to display a keyword divider 
      if (displayedArticleInfoArray[i].keyword != lastKeyword) {
        lastKeyword = displayedArticleInfoArray[i].keyword;
        mainWindow.webContents.send('keyword-div', lastKeyword);  // Display divider
      }

      switch (displayedArticleInfoArray[i].ID) {
        case 'articleInfo':
          // Send articleInfo object for an article    
          mainWindow.webContents.send('article-save', JSON.stringify(displayedArticleInfoArray[i]));
        case 'articleObj':
          // Send articleObj for an NYT Cooking recipe
          mainWindow.webContents.send('article-display', [JSON.stringify(displayedArticleInfoArray[i]), "NYT Cooking"])
      }
    }

  }

  let firstTime = true;
  for ( a = lastArticle; a < articlesFoundArray.length; a++ ) {

    // Display progress bar showing progress through this loop
    mainWindow.webContents.send('progress-bar', [a+1, articlesFoundArray.length, firstTime]);
    if (firstTime) {
      firstTime = false;
    }


    Log("Go to article " + articlesFoundArray[a].link)
    Log("Title: " + articlesFoundArray[a].title)
    Log("Author: " + articlesFoundArray[a].author)
    Log("isBeverage: " + articlesFoundArray[a].isBeverage)
    Log("isRecipe: " + articlesFoundArray[a].isRecipe)
    Log("beverageType: " + articlesFoundArray[a].beverageType)
    Log("Keyword: " + articlesFoundArray[a].keyword)

    // If the keyword that yielded this article has changed from the last one,
    //  tell the renderer process to display a keyword divider 
    if (articlesFoundArray[a].keyword != lastKeyword) {
      lastKeyword = articlesFoundArray[a].keyword; // Update last keyword
      mainWindow.webContents.send('keyword-div', lastKeyword);  // Display divider
    }

    if (articlesFoundArray[a].link.includes("cooking.nytimes.com")) {
      // If this article is an NYT Cooking recipe, just display it without
      //  parsing it for recipes
      Log("Display NYT Cooking recipe: " + articlesFoundArray[a].title);
      articlesDisplayed++;
      mainWindow.webContents.send('article-display', [JSON.stringify(articlesFoundArray[a]), "NYT Cooking"])
      // Add the NYT Cooking recipe's articleObj to the displayed article array, 
      //  used for restart
      displayedArticleInfoArray.push(articlesFoundArray[a]);
    } else {
      // Otherwise, create a new browser page and go to the article to parse it
      articlePage = await browser.newPage();
      articlePageIsOpen = true;
      articlePage.setDefaultNavigationTimeout(0);
      await articlePage.waitForTimeout(250); // Wait a quarter sec

      // Occasionally, a goto an article page returns a captcha page, which
      //  can be identified by the absence of any <div> elements.
      //  In the event of a captcha page, tell the renderer process to display
      //  a message and a button, then wait for the renderer process to say
      //  the button was clicked, indicating that the captcha was solved.
      //  Repeat the goto article page.
      // Go to an article page
      Log("Go to: " + articlesFoundArray[a].link);
      await articlePage.waitForTimeout(getRandomInt())
      await articlePage.goto(articlesFoundArray[a].link, {waitUntil: waitUntil});
      Log("Back from: " + articlesFoundArray[a].link);

      // Get the article page's HTML and create a Cheerio query function for the HTML
      let articleHTML = await articlePage.content();

      // If the article page contains no div elements, it's a CAPTCHA page.
      //  Pause to allow the CAPTCHA to be manually solved
      let divs = await articlePage.$$('div')
      if (divs.length == 0) {
        Log("Captcha detected");
        gotCaptcha = true;
        mainWindow.setAlwaysOnTop(false);


        // Tell the renderer process to display a 'captcha detected' message.
        mainWindow.webContents.send('captcha-detected')

        // See if it's a transient problem
        let ps = await articlePage.$$('p');
        console.log("Number of <p> elements: " + ps.length.toString())
        let isBlocked = true; // Assume it's not transient
        for (i=0; i<ps.length; i++) {
          let pt = await ps[i].evaluate( p => p.textContent)
          console.log('<p> starts with: ' + pt.substring(0, 20))
          if (pt.startsWith("We're sorry, we seem")) {
            isBlocked = false; // Yes it is transient
            break;
          }
        }

        if (isBlocked) {
          // If the application is blocked, save the progress thus far and then
          //  terminate.

          // Display 'Blocked'
          mainWindow.webContents.send('show-msg', 'Blocked by nytimes.com', false)

          // Save the lastDateObj for restarting the search
          lastDateObj.lastStoredDate = dateToSearch;
          lastDateObj.seq = seq;
          lastDateObj.complete = false;
          lastDateObj.lastArticle = a;  // Restart at this article

          lastDateObjString = JSON.stringify(lastDateObj)
          console.log(lastDateObjString)
          fs.writeFileSync(lastDateFile, lastDateObjString, "utf8");

          // Save the array of displayed articleInfo objects for restarting
          displayedArticleInfoArrayString = JSON.stringify(displayedArticleInfoArray);
          fs.writeFileSync(displayedArticleInfoArrayFile, displayedArticleInfoArrayString, "utf8");

          // Save the HTML object for restarting
          htmlObjString = JSON.stringify(htmlObj);
          fs.writeFileSync(htmlObjFile, htmlObjString, "utf8");

          throw "Blocked by nytimes.com, terminating"
        }

        // It it's a transient problem, wait for page navigation and then continue
        console.log("Waiting for navigation")
        await articlePage.waitForNavigation()
        console.log("Navigation ocurred")

        mainWindow.setAlwaysOnTop(true);

        // Tell the renderer process to remove the 'captcha detected' message.
        mainWindow.webContents.send('captcha-solved')

        // Create a Cheerio query function based to the article's HTML
        articleHTML = await articlePage.content();
        console.log("Length of article HTML: " + articleHTML.length.toString())
      }

      // Go parse the article for recipes and display articles that contain recipes
      displayRecipeArticles(articlesFoundArray[a], articleHTML);

      // Close the article browser page
      await articlePage.close();
      articlePageIsOpen = false;

    }

  }

  console.log("Articles displayed: " + articlesFoundArray.toString())

  // Show and focus on the main browser window
  mainWindow.show();
  
  // Allow the user to bring other windows to the top
  mainWindow.setAlwaysOnTop(false);
  
  // Tell the renderer process to remove the progress bar and to enable buttons
  mainWindow.webContents.send('process-end')
  console.log("mainWindow is AlwaysOnTop: " +  mainWindow.isAlwaysOnTop())

}




///////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////





async function authorSearch (author, title, all) {
  // Search NYT Cooking for recipes by author, then
  //  filter search results by recipe name (title)
  // Input: author - string
  //        title - array of strings
  //        all - boolean, true if title array has more than 1 element

  Log("authorSearch entered with author: " + author + ", title: " + title + ", all: " + all)

  let pages;  // Number of author search results pages

  // NYT Cooking's treatment of diacritics is inconsistent (see Fitting the Mold 7/20/2003)
  //  Replacing diacritic marked letters with the base letter enables recipe name 
  //    comparisons despite differing diacritic treatments.
  //  Used in function replaceProblematics
  let diacritics = {
      a: 'ÀÁÂÃÄÅàáâãäåĀāąĄ',
      c: 'ÇçćĆčČ',
      d: 'đĐďĎ',
      e: 'ÈÉÊËèéêëěĚĒēęĘ',
      i: 'ÌÍÎÏìíîïĪī',
      l: 'łŁ',
      n: 'ÑñňŇńŃ',
      o: 'ÒÓÔÕÕÖØòóôõöøŌō',
      r: 'řŘ',
      s: 'ŠšśŚ',
      t: 'ťŤ',
      u: 'ÙÚÛÜùúûüůŮŪū',
      y: 'ŸÿýÝ',
      z: 'ŽžżŻźŹ'
    }

  // NYT cooking recipe names use left/right apostrophes and quotes while
  //  the original material used straight apostrophes and quotes.
  // These objects are used by function replaceProblematics to replace
  //  left/right with straight to normalize recipe names for comparison
  //
  // Left/right apostrophes (a) and left/right double quotes (b)
  let fancy = ({a: decodeURIComponent("%E2%80%98") + decodeURIComponent("%E2%80%99"), 
                b: decodeURIComponent("%E2%80%9c") + decodeURIComponent("%E2%80%9d")})
  // Straight apostrophe (a) and straight quote (b)              
  let plain = ({a: "'", 
                b: '"'})

  // Parts Of Speech (package pos) definitions              
  const lexer = new pos.Lexer(); // Splits text into words and other tokens
  const tagger = new pos.Tagger(); // Tags words and other tokens as parts of speech
  const interestingPOS = ["FW", "JJ", "NN", "VBN"] // Foreign words, adjectives, nouns and past particples//

  function replaceProblematics(text) {
    // Replace letters with diacritical marks with the corresponding base letter to 
    //  normalize recipe names for comparisons.  See:
    //  https://stackoverflow.com/questions/863800/replacing-diacritics-in-javascript#comment81646726_32756572
    // Replace left/right single and double quotes straight single and double quotes
    //
    // Input: string 
    // Output: string with diacritical marked letters replaced by base letters and
    //         left/right quotes and double quotes replaced by straight quotes and double quotes
    // Called by: normalizeRecipeName

    return text.split('').map(l =>  Object.keys(diacritics).find(k => diacritics[k].includes(l)) || 
                                    plain[Object.keys(fancy).find(k => fancy[k].includes(l))] ||                              
                                    l).join(''); 
  }

  function normalizeRecipeName(txt) {
      // Normalize recipe names for comparison
      //  Call replaceProblematics to:
      //   - replace diacritic marked letters with the base letter and
      //   - replace left/right single and double quotes with straight single and double quotes
      //  Lower-case all letters
      //  Replace double spaces with a single space
      //  Trim leading and trailing spaces
      // Input: txt - array of recipe names
      // Output: array of normalized recipe names

      return txt.map( t => replaceProblematics(t).toLowerCase().replace(/  +/g, ' ').trim() );
  }

  function isFuzzy(recipe, interestingTargetRecipeNameWords) {
    // Does input recipe (name) contain at least 2 different interesting words 
    //  from the targetRecipeName?
    // Called from authorSearch
    // Input: name of recipe returned by NYT Cooking search
    //        array of interesting words in the target recipe name
    // Output: boolean

    // Extract words from input recipe name
    let recipeWords = lexer.lex(recipe);

    // Number of interesting target recipe name words found in the input recipe name
    let matchedRecipeWords = 0;

    // List of interesting target recipe name words found in the input recipe name
    let matched = [];
    // See if words in the input recipe name match interesting words in the target recipe name

    for (let w = 0; w < recipeWords.length; w++) {
        // Is input recipe name word an interesting target recipe name word that hasn't aleardy been matched?

        if (interestingTargetRecipeNameWords.includes(recipeWords[w]) && !matched.includes(recipeWords[w])) {
            // Yes, count the match ...
            matchedRecipeWords++
            // ... and note that the interesting target recipe name word has been matched
            matched.push(recipeWords[w])
        }

    }

    // Return true if the input recipe name contains 2 or more different interesting words
    return (matchedRecipeWords > 1)

  }

  async function displayRecipe(articleElem, section, name, index, imageCounter) {
    // Extract data items from an <article> element (a recipe card) and send those
    //  items to the renderer process to recreate the recipe card in the
    //  designated section, "exact" ot "fuzzy"
    // The data items extracted are:
    //  - the recipe href
    //  - the recipe name
    //  - the recipe author
    //  - the recipe time
    //  - the recipe image

    // Called from authorSearch
    // Input:   <article> element,
    //          display section, "exact" ot "fuzzy"
    //          target recipe name
    //          index of recipe name in recipe name array
    //          counter used to name the downloaded recipe image
    // Calls:   NYTCooking.webContents.send('display-recipe' ...

    Log("displayRecipe entered")
    Log(" Section: " + section)
    Log(" Name: " + name)
    Log(" Index: " + index.toString())
    Log(" imageCounter: " + imageCounter.toString())
    
    // If image src starts with 'data:image/gif', image src will be extracted from the associated 
    //  <noscript> element
    const dataImageGif = 'data:image/gif'
    
    // Function to extract an image source URL from a <noscript> element
    //  Called for <img> elements whose src attribute is specified as 'data:image/gif'
    function extractFromNoscript() {
      // Output: image source url

      // Regex to extract image souce url from a <noscript> element
      // Source urls will be of one of these two forms:
      //  /assets ... png\?w=1280&q=75
      //  https: ... jpg\?w=1280&q=75
      const srcRx = new RegExp(/(.*(\/assets.*png\?w=1280&amp;q=75).*|.*(https:.*jpg\?w=1280&amp;q=75).*)/)

      // Get <noscript> element
      let noscript = $('noscript')

      // If a <noscript> element exists ...
      if (noscript) {
        let nsHTML = $('noscript').html()
        let nsMatch = nsHTML.match(srcRx)
        let src = nsMatch[3] == undefined ? nsMatch[2] : nsMatch[3]
        console.log("dataImageGif - $(noscript).html().match(srcRx): " + src)
        return src
      } else {
        throw new Error('dataImageGif but <noscript> absent')
      }
    }

    // Function to download an image from a cooking.nytimes.com search result
    //  A cooking.nytimes.com search result is an <article> element, which includes
    //  an <img> element
    function downloadImage(url, filepath) {
      // Download image from url to filepath
      // Input: image url
      //        path to download destination

      return new Promise((resolve, reject) => {
          https.get(url, (res) => {
              if (res.statusCode === 200) {
                  res.pipe(fs.createWriteStream(filepath))
                      .on('error', reject)
                      .once('close', () => resolve(filepath));
              } else if (res.statusCode == 403) {
                // If Forbidden, copy a cached version of the image

                // Generic recipe images are named x.png, where 'x'
                //  is 1 through 16.  Get this image name.
                let srcPng = url.match(/\d{1,2}\.png/g)[0]

                // Copy the image
                fs.copyFileSync(path.join(cachedImagesDir, srcPng), filepath)
                console.log("Image copied from NYT Recipe Images")
                resolve(filepath);
              } else {
                  // Consume response data to free up memory
                  res.resume();
                  reject(new Error(`Request Failed With a Status Code: ${res.statusCode}`));
  
              }
          });
      });
    }


    // Get <article> element HTML
    let oH = await NYTCookingPage.evaluate(el => {
        return el.outerHTML
    }, articleElem)

    // Load <article> element HTML for Cheerio operations
    let $ = cheerio.load(oH);

    // Extract data items from the <article> element
    let href = $('a').attr('href');
    let recipeName = $('h3').text();
    let ps = $('p');
    // Author is in a <p> w/class that starts with 'recipecard_byline'
    let author = $(ps).filter(function (i, el) {
      return $(this).attr('class').includes('recipecard_byline');
    }).text()
    // Time is in a <p> w/class that starts with 'recipecard_cookTime'
    let time = $(ps).filter(function (i, el) {
      return $(this).attr('class').includes('recipecard_cookTime');
    }).text()

    console.log("article href: " + href)
    console.log("h3 text (recipe name): " + recipeName);
    console.log("author: " + author);
    console.log("time: " + time);

    // Get <article> element image source, then
    //  download the image
    
    // Get image source url
    let imageSource = $('img').attr('src');
    Log("$('img').attr('src'): " + imageSource)

    // If the image source is data:image/gif, extract the source url from an
    // associated <noscript> element, if one exists
    let src = imageSource.startsWith(dataImageGif) ? extractFromNoscript() : imageSource

    // If the source url is relative, prepend cooking.nytimes.com to make it absolute
    if (src.startsWith('/')) {
      src = "https://cooking.nytimes.com" + src
    }

    Log("image src: " + src)

    // Download the recipe image for display in the NYTCooking page (Author Search)
    //  Save it in the images folder in the application's <Application Support> directory
    let imgExt = src.match(/^.*(.png|.jpg).*$/);        // Image file extension
    let dlImgName = imageCounter.toString() + imgExt[1];   // Image file name
    let dlImgPath = path.join(imagesDirectory, dlImgName);    // Image file path

    Log("Downloading to " +  dlImgPath + " ...")
    // Call downloadImage function (above) to download the recipe's image
    try{ 
      await downloadImage(src, dlImgPath)
    } catch(e) {
      Log("downloadImage error:")
      console.log(e)
    }
    Log('... finished downloading')

    // Create an object containing the data items needed to recreate a recipe card
    let articleDataObj = {
      href: href,
      recipeName: recipeName,
      author: author,
      time: time,
      dlImg: "file://" + dlImgPath.replace(' ', '%20')
    }

    // Send the recipe card data to the NYTCooking renderer process for display in the target section
    console.log("Send 'display-recipe' for: " + name)
    NYTCooking.webContents.send('display-recipe', [JSON.stringify(articleDataObj), section, name, index]);

  }

  // For recipe name comparisons, modify the input recipe name(s) to remove diacritical marks, 
  //  replace left/right single and double quotes with staight quotes,
  //  lower-case the name and
  //  replace multiple spaces with a single space
  let lowerCaseTargetRecipeName = normalizeRecipeName(title);

  // Extract words from the target recipe name(s)
  let targetRecipeNameWords = lowerCaseTargetRecipeName.map(
    recipeName => lexer.lex(recipeName)
  );

  // Tag target recipe names with Parts Of Speech; returns [ [ [word, POS], ... ], ... ]
  let taggedTargetRecipeNameWords = targetRecipeNameWords.map(
    nameWords => tagger.tag(nameWords)
  )

  // Create array of interesting words in the target recipe name(s) (i.e. Foreign words, adjectives, nouns and past particples)
  let interestingTargetRecipeNameWords = [];

  for (let i = 0; i < taggedTargetRecipeNameWords.length; i++) {
    // For the words in each recipe name, ...
    let taggedWordsArray = taggedTargetRecipeNameWords[i];
    // ... create an array of the interesting words
    let interestingWords = []

    for (let j = 0; j < taggedWordsArray.length; j++) {
      // For each word in the recipe name, ...
      let wordTag = taggedWordsArray[j][1];
      // ... see if its Part Of Speech is interesting

      for (let p = 0; p < interestingPOS.length; p++) {
        // For each interesting Part Of Speech, ...
        //Log("Interesting?: " + wordTag + " " + interestingPOS[p])
        // ... see if the recipe name word's POS 'matches'
        if (wordTag.startsWith(interestingPOS[p])) {
          // If the POS 'matches', ...
          //Log("Interesting: " + wordTag + " " + interestingPOS[p]);
          // ... add the word to the array of interesting words and 
          //  leave the interesting Part Of Speech loop
          interestingWords.push(taggedWordsArray[j][0]);
          break;
        }
        
      }

    }
    // Add the array of interesting words to the array of recipe name(s) interesting words
    interestingTargetRecipeNameWords.push(interestingWords)
  }

  // If the NYTCooking window ID is not null, close the existing NYTCooking window
  if (NYTCookingID !== null && author !== lastAuthor) {
    Log("Closing existing NYTCooking window")
    BrowserWindow.fromId(NYTCookingID).close();
    NYTCookingID = null;
    await NYTCookingPage.close();
  }
  
  if (NYTCookingID == null) {
    Log("Creating new NYTCooking BrowserWindow and new NYTCookingPage")

    // Create a new browser window for dispalying filtered NYT Cooking search results
    NYTCooking = new BrowserWindow({
      x: 700,
      y: 50,
      width: 900, 
      height: 600,
      alwaysOnTop: true,
      webPreferences: {
        preload: path.join(__dirname, 'NYTC-preload.js')
      }
    })

    // Save the NYTCooking window ID
    NYTCookingID = NYTCooking.id

    // and load the NYTCooking window HTML.
    NYTCooking.loadFile('NYTCooking.html')

    // Close button clicked, close the NYTCooking window and
    //  enable buttons in the main window
    NYTCooking.on('closed', async () => {
      Log("NYTCooking window closed")
      NYTCookingID = null;
      if (!NYTCookingPage.isClosed()) {
        Log("On NYTCooking window closed - close NYTCookingPage")
        await NYTCookingPage.close();
        mainWindow.webContents.send('enable-searchButtons')
      }
    })

    // Respond to request from new NYTCooking window for search args, author and recipe title
    ipcMain.handleOnce('getSearchArgs', () => {
      Log("getSearchArgs handler entered, returning author: " + author + ", name: " + title + ", all: " + all)
      return [author, title, all]
    })

    // Search NYT Cooking
    Log("Create NYTCookingPage")
    NYTCookingPage = await browser.newPage();
    NYTCookingPage.setDefaultNavigationTimeout(0);

  } else {
    Log("Reusing NYTCooking window and NYTCookingPage")
    NYTCooking.webContents.send('set-name', [author, title, all]);
  }

  // Tell the renderer process to clear messages from any previous search
  NYTCooking.webContents.send('clear-messages');

  // Start new search
  let processingPage = 1;     // Search results page being processed
  let noResults = true;       // No results yet
  let noResultsReason = '';   // Error description
  continueWithResultsPages = true;    // Continue examining next search result page, or not
  lastAuthor = author;
  let cookingSearchPage;

  // Search NYT Cooking for recipes by the specified author if there's an author, else by title.
  if (author != '') {
    cookingSearchPage = `https://cooking.nytimes.com/search?q=${encodeURIComponent(author)}`;
  } else {
    cookingSearchPage = `https://cooking.nytimes.com/search?q=${encodeURIComponent(title)}`;
  }
  // await NYTCookingPage.waitForTimeout(getRandomInt()) // Remove or specify shorter time?
  await NYTCookingPage.goto(cookingSearchPage, {waitUntil: waitUntil});

  // Initialize downloaded image name counter
  var dlImgCounter = 0;

  // Create a directory for downloaded recipe card images, 
  //  deleting any previous such directory
  if ( fs.existsSync(imagesDirectory) ) {
    fs.rmdirSync(imagesDirectory, { recursive: true })    
  }
  fs.mkdirSync(imagesDirectory)

  // For each search results page, look for exact and fuzzy matches for the
  //  target recipe
  
  let processingPageString = processingPage.toString()
  do {

    if (processingPage == 1) {
        
      // On the first result page, get the div whose class name includes
      //  'pagination_resultsCount', which contains the text "1 - n of x results"
      let pc = await NYTCookingPage.$$eval('p', ps => {
        // Evaluate <p> elements.
        // Filter <p> elements for class name containing pagination_resultsCount.
        // Return array of text content of filtered <p> elements (should be only 1)
        return ps.filter( p => {
          if (p.className.includes('pagination_resultsCount')) {
            return true
          }
        }).map( p => p.textContent)
      })

      if (pc.length) {
        // If a pagination-count div exists, get n and x from the last div (should be only 1),
        // and calculate x divided by n, rounded up - the number of
        // results pages
        let pagCntText = pc[pc.length-1].split(' ');
        let perPage = pagCntText[2];
        let totResults = pagCntText[4].replace(',', '');
        pages = Math.ceil(totResults / perPage)
      } else {

        // If a pagination-count div does not exist, there's only 1 
        //  results page
          pages = 1;
      }

      Log("Results pages: " + pages.toString());
      // console.log("page count: " + pages)
      // console.log(pages.split(' '))

      // Alernative method of determining the last search results page
      // On the first result page, get the div whose class name includes
      //  'pagination_pagesList', which contains page numbers - a b c d … z
      let lastResultPage;
      let pagDivClassName = await NYTCookingPage.$$eval('div', dv => {
        // Evaluate <div> elements.
        // Filter <div> elements for class name containing pagination_pagesList.
        return dv.filter( d => {
          if (d.className.includes('pagination_pagesList')) {
            return true
          }
        }).map( d => d.className)
      })

      let pagDivClassNameLength = pagDivClassName.length
      console.log("Number of pagination_pagesList <div> elements: " +   pagDivClassNameLength.toString())
      if (pagDivClassNameLength > 0) {

        console.log("Classname: " + pagDivClassName[0])

        let pagListDiv = await NYTCookingPage.$('.' + pagDivClassName[0])
        let pagesGroupDivs =  await pagListDiv.asElement().$$('div')
        console.log("Number of pagesGroupDivs: " + pagesGroupDivs.length.toString())
        let lastPageDiv =  pagesGroupDivs[pagesGroupDivs.length-1]
        lastResultPage = await ( await lastPageDiv.getProperty('textContent')).   jsonValue()

      } else {
        lastResultPage = '1'
      }
      console.log("Last result page: " + lastResultPage)
      // End of alternative method

      // Check if the two methods agree on the number of results pages
      if (pages != parseInt(lastResultPage)) {
        console.log("Mismatch in search result pages - pages: " + pages.toString() + ", lastResultPage: " + lastResultPage)
      }

    }

    if (pages > 1) {

      // If there are multiple result pages, tell the renderer process
      //  to display a progress bar      
      NYTCooking.webContents.send('progress-bar', [processingPage, pages]);
    }

    // On each seach results page, search results are displayed in a <div> element
    //  whose class name starts with 'searchresults_resultsCardGrid', e.g.
    //  

    // On each search result page,  get an array of its divs
    let srDivs = await NYTCookingPage.$$('div')

    // Get the class names of those divs
    let srDivJ$ = await Promise.all(srDivs.map( (el, idx) => {
      return el.evaluate(dd => dd.className)
    }))

    // Get the index of the div whose class name includes 'searchresults_resultsCardGrid'
    //  e.g. searchresults_resultsCardGrid__15rAH
    let srDivIdx = srDivJ$.findIndex( (el) => {
      return el.includes('searchresults_resultsCardGrid')
    })

    if (srDivIdx > -1) {
      // If there is a div whose class name includes 'searchresults_resultsCardGrid' ...

      // Get an array of <article> elements (recipes) in that div
      let arrayOfArticleElements = await srDivs[srDivIdx].$$('article');
      Log("Number of articles: " + arrayOfArticleElements.length.toString());

      // Create an array of the names of the recipes on the search results page.
      // The ith element of arrayOfRecipeNames is the recipe name from the ith
      //  element of arrayOfArticleElements.
      let arrayOfRecipeNames = [];
      for (let i = 0; i < arrayOfArticleElements.length; i++) {
        let txt = await NYTCookingPage.evaluate(el => {
            //return el.querySelector('h3.name').innerText
            return el.querySelector('h3').innerText
        }, arrayOfArticleElements[i] );
        arrayOfRecipeNames.push(txt);
      }
      Log("Number of returned articles: " + arrayOfRecipeNames.length.toString())
      Log("Returned articles: " + arrayOfRecipeNames)
      Log("Titles array: " + title)
      Log("arrayOfRecipeNames array: " + arrayOfRecipeNames)

      //console.log('Recipe names:')
      for (let a = 0; a < arrayOfRecipeNames.length; a++) {
        //console.log(arrayOfRecipeNames[a]);
        // For each recipe on the search results page, compare its name to the
        //  target recipe's name.  The comparison is done on the normalized
        //  names of each.  Normalized names have no diacritical marks, 
        //  have straight quotes and apostrophes, and have all letters lowercased.
        // If an exact match is found, the recipe's article element is displayed.
        // Otherwise, the recipe name is tested for a fuzzy match to the target
        //  recipe.  A fuzzy match has two "interesting" words in common with the
        //  target recipe's name.  "Interesting" words are foreign words, 
        //  adjectives, nouns and past particples.
        // If a fuzzy match is found, the recipe's article element is displayed
        //  below any exact matches.

        // For recipe name comparisons, remove diacritical marks, 
        //  straighten quotes and lower-case the name
        lowerCaseRecipeName = normalizeRecipeName([arrayOfRecipeNames[a]])

        for (let n = 0; n < lowerCaseTargetRecipeName.length; n++) {

          //console.log("Comparing: " + lowerCaseRecipeName[0] + " to " +   lowerCaseTargetRecipeName[n])
          if (lowerCaseRecipeName[0] == lowerCaseTargetRecipeName[n]) {
            // If the recipe name is an exact match, ...
            console.log("Exact match: " + arrayOfRecipeNames[a]);
            noResults = false;
            // ... display the corresponding <article> element
            dlImgCounter++;
            await displayRecipe(arrayOfArticleElements[a], "exact", arrayOfRecipeNames  [a], n, dlImgCounter);
          } else {
            if (isFuzzy(lowerCaseRecipeName[0], interestingTargetRecipeNameWords[n])) {
              // Else if the recipe name is an fuzzy match, ...
              console.log("Fuzzy match: " + arrayOfRecipeNames[a]);
              noResults = false;
              // ... display the corresponding <article> element
              dlImgCounter++            
              await displayRecipe(arrayOfArticleElements[a], "fuzzy", arrayOfRecipeNames  [a], n, dlImgCounter);
            }
          }
        }
      }
    } else {
      noResults = true;
      noResultsReason = "Nothing found for author " + author
      console.log("noResultsReason set at processingPageString: " + processingPageString.toString())
    }

    if (++processingPage <= pages) {
      // If there are more search results pages to be processed, go to the
      //  next search results page.  In case of error, quit processing pages.
      processingPageString = processingPage.toString()
      console.log("Going to search result page " + processingPageString)
      let nxt = '&page=' + processingPageString;
      try {
          await NYTCookingPage.waitForTimeout(getRandomInt(10000, 20000, 4000));
          gotoResponse = await NYTCookingPage.goto(cookingSearchPage + nxt, {waitUntil: waitUntil});
      } catch (e) {
          console.error("page.goto error:");
          console.error(e)
          continueWithResultsPages = false;
      }
      
      let responseStatus = gotoResponse.status()
      console.log("Goto response status: " + responseStatus);
      if (responseStatus != 200) {
          continueWithResultsPages = false;
          noResultsReason = " — " + responseStatus + " response on page " + processingPageString
      }
      
    }

  } while (processingPage <= pages && continueWithResultsPages)
    


  if (noResults) {

    // If no filtered results, send that to the NYTCooking process
    console.log("index.js - typeof noResultsReason: " + typeof noResultsReason)
    NYTCooking.webContents.send('no-results', noResultsReason);
  } else {

    // Otherwise, clear any previous messages
    NYTCooking.webContents.send('clear-messages')
  }

  // Done filtering: allow other windows to be on top and close browser page
  NYTCooking.setAlwaysOnTop(false); 

  // Tell renderer.js to enable searchButtons
  mainWindow.webContents.send('enable-searchButtons')

}



//////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////





// The mainline function establishes Electron event listeners (via ipcMain) and connects to the
//  NYTarticles MySQL database
async function mainline () {

  async function createWindow () {
    // Called on event app ready.
    // Connect puppeteer to an instance of Chrome.
    // If unsuccessful, terminate the app.
    // Otherwise, create a browser window and load index.html.

    // Connect to Chrome
    if (await connectPup() < 0) {
      console.error("Unable to connect to Chrome, terminating")
      app.exit()
    }; 

    // Create the browser window.
    mainWindow = new BrowserWindow({
      x: 10,
      y: 50,
      width: 750, 
      height: 600,
      alwaysOnTop: true,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js')
      }
    })

    // and load the index.html of the app.
    mainWindow.loadFile('index.html')

    // await launchPup({devtools: true});
    mainWindow.show(); // Focus on mainWindow

    // Open the DevTools.
    // mainWindow.webContents.openDevTools()

    // Emitted when the window is closed.
    mainWindow.on('closed', function () {
      // Dereference the window object, usually you would store windows
      // in an array if your app supports multi windows, this is the time
      // when you should delete the corresponding element.
      mainWindow = null
    })

  }

  async function closePages() {
    // On reset-window, close any Chrome tabs
    console.log("closePages entered")

    console.log("Trying to close NYTCooking page")
    try {
      if (!NYTCookingPage.isClosed()) {
        console.log(" closing NYTCookingPage")
        await NYTCookingPage.close();
      }
    } catch(e) {
      //console.log("will-quit - NYTCookingPage error - " + e)
    }

    console.log("Trying to close articlePage")
    if (articlePageIsOpen) {
      await articlePage.close();
      articlePageIsOpen = false;
    }

  }

  // Return next date to search to renderer process
  ipcMain.handle('getNextDate', () => {
    console.log("getNextDate handler entered");
    let nextDate;
    try{
      lastDateObjString = fs.readFileSync(lastDateFile, "utf8");
      console.log("lastDateObjString: " + lastDateObjString);
      lastDateObj = JSON.parse(lastDateObjString);
      lastStoredDate = lastDateObj.lastStoredDate;
      seq = lastDateObj.seq;
      complete = lastDateObj.complete;
      lastArticle = lastDateObj.lastArticle

      // From lastStoredDate, get nextDate to process
      let lastDate = dayjs(lastStoredDate, "YYYY-MM-DD")
      switch (dayjs(lastDate).day()) {
          case 0:
              nextDate = dayjs(lastDate).add(3, 'day').format("YYYY-MM-DD")
              break
          case 3:
            nextDate = dayjs(lastDate).add(4, 'day').format("YYYY-MM-DD")
              break
      }
    } catch(e) {
      console.log("lastDateFile error")
      console.log(e)
      let today = new Date();
      lastStoredDate = today.getFullYear() + '-' + today.getMonth().toString().padStart(2, "0") + '-' + today.getDate().toString().padStart(2, "0");
      seq = 0;
      complete = true;
      lastArticle = 0;
    }

    if (complete) {
      if (lastStoredDate.substring(0,4) != nextDate.substring(0,4)) {
        let prevYear = (parseInt(lastStoredDate.substring(0,4)) - 1).toString()
        let prevNewYear = dayjs(prevYear + '-01-01', 'YYYY-MM-DD')
        let prevNewYearDay = dayjs(prevYear + '-01-01', 'YYYY-MM-DD').day()
        if (prevNewYearDay == 0) {
            firstDay = prevNewYear
        } else if (prevNewYearDay <= 3) {
            firstDay = prevNewYear.add(3 - prevNewYearDay, 'day')
        } else {
            firstDay = prevNewYear.add(7 - prevNewYearDay, 'day')
        }
        nextDate = firstDay.format("YYYY-MM-DD")
      }
    } else {
      nextDate = lastStoredDate
      mainWindow.webContents.send('show-msg', "Restarting this date")
    }

    console.log("seq: " + seq.toString())
    console.log("nextDate: " + nextDate)
    let nextDateObj = {
      nextDate: nextDate,
      complete: complete
    }
    let nextDateObjString = JSON.stringify(nextDateObj)
    return nextDateObjString;
  })

  // Handle date selection in mainWindow process
  ipcMain.on('process-date', async (event, arg) => {
    dateToSearch = arg;
    Log("process-date entered with dateToSearch: " + dateToSearch)

    // Navigate to search results for selected date and date's section (Food or Magazine)
    await processDate(dateToSearch)
  });

  // Listen for NYTCooking Stop button click
  //  Stop filtering search results by setting continueWithResultsPages to false
  ipcMain.on('stop-NYTCooking', (event, arg) => {
    console.log("Request to stop NYTCooking search");
    continueWithResultsPages = false;
  })

  // Listen for NYTCooking Close button click; close NYTCooking window
  ipcMain.on('close-NYTCooking', async (event, arg) => {
    console.log("Request to close NYTCooking window");
    BrowserWindow.fromId(NYTCookingID).close();
    NYTCookingID = null;
    await NYTCookingPage.close();
  })

  // Listen for a recipe Search button click; call authorSearch to search
  //  NYT Cooking for the author and then filter the search results for 
  //  the recipe name 
  ipcMain.on('author-search', async (evt, args) => {
    console.log("author-search entered")
    console.log("ipcMain.on('author-search': " + Array.isArray(args[1]))

    let author = args[0];
    let title = args[1]
    let all = args[2]
    Log("Author: " + author);
    Log("Title: " + title);
    Log("All: " + all)

    await authorSearch(author, title, all);

  })
  
  // Set the Always On Top attribute of the mainWindow.
  //  The main application window should be on top while the nytimes.com pages are being navigated and scraped.
  //  It should no longer be on top when that process is finished to allow reviewing the pages retained.
  ipcMain.on('mainAOT', (event, arg) => {
    mainWindow.setAlwaysOnTop(arg);
  })

  ipcMain.on('mainFocus', (event, arg) => {
    console.log("Focus");
    mainWindow.show();
  })

  // Listen for click on an article in the main application window; open the article in 
  //  Google Chrome
  ipcMain.on('article-open', (event, url) => {
    console.log("Recipe opened: " + url);
    exec('open -a "Google Chrome" ' + url, (error, stdout, stderr) => {
      if (error) {
        console.error(`error: ${error.message}`);
        return;
      }
    
      if (stderr) {
        console.error(`stderr: ${stderr}`);
        return;
      }
    
      console.log(`stdout:\n${stdout}`);
    });
  });

  // When the mainWIndow process sends 'dialog-error', show an error box
  ipcMain.on('dialog-error', (event,args) => {
    let [title, content] = args
    dialog.showErrorBox(title, content)
  })

  // Handle reset window button:
  //  - Close Chrome tabs
  //  - Close the Author Search browser window
  //  - Close the mainWindow browser window and recreate it
  ipcMain.on('reset-window', async () => {
    console.log("Request to reset the window");

    // Close NYTCookingPage and articlePage
    await closePages()

    // Close NYTCooking browser window
    if (NYTCookingID != null) {
      await BrowserWindow.fromId(NYTCookingID).close();
      NYTCookingID = null;
    }

    // Close mainWindow browser window
    mainWindow.close();

    // Recreate maimWindow browser window
    await createWindow();

    console.log("Reset-window finished")

  })

  // Write HTML markup to the clipboard
  ipcMain.on('write-HTML', (event,arg) => {
    console.log('write-HTML entered: ' + arg)
    clipboard.writeHTML(arg)
  })

  // Write text to the clipboard
  ipcMain.on('write-text', (event,arg) => {
    clipboard.writeText(arg)
  })
  

  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  // Some APIs can only be used after this event occurs.
  //  Create the main application window, mainWIndow
  app.on('ready', createWindow)

  // On quitting:
  //  - Close Chrome tabs 
  app.on('will-quit', function () {
    console.log("On will-quit:")
    try {
      if (!NYTCookingPage.isClosed()) {
        console.log(" closing NYTCookingPage")
        NYTCookingPage.close()
      }
    } catch(e) {
      //console.log("will-quit - NYTCookingPage error - " + e)
    }
    console.log(" closing dayPage")
    dayPage.close()   
  })

      // Possible improvement on quitting.  Needs try...catch for all 
      //  puppeteer page operations
      //app.on('before-quit', async function (event) {
      //  console.log("On before-quit:")
      //  try {
      //    console.log("NYTCookingPage.isClosed(): " +  NYTCookingPage.isClosed());
      //    NYTCooking = !NYTCookingPage.isClosed()
      //  } catch(e) {
      //    console.log("NYTCookingPage error:")
      //    console.log(e)
      //    NYTCooking = false
      //  }
      //  console.log("articlePage.isClosed(): " +  articlePage.isClosed());
      //  console.log("articlePageIsOpen: " + articlePageIsOpen)
      //  console.log("dayPage.isClosed(): " +  dayPage.isClosed());
      //
      //  if (NYTCooking || articlePageIsOpen || !dayPage.isClosed()) {
      //    console.log("before-quit closing pages")
      //    console.log("NYTCooking: " + NYTCooking)
      //    console.log("articlePageIsOpen: " + articlePageIsOpen)
      //    console.log("!dayPage.isClosed(): " + !dayPage.isClosed())
      //    event.preventDefault()
        //
        //
      //    try {
      //      if (!NYTCookingPage.isClosed()) {
      //        console.log(" closing NYTCookingPage")
      //        await NYTCookingPage.close()
      //      }
      //    } catch(e) {
      //      //console.log("will-quit - NYTCookingPage error - " + e)
      //    }
        //
      //    console.log("Trying to close articlePage")
      //    if (articlePageIsOpen) {
      //      await articlePage.close();
      //      console.log("articlePage.isClosed(): " +  articlePage.isClosed());
      //      articlePageIsOpen = false;
      //    }
        //
      //    if (!dayPage.isClosed()) {
      //      console.log(" closing dayPage")
      //      await dayPage.close()        
      //      console.log("dayPage.isClosed(): " +  dayPage.isClosed());
      //    }
        //
        //
      //    // Try to update the last stored date. This will fail if a testcase file was
      //    //  processed.
      //    try {
      //      if (dateToSearch > lastStoredDate || 
      //        dateToSearch.substr(0,4) < lastStoredDate.substr(0,4)) {
      //        console.log(" writing lastDateFile")
      //        fs.writeFileSync(lastDateFile, dateToSearch, "utf8");
      //        lastStoredDate = dateToSearch
      //      }
      //    } catch {}
      //    app.quit()
      //  }
      //})

  // Quit when all windows are closed.
  app.on('window-all-closed', function () {
    // On macOS it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (mainWindow === null) {
      createWindow()
    }
  })

  // Listen for click on the Save button in the main application window
  ipcMain.handle('save-article', async (evt, articleResponseString, articleInfoString) => {
    // A Save button was clicked. Save the article and its associated
    //  information to the database.  Return 'true' to the renderer
    //  process when the database save is complete.
    //
    // Input: a stringified articleResponse object - 
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

    console.log("articleResponse string: " + articleResponseString)
    let articleResponse = JSON.parse(articleResponseString)

    console.log("articleInfo string: " + articleInfoString)
    let articleInfo = JSON.parse(articleInfoString)

    // Get this article's HTML, using the article's seq number
    let thisArticleHTML = htmlObj[articleInfo.seq.toString()]

    // If the article is solved, set expectedRecipes to zero-length string
    if (!articleResponse.isNotSolved) {
        articleResponse['expectedRecipes'] = ''
    }

    // Insert the article and its associated information into the database
    let sql = `INSERT INTO articles 
    (seq, date, Name, URL, hasArticleClass, hasTitlePunct, isNotSolved, hasFragmentedTitle, hasUnquantifiedIngredient, discoveredRecipes, expectedRecipes, html) 
    VALUES ('${articleInfo.seq}', '${articleInfo.date}', '${articleInfo.name.replace(/'/g, "\\'")}', '${articleInfo.URL}', '${bx(articleResponse.hasArticleClass)}', '${bx(articleResponse.hasTitlePunct)}', '${bx(articleResponse.isNotSolved)}', '${bx(articleResponse.hasFragmentedTitle)}', '${bx(articleResponse.hasUnquantifiedIngredient)}', '${articleInfo.recipes.replace(/'/g, "\\'")}', '${articleResponse.expectedRecipes.replace(/'/g, "\\'")}', '${thisArticleHTML.replace(/'/g, "\\'")}' )`
    try {
        await connection.query(sql)
        console.log("1 record inserted");
  
        // If the last article of the date being processed was just saved,
        //  which is so when the article's sequence number matches the
        //  global variable seq, update the last stored date and database
        //  sequence number.
        if (  articleInfo.seq == seq &&
              (
                ( 
                  dateToSearch > lastStoredDate || 
                  dateToSearch.substring(0,4) < lastStoredDate.substring(0,4) 
                ) || 
                !complete                
              )
            ) {              
                  
          console.log(" writing lastDateFile")
          lastDateObj = {
            lastStoredDate: dateToSearch,
            seq: seq,
            complete: true,
            lastArticle: 0
          }
          lastDateObjString = JSON.stringify(lastDateObj)
          console.log(lastDateObjString)
          fs.writeFileSync(lastDateFile, lastDateObjString, "utf8");

          // Remove the date's folder from the user data folder
          fs.rmSync( dateDir, { force: true, recursive: true } )
        }

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

}

// Call the mainline function to:
//  - Establish various Electron event listeners
//  - Connect to the NYTarticles MySQL database
mainline()
