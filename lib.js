// This file contains functions that parse NYT article HTML to identify embedded
//  recipes.  

// The functions in the file are:
//  - Log
//  - recipeParse
//  - para
//  - adjustTitle
//  - findRecipe

// These functions are called from the index.js process, which requires
//  adjustTitle and findRecipe

// index.js calls adjustTitle and findRecipe

// findrecipe calls recipeParse, which calls para

// All functions call Log

const debug = true; // Used by function Log

function Log (text) {
  // If debugging, write text to console.log
  if (debug) {
      console.log(text)
  }
}

function recipeParse(demarcation, $, paras, arr, articleObj) {
  // Parse article page text for recipe names
  // Called by: findRecipe
  // Input:
  //  - Name of demarcation in the passed array, "instr" or "yield"
  //  - Cheerio function bound to the article HTML
  //  - Array of the <p> elements in the article (Cheerio objects)
  //  - Array of indices of the paras array that are recipe demarcations
  //  - Article object, including keys:
  //  -  title
  //  -  isRecipe (boolean)
  //  -  isPairing (boolean)
  //  -  isBeverage (boolean)
  //  -  beverageType (wine, beer, etc)
  // Output: articleResults object - 
  //         {
  //            hasRecipes: boolean
  //            recipes: array of recipe names,
  //            type: 'Article' | 'Pairing' | 'beverage type' | 'Recipe'
  //         } 
  //
  // Each element of the 'demarcations' array corresponds to a recipe.
  // When the demarcation name is "instr", the array elements are the first
  //  recipe instruction paragraph (i.e. '1. text').
  // When the demarcation name is "yield", the array elements are the last
  //  paragraph of a recipe, which starts with "Yield:"
  // 
  // This function iterates through the <p> elements preceeding each 
  //  demarcation array element until a recipe name is found.
  //
  //  The recipe name is:
  //   - Consecutive <p> elements between:
  //    -- a <p> element that starts with a numeral and
  //    -- a <p> element that:
  //      --- starts with "Yield" or that 
  //      --- ends with terminal punctuation - 
  //          a period, question mark or exclamation point or that
  //      --- consists of RECIPES
  //
  //  Because recipe names can be split between consecutive <p> elements
  //   and because definitive identification of a recipe name depends on
  //   encountering a subsequent terminating <p> element, the variable
  let accumRecipeName;
  //   is used to accumulate recipe name fragments before being assigned as
  //   the recipe name.    

  Log("recipeParse entered")
  Log(" arr: " + arr);
  Log(" demarcation: " + demarcation);
  Log(" Title: " + articleObj.title);
  Log(" isRecipe: " + articleObj.isRecipe);
  Log(" isPairing: " + articleObj.isPairing);
  Log(" numRecipes: " + arr.length);
  Log(" isBeverage: " + articleObj.isBeverage);
  Log(" beverageType: " + articleObj.beverageType)
  Log(" cookingWithTheTimes: " + articleObj.cookingWithTheTimes)
    
  let recipeNameArray = [];
  let recipeNameIsArticleTitle = false;
  
  // For each recipe marker, indicated by an element of arr[],
  //  find the recipe name
  for (j = 0; j < arr.length; j++) {
    Log("Recipe marker " + j.toString())

    recipeName = "Recipe Name not found";

    // Empty the recipe name accumulator.  
    accumRecipeName = "";

    // (01/31/2001: Ahi Katsu with Wasabi Ginger Sauce - 
    //   recipe name as title, not marked Recipe. Distinguish from FOOTNOTES
    //   by ingredientFound
    let ingredientFound = false;

    let numFound = false; // Don't concat paras until a numeral-started paragraph is found

    // Walk back through <p> elements preceeding the recipe marker, 
    //  "Yield:" or "1. ", examining each to identify the recipe name
    for (let i = arr[j]-1; i > -1; i--) {
      
      // Get text of each <p> element
      let paraText = $(paras[i]).text();

      // Occasionally, the paragraph preceding the recipe name ends with
      //  the author name, preventing terminal puncuation from being detected.
      // Remove the author name, if it exists.
      // 
      // Create a RegExp to match (case-insensitive) the author name at the end
      //  of the paragraph text and capture the text preceding the name.
      let rx = new RegExp('(.*)' + articleObj.author + '$', 'i');

      // Look for a match
      let m = paraText.match(rx);

      // If there is a match, ...
      if (m != null) {

          // ... set the paragraph text to the capture group
          paraText = m[1]
          console.log('Author name removed from <p> element');

      }

      // Trimmed the paragraph text and call function para to characterize it -
      //  para returns an object containing various attributes
      paraText = paraText.trim()
      let p = para(paraText);
      Log("Paragraph " + i.toString() + " text: " + paraText.substr(0,40));
      Log(" words: " + p.words + ", isNum: " + p.isNum + ", isInstr: " + p.isInstr);
      Log(" isYield: " + p.isYield + ", colon: " + p.colon + ", allCAPS: " + p.allCAPS);
      Log(" ad: " + p.ad + ", adapted: " + p.adapted + ", punct: " + p.punct);
      Log(" time: " + p.time)

      // All uppercase is a recipe name
      if (p.allCAPS) {
          Log("allCAPS");
          Log(paraText)

          // If the <p> element consists of RECIPES…
          if (paraText == "RECIPES") {
            
            // …the recipe name is the previously accumulated recipe name
            recipeName = accumRecipeName

            // Reset the accumulation and exit the find-recipe-name loop
            accumRecipeName = ""
            break
          } else {
            
            // otherwise accumulate the <p> element's text and continue with the 
            //  next <p> element
            accumRecipeName = paraText + " " + accumRecipeName;
            continue
          }
      }

      // For paragraphs that start with a numeral,
      //  If the recipe demarcation is 'Yield:' or 
      //  if the paragraph is not a recipe instruction, then
      //  note that such a paragraph was found (numFound = true),
      //  empty accumRecipeName, 
      //  and if the paragraph is not an instruction, note that an ingredient was 
      //  found (ingredientFound = true),
      //  then continue with the next <p> element
      if (p.isNum && (demarcation == 'yield' || !p.isInstr)) {
          numFound = true;
          accumRecipeName = "";
          if (!p.isInstr) {
            // If not an instruction, then note that it's an ingredient
            ingredientFound = true;
          }
          Log("isNum - accumRecipeName reset - ingredient: " + ingredientFound);
          continue
      }

      // Skip 'Adapted' and 'time:' <p> elements and empty accumRecipeName
      if (p.adapted || p.time) {
        if (p.adapted) {                 
          c = 'adapted'
        } else {
          c = 'time'
        }
        Log(c + " - accumRecipeName reset");
        accumRecipeName = "";
        continue
      }

      // Skip certain <p> elements (e.g. Note:, Advertisement)
      if (p.colon || p.ad) {
        Log("Skipped - colon or ad");
        continue
      }

      // Finally ...
      if (((p.punct)  && accumRecipeName != "") || p.isYield) {
        // If this <p> element contains terminal puncuation and
        //  accumRecipeName is not empty
        // Or if this <p> element contains "Yield:",
        Log("Terminal punct and accumRecipeName or Yield:");

        if (p.isYield && accumRecipeName == '') {
          // If 'Yield:' encountered and accumRecipeName is empty, 
          //  set the recipe name from the subsequent <p> element
          let subsequentParaText = $(paras[i+1]).text()
          Log("Yield: & empty accumRecipeName, previous paragraph: " + subsequentParaText)
          recipeName = subsequentParaText

        } else {
          // When this <p> element contains terminal puncuation and
          //  accumRecipeName is not empty, then set the recipe name to accumRecipeName 
          recipeName = accumRecipeName;
        }

        // Clear accumRecipeName and exit the loop
        accumRecipeName = "";
        break

      } else if (p.punct) {
        // If the <p> element contains terminal puncuation and
        //  accumRecipeName is empty, continue with the next <p> element
        Log("para contains terminal punctuation, skipped");
        continue

      } else if (numFound) {
        // If this <p> element does not contain terminal punctuation and
        //  does not contain "Yield:" and
        //  a <p> element starting with a numeral has previously be encountered,
        // then prepend this <p> element to accumRecipeName and
        //  continue with the next <p> element
        Log("numFound so para concatenated");
        accumRecipeName = paraText + " " + accumRecipeName;
      }

    }

    Log("Finished walking back through paragraphs")
    Log("Ingredients? " + ingredientFound);
    //Log("Title paragraph number: " + i.toString())
    Log("isRecipe: " + articleObj.isRecipe)
    Log("accumRecipeName: " + accumRecipeName)
    if (accumRecipeName !== "" && !articleObj.isRecipe) {
      Log("Recipe name set to accumRecipeName")
      recipeName = accumRecipeName;
    }
    Log("Initial recipe name: " + recipeName)
    // console.log("Recipe name split: " + recipeName.split(/\(*.*adapted/i))

    // 12/08/2002 (adapted...) as part of the recipe title; 1/7/2001 (wildly adapted...)
    let trimmedRecipeName = recipeName.split(/\(.*adapted/i)[0].trim();
    Log("trimmedRecipeName: " + trimmedRecipeName);

    // Set the recipe name to the article title if,
    //  if the recipe name was not found and the article is a recipe,
    //  or there is only one recipe demarcation and an ingredient was found,
    //  or the recipe name is "recipe"
    if ((trimmedRecipeName == "Recipe Name not found" && (articleObj.isRecipe || (arr.length == 1 && ingredientFound))) || trimmedRecipeName.toLowerCase() == "recipe") {
      Log("Recipe name set to title")
      recipeNameIsArticleTitle = true;
      trimmedRecipeName = articleObj.title;
    }

    // Prior to 2001, article-embedded recipe names were sometimes followed
    //  by the time to execute the recipe.  If the recipe name includes 'ime:',
    //  strip the phrase beginning with 'time:' (case-insensitive) from 
    //  the recipe name.
    if (trimmedRecipeName.includes('ime:')) {
      Log("Stripped time: phrase from name")
      let timeIndex = trimmedRecipeName.toLowerCase().indexOf("time:")
      trimmedRecipeName = trimmedRecipeName.substring(0,timeIndex)
    
    }

    // The same for 'adapted' (case-insensitive)
    let adaptedIndex = trimmedRecipeName.toLowerCase().indexOf("adapted")
    if (adaptedIndex > 0) {
      Log("Stripped 'adapted' phrase from name")
      trimmedRecipeName = trimmedRecipeName.substring(0,adaptedIndex)
    
    }        

    Log("Recorded recipe name: " + trimmedRecipeName);
    recipeNameArray.push(trimmedRecipeName)
  }
  
  // Set the article tyoe
  if (recipeNameIsArticleTitle) {
    type = "Recipe";
  } else if (articleObj.isPairing) {
    type = "Pairing";
  } else if (articleObj.isBeverage) {
    type = articleObj.beverageType;
  } else if (articleObj.cookingWithTheTimes) {
    type = 'Cooking With The Times';
  } else {
    type = "Article";
  }

  Log("Page type: " + type)
  Log("Some result: " + recipeNameArray.some( (name) => {return name != "Recipe Name not found"}),)

  // Return an articleResults object
  return {
      hasRecipes: recipeNameArray.some( (name) => {return name != "Recipe Name not found"} ),
      recipes: recipeNameArray,
      type: type
  }
}

  
function para(text) {
  // Return an object describing the input paragraph text:
  //  words: the number of words in the paragraph
  //  isNum: true if the first character of the paragraph is a numeral
  //  isInstr: true if the paragraph starts with numerals followed by a period
  //  isYield: true if the first word is Yield:
  //  colon: true if the first word ends with ':' but is not Yield: or
  //           the paragraph text ends with ':'
  //  allCAPS: true if all letters are capital letters
  //  ad: true if first word is "Advertisement" 
  //  adapted: true if first word includes (case-insensitive) "Adapted"
  //  punct: true if the paragraph ends with a period, question mark,
  //          exclamation point, apostrophe, quote or right parenthesis.
  //  time: true if the paragraph includes "total time:" (case-insensitive)

  let words = text.split(/\s+/g); // Split text by whitespace characters
  
  return {
      words: words.length,
      isNum: Number.isInteger(parseInt(text.substr(0,1))),
      isInstr: text.search(/^\d+\./) > -1,
      isYield: words[0] === "Yield:",
      colon: (words[0].endsWith(":") && !words[0].startsWith("Yield")) || text.endsWith(":"),
      allCAPS: text === text.toUpperCase(),
      ad: words[0] === "Advertisement",
      adapted: words[0].search(/Adapted/i) > -1,
      punct: text.match(/[\.\?!\"\')]$/) != null,
      time: text.toLowerCase().includes('total time:')

  }
  
}

function adjustTitle(title) {
  // Adjust the title, if necessary
  Log("adjustTitle entered with: " + "'" + title + "'");
  // Initialize article type attributes
  let isPairing = false;
  let isRecipe = false;
  let Beverage = [false, null];

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
    return [isBeverage, beverageType];
  }

  // See if title contains a ';' or a ':'
  titleMatch = title.match(/[;:]/);
  Log("titleMatch: " + titleMatch);
  if (titleMatch !== null) {
    // If so, split the title at the first ';' or ':'        
    titleSplit = title.split(titleMatch[0]);
    Log("titleSplit: " + titleSplit);
    // If the title was split at a ';', set the article's title to the portion following the ';' 
    if (titleMatch[0] == ';') {
      title = titleSplit.slice(-1)[0].trim();
    // Else if the title was split at a ':' and the portion preceeding the ':' was 'recipe(s)' or 'pairing(s),
    //  set the article's title to the portion following the ':' 
    } else if (titleMatch[0] == ':' && titleSplit[0].toLowerCase().match(/recipe+s*|pairing+s*/) !== null) {
      title = titleSplit.slice(-1)[0].trim();
    }
    
    Log("Adjusted title: " + "'" + title + "'");
    // Set article type according to the portion preceeding the split
    let portionPreceeding = titleSplit[0].toLowerCase();
    // See if the article is beverage-related; Beverage = [boolean, display label]
    Beverage = checkForBeverage(portionPreceeding);
    Log("Beverage array: " + Beverage)
    if (portionPreceeding.match(/pairing+s*/) !== null) {
      isPairing = true;
    }
    if (portionPreceeding.match(/recipe+s*/) !== null) {
      isRecipe = true;
    }
  }
  // Return an articleObj
  return {
    title: title,
    isBeverage: Beverage[0],
    isPairing: isPairing,
    isRecipe: isRecipe,
    beverageType: Beverage[1]
  }

}

async function findRecipes($, articleObj, mainWindow) {

  let articlesDisplayed = 0;

  // Set articleObj boolean key 'cookingWithTheTimes' as to whether
  //  the <header> element contains 'Cooking With The Times' 
  articleObj['cookingWithTheTimes'] = $('p.e6idgb70', 'header').map(function (i, el) {
    if ($(this).text() === 'Cooking With The Times') {
      return true;
    } else {
    return null
    }
  }).toArray().includes(true);
  Log("cookingWithTheTimes: " + articleObj.cookingWithTheTimes)

  // Get the <section> named 'articleBody'
  articleBody = $('section').attr('name', 'articleBody')

  // Create an array of <p> elements within the articleBody section
  let paras = $('p',articleBody);
  Log("Number of paragraphs: " + paras.length.toString());

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
  
  // Get the number of 'Yield:' paragraphs and of '1. ' paragraphs
  let yieldRecipes = yieldPara.length; // 'Yield:' paragraphs
  let instrRecipes = instrPara.length; // '1. ' paragraphs
  if (yieldRecipes == instrRecipes) {
    // If those numbers are the same...
    Log("Recipes: " + yieldRecipes.toString());
  } else {
    // If they're different...
    Log("Recipe mismatch: Yield: " + yieldRecipes.toString() + ", 1.: " + instrRecipes.toString())
  }

  // Sometimes, recipes don't end with "Yield:" (1/29/2006 It Takes a Village)
  // Sometimes, recipe instruction steps aren't numbered (?)
  // In order to identify recipes, use the more numerous marker.
  //  If both markers are equal, use the first instruction step marker
  if (instrRecipes > 0 || yieldRecipes > 0) {
    // If any 'Yield:' or '1. ' paragraphs were found, parse the article
    //  for recipes.
    if (instrRecipes >= yieldRecipes) {
      // If '1. ' paragraphs are as or more numerous that 'Yield:' paragraphs,
      // parse the article using '1. ' as the marker for a recipe
      articleResults = recipeParse("instr", $, paras, instrPara, articleObj)
    } else {
      // Otherwise, parse the article using 'Yield:' as the marker for a recipe
      articleResults = recipeParse("yield", $, paras, yieldPara, articleObj)
    }
  } else {
    // If no 'Yield:' or '1. ' paragraphs, the article has no recipes
    articleResults = {hasRecipes: false}
  }

  if (articleResults.hasRecipes) {
    // If the article has recipes, display the article and its embedded recipes
    Log("recipes length: " + articleResults.recipes.length.toString());
    for (let r = 0; r < articleResults.recipes.length; r++) {
      Log(articleResults.recipes[r])
    }
    Log("Display article: " + articleObj.title)
    articlesDisplayed++;
    mainWindow.webContents.send('article-display', [JSON.stringify(articleObj), articleResults.recipes, articleResults.type])

  } else if (articleObj.cookingWithTheTimes) {
    // If the article is a 'Cooking With The Times' article, display it.
    Log("Displaying TASTINGS article")
    articlesDisplayed++;
    mainWindow.webContents.send('article-display', [JSON.stringify(articleObj), [], 'Cooking With The Times'])

  } else if (articleObj.isBeverage) {
    // If the article is a beverage article (which typicallly don't have
    //  embedded recipes), display it.
    Log("Displaying TASTINGS article")
    articlesDisplayed++;
    mainWindow.webContents.send('article-display', [JSON.stringify(articleObj), [], articleObj.beverageType])

  }



  // Return number of articles displayed - used for evaluating code changes
  return articlesDisplayed;
}

module.exports = { adjustTitle, findRecipes };