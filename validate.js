// External modules used
const {app, BrowserWindow} = require('electron');
const { ipcMain } = require('electron');
const path = require('path');
const mysql = require('mysql2/promise');
const cheerio = require('cheerio')
const fs = require('fs'); // Filesystem functions
const appPath = process.cwd();
const updatePath = '/Applications/MAMP/htdocs/exports/article-updates/'

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
  // Convert MySQL boolean values [0, 1] to [false, true] and vice versa

  if (typeof num == 'number') {
    if (num == 1) {
      return true
    } else {
      return false
    }
  } else {
    if (num){
      return 1
    } else {
      return 0
    }

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
  const table = "articles";

  function createUpdate(seq, name, solved, articleResults, articleObj) {
    // Create a MySQL UPDATE statement to update the 'articles' table for an
    //  article, specified by 'seq', that have been solved or improved, where
    //  'solved' means the the current parse results match the expected results 
    //  recorded in the database and 'improved' means the current parse results 
    //  are closer to the expected results recorded in the database than the parse
    //  results recorded in the database.
    // The UPDATE statement updates the hasArticleClass item and the 
    //  discoveredRecipes item in both the 'solved' and 'improved' cases.  In the 
    //  'solved' case, the isNotSolved, expectedRecipes and hasFragmentedTitle are
    //  also updated.
    //
    // Input: seq: sequence number of the article to update
    //        name: Name item from the database
    //        solved: boolean, indicates whether the results solve the article (true)
    //                  or just improve it (false)
    //        articleResults: object, output of function findRecipes
    //        articleObj: object, output of function adjustTitle plus addition
    // Output: string, MySQL UPDATE statement, written to:
    //          `/Applications/MAMP/htdocs/exports/article-updates/${seq}-${name}.txt`

    Log("createUpdate entered with: ")
    Log(`seq: ${seq.toString()}`)
    Log(`articleResults: ${JSON.stringify(articleResults)}`)
    Log('articleObj.hasArticleClass: ' + articleObj.hasArticleClass)
    const table = "articles";

    let set = `hasArticleClass=${bx(articleObj.hasArticleClass)},
      discoveredRecipes="${articleResults.recipes.join('\n')}"`
    if (solved) {
      set = `isNotSolved=false, expectedRecipes='', hasFragmentedTitle=${bx(articleResults.hasFragmentedTitle)}, ${set}`
    }

    let updateStmt = `UPDATE ${table} SET ${set} WHERE seq=${seq}`
    console.log('updateStmt: ' + updateStmt)
    let fileName = `${updatePath}${seq.toString()}_${name}`
    fs.writeFileSync(fileName, updateStmt, 'utf8')

  }


  // Get the range of sequence numbers to be validated
  let maxResult = await connection.query(`SELECT MAX(seq) FROM ${table}`)
  let max = maxResult[0][0]['MAX(seq)'];
  console.log("Max seq: " + max.toString())

  // Set the database items to be retrieved from each database row
  let cols = 'Name, hasArticleClass, hasFragmentedTitle, isNotSolved, discoveredRecipes, expectedRecipes, html'

  // Assume all results will be the same as the database's results
  let allSame = true;

  // Define the database results object
  let dbResult;

  // Validate each database row, i.e. each article
  for (let seq = 1; seq <= max; seq++ ) {
    console.log(`Processing seq: ${seq.toString()}`)

    // Retrieve the article's items from the database
    row = await connection.query(`SELECT ${cols} FROM ${table} WHERE seq = ${seq}`)

    // dbResults is an object specifying the retrieved items from this row
    dbResult = row[0][0];

    // If the article was not previously solved ...
    if (bx(dbResult.isNotSolved)) {
      // Create an array of the expected recipes
      var expectedRecipesArray = dbResult.expectedRecipes.split('\n')
      //Log("Database hasArticleClass: " + dbResult.hasArticleClass)
    }

    // Create an array of the database discovered recipes
    //  recipesToArray handles empty strings, returning an empty array  
    let dbDiscoveredRecipesArray = recipesToArray(dbResult.discoveredRecipes)

    // If the discovered results in the database row is an empty string,
    //  .split('\n') does not return an empty array ( it returns [ '' ] ).
    // Create dbExpectedResultsArray, which can be compared to the array
    //  returned in articleResults.recipes
    function recipesToArray (recipeString) {
      Log("recipesToArray entered with: '" + recipeString + "'" )
      if (recipeString == '') {
        return []
      } else{
        return recipeString.split('\n')
      }
    }

    // Create a Cheerio query function based on this article's html
    let $ = cheerio.load(dbResult.html)
      
    // Get article title and create articleObj with key 'title'
    let header = $('header.e12qa4dv0');
    let rawTitle = $('h1', header).text();
    let articleObj = adjustTitle(rawTitle);

    // Add hasArticleClass to the articleObj
    articleObj['hasArticleClass'] = getArticleClass($)[0];
    //Log("Current hasArticleClass: " + articleObj.hasArticleClass)

    // Add author to the articleObj
    articleObj['author'] = getAuthor($)

    // Call findRecipes to get recipes in the article
    let [ , articleResults] = await findRecipes($, articleObj);
    console.log("articleResults.recipes: " + articleResults.recipes + ", typeof: " + typeof articleResults.recipes + ", length: " +  articleResults.recipes.length.toString());

    // Check if a previously unsolved article has been solved, i.e. the 
    //  current discovered recipes match the database's expected recipes.
    // If so, display the article as solved.
    // In either case, add the isNotSolved key to the current results object, articleResults
    if (bx(dbResult.isNotSolved)) { 
      // If the article is not solved in the database ...
      if (expectedRecipesArray.equals(articleResults.recipes)) {
        // ... and the current recipes match the expected recipes,
        // display the article as solved
        console.log("Article solved: seq: " + seq.toString() + ", Name: " + dbResult.Name )
        allSame = false
        validateWindow.webContents.send('article-solved', 
        JSON.stringify(
          {
            seq: seq,
            name: dbResult.Name
          
          })
        )
        articleResults['isNotSolved'] = false
        createUpdate(seq, dbResult.Name, true, articleResults, articleObj)
      } else {
        articleResults['isNotSolved'] = true
      }
    }

    // Compare the current parse results to the database results.
    //  Results include attributes such as hasArticleClass and 
    //  hasFragmentedTitle, as well as the recipes discovered.
    
    let improved = false;
    let comparisonArray;

    // For this comparison, choose which set of database recipes to
    //  compare with the current discovered recipes
    let dbRecipesArray;
    if (!articleResults.isNotSolved && bx(dbResult.isNotSolved)) {
      // If the current results solve a previously unsolved article,
      //  use the expected results for the comparison.
      // Note: Only unsolved database entries have expected recipes.
      //  Since the current results solve the article, its discovered
      //  recipes will match the database's expected recipes, so the
      //  comparison will only detect differences in the tested
      //  attributes, e.g. hasArticleClass and hasFragmentedTitle.
      Log("Different results test will use expectedRecipes")
      dbRecipesArray = expectedRecipesArray;
    } else {
      // Otherwise, use the previously discovered recipes for the
      //  comparison
      Log("Different results test will use discoveredRecipes")
      dbRecipesArray = dbDiscoveredRecipesArray
    }    
    
    // If the article is not yet solved, check if the current results
    //  are an improvement.
    // For each expected recipe, determine whether it is included
    //  in the current discovered recipes and whether is is inclduded
    //  in the database discovered recipes.  If more of the expected
    //  recipes are included in the current discovered results than
    //  are included in the database discovered results, then the 
    //  current results are an improvement, and the improvement is
    //  displayed.
    if ( articleResults.isNotSolved && bx(dbResult.isNotSolved) ) {
      Log("Neither solved")

      // Number of current results recipes that match an expected recipe
      let currMatch = 0;

      // Number of database results recipes that match an expected recipe
      let dbMatch = 0;

      // Array, status of each expected recipe's presence in the current
      //  discovered recipes
      let currStatus = [];

      // Array, status of each expected recipe's presence in the database
      //  discovered recipes
      let dbStatus = [];

      for (let i = 0; i < expectedRecipesArray.length; i++) {
        // For each expected recipe ...

        if (articleResults.recipes.includes(expectedRecipesArray[i])) {
          // If this expected recipe is included in the current discovered
          //  results ...

          // Count the match
          currMatch++

          // Determine which discovered recipe matches this expected recipe.
          for (let ix = 0; ix < articleResults.recipes.length; ix++) {
            // For each current discovered recipe
            
            if ( articleResults.recipes[ix] == expectedRecipesArray[i]) {
            // Try this: if ( articleResults.recipes[ix].startsWith(expectedRecipesArray[i]) ) {
              // If the discovered recipe matches this expected recipe ...

              // Add an element indicating the discovered recipe index and
              //  indicating the match to the currStatus array, then exit
              //  the loop.
              currStatus.push([ix, true])
              break;
            }
          }

        } else {
          // If the expected recipe is not included in the array of the 
          //  current discovered recipes, append an element to the
          //  currStatus array that indicates the discovered recipes
          //  array index is null and the expected recipe is not matched
          currStatus.push([null, false])
        }

        Log("currStatus array: " + JSON.stringify(currStatus))

        // Determine whether this expected recipe is inculded in the 
        //  database discovered recipes array.
        // If so, count it.
        // And add the determination to the dbStatus array
        if (dbDiscoveredRecipesArray.includes(expectedRecipesArray[i])) {
          dbMatch++
          dbStatus.push(true)
        } else {
          dbStatus.push(false)
        }
      }

      // Create a comparison array that combines the elements of the
      //  currStatus array and the dbStatus array.  The elements of
      //  the comparison array have the form:
      //  [index, currIsMatch, dbIsMatch]
      //  where index is either the index of the current discovered recipes
      //               array element that matches ix element of the expected 
      //               recipes array or null, if the ix element of the expeced
      //               recipes array is not matched by any element of the 
      //               current discovered recipes array
      //        currIsMatch is a boolean indicating whether the ix element
      //                      of the expected recipes array is matched by
      //                      and elementof the current discovered recipes
      //                      array
      //        dbIsMatch is a boolean indicating whether the ix element
      //                      of the expected recipes array is matched by
      //                      and elementof the database discovered recipes
      //                      array
      // The comparison array is passed to the renderer process, which uses
      //  it to color the displayed current discovered recipes
      comparisonArray = currStatus.map((e, ix) => [e[0], e[1], dbStatus[ix]])
      //Log("comparisonArray:")
      //Log(JSON.stringify(comparisonArray))

      Log("currMatch: " + currMatch.toString() + ", dbMatch: " + dbMatch.toString())
      if (currMatch > dbMatch) {
        // If more of the current discovered recipes than the database
        //  discovered recipes match expected recipes, indicate that
        //  the current results are an improvement

        improved = true
        //Log("Comparison array:")
        //Log(JSON.stringify(comparisonArray))

        createUpdate(seq, dbResult.Name, false, articleResults, articleObj)

      }

    }

    if ( !dbRecipesArray.equals(articleResults.recipes)
      || articleObj.hasArticleClass != bx(dbResult.hasArticleClass)
      || (articleResults.hasFragmentedTitle != bx(dbResult.hasFragmentedTitle) && !bx(dbResult.isNotSolved)) ) {
      // If there is a difference between the current parse results and
      //  the database results, display the article

      // Log("Different results: seq: " + seq.toString() + ", Name: " + dbResult.Name )
      // Log("First condition: " + !dbRecipesArray.equals(articleResults.recipes) );
      // Log("recipes split: " + dbRecipesArray )
      // Log("article recipes: " + articleResults.recipes);
      // Log("Second condition: " +  articleObj.hasArticleClass != bx(dbResult.hasArticleClass) )
      // Log("Second condition: ")
      // Log("articleObj.hasArticleClass: " + articleObj.hasArticleClass)
      // Log("bx(dbResult.hasArticleClass): " + bx(dbResult.hasArticleClass))
      // Log( articleObj.hasArticleClass != bx(dbResult.hasArticleClass) )
      // Log("Third condition: " + (articleResults.hasFragmentedTitle != bx(dbResult.hasFragmentedTitle) && !bx(dbResult.isNotSolved)) )
      // Log("articleObj.hasArticleClass: " + articleObj.hasArticleClass);
      // Log("dbResult.hasArticleClass: " + dbResult.hasArticleClass)
      // Log("articleResults.hasFragmentedTitle: " + articleResults.hasFragmentedTitle);
      // Log("dbResult.hasFragmentedTitle: " + dbResult.hasFragmentedTitle)
      // Log("dbResults recipes: " + dbResult.discoveredRecipes)
      // Log("articleResults recipes: " + articleResults.recipes)
      // Log("articleResults.isNotSolved: " + articleResults.isNotSolved)
      // Log("Improved: " + improved)


      // Indicate that differences were found
      allSame = false;

      // Display the different article
      validateWindow.webContents.send('article-display', 
        JSON.stringify(
          {
            seq: seq,
            name: dbResult.Name,
            dbClass: bx(dbResult.hasArticleClass),
            articleClass: articleObj.hasArticleClass,
            dbTitle: bx(dbResult.hasFragmentedTitle),
            articleTitle: articleResults.hasFragmentedTitle,
            dbResult: dbRecipesArray,
            articleResults: articleResults.recipes,
            articleNotSolved: articleResults.isNotSolved,
            improved: improved,
            comparison: comparisonArray
          
          }
        )
      )
    }
  }

  
  if (allSame) {
    // If no differences were found, display that, ...
    Log("All results as expected")
    validateWindow.webContents.send('Ok-display');
  } else {
    // Otherwise, just remove the 'loading' div
    validateWindow.webContents.send('finished');
  }
    
}

mainline()