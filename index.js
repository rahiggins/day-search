// This application searches nytimes.com for articles published on a particular 
// Sunday or Wednesday.  For Sundays, the search is for articles in the Magazine 
// section.  For Wednesdays, the search is for articles in the Food section. After the
// the day-specific section search, the full day is searched for these keywords:
// [tablespoon, shaken, recipe, yield:]

// Each result found by these searches is examined for the presence of recipes.

// These search results are displayed:
//  - Articles that contain recipes, along with the names of the recipes
//  - Search results that consist of a single recipe, along with the name of the recipe
//  - Search results that consist of an NYT Cooking page

// For each recipe displayed, a Search button is provided to search NYT Cooking
//  for recipes by the article's author that match the recipe name.  Matches 
//  are displayed in a separate window.

// For articles that contain more than one recipe, a 'Search All' button is
//  is displayed next to the article title. When clicked, NYT Cooking is
//  searched by author name, and results matching any of the article's recipes 
//  are displayed in a separate window.

// This apppication requires an instance of Chrome enabled for remote debugging.
//  First start Chrome by executing Remote_debug_Chrome.sh in the Terminal app
//  and use that instance of Chrome to log in to nytimes.com.  Then start this
//  application.

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

// Version single-search 0.1
// Version validate 0.2

// Code structure:
//
//  Global variable definitions
//  Global function definitions
//    function Log
//    function launchPup
//    function connectPup
//    function login
//    function processSectionOrKeywords
//      function searchResultsNum
//      function captchaSolution
//
//  function processDate
//    imports function findRecipes from lib.js
//    imports function adjustTitle from lib.js
// 
//  function authorSearch
//    function replaceProblematics
//    function normalizeRecipeName
//    function isFuzzy
//    function displayRecipe
//    NYTCooking.on('closed')
//    ipcMain.handleOnce('getSearchArgs')
//
//  function mainline
//    function createWindow
//      mainWindow.on('closed')
//    ipcMain.handle('getLastDate')
//    ipcMain.on('process-date')
//    ipcMain.on('process-file')
//      imports function findRecipes from testcase-lib.js or lib.js
//      imports function adjustTitle from testcase-lib.js or lib.js
//    ipcMain.on('stop-NYTCooking')
//    ipcMain.on('close-NYTCooking')
//    ipcMain.on('author-search')
//    ipcMain.on('mainAOT')
//    ipcMain.on('mainFocus')
//    ipcMain.on('article-open')
//    ipcMain.on('dialog-error')
//    ipcMain.on('reset-window')
//    app.on('ready')
//    app.on('will-quit')
//    app.on('window-all-closed')

// Program flow:
//
//   Mainline
//    app.on('ready')
//      calls createWindow
//    createWindow
//      calls connectPup
//    ipcMain.on('process-date')
//      calls processDate
//    processDate
//      calls processSectionOrKeywords
//        calls searchResultsNum
//        calls adjustTitle
//        calls findRecipes
//    ipcMain.on('process-file')
//        calls adjustTitle
//        calls findRecipes
//    ipcMain.on('author-search')
//      calls authorSearch
//    authorSearch
//      calls normalizeRecipeName
//        calls replaceProblematics
//      calls isFuzzy
//      calls displayRecipe

// Data structures
//
// articleObj
//  {
//    title: <string>
//    isBeverage: <boolean>
//    isPairing: <boolean>
//    isRecipe: <boolean>
//    beverageType: <string>
//    author: <string>
//    link: <URL> 
//  }

// Modules used here
const {app, BrowserWindow, dialog} = require('electron');
const { ipcMain } = require('electron');
const path = require('path');
const fs = require('fs'); // Filesystem functions
const { exec } = require('child_process');
const needle = require('needle'); // HTTP client
const puppeteer = require('puppeteer'); // Chrome API
const cheerio = require('cheerio'); // core jQuery
const pos = require('pos');  // Part Of Speech classification

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
const { adjustTitle, findRecipes } = require(libName);

// Get path to application data and set set paths to lastDate and testcase
const appPath = app.getPath('appData') + "/" + app.name + '/';
console.log("appPath: " + appPath)
const lastDateFile = appPath + 'LastDate.txt';  // Last date processed
const testcase = appPath + 'testcase/'; // Folder containing testcase data

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow

// Global variables
let browser;              // Puppeteer browser
let dayPage;              // Day search page
let NYTCookingID = null;  // NYT Cooking window ID
let NYTCookingPage;       // NYT Cooking page
let lastAuthor = null;    // Last author searched at NYT Cooking
let lastStoredDate;       // Last date stored to ~user/Library/Application Support/day-search
let dateToSearch;         // YYYY-MM-DD
let debug = true;         // Used by Log function
let articlePageIsOpen = false;  // true while an articlePage is open

let writeToTestcase;      // Boolean - write articles to testcaseDateDir?
let testcaseDateDir;      // ~/Library/Application Support/day-search/testcase/mm-dd-yyyy

let parsedArticles = [];    // Array of urls of articles parsed
let parseSkipped;           // Count of articles previously parsed, so skipped
let articlesDisplayed;      // Count of articles displayed

let waitUntil = "networkidle2"  // puppeteer goto waitUntil value

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

function prepArticle(htmlToParseFile, hrefFile) {
  // Prepare article to be examined for recipes by function findRecipes
  // Input: - path of file containing the article's HTML (*.html)
  //        - path of file (*.txt) containing:
  //            -- either the article's url, or
  //            -- an object specifying the url and an array of its recipes 
  // Output:  - array:
  //            - Cheerio query function based on the article's HTML
  //            - the articleObj for the article
  //            - an array of the article's expected recipe names, or null

  //  - Read the article's .html and .txt files
  let htmlToParse = fs.readFileSync(htmlToParseFile, "utf8");
  let href = fs.readFileSync(hrefFile, "utf8");

  // Attempt parsing the .txt file as a Javascript object
  try {
    href = JSON.parse(href)
  } catch {}
      
  // href is an object when the file selection is in the solvedTestcases folder
  let expectedRecipes;
  if (typeof href == 'object') {
    expectedRecipes = href.recipes;
    href = href.url;
  } else {
    expectedRecipes = null;
  }
  console.log("function prepArticle entered, expectedRecipes:")
  console.log(expectedRecipes)
  
  articles = []; // array of article objects
  
  // Create a Cheerio query function for the article HTML
  $ = cheerio.load(htmlToParse);
  // Get title
  let title = $('h1').text().trim();
  Log("Title: " + title);

  // Call adjustTitle to remove prefixes from the title and return an articleObj
  let articleObj = adjustTitle(title);

  // Add author and href to the object returned by adjustTitle

  // The author name can be contained in a <span> element by itself or 
  //  preceded by 'By '.  Get the <span> text and nullify 'By ' if it exists.
  //articleObj['author'] = $('#story > header > div.css-xt80pu.eakwutd0 > div > div > div > p > span.css-1baulvz.last-byline').text();
  articleObj['author'] = $('#story > header > div.css-xt80pu.eakwutd0 > div > div > div > p > span').text().replace('By ', '');

  articleObj['link'] = href;

  return [$, articleObj, expectedRecipes]

}


//////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////


async function processSectionOrKeywords(url, dayOfWeek, searchDomain, domainType) {
  // Go to a search page listing articles that match the criteria specified in
  //  the url argument
  //
  // Input: url - www.nytimes.com/search with a query string indicating
  //              a date and either a section (Magazine | Food) or a keyword
  //              (tablespoon | shaken | recipe | yield:)
  //
  //        dayOfWeek - integer: ( 0 (Sunday) | 3 (Wednesday) )
  //
  //        searchDomain - string: ( 'X section' | 'keyword X' )
  //
  //        domainType - string: ( 'section' | 'keyword' )

  // Access the functions in lib.js
  //  - adjustTitle: Separate prefixes from the article title and use prefixes
  //     to set article attributes
  //  - findRecipes: parse the article's HTML to identify embedded recipes
  const { adjustTitle, findRecipes } = require('./lib.js')

  //
  // Define a function to return the number of results in the search page
  //
  async function searchResultsNum() {

    // Create a Cheerio query function for dayPage
    let $ = cheerio.load(await dayPage.content());

    // Get the list items in the page's ordered list
    let listItems = $('li.css-1l4w6pd', 'ol')

    // Return the number of those list items
    return listItems.length;
  }

  // Create a string representing an object with keys 'url' and 'recipes'
  //  to be written to testcase
  function createTestcaseObj(url, recipeArray) {
    let comma = ","
    let object = '{\n\n';
    object += '\t"url":\t"' + url + '",\n\n';
    object += '\t"recipes":\t[\n\n';
    let noComma = recipeArray.length - 1;
    for (let i = 0; i < recipeArray.length; i++) {
      if (i == noComma) {
        comma = "";
      }
      object += '\t\t\t"' + recipeArray[i] + '"' + comma + '\n'
    }
    object += '\n\t\t\t]\n\n}'
    return object
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
    await dayPage.goto(url, {waitUntil: waitUntil});
  }

      // Unused -- the application connects to an existing instance of Chrome logged
      //            into nytimes.com
      // // If there's a 'Log In' link, log in
      // try {
      //   let logInButton = await dayPage.waitForSelector('[data-testid="login-link"]', {timeout: 250});
      //   Log("Log In found")
      // 
      //   // Click the Log In link
      //   await logInButton.click();
      // 
      //   // Go enter credentials
      //   //await login();
      // 
      //   // Wait for navigation back to search results
      //   await dayPage.waitForNavigation({waitUntil: 'networkidle0'})
      // 
      // 
      // } catch {
      //     Log("Log In not found");
      // }

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

  // Tell the renderer process to display a spinner while expanding the 
  //  search results
  mainWindow.webContents.send('display-spinner');

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
      Log("Clicking Show More button");
      await dayPage.waitForTimeout(3000)
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

  // Define the array of article objects
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
    let articleObj = adjustTitle(title);

    // Add author and href to articleObj
    articleObj['author'] = $('p.css-15w69y9',this).text().substr(3);
    articleObj['link'] = href;

    // Push articleObj onto the articles array
    articles.push(articleObj);

  })

  let articlesNum = articles.length.toString();
  Log("Array articles length: " + articlesNum);

  // For each article, parse the article HTML to identify embedded recipes.
  for (a = 0; a<articles.length; a++) {

    // Display progress bar showing progress through this loop
    mainWindow.webContents.send('progress-bar', [a+1, articlesNum, searchDomain]);

    if (parsedArticles.includes(articles[a].link)) {
      // If this article's url is in the array of articles already parsed,
      //  skip parsing it again.
      parseSkipped++; // Count skipped articles
      continue;
    } else {
      // If not, add this article's url to the array of articles already parsed
      parsedArticles.push(articles[a].link)
    }

    Log("Go to article " + articles[a].link)
    Log("Title: " + articles[a].title)
    Log("Author: " + articles[a].author)
    Log("isBeverage: " + articles[a].isBeverage)
    Log("isRecipe: " + articles[a].isRecipe)
    Log("beverageType: " + articles[a].beverageType)


    if (articles[a].link.includes("cooking.nytimes.com")) {
      // If this article is an NYT Cooking recipe, just display it without
      //  parsing it for recipes
      Log("Display NYT Cooking recipe: " + articles[a].title);
      articlesDisplayed++;
      mainWindow.webContents.send('article-display', [JSON.stringify(articles[a]), [articles[a].title], "NYT Cooking"])
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
      do {

        // Go to an article page
        Log("Go to: " + articles[a].link);
        await articlePage.goto(articles[a].link, {waitUntil: waitUntil});
        Log("Back from: " + articles[a].link);

        // Get the article page's HTML and create a Cheerio query function for the HTML
        let articleHTML = await articlePage.content();
        $ = cheerio.load(articleHTML);

        // If the article page contains no div elements, it's a CAPTCHA page.
        //  Pause to allow the CAPTCHA to be manually solved
        let divs = $('div')
        if (divs.length == 0) {
          Log("Captcha detected");
          gotCaptcha = true;

          // Function to wait for the captcha solved button to be clicked
          async function captchaSolution() {
            return new Promise(function (resolve) {
              ipcMain.on('captcha-solved', async (event, arg) => {
                resolve();  // Resolve Promise
              })
            })
          }

          // Tell the renderer process to display a 'captcha detected' message
          //  and a button whose click indicates that the captcha was solved.
          mainWindow.webContents.send('captcha-detected');

          // Wait for the captcha to be solved
          await captchaSolution();
          console.log("Captcha solved");        

        } else {
          // The article page was returned
          gotCaptcha = false;
        }

      } while (gotCaptcha)  // Repeat until the article page is returned

      // Call findRecipes, which parses the article's HTML to identify recipes and
      //  displays those recipes.  The function returns 1 if the article was displayed,
      //   0 otherwise, and an array of the recipes found.
      [articleDisplayed, foundRecipes] = await findRecipes($, articles[a], mainWindow)
      articlesDisplayed += articleDisplayed;

      if (writeToTestcase) {
        // If 'Write to testcase' was selected, write the article html and
        //  and object specifying the article url and the recipes found to testcaseDateDir 

        // Create a safe filename for the files from the article title
        let safeTitle = articles[a].title.replace(/\//g, "\\"); // / => \

        // Write the html file to testcaseDateDir 
        fs.writeFileSync(testcaseDateDir + safeTitle + ".html", $.html(), "utf8");

        // Create the object specifying the article url and the recipes found and
        //  write it to testcaseDateDir
        let testcaseObj = createTestcaseObj(articles[a].link, foundRecipes);
        fs.writeFileSync(testcaseDateDir + safeTitle + ".txt", testcaseObj, "utf8")
      }

      // Close the article browser page
      await articlePage.close();
      articlePageIsOpen = false;

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
  //  for articles containing recipes. Then search the day for certain keywords.

  Log("processDate entered with dateToSearch: " + dateToSearch);

  // If the NYTCooking window ID is not null, close the existing NYTCooking window
  if (NYTCookingID !== null) {
    Log("Closing existing NYTCooking window")
    BrowserWindow.fromId(NYTCookingID).close();
    NYTCookingID = null;
    await NYTCookingPage.close();
  }

  // Initialize array of urls of articles parsed, which is used to skip parsing
  //  articles already parsed, and the count of articles displayed and parses skipped
  parsedArticles = [];
  articlesDisplayed = 0;
  parseSkipped = 0;

  if (writeToTestcase) {
    // For writeToTestcase, create an output directory for the date being processed.

    // dateToSearch is YYYY-MM-DD.  Use match to extract YYYY and MM-DD from
    //  dateToSearch, then form testcaseDateDir:
    //  ~/Library/Application Support/day-search/testcase/mm-dd-yyyy
    let m = dateToSearch.match(/^(?<yyyy>\d{4})-(?<mmdd>\d{2}-\d{2})$/);
    let d = m.groups.mmdd + "-" + m.groups.yyyy;
    testcaseDateDir = testcase + "/" + d + "/"; // testcaseDateDir is a global variable

    if (!fs.existsSync(testcaseDateDir)) {
      // If testcaseDateDir does not exist, create it
      fs.mkdirSync(testcaseDateDir);
    }
  }

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
  await processSectionOrKeywords(dayURL, dayOfWeek, searchDomain, 'section');

  // 
  // Search all the day's articles for articles containing these keywords:
  let keywords = ["cooking.nytimes.com", "Tablespoon", "Shaken", "Recipe", "Yield:"];

  for (let k = 0; k < keywords.length; k++) {
    // For each keyword,

    // Display a horizontal divider for the keyword
    mainWindow.webContents.send('keyword-div', keywords[k])

    // Form the search URL specifying the day and the keyword
    let url = `https://www.nytimes.com/search?dropmab=true&endDate=${urlDateToSearch}&query=${keywords[k]}&sort=best&startDate=${urlDateToSearch}`

    // Search the day's articles for the keyword
    searchDomain = "keyword " + keywords[k]
    Log("Searching " + searchDomain)
    await processSectionOrKeywords(url, dayOfWeek,searchDomain, 'keyword');
  }


  console.log("end of processDate");
  Log("Articles displayed: " + articlesDisplayed.toString());
  Log("Parse skipped: " + parseSkipped.toString());

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

  async function displayRecipe(recipe, section, name, index) {
    // Add a recipe <article> element to the designated section, exact or fuzzy
    // Called from authorSearch
    // Input:   <article> element,
    //          display section, "exact" ot "fuzzy"
    //          target recipe name
    //          index of recipe name in recipe name array

    // Extract <article> element HTML
    let oH = await NYTCookingPage.evaluate(el => {
        return el.outerHTML
    }, recipe)

    // Load <article> element for Cheerio operations
    let $ = cheerio.load(oH);

    // Remove "stickers" (Easy, Healthy, etc), to avoid adjusting their styles
    //  Around 6/2021, the "sticker" class changed from 'sticker' to 'divSticker'
    let sticker = $.merge($('a.sticker'), $('a.divSticker'))
    $(sticker).each( function(i, elem)  {
        $(this).remove()
    })

    // Remove Save button because it throws an error
    let saveBtn = $('div.control-save-btn')
    if (saveBtn.length > 0) {
        $('div.control-save-btn').remove()
    }

    // If recipe image src attribute specifies a 'card-placeholder-image' file,
    //  replace the src attribute with the url specified by the data-src attibute
    let image =  $('img')
    let imageSrc = $(image).attr('src');
    if (imageSrc.includes('card-placeholder-image')) {
        let imageSrcData =  $(image).data('src');
        $(image).attr('src', imageSrcData);
    }

    // Send <article> element HTML to the NYTCooking renderer process for display
    NYTCooking.webContents.send('display-recipe', [$.html(), section, name, index]);

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
      width: 750, 
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
        console.log("On NYTCooking window closed - close NYTCookingPage")
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
    console.log("Create NYTCookingPage")
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
  await NYTCookingPage.goto(cookingSearchPage, {waitUntil: waitUntil});

  // For each search results page, look for exact and fuzzy matches for the
  //  target recipe
  do {

    if (processingPage == 1) {
        
      // On the first result page, get the id=pagination-count div,
      //  which contains the text "1 - n of x results"
      let pc = await NYTCookingPage.$('#pagination-count');
      if (pc !== null) {

        // If a pagination-count div exists, get its text, get n and x,
        // and calculate x divided by n, rounded up - the number of
        // results pages
        pages = await pc.evaluate(el => {
            let pagCntText = el.innerText.split(' ');
            let perPage = pagCntText[2];
            let totResults = pagCntText[4].replace(',', '');
            return Math.ceil(totResults / perPage)
        })
      } else {

        // If a pagination-count div does not exist, there's only 1 
        //  results page
          pages = 1;
      }

      Log("Results pages: " + pages.toString());
      // console.log("page count: " + pages)
      // console.log(pages.split(' '))
    }

    if (pages > 1) {

      // If there are multiple result pages, tell the renderer process
      //  to display a progress bar
      NYTCooking.webContents.send('progress-bar', [processingPage, pages]);
    }

    // On each search result page,  get the id=search-results div
    let sr = await NYTCookingPage.$('#search-results')

    // Get the section within that div
    let srSect = await sr.$('#search-results > section');

    // Get an array of <article> elements (recipes) in that section
    let arrayOfArticleElements = await srSect.$$('article');
    Log("Number of articles: " + arrayOfArticleElements.length.toString());

    // Create an array of the names of the recipes on the search results page.
    // The ith element of arrayOfRecipeNames is the recipe name from the ith
    //  element of arrayOfArticleElements.
    let arrayOfRecipeNames = [];
    for (let i = 0; i < arrayOfArticleElements.length; i++) {
      let txt = await NYTCookingPage.evaluate(el => {
          return el.querySelector('h3.name').innerText
      }, arrayOfArticleElements[i] );
      arrayOfRecipeNames.push(txt);
    }
    Log("Number of returned articles: " + arrayOfRecipeNames.length.toString())

    // console.log('Recipe names:')
    for (let a = 0; a < arrayOfRecipeNames.length; a++) {
      // console.log(arrayOfRecipeNames[a]);
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
        
        //console.log("Comparing: " + lowerCaseRecipeName[0] + " to " + lowerCaseTargetRecipeName[n])
        if (lowerCaseRecipeName[0] == lowerCaseTargetRecipeName[n]) {
          // If the recipe name is an exact match, ...
          console.log("Exact match: " + arrayOfRecipeNames[a]);
          noResults = false;
          // ... display the corresponding <article> element
          await displayRecipe(arrayOfArticleElements[a], "exact", title[n], n);
        } else {
          if (isFuzzy(lowerCaseRecipeName[0], interestingTargetRecipeNameWords[n])) {
            // Else if the recipe name is an fuzzy match, ...
            console.log("Fuzzy match: " + arrayOfRecipeNames[a]);
            noResults = false;
            // ... display the corresponding <article> element
            await displayRecipe(arrayOfArticleElements[a], "fuzzy", title[n], n);
          }
        }
      }
    }

      if (++processingPage <= pages) {

        // If there are more search results pages to be processed, go to the
        //  next search results page.  In case of error, quit processing pages.
        let processingPageString = processingPage.toString();
        console.log("Going to search result page " + processingPageString)
        let nxt = '&page=' + processingPageString;
        try {
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






async function mainline () {

  async function createWindow () {
    // On app ready, attempt to connect puppeteer to an instance of Chrome.
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
      width: 650, 
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

  // Return last date searched to renderer process
  ipcMain.handle('getLastDate', () => {
    try{
      lastStoredDate = fs.readFileSync(lastDateFile, "utf8");
    } catch {
      let today = new Date();
      lastStoredDate = today.getFullYear() + '-' + today.getMonth() + '-' + today.getDate()
    }
    
    return lastStoredDate;
  })

  // Handle date selection in mainWindow process
  ipcMain.on('process-date', async (event, arg) => {
    dateToSearch = arg[0];
    writeToTestcase = arg[1]; // writeToTestcase is a global variable
    Log("process-date entered with dateToSearch: " + dateToSearch + ", writeToTestcase: " + writeToTestcase)

    // Navigate to search results for selected date and date's section (Food or Magazine)
    await processDate(dateToSearch)
  });

  // Handle testcase file selection in the mainWindow process
  ipcMain.on('process-file', async (event, arg) => {
    // Input: [HTML filename, href filename]
    console.log("process-file entered")

    htmlToParseFile = arg[0];
    hrefFile = arg[1];
    Log("HTML to parse file: " + htmlToParseFile)
    Log("href file: " + hrefFile)

    // Process input files, ignore recipes
    let [$, articleObj] = prepArticle(htmlToParseFile, hrefFile)

    // Call findRecipes, which parses the article's HTML to identify recipes and
    //  display those recipes.
    await findRecipes($, articleObj, mainWindow);
    mainWindow.webContents.send('enable-searchButtons')

  });

  // Handle click on the Validate button. Parse testcase articles for recipes and compare
  //  those to the expected recipes.
  // The %appPath%/testcase/solvedTestcases directory contains testcases that should be correctly
  //   parsed for recipes.  
  // Each testcase is a directory, named mm-dd-yyy, that contains two
  //  files: <article name>.html and <article name>.txt.
  // The html file is an article to be parsed for recipes.
  // The txt file is a string representing an object with keys url and recipes.
  // The url key specifies the url of the article and is used in the display of the article.
  // The recipes key specifies an array of recipes expected to be found in the article.
  // The process-validate routine parses each testcase for recipes and compares the recipes 
  //  found to the recipes expected.  Testcase where the recipes found differ from the recipes
  //  expected are displayed.
  ipcMain.on('process-validate', async () => {
    console.log("Process validate received")

    // Keep track of articles displayed. None means all testcases were valid.
    let articlesDisplayed = 0;
    
    // Get entries in %appPath%/testcase/solvedTestcases
    let solvedTestcasesDates = fs.readdirSync(testcase + "/solvedTestcases");

    // For each entry ...
    for (solvedTestcasesDate of solvedTestcasesDates) {
      // ... that matches mm-dd-yyy ...
      if (solvedTestcasesDate.match(/\d{2}-\d{2}-\d{4}/)) {

        // ... get its files
        let solvedTestcaseDatePath = testcase + "/solvedTestcases" + "/" + solvedTestcasesDate;
        let solvedTestcaseFiles = fs.readdirSync(solvedTestcaseDatePath)

        for (solvedTestcaseFile of solvedTestcaseFiles) {
          if (solvedTestcaseFile.endsWith(".html")) {
            // For the html file ...

            // Identify the associated txt file
            let solvedTestcaseTxtFile = solvedTestcaseFile.match(/(.*)\.html$/)[1] + '.txt'

            // Identify the paths for both files
            let htmlToParseFile = solvedTestcaseDatePath + "/" + solvedTestcaseFile
            let txtFile = solvedTestcaseDatePath + "/" + solvedTestcaseTxtFile
            console.log("HTML file: " + htmlToParseFile)
            console.log("Txt file: " + txtFile)

            // Process the two input files, returning a Cheerio query function, an article object and              
            //  and array of the expected recipes
            let [$, articleObj, expectedRecipes] = prepArticle(htmlToParseFile, txtFile);

            // Call findRecipes to parse the article for recipes, to compare the found recipes
            //  to the expeced recipes, and to display the article if thefound and expected recipes
            //  deviate.
            // Returns 1 if the deviant article was displayed, 0 oterwise
            let [deviantArticlesDisplayed] = await findRecipes($, articleObj, mainWindow, expectedRecipes);

            // Accumulate the number of deviant articles
            articlesDisplayed += deviantArticlesDisplayed
          }
        }
      }
    }

    // If no articles were deviant, tell renderer.js 
    //  to display an 'all valid' msg
    if (articlesDisplayed == 0) {
      mainWindow.webContents.send('validate-successful');
    }

    mainWindow.webContents.send('process-end')

  })

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
  
  // Set the Always On Top attribute of the mainWindow
  //  The mainWindow should be on top while the nytimes.com pages are being navigated and scraped
  //  It should no longer be on top when that process is finished to allow reviewing the pages retained
  ipcMain.on('mainAOT', (event, arg) => {
    //mainWindow.setAlwaysOnTop(arg);
  })

  ipcMain.on('mainFocus', (event, arg) => {
    console.log("Focus");
    mainWindow.show();
  })

  // Listen for click on an article in the mainWindow; open the article in 
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

  ipcMain.on('dialog-error', (event,args) => {
    let [title, content] = args
    dialog.showErrorBox(title, content)
  })

  // Handle reset window button 
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
  

  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  // Some APIs can only be used after this event occurs.
  app.on('ready', createWindow)

  // On quitting, store the last date searched (if later that the last date stored)
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

    // Try to update the last stored date. This will fail if a testcase file was
    //  processed.
    try {
      if (dateToSearch > lastStoredDate || 
        dateToSearch.substr(0,4) < lastStoredDate.substr(0,4)) {
        console.log(" writing lastDateFile")
        fs.writeFileSync(lastDateFile, dateToSearch, "utf8");
      }
    } catch {}
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

}

// Call the mainline function to establish various event listeners
mainline()
