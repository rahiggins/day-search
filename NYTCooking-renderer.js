// Manage NYTCooking BrowserWindow
// Single search version
// Recipe card template version

// This script:
//  - Appends a clone of the recipeResultsTemplate to the recipes div for each recipe being searched
//  - Appends a clone of the recipeCardTemplate to the appropriate recipe card display div for each recipe
//     that matches the seach criteria
//  - Handles clicks on the Stop, Clear and Close buttons
//  - Handles clicks and double clicks on recipeCards

// Code structure:
//
//  Global variable definitions
//  Global function definitions
//    function Log      
//    function addProgress
//    function displayRecipe
//      article.lastChild addEventListener for click => articleClick
//      article.lastChild addEventListener for contextmenu => articleOpen
//    function clearClick
//    function stopClick
//    function closeClick
//    function articleClick    
//    function articleOpen
//    String.prototype.hashCode
//    function Mainline
//      function addRecipeDiv
//      function newRecipeDisplay      
//      stopButton EventListener for click => stopClick
//      clearButton EventListener for click => clearClick
//      closeButton EventListener for click => closeClick
//      ipcRenderer.on("set-name")
//      ipcRenderer.on('progress-bar')
//      ipcRenderer.on('no-results')
//      ipcRenderer.on('clear-messages')
//      ipcRenderer.on('display-recipe')

// Program flow:
//
//   Mainline
//     stopButton EventListener
//       calls stopClick
//     clearButton EventListener
//        calls clearClick
//     closeButton EventListener
//        calls closeClick
//     call searchargs in index.js
//     call newRecipeDisplay
//     ipcRenderer.on("set-name")
//         call newRecipeDisplay
//     ipcRenderer.on('progress-bar')
//     ipcRenderer.on('no-results')
//     ipcRenderer.on('clear-messages')
//     ipcRenderer.on('display-recipe')
//         call displayRecipe
//
//   newRecipeDisplay
//      calls addRecipeDiv
//
//   displayRecipe
//      article.lastChild EventListener
//         calls articleClick
//      article.lastChild EventListener
//         calls articleOpen
//
// Display infrastructure:
//
//  <div id='recipe'>
//      <div class='keywDiv>        only if multipleRecipes
//          <div class='divider'>
//      <div>
//          <div id='exact'>
//              <p>                     initially display: none
//              <div>                   recipe card display div
//          <div id='fuzzy'>
//              <p>                     initially display: none
//              <div>                   recipe card display div

// Define variables for NYTCooking.html elements
const recipesDiv = document.getElementById("recipes");
const authorP = document.getElementById("author");
const clearButton = document.getElementById("clearButton");
const stopButton = document.getElementById("stopButton");
const closeButton = document.getElementById("closeButton");
const mL = document.getElementById('msgs');
const recipeResultsContent = document.getElementById('recipeResultsTemplate').content   // Template content
const recipeCardContent = document.getElementById('recipeCardTemplate').content         // Template content
const debug = true;

// Define arrays of display infrastructure elements
let divElements;    // HTMLCollection of <div> elements

// Define an object used to indicate which recipe card display divs already contain recipe cards and
//  therefore don't need to have their exactMatchPara/fuzzyMatchPara <p> element made visible
let isPopulated = {}; // Keys of this object are the id attributes of the previously populated
                        //  recipe card display divs

// Function definiitions

function Log (text) {
    // If debugging, write text to console.log
    if (debug) {
        console.log(text)
    }
  }
  
function addProgress(now,max) {
    // Add/update a progress bar
    // Called from window.NYTC.onProgressBar
    // Input:   now - number of articles retrieved
    //          max - number of articles to be retrieved
    // return a progress bar element
    let prog = document.createElement("progress");
    prog.id = "pgProg";
    prog.classList = " progress float-left";
    prog.style.marginTop = "11px"; // aligns progress bar with adjacent text, derived empirically
    prog.max = max;
    prog.value = now;
    return prog;
}

async function displayRecipe(args) {
    // Add a recipe card to the designated recipe card display div
    // Called from window.NYTC.onDisplayRecipe
    // Input:   stringified articleDataObj,
    //          match type, "exact" ot "fuzzy"
    //          target recipe name
    //          index of target recipe name in array of recipe names

    // Parse args[]
    let [stringifiedArticleDataObj, matchType, recipeName, index] = args;

    Log("displayRecipe entered for recipe: " + recipeName);
    //console.log("stringifiedArticleDataObj: " + stringifiedArticleDataObj)

    // Objectify argument stringifiedArticleDataObj
    let articleDataObj = JSON.parse(stringifiedArticleDataObj);

    function tooltipMultiLine(recipeName) {
        // Split a recipe name at spaces into multiple lines
        //  for use as tooltip data. Each line should be 40 characters
        //  or less.

        lines = []; // Array of 40 characters or less lines

        if (recipeName.length > 40) {
            // If the recipe name is longer than 40 characters,
            //  split it into lines
            do {
                // While the recipe name length is greater than 40,

                // Find the last space character in the first 40 characters
                let idx = recipeName.substring(0,41).lastIndexOf(' ');

                // Append the substring up to the last space to the lines array
                lines.push(recipeName.substring(0,idx));

                // Set the recipe name to the remaining substring,
                // exclusive of the leading space
                recipeName = recipeName.substring(idx+1)

                // Repeat until the remaining substring is less than 40 characters
            } while (recipeName.length > 40)
        }

        // Append the recipe name (if less than 40 characters) or the last
        //  line of the recipe name to the lines array
        lines.push(recipeName)

        // Return a string of the 40 characters or less lines separated
        //  by newline characters
        return lines.join('\n')
    }

    // Form the ID of the <div> element in which the recipe card should be displayed
    targetDivID = 'recipe' + index.toString().padStart(2, '0') + matchType + 'Columns';

    // Get the div where the recipe card will be displayed
    let divElementNamed = divElements.namedItem(targetDivID);

    // If this recipe is the first to be added to this recipe card display div, remove the display:none 
    //  attribute from the <p> element that contains 'Exact Match' or 'Fuzzy Match'
    if (!isPopulated[targetDivID]) {
        // If the target recipe display div has not been previously populated ...

        // ... remove display:none ...
        divElementNamed.parentNode.firstElementChild.classList.remove('d-none');

        // ... and indicate that the div has been populated
        isPopulated[targetDivID] = "populated";

        Log(targetDivID + " has been populated")
    }

    // Clone the recipeCard template content and add recipe information from the articleDataObj object
    //  to the clone
    let recipeCard = recipeCardContent.cloneNode(true);

    // Identify elements in the cloned recipeCard to which recipe information will be added
    let recipeCardArt = recipeCard.querySelector('article')
    let recipeCardA = recipeCard.querySelector('a')
    let recipeCardFigureDiv = recipeCard.querySelector('.figureDivStyle')
    let recipeCardH3 = recipeCard.querySelector('h3')
    let recipeCardByline = recipeCard.querySelector('.cardBylineStyle')
    let recipeCardTime = recipeCard.querySelector('.cardCooktimeStyle')

    // Add recipe information to the cloned recipeCard
    recipeCardArt.dataset.url = 'https://cooking.nytimes.com' + articleDataObj.href
    recipeCardArt.dataset.tooltip = tooltipMultiLine(articleDataObj.recipeName);
    recipeCardA.href = articleDataObj.href
    recipeCardH3.textContent = articleDataObj.recipeName;
    recipeCardByline.innerText = articleDataObj.author
    recipeCardTime.innerText = articleDataObj.time

    // Set the source attribute of the recipe card <img> element
    recipeCardFigureDiv.firstElementChild.src = articleDataObj.dlImg    



    // Append the cloned recipeCard to the recipe card display div
    Log("Appending recipe card to div: " + targetDivID);
    divElementNamed.appendChild(recipeCard);

    // Add event listeners to the <artcle> element of the appended recipeCard
    let article = divElementNamed.lastElementChild.querySelector('article')
    article.addEventListener("click", articleClick, false);
    article.addEventListener("contextmenu", articleOpen, false);

    // Enable the Clear and Stop buttons
    clearButton.disabled = false;
    stopButton.disabled = false;
}

async function clearClick (evt) {
    // Click event handler for Clear button
    //  Remove article elements
    Log("Clear clicked");
    Log("evt type: " + typeof evt)
    if (typeof evt == "object") {
        evt.preventDefault();
    }

    // Clear display infrasrtucture
    while (recipesDiv.firstChild) {
        recipesDiv.removeChild(recipesDiv.lastChild);
    }

    // Clear messages
    while (mL.firstChild) {
        mL.removeChild(mL.lastChild);
    }
    clearButton.disabled = true;
}

async function stopClick (evt) {
    // Click event handler for Stop button
    //  Send Stop request to main process
    Log("Stop clicked");
    evt.preventDefault();

    // Clear messages, including progress-bar
    while (mL.firstChild) {
        mL.removeChild(mL.lastChild);
    }
    stopButton.disabled = true;
    window.NYTC.send('stop-NYTCooking')
}

async function closeClick (evt) {
    // Click event handler for Close button
    //  Send close request to main process.
    Log("Close clicked");
    evt.preventDefault();
    window.NYTC.send('close-NYTCooking')
}

async function articleClick (evt) {
    // Click event handler for recipes (<article> elements)
    //  Form link element for recipe and write to clipboard
    Log("Article clicked");
    evt.preventDefault();
    let parent = evt.target.parentNode
    while (parent.tagName != "ARTICLE") {
        parent = parent.parentNode
    }
    let name = parent.innerText.split('\n');
    let recipeLink = '<a href="' + parent.dataset.url;
    recipeLink += '">' + name[0] + '</a>';
    Log("Copied url: " + recipeLink);
    window.NYTC.send('write-HTML', recipeLink);

}

async function articleOpen (evt) {
    // ContextMenu event handler for recipes (<article> elements)
    //  IPC send to open recipe in Chrome
    Log("Article opened");
    evt.preventDefault();
    let parent = evt.target.parentNode
    while (parent.tagName != "ARTICLE") {
        parent = parent.parentNode
    }

    let name = parent.innerText.split('\n');

    Log("Opened recipe: " + name[0]);
    console.log(parent.dataset.url);
    window.NYTC.send('article-open', parent.dataset.url);
}

// Mainline function
async function Mainline() {

    function addRecipeDiv(i, name, multipleRecipes) {
        // Add recipe search results display infrastructure to the Author/Recipe Search window
        // Input:   index of this recipe name - number  
        //          target recipe name - string
        //          indicator that multiple recipes are being displayed - boolean

        Log("addRecipeDiv entered for: " + name)

        // Clone the recipe search results infrastructure template
        let recipeResults = recipeResultsContent.cloneNode(true);

        // Create a recipe-specific ID for display elements: 'recipe<padded index>'
        let recipeID = 'recipe' + i.toString().padStart(2, '0');

        // Change generic element IDs in the recipe search results infrastructure template clone
        //  to recipe-specific IDs
        const recipeDiv = recipeResults.querySelector('#recipe')
        recipeDiv.id = recipeID;
        const exactDiv = recipeResults.querySelector('#exact')
        exactDiv.id = recipeID + 'exact'
        const exactPara = recipeResults.querySelector('#exactMatchPara')
        exactPara.id = recipeID + 'exactMatchPara'
        const exactColumnsDiv = recipeResults.querySelector('#exactColumns')
        exactColumnsDiv.id = recipeID + 'exactColumns'
        const fuzzyDiv = recipeResults.querySelector('#fuzzy')
        fuzzyDiv.id = recipeID + 'fuzzy'
        const fuzzyPara = recipeResults.querySelector('#fuzzyMatchPara')
        fuzzyPara.id = recipeID + 'fuzzyMatchPara'
        const fuzzyColumnsDiv = recipeResults.querySelector('#fuzzyColumns')
        fuzzyColumnsDiv.id = recipeID + 'fuzzyColumns'

        // For multiple recipes, set the divider data-content; else remove the divider
        if (multipleRecipes) {
            // Set divider data-content = recipe name
            let divDiv = recipeResults.querySelector('.recdiv');
            divDiv.setAttribute('data-content', name);
        } else {
            // Remove the div containing the recipe divider element
            const keywDiv = recipeResults.querySelector('.keywDiv');
            keywDiv.remove()
        }
    
        // Add the recipe search results infrastructure clone to the window
        recipesDiv.appendChild(recipeResults);
    }

    function newRecipeDisplay(searchArgs) {
        // Prepare the window for display of a new recipe or set of recipes
        // Input:   [author - string,
        //          target recipe names - array of strings,
        //          indicator that multiple recipes are being displayed - boolean]

        Log("newRecipeDisplay entered with SearchArgs: " + searchArgs);
        let [author, recipeNames, multipleRecipes] = searchArgs;
        Log("author: " + author);
        Log("name: " + recipeNames);
        Log("multipleRecipes: " + multipleRecipes);

        // Set display name for the recipe search argument
        if (multipleRecipes) {
            searchFor = "multiple recipes";
        } else {
            searchFor = recipeNames[0];
        }

        // Add search arguments to the window
        authorP.innerHTML  = "Searching for: " + searchFor + "<br>by " + author;

        // Clear any previous display infrasrtucture
        while (recipesDiv.firstChild) {
            recipesDiv.removeChild(recipesDiv.lastChild);
        }
        while (mL.firstChild) {
            mL.removeChild(mL.lastChild);
        }
        clearButton.disabled = true;
        
        // Reset the recipe card display <div> element initializtion status
        isPopulated = {}

        // Add display infrastructure for each recipe to the window
        for (let i = 0; i < recipeNames.length; i++) {
            addRecipeDiv(i, recipeNames[i], multipleRecipes);
        }


        // Create an HTMLCollection of <div> elements
        divElements = document.getElementsByTagName('div');

    }
 

    // Add EventListeners for click on the Stop, Clear and Close buttons.
    Log("Mainline: Adding event listener to Stop, Clear and Close buttons");
    stopButton.addEventListener("click", stopClick, false);
    clearButton.addEventListener("click", clearClick, false);
    closeButton.addEventListener("click", closeClick, false);

    // Get search arguments: author, name(s) of recipe(s), multiple recipe indicator and
    //  call newRecipeDisplay to add display infrastructure for them to the Author/Recipe Search window
    newRecipeDisplay(await window.NYTC.getSearchArgs());

    // Listen for 'set-name' message
    window.NYTC.onSetName( (searchArgs) => {
        // Input: search arguments - author, name(s) of recipe(s), multiple recipe indicator

        // Add display infrastructure for search arguments to the Author/Recipe Search window 
        newRecipeDisplay(searchArgs);
    })


    // Listen for 'progress-bar' update
    window.NYTC.onProgressBar( (args) => {
        // Input: - number of page being processed
        //        - total number of pages

        let processingPage = args[0];
        let pages = args[1];

        if (processingPage == 1) {
            // On first page, create the progress-bar element
            let para = document.createElement("p");
            para.classList = "pr-2 pt-2 float-left m-0 text-tiny";
            let txt = "Searching " + pages.toString() + " result pages... "
            let txnd = document.createTextNode(txt);
            para.appendChild(txnd);
            mL.appendChild(para);
            mL.appendChild(addProgress(processingPage,pages));
        } else {
            // For subsequent pages, replace the progress-bar elment
            mL.removeChild(mL.lastChild);
            mL.appendChild(addProgress(processingPage,pages));
        }
    })

    // Listen for 'no-results' message
    window.NYTC.onNoResults( (arg) => {
        // Remove messages, including progress-bar
        while (mL.firstChild) {
            mL.removeChild(mL.firstChild);
        }

        // Add 'No results' to the window
        let noResP = document.createElement("p");
        noResP.classList = "text-error m-0 mt-2";
        arg = !arg ? "" : " - " + arg 
        let txt = "No results" + arg;
        let txnd = document.createTextNode(txt);
        noResP.appendChild(txnd);;
        mL.appendChild(noResP);
    })

    // Listen for 'clear-messages' message
    window.NYTC.onClearMessages( () => {
        // Remove messages, including progress-bar
        while (mL.firstChild) {
            mL.removeChild(mL.firstChild);
        }
    })

    // Listen for 'display-recipe' message
    window.NYTC.onDisplayRecipe( (args) => {
        // Display a recipe card 
        // Input:   stringified articleDataObj,
        //          match type, "exact" ot "fuzzy"
        //          target recipe name
        //          index of target recipe name in array of recipe names

        displayRecipe(args)
    })
    
}

// End of function definitions

Mainline(); // Add event listeners for buttons, display recipe cards