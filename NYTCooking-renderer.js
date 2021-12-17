// Manage NYTCooking BrowserWindow
// Single search version

// Code structure:
//
//  Global variable definitions
//  Global function definitions
//    function addProgress
//    function displayRecipe
//      section.lastChild addEventListener for click => articleClick
//      section.lastChild addEventListener for contextmenu => articleOpen
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
//      section.lastChild EventListener
//         calls articleClick
//      section.lastChild EventListener
//         calls articleOpen
//
// Display infrastructure:
//
//  <div id=' recipe name hash '>
//      <div class='keywDiv>        only if multipleRecipes
//          <div class='divider'>
//      <div class='sectDiv'>
//          <p>                     only if <article> element is appended to <section>
//          <section>
//          <p>                     only if <article> element is appended to <section>
//          <section>

const { ipcRenderer } = require('electron'); // InterProcess Communications
const { clipboard } = require('electron');  // System clipboard API
//const fs = require('fs'); // Filesystem functions

// Define variables for NYTCooking.html elements
const recipesDiv = document.getElementById("recipes");
const authorP = document.getElementById("author");
const clearButton = document.getElementById("clearButton");
const stopButton = document.getElementById("stopButton");
const closeButton = document.getElementById("closeButton");
const mL = document.getElementById('msgs');

// Define arrays of display infrastructure elements
let sectDivs;                           // Array of <div> elements that contain <section> elements
let exactSections;                      // Array of exact match sections
let exactSectionIsNotInitialized = [];  // Array of booleans
let fuzzySections;                      // Array of fuzzy match sections
let fuzzySectionIsNotInitialized = [];  // Array of booleans

// Function definiitions

function addProgress(now,max) {
    // Add/update a progress bar
    // Called from searchClick
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

async function displayRecipe(evt, args) {
    // Add a matching recipe <article> element to the designated section, exact or fuzzy
    // Called from searchClick
    // Input:   <article> element HTML,
    //          match type, "exact" ot "fuzzy"
    //          target recipe name
    //          index of target recipe name in array of recipe names

    // Parse args[]
    let [html, matchType, recipeName, index] = args

    // Set the recipe-specific ID for display elements
    let recipeID = 'recipe' +  index.toString().padStart(2, '0');   // recipeNN
    let displaySection = recipeID + matchType;
    console.log("Display: " + recipeName + " at " + displaySection + ", index: " + index.toString());

    let section;            // <section> element targeted for recipe display
    let isNotInitialized;   // booolean indicating that section needs to be initialized for recipe display

    // Identify the target <section> element where the matching recipe is to be displayed and
    //  the associated section-is-NotInitialized indicator
    switch (matchType) {
        case 'exact':
            section = exactSections[index];
            isNotInitialized = exactSectionIsNotInitialized[index];
            break;
        case 'fuzzy':
            section = fuzzySections[index];
            isNotInitialized = fuzzySectionIsNotInitialized[index];
            break;
    }

    if (isNotInitialized) {
        // If the target <section> element has not been initialized ...
        console.log("Display section: " + displaySection + " is NotInitialized,  displayIndex: " + index.toString());

        // Set data-layout = grid
        section.dataset.layout = 'grid';

        // Get the parent <div> of the target <section>
        let thisSectDiv = sectDivs[index];

        // Create a descriptive <p> element to be inserted before the target <section> element
        let match = document.createElement('p');
        match.classList = "mb-2"
        match.style.color = "grey"

        // Set the descriptive <p> element's text according to the match type and
        //  indicate that the <section> element has been initialized
        switch (matchType) {
            case 'exact':
                exactSectionIsNotInitialized[index] = false;
                match.textContent = 'Exact match'; 
                break;
            case 'fuzzy':
                fuzzySectionIsNotInitialized[index] = false;
                match.textContent = 'Fuzzy match'; 
                break;
        }
        
        // Insert the descriptive <p> element before the target <section> element
        thisSectDiv.insertBefore(match,section);
    }

    // Create a template element that will contain a recipe card (an <article> element)
    let temp = document.createElement('template');

    // Set the template's HTML to the <article> element's HTML
    temp.innerHTML = html;


    // Append the <article> element to the target section,
    //  add 'click' and 'contextmenu' event listebers to the <article> element,
    //  and enable the Clear button
    section.appendChild(temp.content.firstChild);
    section.lastChild.addEventListener("click", articleClick, false);
    section.lastChild.addEventListener("contextmenu", articleOpen, false);
    clearButton.disabled = false;
    stopButton.disabled = false;
}

async function clearClick (evt) {
    // Click event handler for Clear button
    //  Remove article elements
    console.log("Clear clicked");
    console.log("evt type: " + typeof evt)
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
    console.log("Stop clicked");
    evt.preventDefault();

    // Clear messages, including progress-bar
    while (mL.firstChild) {
        mL.removeChild(mL.lastChild);
    }
    stopButton.disabled = true;
    ipcRenderer.send("stop-NYTCooking")
}

async function closeClick (evt) {
    // Click event handler for Close button
    //  Send close request to main process.
    console.log("Close clicked");
    evt.preventDefault();
    //let html = document.documentElement.outerHTML;
    //fs.writeFileSync('/Users/rahiggins/Library/Application Support/day-search' + '/div-problem.html', html, "utf8");
    ipcRenderer.send("close-NYTCooking")
}

async function articleClick (evt) {
    // Click event handler for recipes (<article> elements)
    //  Form link element for recipe and write to clipboard
    console.log("Article clicked");
    evt.preventDefault();
    let parent = evt.target.parentNode
    while (parent.tagName != "ARTICLE") {
        parent = parent.parentNode
    }
    let name = parent.innerText.split('\n');
    let recipeLink = '<a href="https://cooking.nytimes.com' + parent.dataset.url;
    recipeLink += '">' + name[0] + '</a>';
    console.log(recipeLink);
    clipboard.writeHTML(recipeLink);

}

async function articleOpen (evt) {
    // ContextMenu event handler for recipes (<article> elements)
    //  IPC send to open recipe in Chrome
    console.log("Article opened");
    evt.preventDefault();
    let parent = evt.target.parentNode
    while (parent.tagName != "ARTICLE") {
        parent = parent.parentNode
    }
    let name = parent.innerText.split('\n');
    let recipeURL = "https://cooking.nytimes.com" + parent.dataset.url
    console.log("Opened recipe: " + name[0]);
    console.log(recipeURL);
    ipcRenderer.send('article-open', 'open', recipeURL);
}

// Mainline function
async function Mainline() {

    function addRecipeDiv(i, name, multipleRecipes) {
        // Add recipe display infrastructure to the Author/Recipe Search window
        // Input:   target recipe name - string
        //          indicator that multiple recipes are being displayed - boolean
    
        // Create a recipe-specific ID for display elements
        let recipeID = 'recipe' + i.toString().padStart(2, '0');
    
        // Create a <div> element for the target recipe
        let recipeDiv = document.createElement('div');
        recipeDiv.id = recipeID;
        recipeDiv.classList = "column col-12 pt-2"
    
        // Create a <div> element for a divider
        let nameDiv = document.createElement("div");
        if (multipleRecipes) {
            // If multiple recipes are being displayed, create a divider and add it to the divider <div>
            nameDiv.className = "keywDiv";
            let divDiv = document.createElement("div");
            divDiv.className = "recdiv divider text-left";
            divDiv.setAttribute('data-content', name);
            nameDiv.appendChild(divDiv)
        }
    
        // Create a <div> element for the exact match and fuzzy matches <section> elements
        let sectDiv = document.createElement('div');
        sectDiv.classList = "pl-2 ml-2 sectDiv";
    
        // Create a <section> element for the exact match to the target recipe name
        let exactSect = document.createElement('section');
        exactSect.classList = 'recipe-card-list track-card-params ml-1';
        exactSect.dataset.matchType = 'exact';
        exactSect.id = recipeID + "exact"
    
        // Create a <section> element for the fuzzy matches to the target recipe name
        let fuzzySect = document.createElement('section');
        fuzzySect.classList = 'recipe-card-list track-card-params ml-1';
        fuzzySect.dataset.matchType = 'fuzzy'
        fuzzySect.id = recipeID + "fuzzy"
    
        // Add the <section> elements to the <div> for sections
        sectDiv.appendChild(exactSect);
        sectDiv.appendChild(fuzzySect)
    
        // Add the divider <div> and the section <div> to the target recipe <div>
        recipeDiv.appendChild(nameDiv);
        recipeDiv.appendChild(sectDiv)
    
        // Add the target recipe <div> to the window
        recipesDiv.appendChild(recipeDiv);
    }

    function newRecipeDisplay(author, recipeNames, multipleRecipes) {
        // Prepare the window for display of a new recipe or set of recipes
        // Input:   author - string
        //          target recipe names - array of strings
        //          indicator that multiple recipes are being displayed - boolean

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
        
        // Reset arrays
        exactSectionIsNotInitialized = [];
        fuzzySectionIsNotInitialized = [];

        // Add display infrastructure for each recipe to the window
        for (let i = 0; i < recipeNames.length; i++) {
            addRecipeDiv(i, recipeNames[i], multipleRecipes);
        }

        // Create arrays of the various recipe display infrastructure elements
        console.log("Gather sections");

        // Create array of <div> elements that are parents of the recipe <section> elements
        sectDivs = document.getElementsByClassName('sectDiv');
        console.log("Number of sectDiv: " + sectDivs.length.toString());

        // Create array of <section> elements
        let sectionsArray = Array.from(document.getElementsByTagName('section'), s => s)

        // Create array of exact match <section> elements and
        //  set corresponding IsNotInitialized indicators to 'true'
        exactSections = sectionsArray.filter(s => s.dataset.matchType == 'exact')
        console.log("Number of  exact sections: " + exactSections.length.toString())
        for (let i = 0; i < exactSections.length; i++) {
            exactSectionIsNotInitialized.push(true);
        }

        // Create array of fuzzy match <section> elements and
        //  set corresponding IsNotInitialized indicators to 'true'
        fuzzySections = sectionsArray.filter(s => s.dataset.matchType == 'fuzzy')
        console.log("Number of  fuzzy sections: " + fuzzySections.length.toString())
        for (let i = 0; i < fuzzySections.length; i++) {
            fuzzySectionIsNotInitialized.push(true);
        }

    }
 

    // Add EventListeners for click on the Stop, Clear and Close buttons.
    console.log("Mainline: Adding event listener to Stop, Clear and Close buttons");
    stopButton.addEventListener("click", stopClick, false);
    clearButton.addEventListener("click", clearClick, false);
    closeButton.addEventListener("click", closeClick, false);

    // Get search arguments: author, name(s) of recipe(s), multiple recipe indicator
    let searchArgs = await ipcRenderer.invoke('getSearchArgs');
    console.log("Got searchArgs: " + searchArgs);
    let [author, recipeNames, multipleRecipes] = searchArgs;
    console.log("author: " + author);
    console.log("name: " + recipeNames);
    console.log("multipleRecipes: " + multipleRecipes);

    // Prepare the window for a new display
    newRecipeDisplay(author, recipeNames, multipleRecipes);

    // Listen for 'set-name' directive
    ipcRenderer.on("set-name", (evt, searchArgs) => {
        console.log("Set searchArgs: " + searchArgs);
        let [author, recipeNames, multipleRecipes] = searchArgs;
        console.log("author: " + author);
        console.log("name: " + recipeNames);
        console.log("multipleRecipes: " + multipleRecipes);

        // Prepare the window for a new display
        newRecipeDisplay(author, recipeNames, multipleRecipes)
    
    })

    // Listen for 'progress-bar' update
    ipcRenderer.on('progress-bar', (evt, args) => {
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

    // Listen for 'no-results' signal
    ipcRenderer.on('no-results', (evt, arg) => {
        // Remove messages, including progress-bar
        while (mL.firstChild) {
            mL.removeChild(mL.firstChild);
        }

        // Add a 'No results' message
        let noResP = document.createElement("p");
        noResP.classList = "text-error m-0 mt-2";
        let txt = "No results" + arg;
        let txnd = document.createTextNode(txt);
        noResP.appendChild(txnd);;
        mL.appendChild(noResP);
    })

    // Listen for 'clear-messages' directive
    ipcRenderer.on('clear-messages', (evt, arg) => {
        // Remove messages, including progress-bar
        while (mL.firstChild) {
            mL.removeChild(mL.firstChild);
        }
    })

    // Listen for 'display-recipe' directive
    ipcRenderer.on('display-recipe', displayRecipe)
    
}

// End of function definitions

Mainline(); // Add event listeners for buttons, display recipe cards