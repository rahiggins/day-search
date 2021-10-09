const debug = true;

function Log (text) {
  // If debugging, write text to console.log
  if (debug) {
      console.log(text)
  }
}

function recipeParse(demarcation, $, paras, arr, articleObj) {
  // Parse article page text for recipe names
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
  Log(" Title: " + articleObj.title);
  Log(" isRecipe: " + articleObj.isRecipe);
  Log(" isPairing: " + articleObj.isPairing);
  Log(" numRecipes: " + arr.length);
  Log(" isBeverage: " + articleObj.isBeverage);
  Log(" beverageType: " + articleObj.beverageType)
    
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

      // Skip 'Adapted' and 'time:' paragraphs and reset concatention of paragraphs
      if (p.adapted || p.time) {
        if (p.adapted) {                 
          c = 'adapted'
        } else {
          c = 'time'
        }
        Log(c + " - tempNaN reset");
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
    Log("isRecipe: " + articleObj.isRecipe)
    Log("tempNaN: " + tempNaN)
    if (tempNaN !== "" && !articleObj.isRecipe) {
      Log("Recipe name set to tempNaN")
      recipeName = tempNaN;
    }
    Log("Initial recipe name: " + recipeName)
    // console.log("Recipe name split: " + recipeName.split(/\(*.*adapted/i))

    // 12/08/2002 (adapted...) as part of the recipe title; 1/7/2001 (wildly adapted...)
    let trimmedRecipeName = recipeName.split(/\(.*adapted/i)[0].trim();
    Log("trimmedRecipeName: " + trimmedRecipeName);
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
    
  if (recipeNameIsArticleTitle) {
    type = "Recipe";
  } else if (articleObj.isPairing) {
    type = "Pairing";
  } else if (articleObj.isBeverage) {
    type = articleObj.beverageType;
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
  //  time: true if the paragraph includes "total time:" (case-insensitive)

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
      punct: trimmedText.match(/[\.\?!\"\')]$/) != null,
      time: trimmedText.toLowerCase().includes('total time:')

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

  // Sometimes, recipes don't end with "Yield:"
  // Sometimes, recipe instruction steps aren't numbered
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
  }

  if (articleObj.isBeverage) {
    // If the article is a beverage article (which typicallly don't have
    //  embedded recipes), display it.
    Log("Displaying TASTINGS article")
    articlesDisplayed++;
    mainWindow.webContents.send('article-display', [JSON.stringify(articleObj), [], articleObj.beverageType])
  }

  return articlesDisplayed;
}

module.exports = { adjustTitle, findRecipes };