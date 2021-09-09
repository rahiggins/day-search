// This application searches nytimes.com for articles published on a particular 
// Sunday or Wednesday.  For Sundays, the search is for articles in the Magazine 
// section.  For Wednesdays, the search is for articles in the Food section. After the
// the day-specific section search, the full day is searched for the keywords:
// [tablespoon, shaken, recipe, yield:]

// Each result found by these searches is examined for the presence of recipes.

// These search results are displayed:
//  - Articles that contain recipes, along with the names of the recipes
//  - Search results that consist of a single recipe, along with the name of the recipe
//  - Search results that consist of an NYT Cooking page

// For each recipe displayed, a Search button is provided to search NYT Cooking
//  for recipes by the article's author that match the recipe name.  Matches 
//  are displayed in a separate window.

// This apppication requires an instance of Chrome enabled for remote debugging.
//  First start Chrome by executing Remote_debug_Chrome.sh in the Terminal app
//  and use that instance of Chrome to log in to nytimes.com.  Then start this
//  application.

// Modules used here
const {app, BrowserWindow} = require('electron')
const { ipcMain } = require('electron')
const fs = require('fs'); // Filesystem functions
const { exec } = require('child_process');
const needle = require('needle'); // HTTP client
const puppeteer = require('puppeteer'); // Chrome API
const cheerio = require('cheerio'); // core jQuery
const pos = require('pos');  // Part Of Speech classification 

// Get path to application data and set set paths to local data
const appPath = app.getPath('appData') + "/" + app.name + '/';
const lastDateFile = appPath + 'LastDate.txt';  // Last date processed
const testcase = appPath + 'testcase/'; // Folder containing testcase data

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow

// Global variables
let browser;              // Puppeteer browser
let dayPage;              // Day search page
let NYTCookingID = null;  // NYT Cooking page ID
let lastAuthor = null;    // Last author searched at NYT Cooking
let lastStoredDate;       // Last date stored to ~user/Library/Application Support/day-search
let dateToSearch;
let debug = true;         // Used by Log function

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
  // Called from Mainline

  console.log("connectPup: entered");

  // Try to obtain the remote-debugging Chrome endpoint.  If successful, connect
  //  puppeteer to the remote-debugging instance of Chrome, create a new page
  //  and return 0. If unsuccessful, return -1, terminating the application.
  let url = "http://127.0.0.1:9222/json/version"
  try {
      let resp = await needle("get", url);
      Log(resp.body.webSocketDebuggerUrl)
      browser = await puppeteer.connect({
          browserWSEndpoint: resp.body.webSocketDebuggerUrl,
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



//////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////



async function processDate (dateToSearch, writeToTestcase) {
  // Search a date (Sunday: Magazine section or Wednesday: Food Section)
  //  for articles containing recipes

  function recipeParse($, paras, arr, demarcation, title, isRecipe, isPairing, numRecipes, isBeverage, beverageType) {
    // Parse article page text for recipe names
    // Input:
    //  - Cheerio function bound to the article HTML
    //  - Array of the <p> elements in the article (Cheerio objects)
    //  - Array of indices of the paras array that are recipe demarcations
    //  - Name of demarcation in the passed array, "instr" or "yield"
    //  - Article title
    //  - isRecipe (boolean)
    //  - isPairing (boolean)
    //  - number of recipes (unused?)
    //  - isBeverage (boolean)
    //  - Beverage type (wine, beer, etc)
    // Output: Recipe names 
    //
    // Each element of the 'demarcations' array corresponds to a recipe.
    // When the demarcation name is "instr", the array elements are the first
    //  recipe instruction paragraph (i.e. '1. text').
    // When the demarcation name is "yield", the array elements are the last
    //  paragraph of a recipe, which starts with "Yield:"
    // 
    // This function ierates through the paragraphs preceeding each demarcation array element
    //   until a recipe name is found.
    //
    //  The recipe name is:
    //   - A paragraph containing all upper case letters
    //   - The concatenation of paragraphs between:
    //    -- a paragraph that starts with a numeral and
    //    -- a paragraph that starts with "Yield" or that ends with terminal
    //        punctuation - a period, question mark or exclamation point

    Log("recipeParse entered")
    Log(" arr: " + arr);
    Log(" demarcation: " + demarcation);
    Log(" Title: " + title);
    Log(" isRecipe: " + isRecipe);
    Log(" isPairing: " + isPairing);
    Log(" numRecipes: " + numRecipes);
    Log(" isBeverage: " + isBeverage);
    Log(" beverageType: " + beverageType)
    
    let recipeNameArray = [];
    let recipeNameIsArticleTitle = false;
  
    // The difference between "Yield;" markers and "1. " markers is
    //  the treatment of numbered paragraphs
    if (demarcation == "instr") {
        exp = "p.isNum && !p.isInstr"
    } else {
        exp = "p.isNum"
    }
  
    // For each recipe marker
    for (j = 0; j < arr.length; j++) {
        let last = arr[j];
        let tempNaN = ""; // Concatenation of paragraphs
        recipeName = "Recipe Name not found";

        // (01/31/2001: Ahi Katsu with Wasabi Ginger Sauce - 
        //   recipe name as title, not marked Recipe. Distinguish from FOOTNOTES
        //   by ingredientFound: p.isNum && !p.isInstr)
        let ingredientFound = false;

        let numFound = false; // Don't concat paras until a numeral-started paragraph is found
  
        // Walk back through paragraphs from "Yield:" or "1. "
        for (let i = last-1; i>Math.max(last-50, -1); i--) {
            let lp = $(paras[i])
            let t = $(lp).text()
            let p = para(t)
            Log(t.substr(0,15) + " " + p.words + " " + p.isNum + " " + p.isInstr + " " + p.yield + " " + p.colon + " " + p.allCAPS + " " + p.ad + " " + p.adapted + " " + p.punct);
  
            // All uppercase is a recipe name
            if (p.allCAPS) {
                Log("allCAPS");
                Log(t)
                if (t == "RECIPES") {
                    recipeName = tempNaN
                    tempNaN = ""
                    break
                } else {
                    //recipeName = t
                    //break
                    tempNaN = t + " " + tempNaN;
                    continue
                }
            }
  
            // Skip paragraphs that start with a numeral (instruction step or ingredient)
            //  and reset concatention of paragraphs
            if (eval(exp)) {
                numFound = true;
                tempNaN = "";
                if (!p.isInstr) {
                  // If not an instruction, then note that it's an ingredient
                  ingredientFound = true;
                }
                Log("isNum - tempNaN reset - ingredient: " + ingredientFound);
                continue
            }
  
            // Skip 'Adapted' paragraphs and reset concatention of paragraphs
            if (p.adapted) {
                Log("adapted - tempNaN reset");
                tempNaN = "";
                continue
            }
  
            // Skip paragraphs (e.g. Note:, Advertisement)
            if (p.colon || p.ad) {
                Log("Skipped - colon or ad");
                continue
            }
  
            // If a paragraph containing punctuation and concatenated paragraphs exist, or "Yield:"
            //  set recipe name and exit loop,
            // else concatenate paragraph if a paragraph beginning with a numeral
            //   has been encountered previously
            //if (((p.words > 9 || p.punct)  && tempNaN != "") || p.yield) {
            if (((p.punct)  && tempNaN != "") || p.yield) {
              Log("Text para and tempNaN or Yield- recipeName set");
              if (p.yield && tempNaN == '') {
                // If 'Yield:' encountered and tempNaN is empty, look to the subsequent paragraph
                let subsequentParaText = $(paras[i+1]).text()
                Log("yield & empty tempNAN, previous paragraph: " + subsequentParaText)
                recipeName = subsequentParaText
              } else {
                recipeName = tempNaN;
              }
              tempNaN = "";
              break
            } else if (p.punct) {
                Log("para contains terminal punctuation, skipped");
                continue
            } else if (numFound) {
              Log("numFound so para concatenated");
              tempNaN = t + " " + tempNaN;
          }
        }

        Log("Finished walking back through paragraphs")
        Log("Ingredients? " + ingredientFound);
        //Log("Title paragraph number: " + i.toString())
        Log("isRecipe: " + isRecipe)
        Log("tempNaN: " + tempNaN)
        if (tempNaN !== "" && !isRecipe) {
          Log("Recipe name set to tempNaN")
          recipeName = tempNaN;
        }
        // console.log("Recipe name: " + recipeName)
        // console.log("Recipe name split: " + recipeName.split(/\(*.*adapted/i))

        // 12/08/2002 (adapted...) as part of the recipe title; 1/7/2001 (wildly adapted...)
        let trimmedRecipeName = recipeName.split(/\(.*adapted/i)[0].trim();
        Log("trimmedRecipeName: " + trimmedRecipeName);
        if ((trimmedRecipeName == "Recipe Name not found" && (isRecipe || (numRecipes == 1 && ingredientFound))) || trimmedRecipeName.toLowerCase() == "recipe") {
          Log("Recipe name set to title")
          recipeNameIsArticleTitle = true;
          trimmedRecipeName = title;
        }
        Log("Recipe name: " + trimmedRecipeName);
        recipeNameArray.push(trimmedRecipeName)
    }
    
    if (recipeNameIsArticleTitle) {
      type = "Recipe";
    } else if (isPairing) {
      type = "Pairing";
    } else if (isBeverage) {
      type = beverageType;
    } else {
      type = "Article";
    }
    Log("Page type: " + type)
    Log("Some result: " + recipeNameArray.some( (name) => {return name != "Recipe Name not found"}),)
    return {
        hasRecipes: recipeNameArray.some( (name) => {return name != "Recipe Name not found"} ),
        recipes: recipeNameArray,
        type: type
    }
  }
  
  function para(text) {
    // Return an object describing paragraph text:
    //  words: the number of words in the paragraph
    //  isNum: true if the first character of the paragraph is a numeral
    //  isInstr: true if the paragraph starts with numerals followed by a period
    //  yield: true if the first word is Yield:
    //  colon: true if the first word ends with ':' but is not Yield: or
    //           the paragraph text ends with ':'
    //  allCAPS: true if all letters are capital letters
    //  ad: true if first word is "Advertisement" 
    //  adapted: true if first word includes (case-insensitive) "Adapted"
    //  punct: true if the paragraph ends with a period, question mark,
    //          exclamation point, apostrophe, quote or right parenthesis.

  
    let trimmedText = text.trim()
    let words = trimmedText.split(/\s+/g); // Split text by whitespace characters
    return {
        words: words.length,
        isNum: Number.isInteger(parseInt(trimmedText.substr(0,1))),
        isInstr: trimmedText.search(/^\d+\./) > -1,
        yield: words[0] === "Yield:",
        colon: (words[0].endsWith(":") && !words[0].startsWith("Yield")) || trimmedText.endsWith(":"),
        allCAPS: trimmedText === trimmedText.toUpperCase(),
        ad: words[0] === "Advertisement",
        adapted: words[0].search(/Adapted/i) > -1,
        punct: trimmedText.match(/[\.\?!\"\')]$/) != null
  
    }
    
  }

  async function processSectionOrKeywords(url, searchDomain) {

      // Go to search page listing articles in the selected day's section of interest:
      //  Magazine (Sunday) or Food (Wednesday).  First, make the dayPage tab active (bringToFront).
    await dayPage.bringToFront(); 
    await dayPage.goto(url, {waitUntil: "networkidle0"});

    // If there's a 'Log In' link, log in
    try {
      let logInButton = await dayPage.waitForSelector('[data-testid="login-link"]', {timeout: 250});
      Log("Log In found")

      // Click the Log In link
      await logInButton.click();

      // Go enter credentials
      //await login();

      // Wait for navigation back to search results
      await dayPage.waitForNavigation({waitUntil: 'networkidle0'})


    } catch {
        Log("Log In not found");
    }

    // Get number of search results initially displayed
    let currentSearchResultsNum = await searchResultsNum()
    Log("Initial search results: " + currentSearchResultsNum.toString())

    async function searchResultsNum() {
        // Return the number of search results in the page 
        let $ = cheerio.load(await dayPage.content());
        let ol = $('ol');
        let listItems = $('li.css-1l4w6pd', ol)
        return listItems.length;
    }

    mainWindow.webContents.send('display-spinner')

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

    // First, create an array of Cheerio objects corresponding to the articles returned by the search.
    //  - Load search results page HTML into Cheerio.  Search results are displayed in
    //    an ordered list. Create an array listItems of articles have attribute data-testid=search-bodega-result.
    let $ = cheerio.load(await dayPage.content()); 
    let ol = $('ol');
    let listItems = $('li', ol).filter(function (i, el) {
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

    // For each search result article
    $(listItems).each( async function(i, elem) {
        Log($('h4',this).text()); // Log title

        // Initialize article type attributes
        let isPairing = false;
        let isRecipe = false;
        let Beverage = [false, null];

        // Get href, discard query string (?...), prefix relative hrefs
        let href = $('a',this).attr('href');
        href = href.substring(0,href.indexOf('?'));
        if (href.startsWith("/")) {
          href = `https://www.nytimes.com${href}`;
        }

        // Get title
        let title = $('h4',this).text().trim();

        // Adjust the title, if necessary

        // See if title contains a ';' or a ':'
        titleMatch = title.match(/[;:]/);
        Log("titleMatch: " + titleMatch);

        if (titleMatch !== null) {
          // If so, split the title at the first ';' or ':'        
          titleSplit = title.split(titleMatch[0]);
          Log("titleSplit: " + titleSplit);

          // If the title was split at a ';', set the article's title to the portion following the ';' 
          if (titleMatch[0] == ';') {
            title = titleSplit.slice(-1)[0];

          // Else if the title was split at a ':' and the portion preceeding the ':' was 'recipe(s)' or 'pairing(s),
          //  set the article's title to the portion following the ':' 
          } else if (titleMatch[0] == ':' && titleSplit[0].toLowerCase().match(/recipe+s*|pairing+s*/) !== null) {
            title = titleSplit.slice(-1)[0];
          }

          Log("Adjusted title: " + title);

          // Set article type according to the portion preceeding the split
          let portionPreceeding = titleSplit[0].toLowerCase();

          // See if the article is beverage-related; Beverage = [boolean, display label]
          Beverage = checkForBeverage(portionPreceeding);
          Log("Beverage array: " + Beverage)

          function checkForBeverage (portionPreceeding) {
            // Check the article title to see if the article is beverage-related
            //
            // Input: the first part of the article title (preceeding a ';' or ':')
            //
            // If portionPreceeding contains 'tasting[s] or starts with 
            //  'wines', 'beers', 'spirits' or 'ales' etc and is followed by ' of the times',
            //  then the article is beverage-related and article display will be labeled
            //  'Tasting", 'Wine', 'Beer', 'Spirits', 'Ale', etc
            //
            // Output: Array [boolean isBeverage, string beverageType]

            // Map title text to beverageType
            let beverageTypeMap = {
              wines: "Wine",
              beers: "Beer",
              spirits: "Spirits",
              ales: "Ale"
            }

            // Initialize isBeverage and beverageType: not beverage-related, null
            let isBeverage = false;
            let beverageType = null;

            // Split the portionPreceeding by ' of the times'
            //  The result is [portionPreceeding] if ' of the times' is not found, or
            //  [x, ""] if portionPreceeding is 'x of the times'
            let ofTheTimesSplit = portionPreceeding.split(" of the times");

            // See if the first element of the preceeding split result is 'wines', 'beers', 'spirits' or 'ales' etc
            //  The result is null if not, or [x] where x is 'wines', 'beers', 'spirits' or 'ales' etc
            let ofTheTimesFirstPart = ofTheTimesSplit[0].match(/^wines$|^beers$|^spirits$|^ales$/)

            // If the portionPreceeding contains 'tasting[s]', the article is beverage-related
            if (portionPreceeding.match(/tasting+s*/) !== null) {
              isBeverage = true;
              beverageType = "Tasting"

            // If the ' of the times' split yielded 2 elements and 
            //  the first element is 'wines', 'beers', 'spirits' or 'ales' etc,
            //  then the article is beverage-related and 
            //  the first element is mapped to an article display label 
            } else if (ofTheTimesSplit.length == 2 && ofTheTimesFirstPart !== null) {
              isBeverage = true;
              beverageType = beverageTypeMap[ofTheTimesFirstPart[0]]
            }

            return [isBeverage, beverageType]
          }

          if (portionPreceeding.match(/pairing+s*/) !== null) {
            isPairing = true;
          }
          if (portionPreceeding.match(/recipe+s*/) !== null) {
            isRecipe = true;
          }

        }

        // Add an article object to the articles array
        articles.push(
            {
                title: title,
                author: $('p.css-15w69y9',this).text().substr(3),
                link: href,
                isBeverage: Beverage[0],
                isPairing: isPairing,
                isRecipe: isRecipe,
                beverageType: Beverage[1]
            }
        )
    })

    let articlesNum = articles.length.toString();
    Log("Array articles length: " + articlesNum);

    // For each article, search the article text for recipes.
    for (a = 0; a<articles.length; a++) {
      mainWindow.webContents.send('progress-bar', [(a+1).toString(), articlesNum, searchDomain]);
      if (displayedURLs.includes(articles[a].link)) {
        Log("Early already displayed: " + articles[a].title)
        continue;
      }
      Log("Go to article " + articles[a].link)
      Log("Title: " + articles[a].title)
      Log("Author: " + articles[a].author)
      Log("isBeverage: " + articles[a].isBeverage)
      Log("isRecipe: " + articles[a].isRecipe)
      Log("beverageType: " + articles[a].beverageType)

      if (articles[a].link.includes("cooking.nytimes.com")) {
        if (displayedURLs.includes(articles[a].link)) {
          Log("Article already displayed: " + articles[a].title)
        } else {
          Log("Display article: " + articles[a].title);
          displayedURLs.push(articles[a].link)
          mainWindow.webContents.send('article-display', [JSON.stringify(articles[a]), [articles[a].title], "NYT Cooking"])
        }
      } else {
        // Create a new page and go to the article
        articlePage = await browser.newPage(); 
        articlePage.setDefaultNavigationTimeout(0);
        await articlePage.waitForTimeout(250);
        await articlePage.goto(articles[a].link, {waitUntil: "networkidle0"})
        // Load article HTML into Cheerio and create an array (paras) of <p> elements
        let articleHTML = await articlePage.content();

        if (writeToTestcase) {
          let safeTitle = articles[a].title.replace(/\//g, "\\")
          if ( !fs.existsSync(testcase + safeTitle + ".html") ) {
            fs.writeFileSync(testcase + safeTitle + ".html", articleHTML);
            fs.writeFileSync(testcase + safeTitle + ".JSON", JSON.stringify(articles[a]))
          }
        }

        $ = cheerio.load(articleHTML);
        articleBody = $('section').attr('name', 'articleBody')
        let paras = $('p',articleBody);
        Log("Number of paragraphs: " + paras.length.toString())
        //if (articles[a].link.includes("footnotes")) {
        //    $(paras).each( function(i, elem) {
        //        Log($(this).text().substr(0,20))
        //    })
        //

        // Create an array (yieldPara) of <p> elements whose text starts with "Yield:"
        //  These paragraphs mark the end of a recipe.
        // Also create an array (instrPara) of <p> elements whose text starts with "1. "
        //  The paragraphs mark the first instruction step of a recipe.
        let yieldPara = [];
        let instrPara = [];
        $(paras).each( function(k, elem) {
          //Log("Para " + k.toString() + " starts with: " + $(this).text().substr(0, 10))
            if ($(this).text().trim().startsWith("Yield:")) {
                //Log("Pushed Yield: para")
                yieldPara.push(k)
            }
            if ($(this).text().trim().startsWith("1. ")) {
                //Log("Pushed 1. para")
                instrPara.push(k)
            }
        })
      
        let yieldRecipes = yieldPara.length;
        let instrRecipes = instrPara.length;
        if (yieldRecipes == instrRecipes) {
            Log("Recipes: " + yieldRecipes.toString());
        } else {
            Log("Recipe mismatch: Yield: " + yieldRecipes.toString() + ", 1.: " + instrRecipes.toString())
        }

        // Sometimes, recipes don't end with "Yield:"
        // Sometimes, recipe instruction steps aren't numbered
        // In order to identify recipes, use the more numerous marker.
        //  If both markers are equal, use the first instruction step marker
        if (instrRecipes > 0 || yieldRecipes > 0) {
            if (instrRecipes >= yieldRecipes) {
                articleResults = recipeParse($, paras, instrPara, "instr", articles[a].title, articles[a].isRecipe, articles[a].isPairing, instrPara.length, articles[a].isBeverage, articles[a].beverageType)
            } else {
                articleResults = recipeParse($, paras, yieldPara, "yield", articles[a].title, articles[a].isRecipe, articles[a].isPairing, yieldPara.length, articles[a].isBeverage, articles[a].beverageType)
            }
        } else {
            articleResults = {hasRecipes: false}
        }

        if (articleResults.hasRecipes) {
          Log("recipes length: " + articleResults.recipes.length.toString());
          for (r in articleResults.recipes) {
              Log(articleResults.recipes[r])
          }
          if (displayedURLs.includes(articles[a].link)) {
            Log("Article already displayed: " + articles[a].title)
          } else {
            Log("Display article: " + articles[a].title)
            displayedURLs.push(articles[a].link)
            mainWindow.webContents.send('article-display', [JSON.stringify(articles[a]), articleResults.recipes, articleResults.type])
          }
        }

        if (articles[a].isBeverage) {
          Log("Displaying TASTINGS article")
          mainWindow.webContents.send('article-display', [JSON.stringify(articles[a]), [], articles[a].beverageType])
        }

        await articlePage.close()

      }
    }

  }


  // Remove hyphens from dateToSearch for use in URL
  let urlDateToSearch = dateToSearch.replace(/-/g, '');
  // Get day of week (0-6) of selected date
  let dateToSearchObj = new Date(dateToSearch);
  let dayOfWeek = dateToSearchObj.getUTCDay()
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

  let displayedURLs = [];   // array of article URLs displayed

  Log("Searching " + searchDomain)
  await processSectionOrKeywords(dayURL, searchDomain);

  let keywords = ["Tablespoon", "Shaken", "Recipe", "Yield:"]

  for (k in keywords) {
    mainWindow.webContents.send('keyword-div', [keywords[k]])
    let url = `https://www.nytimes.com/search?dropmab=true&endDate=${urlDateToSearch}&query=${keywords[k]}&sort=best&startDate=${urlDateToSearch}`
    searchDomain = "keyword " + keywords[k]
    Log("Searching " + searchDomain)
    await processSectionOrKeywords(url, searchDomain);
  }


  console.log("end of processDate");
  mainWindow.show();
  mainWindow.setAlwaysOnTop(false);
  mainWindow.webContents.send('process-end')
  console.log("mainWindow is AlwaysOnTop: " +  mainWindow.isAlwaysOnTop())

}




///////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////





async function authorSearch (author, title) {
  // Search NYT Cooking for recipes by author, then
  //  filter search results by recipe name (title)

  Log("authorSearch entered with author: " + author + ", title: " + title)

  // NYT Cooking's treatment of diacritics is inconsistent (see Fitting the Mold 7/20/2003)
  //  Used in function replaceProblematics to replace diacritic marked letters with
  //  the base letter for recipe name comparison
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
    }//

    // NYT cooking recipe names use left/right apostrophes and quotes while
    //  the original material used straight apostrophes and quotes.
    // These objects are used by function replaceProblematics to replace
    //  left/right with straight for recipe name comparison
    //
    // Left/right apostrophes (a) and left/right double quotes (b)
    let fancy = ({a: decodeURIComponent("%E2%80%98") + decodeURIComponent("%E2%80%99"), 
                  b: decodeURIComponent("%E2%80%9c") + decodeURIComponent("%E2%80%9d")})//

    // Straight apostrophe (a) and straight quote (b)              
    let plain = ({a: "'", 
                  b: '"'})//

  const lexer = new pos.Lexer(); // Splits text into words and other tokens
  const tagger = new pos.Tagger(); // Tags words and other tokens as parts of speech
  const interestingPOS = ["FW", "JJ", "NN", "VBN"] // Foreign words, adjectives, nouns and past particples//

  function replaceProblematics(text) {
    // Replace letters with diacritical marks with the corresponding base letter for recipe name comparisons
    //  https://stackoverflow.com/questions/863800/replacing-diacritics-in-javascript#comment81646726_32756572
    // Replace left/right single and double quotes straight single and double quotes
    // Input: string 
    // Output: string with diacritical marked letters replaced by base letters and
    //         left/right quotes replaced by double quotes

    return text.split('').map(l =>  Object.keys(diacritics).find(k => diacritics[k].includes(l)) || 
                                    plain[Object.keys(fancy).find(k => fancy[k].includes(l))] ||                              
                                    l).join(''); 
  }

  function desensitize(txt) {
      // Desensitize recipe names for comparison
      //  Call replaceProblematics to:
      //   - replace diacritic marked letters with the base letter and
      //   - replace left/right single and double quotes with straight single and double quotes
      //  Lower-case all letters
      //  Replace double spaces with a single space

      return replaceProblematics(txt).toLowerCase().replace(/  +/g, ' ');
  }

  function isFuzzy(recipe) {
      // Does input recipe (name) contain at least 2 different interesting words from the targetRecipeName?
      // Called from searchClick
      // Input: name of recipe returned by NYT Cooking search
      // Output: boolean

      // Extract words from input recipe name
      let recipeWords = lexer.lex(recipe);

      // Number of interesting target recipe name words found in the input recipe name
      let matchedRecipeWords = 0;

      // List of interesting target recipe name words found in the input recipe name
      let matched = [];

      // See if words in the input recipe name match interesting words in the target recipe name
      for (w in recipeWords) {

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

  async function displayRecipe(recipe, section) {
    // Add a recipe <article> element to the designated section, exact or fuzzy
    // Called from authorSearch
    // Input:   <article> element,
    //          display section, "exact" ot "fuzzy"

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

    // Send <article> element HTML to the NYTCooking renderer proces for display
    NYTCooking.webContents.send('display-recipe', [$.html(), section])

  }

  // For recipe name comparisons, modify the input recipe name to remove diacritical marks, 
  //  replace left/right single and double quotes with staight quotes,
  //  lower-case the name and
  //  replace multiple spaces with a single space
  let lowerCaseTargetRecipeName = desensitize(title)

  // Extract words from the target recipe name
  let targetRecipeNameWords = lexer.lex(lowerCaseTargetRecipeName);

  // Tag target recipe names with Parts Of Speech; returns [ [word, POS], ...]
  let taggedTargetRecipeNameWords = tagger.tag(targetRecipeNameWords);

  // Create array of interesting words in the target recipe name (i.e. Foreign words, adjectives, nouns and past particples)
  //  Use .filter to select interesting Parts Of Speech
  //  Use .map to return just the interesting word - the first element of the [word, POS] pair
  let interestingTargetRecipeNameWords = taggedTargetRecipeNameWords.filter(w => {
      // console.log(w)
      for (p in interestingPOS) {
          if (w[1].startsWith(interestingPOS[p])) {
              // console.log("Interesting")
              return true;
          }
  
      }
  }).map(interesting => interesting[0])

  // If the NYTCooking window ID is not null, close the existing NYTCooking window
  if (NYTCookingID !== null && author !== lastAuthor) {
    Log("Closing existing NYTCooking window")
    BrowserWindow.fromId(NYTCookingID).close();
    NYTCookingID = null;
    NYTCookingPage.close();
  }
  
  if (NYTCookingID == null) {
    Log("Creating new NYTCooking and new NYTCookingPage")

    // Create a new browser window for dispalying filtered NYT Cooking search results
    NYTCooking = new BrowserWindow({
      x: 700,
      y: 50,
      width: 750, 
      height: 600,
      alwaysOnTop: true,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    })

    // Save the NYTCooking window ID
    NYTCookingID = NYTCooking.id

    // and load the NYTCooking window HTML.
    NYTCooking.loadFile('NYTCooking.html')

    // Close button clicked, close the NYTCooking window
    NYTCooking.on('closed', () => {
      Log("NYTCooking window closed")
      NYTCookingID = null;
      //if (!NYTCookingPage.isClosed()) {
      //  NYTCookingPage.close();
      //}
    })

    // Respond to request from new NYTCooking window for search args, author and recipe title
    ipcMain.handleOnce('getSearchArgs', () => {
      Log("getSearchArgs handler entered, returning author: " + author + " and title: " + title)
      return [author, title]
    })

    // Search NYT Cooking
    NYTCookingPage = await browser.newPage();
    NYTCookingPage.setDefaultNavigationTimeout(0);

  } else {
    Log("Reusing NYTCooking window and NYTCookingPage")
    NYTCooking.webContents.send('set-title', [author, title]);
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
  await NYTCookingPage.goto(cookingSearchPage, {waitUntil: "networkidle0"});

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

      // Get an array of recipes (article elements) in that section
      let arrayOfArticleElements = await srSect.$$('article');
      Log("Number of articles: " + arrayOfArticleElements.length.toString());

      // Create an array of the names of the recipes on the search results page
      let arrayOfRecipeNames = [];
      for (i in arrayOfArticleElements) {
          let txt = await NYTCookingPage.evaluate(el => {

              return el.querySelector('h3.name').innerText
          }, arrayOfArticleElements[i] );
          arrayOfRecipeNames.push(txt);
      }
      Log("Number of returned articles: " + arrayOfRecipeNames.length.toString())

      //console.log("Article text:")
      for (a in arrayOfRecipeNames) {
          // console.log(arrayOfRecipeNames[a]);

          // For each recipe on the search results page, compare its name to the
          //  target recipe's name.  The comparison is done on the desensitized
          //  names of each.  Densentized names have no diacritical marks, 
          //  straight quotes and apostrophes, and all letters lowercased.
          // If an exact match is found, the recipe's article element is displayed.
          // Otherwise, the recipe name is tested for a fuzzy match to the target
          //  recipe.  A fuzzy match has two "interesting" words in common with the
          //  target recipe's name.  "Interesting" words are foreign words, 
          //  adjectives, nouns and past particples.
          // If a fuzzy match is found, the recipe's article element is displayed
          //  below any exact matches.

          // For recipe name comparisons, remove diacritical marks, 
          //  straighten quotes and lower-case the name
          lowerCaseRecipeName = desensitize(arrayOfRecipeNames[a])

          // Check for an exact match
          if (lowerCaseRecipeName == lowerCaseTargetRecipeName) {
            console.log("Exact match: " + arrayOfRecipeNames[a]);
            noResults = false;
            await displayRecipe(arrayOfArticleElements[a], "exact");

          } else {

            // Else check for a fuzzy match
            if (isFuzzy(lowerCaseRecipeName)) {
              console.log("Fuzzy match: " + arrayOfRecipeNames[a]);
              noResults = false;
              await displayRecipe(arrayOfArticleElements[a], "fuzzy");
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
            gotoResponse = await NYTCookingPage.goto(cookingSearchPage + nxt, {waitUntil: "networkidle0"});
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
    NYTCooking.webContents.send('no-results', noResultsReason);
  } else {

    // Otherwise, clear any previous messages
    NYTCooking.webContents.send('clear-messages')
  }

  // Done filtering: allow other windows to be on top and close browser page
  NYTCooking.setAlwaysOnTop(false); 

  // Tell renerer.js to enable searchButtons
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
        nodeIntegration: true,
        contextIsolation: false
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

  // Return last date searched to renderer process
  ipcMain.handle('getLastDate', () => {
    lastStoredDate = fs.readFileSync(lastDateFile, "utf8");
    return lastStoredDate;
  })

  // Handle date selection in mainWindow process
  ipcMain.on('process-date', async (event, arg) => {
    dateToSearch = arg[0];
    writeToTestcase = arg[1];
    Log("Date to search: " + dateToSearch )

    // Navigate to search results for selected date and date's section (Food or Magazine)
    //  Return number of number of search results (articles)
    await processDate(dateToSearch, writeToTestcase);
  });

  // Listen for NYTCooking Stop button click
  //  Stop filtering search results by setting continueWithResultsPages to false
  ipcMain.on('stop-NYTCooking', (event, arg) => {
    console.log("Request to stop NYTCooking search");
    continueWithResultsPages = false;
  })

  // Listen for NYTCooking Close button click; close NYTCooking window
  ipcMain.on('close-NYTCooking', (event, arg) => {
    console.log("Request to close NYTCooking window");
    BrowserWindow.fromId(NYTCookingID).close();
    NYTCookingID = null;
    NYTCookingPage.close();
  })

  ipcMain.on('author-search', async (evt, args) => {
    console.log("author-search entered")

    let author = args[0];
    let title = args[1]
    Log("Author: " + author);
    Log("Title: " + title);

    await authorSearch(author, title);

    //ipcMain.removeHandler('getSearchArgs')


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

  ipcMain.on('article-open', (event, action, url) => {
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
  

  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  // Some APIs can only be used after this event occurs.
  app.on('ready', createWindow)

  // On quitting, store the last date searched (if later that the last date stored)
  app.on('will-quit', function () {
    dayPage.close()
    if (dateToSearch > lastStoredDate) {
      fs.writeFileSync(lastDateFile, dateToSearch, "utf8");
    }
  })

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

mainline()
// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
