// This file contains functions that parse NYT article HTML to identify embedded
//  recipes.  

// The functions in the file are:
//  - Log
//  - getAuthor
//  - recipeParse
//    - adjustParaText
//  - para
//  - adjustTitle
//    - checkForBeverage
//  - findRecipe

// These functions are called from the index.js process, which requires
//  getAuthor, adjustTitle and findRecipe

// index.js calls getAuthor, adjustTitle and findRecipe

// findrecipe calls recipeParse, which calls adjustParaText and para

// adjustParaText calls para

// All functions call Log


const debug = true; // Used by function Log

// Define a regular expression that matches 
//  'Yield:', 'blah blah Serves', 'Makes 2' and 'Makes about 2'
//  A match indicates the end of a recipe 
const endOfRecipeRX = new RegExp('Yield:|.+Serves|Makes\\s\\w*\\s*\\d')

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

function getAuthor ($) {
  // Get authir name from aritcle
  // Input: Cheerio query function based on article HTML
  // Output: Author name, string
  return $('#story > header > div.css-xt80pu.eakwutd0 > div > div > div > p > span').text().replace('By ', '');
}

function recipeParse(demarcation, $, paras, arr, articleObj) {
  // Parse article page text for recipe names
  // Called by: findRecipe
  // Input:
  //  - Name of demarcation in the passed array, "instr" or "end"
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
  //            hasRecipes: boolean,
  //            recipes: array of recipe names,
  //            type: 'Article' | 'Pairing' | 'beverage type' | 'Recipe',
  //            hasFragmentedTitle: boolean,
  //            hasUnquantifiedIngredient: boolean
  //         } 
  //
  // Each element of the 'demarcations' array corresponds to a recipe.
  // When the demarcation name is "instr", the array elements are the first
  //  recipe instruction paragraph (i.e. '1. text').
  // When the demarcation name is "end", the array elements are the last
  //  paragraph of a recipe, which matches the endOfRecipeRx regexp
  // 
  // This function iterates through the <p> elements preceeding each 
  //  demarcation array element until a recipe name is found.
  //
  //  The recipe name is:
  //   - Consecutive <p> elements between:
  //    -- a <p> element that starts with a numeral and
  //    -- a <p> element that:
  //      --- matches the endOfRecipeRx regexp or that 
  //      --- ends with terminal punctuation - 
  //          a period, question mark or exclamation point or that
  //      --- consists of RECIPES
  //
  //  Because recipe names can be split between consecutive <p> elements
  //   and because definitive identification of a recipe name depends on
  //   encountering a subsequent terminating <p> element, the array
  let accumRecipeName = [];
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
  Log(" Author: " + articleObj.author);
    
  let recipeNameArray = [];
  let recipeNameIsArticleTitle = false;
  let hasUnquantifiedIngredient = false;
  let hasFragmentedTitle = false;
  let ingredientFound;
  let numFound;

  function adjustParaText(paraText) {
    // Adjust <p> element text before determining whether it's a recipe name
    // Adjustments:
    //  - Remove author name at the end a paragraph
    //  - If the paragraph ends with terminal punctuation [.?!] followed by ['")],
    //     move the terminal punctuation to the end of the paragraph 
    //  - If ingredients have not yet been identified,
    //     Check for ingredients list contained in a single <p> element.
    //       If found, not that ingredients were found and discard the parapraph
    //       For a single ingredient paragraph with terminal punctuation,
    //         strip the terminal punctuation
    //  - If the paragraph ends with terminal punctuation, return the paragraph,
    //    else ...
    //  - Remove 'For the _:' phrases
    //  - Remove '(... adapted ...)' phrases
    Log("adjustParaText called with -")
    Log(paraText)

    // Array of ingredient units of measurement
    const unitsOfMeasurement = [
      "pinch", "teaspoon", "tablespoon", "cup", "pint", "quart", "gallon",
      "small", "medium", "large",
      "pound", "ounce", "gram",
      "inch", 
      "clove", "bunch", "sprig", "sheet", "handful", "pinch"
    ]

    // Trim leading and trailing whitespace from the paragraph text.
    // The text should be trimmed after any adjustment that might expose
    //  leading or trailing whitespace.
    paraText = paraText.trim();

    // Define local para() output - paragraph text characteristics
    let pCharacteristics;
    
    // Occasionally, the paragraph preceding the recipe name ends with
    //  the author name, preventing that paragraph's terminal puncuation 
    //  from being detected.
    // Remove the author name, if it exists.

    // Create a RegExp to match (case-insensitive) the author name at the end
    //  of the paragraph text (possibly preceded by spaces and dashes) and 
    //  capture the text preceding the name (and possibly spaces and dashes).
    let rx = new RegExp('(.*?)(\\s*-*\\s*)?' + articleObj.author + '$', 'i');

    // Look for a match
    let m = paraText.match(rx);

    // If there is a match, ...
    if (m != null) {

        // ... set the paragraph text to the capture group, trimmed
        paraText = m[1].trim()
        Log('Author name removed from <p> element');

        // Characterize the text
        pCharacteristics = para(paraText);

        // If the adjusted paragraph text ends with terminal punctuation, 
        //  return to the caller
        if (pCharacteristics.punct) {
          return paraText;
        }

    }

    // Occasionally, paragraph text ends with apostrophes, double apostrophes,
    //  quotes or right parentheses that follow terminal punctuation [.?!],
    //  obscuring the terminal punctuation.
    // If that is the case, move the terminal punctuation to the end of the
    //  the paragraph text so that the terminal puncuation can be recognized.
    let punctChars = paraText.match(/([\.\?\!]{1})([\'\"\)]{1,3})$/); // 3 consecutive apostorphes: 11/05/2000 'The Latest Temptations of Uma'

    if (punctChars != null) {
      let punctCharsLength = punctChars[0].length
      paraText = paraText.slice(0,-punctCharsLength) + punctChars[2] + punctChars[1]      
    }

    // Occaisionally, the ingredients list is contained in one <p> element, instead
    //  of each ingredient contained in its own <p> element.  Check for this 
    //  situation and discard the ingredients list, setting the booleans
    //  ingredientFound and numFound to true, and resetting the recipe name
    //  accumulator.

    // Occasionally, the recipe name followed by the ingredients list are in the 
    //  same <p> element (e.g. 12/17/2000 - Plaen and Fancy).  In this case,
    //  discard the ingredients list, but retain the recipe name.

    if (!ingredientFound) {
      // If ingredients haven't been found yet,
      //  check for ingredients list in the same <p> element

      // Characterize the paragraph text
      pCharacteristics = para(paraText);

      if (!pCharacteristics.isInstr && !pCharacteristics.isEndOfRecipe) {
        // For paragraph text that:
        //  - is not an instruction and
        //  - does not match the endOfRecipeRx regexp
        Log("Checking for ingredients");

        // Create a regular expression to match:
        //  a quantity
        //   followed by 0 or more whitespace characters or a dash
        //   followed by alphabetic characters (a unit of measure)
        //   followed by 1 whitespace character

        // This expression matches an ingredient measure (e.g. '1 3/4 sheets ',
        //  '1 1 1/2-pound', '1 28-ounce ', '1/2 tablespoon ', '11/3 cup ',
        //  '2 cups ', '18-pound ', etc
        //let ingredientRxBase = /(\d\s\d\/\d|\d\s\d+-|\d+\/\d|\d+|\d+-)\s*\w+\s/;
        let ingredientRxBase = /(\d\s\d\/\d|(\d+\s){0,2}\d\/\d+-|\d\s\d+-|\d+\/\d|\d+|\d+-)\s*\w+\s/;

        // Create global match version of that expression
        let ingredientRxG = new RegExp(ingredientRxBase, 'g')

        // Perform a global match for ingredients in the paragraph text
        let ingredients = paraText.match(ingredientRxG)
        Log("Ingredients match result: " + ingredients)

        if (ingredients != null) {
          // If there are ingredients //and more than 1 ingredient,
          Log("Para contains ingredients")

          // Do not adjust paragraphs that contain a single ingredient
          //  except to remove teminal punctuation, if present.
          if (pCharacteristics.isNum && !pCharacteristics.isInstr && ingredients.length == 1) {
            // If the paragraph starts with a number, is not an instruction
            //  and contains 1 ingredient ...
            console.log("Para isNum and contains 1 ingredient")
            if (pCharacteristics.punct) {
              // If the paragraph ends with terminal punctuation (12/07/2005 Everything Goes Better With a Little Lobster)
              console.log("Removed terminal punct")
              paraText = paraText.slice(0,-1)
            }
            console.log("Return paraText")
            return paraText
          }

          // Count ingredient matches that include an ingredient unit of measure
          //  such as cup, tablespoon, large, bunch or inch etc
          let measureCount = 0;
          for (let i = 0; i < ingredients.length; i++) {
            for (let m = 0; m < unitsOfMeasurement.length; m++) {
              if ( ingredients[i].includes(unitsOfMeasurement[m]) ) {
                // If the ingredient match includes a unit of measure,
                Log("Ingredient match: " + ingredients[i] + " includes UOM: " + unitsOfMeasurement[m])

                // Check for unit or unit plural followed by whitespace
                let uomRx = new RegExp(unitsOfMeasurement[m] + 's?\\s$')
                if (ingredients[i].match(uomRx) != null) {
                  // If so, count the measure
                  measureCount++
                  break
                } else {
                  Log("Not an ingredient: %" + ingredients[i] + "%")
                }
              }
            }
          }
          Log("Number of ingredient matches: " + ingredients.length.toString())
          Log("Number of matches including a measure: " + measureCount.toString())
          Log("Half or so: " + Math.max(Math.floor(ingredients.length / 2), 2))

          // Verify that the matched text is an ingredients list
          if (measureCount >= Math.max(Math.floor(ingredients.length / 2), 2)) {
            // If half or so ingredient matches, but at least 2,
            //  include an ingredient measure, 
            //  the matched text is an ingredients list,
            //  which will be noted and discarded.
              
            // Match the first ingredient
            let firstIngredient = paraText.match(ingredientRxBase);
            Log("firstIngredient: " + firstIngredient);

            // Get the index of the first ingredient
            let firstIngredientIndex = firstIngredient.index;
            Log("para with ingredients, first ingredient index: " + firstIngredientIndex.toString());

            // Slice the paragraph text at the first ingredient index and trim
            paraText = paraText.slice(0,firstIngredientIndex).trim();
            Log("Sliced paraText: " + paraText);


            // Indicate that ingredients were found and 
            //  that numbered paragraphs were found and
            //  empty the recipe name accumulator
            ingredientFound = true;
            numFound = true;
            if (accumRecipeName.length != 0) {
              console.log("accumRecipeName is not empty: " + accumRecipeName)
            }
            accumRecipeName = [];
            Log("Ingredients found, accumRecipeName reset");

            // Check the paragraph text for the case-insensitive phrases 
            //  'total time:', 'time:', 'adapted', or 'from'
            // If the paragraph text does not contain these prhases,
            //  then the paragraph contained only the ingredients list and
            //  can be discarded by setting its text to an empty string.
            // If the paragraph text does contain one of those phrases,
            //  then the paragraph might also contain the recipe name.
            //  In that case, discard the that starts with that phrase and
            //  return only the text that preceeds that phrase.
            let attribution = paraText.match(/(total )*(time:)|(adapted)|(from)/i)
            if (attribution == null) {
              console.log("(ingredients not found) Paragraph discarded")
              paraText = ''
            } else {
              paraText = paraText.substring(0, attribution.index)
              console.log("(ingredients not found) Paragraph text trimmed at '" + attribution[0])
            }

          }

        }           

      }

    }
    
    // If the paragraph ends with terminal puntuation, return the paragraph
    //  text
    pCharacteristics = para(paraText);
    if (pCharacteristics.punct) {
      console.log("Teminal punct - return paraText")
      return paraText
    }

    // Occaisionally, the ingredients list is partitioned by phrases like
    //  'For the _:' (e.g For the dough:).  Discard such text.
    let forThe = paraText.match(/(for the.*:\s?)/i);
    if (forThe != null) {
      Log("'For the x:' discarded")
      //paraText = paraText.slice(forThe[1].length).trim();
      paraText = ''
    }

    // Occaisionally, the recipe name is followed by '(adapted ...)'
    //  e.g. 12/08/2002 (adapted...) as part of the recipe title; 
    //    1/7/2001 (wildly adapted...)
    // Truncate paragraph text at such parenthetical phrases.

    // Article-embedded recipe names are sometimes followed by the time
    //  to execute the recipe and/or an 'adapted from' attribution.  
    // If the text includes the phrase 'time:' or 'total time:' or
    //  'adapteted' (case-insensitive) truncate the
    //  text at the matched phrase.

    // Try to match the phrases descibed above in the paragraph text
    let ta = paraText.match(/(total )*(time:)|(\(.*adapted.*\))|(adapted)/i)

    if (ta != null) {
      // If one of the phrases is matched, truncate the paragraph text at 
      //  the matched phrase.
      paraText = paraText.substring(0,ta.index).trim();
      console.log("paraText truncated at " + ta[0])
    }

    return paraText;

  }
  
  // For each recipe marker, indicated by an element of arr[],
  //  find the recipe name
  for (j = 0; j < arr.length; j++) {
    Log("Recipe marker " + j.toString())

    recipeName = "Recipe Name not found";

    // Empty the recipe name accumulator.  
    accumRecipeName = [];

    // (01/31/2001: Ahi Katsu with Wasabi Ginger Sauce - 
    //   recipe name as title, not marked Recipe. Distinguish from FOOTNOTES
    //   by ingredientFound
    ingredientFound = false;

    numFound = false; // Don't concat paras until a numeral-started paragraph is found

    // Walk back through <p> elements preceeding the recipe marker, 
    //  "endOfRecipeRx" or "1. ", examining each to identify the recipe name
    for (let i = arr[j]-1; i > -1; i--) {

      // Starting in early 2022, a section with attribute role=complementary that
      //  contains <p> elements may be inserted at arbitary locations
      //  in the article.  These <p> elements have no relevance to the article
      //  and must be skipped.
      if ($(paras[i]).parents("section[role=complementary]").length > 0) {
        continue
      }
      
      // Get text of each <p> element
      let paraText = $(paras[i]).text();
      paraText = adjustParaText($(paras[i]).text());
      Log("ingredientFound: " + ingredientFound + " numFound: " + numFound)
      if (paraText == '') {
        Log("Empty paragraph text skipped - accumRecipeName reset")

        // Added for 3/21/1999 'Bait and Switch' - (Adapted ... ) is split across
        //  multiple <p> elements; the <p> elements following the first one
        //  (that contains '(Adapted') were accumulated and appended to the 
        //  recipe name.  The first <p> element is rendered null by adjustParaText().
        //  Clear accumRecipeName upon a null <p> element to prevent appending
        //  these (Adapted .. ) fragments to the recipe name.
        Log("accumRecipeName reset due to empty paragraph text")
        accumRecipeName = []
        continue
      }



      // Trimmed the paragraph text and call function para to characterize it -
      //  para returns an object containing various attributes
      let p = para(paraText);
      Log("Paragraph " + i.toString() + " text: " + paraText.substr(0,40));
      Log(" words: " + p.words + ", isNum: " + p.isNum + ", isInstr: " + p.isInstr);
      Log(" isEndOfRecipe: " + p.isEndOfRecipe + ", colon: " + p.colon + ", allCAPS: " + p.allCAPS);
      Log(" ad: " + p.ad + ", adapted: " + p.adapted + ", punct: " + p.punct);
      Log(" time: " + p.time)

      // All uppercase is a recipe name
      if (p.allCAPS) {
        Log("allCAPS");
        Log(paraText)
        // If the <p> element consists of RECIPES…
        if (paraText == "RECIPES") {
          
          // …the recipe name is the previously accumulated recipe name
          recipeName = accumRecipeName.join(' ')
          hasFragmentedTitle = hasFragmentedTitle || accumRecipeName.length > 1;
          console.log("allCAPS hasFragmentedTitle: " + hasFragmentedTitle)
          // Reset the accumulation and exit the find-recipe-name loop
          accumRecipeName = []
          break
        } else {
          
         // otherwise accumulate the <p> element's text and continue with the 
          //  next <p> element
          console.log("Prepending " + paraText + " to accumRecipeName")
          accumRecipeName = [paraText].concat(accumRecipeName);
          continue
        }
      }

      // For paragraphs that start with a numeral,
      //  If the recipe demarcation is 'end' or 
      //  if the paragraph is not a recipe instruction and
      //  if the paragraph does not end with terminal punctuation, then
      //  note that such a paragraph was found (numFound = true),
      //  empty accumRecipeName, 
      //  and if the paragraph is not an instruction, note that an ingredient was 
      //  found (ingredientFound = true),
      //  then continue with the next <p> element
      //if (p.isNum && (demarcation == 'end' || !p.isInstr)) {
      if (p.isNum && (demarcation == 'end' || !p.isInstr) && !p.punct) {
        console.log("isNum and (end demarcation or not instruction) and not terminal punctuation")
        numFound = true;
        if (accumRecipeName.length != 0) {
          console.log("accumRecipeName is not empty: " + accumRecipeName)
          hasUnquantifiedIngredient = true;
          console.log("hasUnquantifiedIngredient = true")
        }
        accumRecipeName = [];
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
        if (accumRecipeName.length != 0) {
          console.log("accumRecipeName is not empty: " + accumRecipeName)
        }
        Log(c + " - accumRecipeName reset");
        accumRecipeName = [];
        continue
      }

      // Skip Advertisement <p> elements
      if (p.ad) {
        Log("Skipped - ad");
        continue
      }

      // Skip certain <p> elements containing colons (e.g. Note:, etc), but
      //  if the colon appears in 'recipe:' at the beginning of the <p> element,
      //  jsut remove 'recipe:'
      if (p.colon) {
        let recipeMatch = paraText.match(/^recipe:\s*(.*)$/i)
        if (recipeMatch != null) {
          paraText = recipeMatch[1];
          console.log('recipeParse: "recipe:" removed ')
        } else {
        Log("Skipped - colon");
        continue
        }
      }

      // Finally ...
      if (((p.punct)  && accumRecipeName.length != 0) || p.isEndOfRecipe) {
        // If this <p> element contains terminal puncuation and
        //  accumRecipeName is not empty
        // Or if this <p> element matches the endOfRecipeRx regular expression,
        Log("Terminal punct and accumRecipeName or endOfRecipe");

        if (p.isEndOfRecipe && accumRecipeName.length == 0) {
          // If 'endOfRecipe' encountered and accumRecipeName is empty, 
          //  set the recipe name from the subsequent <p> element
          let subsequentParaText = adjustParaText($(paras[i+1]).text())
          Log("endOfRecipe & empty accumRecipeName, previous paragraph: " + subsequentParaText)
          recipeName = subsequentParaText

        } else {
          // When this <p> element contains terminal puncuation and
          //  accumRecipeName is not empty, then set the recipe name to accumRecipeName
          console.log("terminal punct & accumRecipeName not empty")
          console.log("hasFragmentedTitle: " + hasFragmentedTitle)
          console.log("accumRecipeName length: " + accumRecipeName.length.toString())
          recipeName = accumRecipeName.join(' ');
          hasFragmentedTitle = hasFragmentedTitle || accumRecipeName.length > 1;
          Log("Recipe name set to accumRecipeName, hasFragmentedTitle: " + hasFragmentedTitle)
        }

        // Clear accumRecipeName and exit the loop
        accumRecipeName = [];
        break

      } else if (p.punct) {
        // If the <p> element contains terminal puncuation and
        //  accumRecipeName is empty, continue with the next <p> element
        Log("para contains terminal punctuation, skipped");
        continue

      } else if (numFound) {
        // If this <p> element does not contain terminal punctuation and
        //  does not contain "endOfRecipe" and
        //  a <p> element starting with a numeral has previously be encountered,
        // then prepend this <p> element to accumRecipeName and
        //  continue with the next <p> element
        Log("numFound so para concatenated");
        console.log("Prepending " + paraText + " to accumRecipeName")
        accumRecipeName = [paraText].concat(accumRecipeName);
        Log("accumRecipeName length: " + accumRecipeName.length.toString())
      }

    }

    Log("Finished walking back through paragraphs")
    Log("Ingredients? " + ingredientFound);
    //Log("Title paragraph number: " + i.toString())
    Log("isRecipe: " + articleObj.isRecipe)
    Log("accumRecipeName: " + accumRecipeName)
    if (accumRecipeName.length != 0 && !articleObj.isRecipe) {
      Log("Recipe name set to accumRecipeName")
      recipeName = accumRecipeName.join(' ');
      hasFragmentedTitle = hasFragmentedTitle || accumRecipeName.length > 1;
      console.log("hasFragmentedTitle: " + hasFragmentedTitle)
    }
    Log("Initial recipe name: " + recipeName)
    // console.log("Recipe name split: " + recipeName.split(/\(*.*adapted/i))

    // Set the recipe name to the article title if,
    //  if the recipe name was not found and the article is a recipe,
    //  or there is only one recipe demarcation and an ingredient was found,
    //  or the recipe name is "recipe"
    if ((recipeName == "Recipe Name not found" && (articleObj.isRecipe || (arr.length == 1 && ingredientFound))) || recipeName.toLowerCase() == "recipe") {
      Log("Recipe name set to title")
      recipeNameIsArticleTitle = true;
      recipeName = articleObj.title;
    }

    Log("Recorded recipe name: '" + recipeName + "'");
    recipeNameArray.push(recipeName.trim())
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
      type: type,
      hasFragmentedTitle: hasFragmentedTitle,
      hasUnquantifiedIngredient: hasUnquantifiedIngredient
  }
}

  
function para(text) {
  // Return an object describing the input paragraph text:
  //  words: the number of words in the paragraph
  //  isNum: true if the first character of the paragraph is a numeral
  //  isInstr: true if the paragraph starts with numerals followed by a period
  //  isEndOfRecipe: true if the paragraph matches the endOfRecipeRx regular expresion
  //  colon: true if the first word ends with ':' but is not Yield: or
  //           the paragraph text ends with ':'
  //  allCAPS: true if all letters are capital letters
  //  ad: true if first word is "Advertisement" 
  //  adapted: true if first word includes (case-insensitive) "Adapted"
  //  punct: true if the paragraph ends with a period, comma, question mark,
  //          exclamation point, apostrophe, quote or right parenthesis.
  //  time: true if the paragraph includes "total time:" (case-insensitive)

  let words = text.split(/\s+/g); // Split text by whitespace characters–
  
  // >>---> words[0] == "Serves" or "Makes" should be skipped like "Advertisement",
  //  call it 'skip' ?
  return {
      words: words.length,
      isNum: Number.isInteger(parseInt(text.substr(0,1))),
      isInstr: text.search(/^\d+\./) > -1,
      isEndOfRecipe: text.match(endOfRecipeRX) != null,
      colon: (words[0].endsWith(":") && !words[0].startsWith("Yield")) || text.endsWith(":"),
      allCAPS: (text === text.toUpperCase() && text != ''),
      ad: words[0] === "Advertisement", 
      adapted: words[0].search(/Adapted/i) > -1,
      //punct: text.match(/[\.\,\?!\"\')]$/) != null,
      punct: text.match(/[\.\?!]$/) != null,
      time: text.toLowerCase().includes('total time:')
  }
  
}

function adjustTitle(title) {
  // Adjust the title, if necessary
  console.log(__filename + " version of findRecipes entered")
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
    // If the title was split at a ';', set the article's title 
    //  to the portion following the ';' unless the 'THE CHEF' precedes the ';'
    if (titleMatch[0] == ';' & titleSplit[0] != 'THE CHEF') {
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

async function findRecipes($, articleObj, mainWindow, expectedRecipes) {
  // Find recipes in an article page and displays the article and recipes
  //  Input:  - Cheerio query function based on page HTML
  //          - an article object
  //          - Optional. A reference to the mainWindow; if omitted,
  //            the article is not displayed
  //          - Optional. For Validate, an array of expected recipe names
  // Output: Array:
  //                - 1 if the article was displayed, 0 otherwise,
  //                - array of recipe names

  // If expectedRecipes is not null, the Validate button was clicked.
  //  Returned recipe names will be checked against expected recipe names
  if (expectedRecipes != null) {
    validating = true
  } else {
    validating = false
  }
  console.log("findRecipes entered, validating: " + validating)
  
  // articlesDisplayed is 0 if the article is not displayed, 1 otherwise
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

  // Create an array (endPara) of <p> elements whose text matches 
  //  the endOfRecipeRx regular expression
  //  These paragraphs mark the end of a recipe.
  // Also create an array (instrPara) of <p> elements whose text starts with "1. "
  //  The paragraphs mark the first instruction step of a recipe.
  // Also create an array (correctPara) of <p> elements whose text starts with
  //  'Correction:'.  Ignore any recipe markers that follow the first 
  //  'Correction:' paragraph.
  let endPara = [];
  let instrPara = [];
  let correctPara = [];
  $(paras).each( function(k, elem) {
    //Log("Para " + k.toString() + " starts with: " + $(this).text().substr(0, 10))
      if ($(this).text().trim().match(endOfRecipeRX) != null) {
          //Log("Pushed endOfRecipe para")
          endPara.push(k)
      }
      if ($(this).text().trim().startsWith("1. ")) {
          //Log("Pushed 1. para")
          instrPara.push(k)
      }
      if ($(this).text().trim().match(/correction:/i) != null) {
          //Log("Pushed Correction para")
          correctPara.push(k)
      }
  })

  // If the article includes corrections, which are appended to the end
  //  of the article, the corrections may include a full recipe.  For the
  //  purpose of identifying recipe names, ignore these recipe corrections.
  // Update the endPara and instrPara arrays to eliminate markers that
  //  follow the first Correction: paragraph.
  if (correctPara.length > 0) {
    console.log("Correction para exists")
    let firstCorrection = correctPara[0]
    if (endPara[endPara.length-1] > firstCorrection) {
      console.log("  endPara trimmed")
      endPara = endPara.filter(i => i < firstCorrection)
    }

    if (instrPara[instrPara.length-1] > firstCorrection) {
      console.log("  instrPara trimmed")
      instrPara = instrPara.filter(i => i < firstCorrection)
    }
  }
  
  // Get the number of endOfRecipe paragraphs and of '1. ' paragraphs
  let endRecipes = endPara.length; // endOfRecipe paragraphs
  let instrRecipes = instrPara.length; // '1. ' paragraphs
  if (endRecipes == instrRecipes) {
    // If those numbers are the same...
    Log("Recipes: " + endRecipes.toString());
  } else {
    // If they're different...
    Log("Recipe mismatch: endOfRecipe " + endRecipes.toString() + ", 1.: " + instrRecipes.toString())
  }

  // Sometimes, recipes don't end with a paragraph that matches the 
  //  endOfRecipeRx regexp, (1/29/2006 It Takes a Village)
  // Sometimes, recipe instruction steps aren't numbered (?)
  // In order to identify recipes, use the more numerous marker.
  //  If both markers are equal, use the first instruction step marker
  if (instrRecipes > 0 || endRecipes > 0) {
    // If any '1. ' or 'endOfRecipe' paragraphs were found, parse the article
    //  for recipes.
    if (instrRecipes >= endRecipes) {
      // If '1. ' paragraphs are as or more numerous than 'endOfRecipe' paragraphs,
      // parse the article using '1. ' as the marker for a recipe
      articleResults = recipeParse("instr", $, paras, instrPara, articleObj)
    } else {
      // Otherwise, parse the article using 'endOfRecipe' as the marker for a recipe
      articleResults = recipeParse("end", $, paras, endPara, articleObj)
    }
  } else {
    // If no 'endOfRecipe' or '1. ' paragraphs, the article has no recipes
    articleResults = {hasRecipes: false, recipes: []}
  }

  if (articleResults.hasRecipes) {
    // If the article has recipes, display the article and its embedded recipes
    Log("recipes length: " + articleResults.recipes.length.toString());
    for (let r = 0; r < articleResults.recipes.length; r++) {
      Log(articleResults.recipes[r])
    }

    // If expected recipes were passed to this function,
    //  see if this function's results equal the expected results
    let validated = true; // Assuming the results are equal
    if (expectedRecipes != null) {
      // Expected recipes were passed to this function ... 
      if (!articleResults.recipes.equals(expectedRecipes)) {
        // but this function's results don't equal the expected results
        validated = false;
      }
    }

    if (expectedRecipes == null || !validated) {
      Log("Display article: " + articleObj.title)
      articlesDisplayed = 1;
      if (mainWindow != null) {
        mainWindow.webContents.send('article-display', [JSON.stringify(articleObj), articleResults.recipes, articleResults.type, expectedRecipes]);
      }
    } else {
      Log("Article not displayed")
    }

  } else if (articleObj.cookingWithTheTimes) {
    // If the article is a 'Cooking With The Times' article, display it.
    Log("Displaying TASTINGS article")
    articlesDisplayed = 1;
    if (mainWindow != null) {
      mainWindow.webContents.send('article-display', [JSON.stringify(articleObj), [], 'Cooking With The Times'])
    }

  } else if (articleObj.isBeverage) {
    // If the article is a beverage article (which typicallly don't have
    //  embedded recipes), display it.
    Log("Displaying TASTINGS article")
    articlesDisplayed = 1
    if (mainWindow != null) {
      mainWindow.webContents.send('article-display', [JSON.stringify(articleObj), [], articleObj.beverageType])
    }

  }

  // Return 1 if the article was displayed, 0 otherwise - used for evaluating code changes,
  //  the array of recipe names found,
  //  a boolean indicating unquantified ingredients
  // return [articlesDisplayed, articleResults.recipes];
  return [articlesDisplayed, articleResults];
}

module.exports = { getAuthor, adjustTitle, findRecipes };