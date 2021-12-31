// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// No Node.js APIs are available in this process.

// Code structure:
//
//  Global variable definitions
//  Global function definitions
//    function Log
//    function addMsg
//    function remvAllMsg
// 
//   window.electron.onDisplaySpinner
//   window.electron.onProgressBar
//    function addProgress
//   window.electron.onKeywordDiv
//   window.electron.onProcessEnd
//   window.electron.onArticleDisplay
//    function elementClick
//    function articleOpen
//    function recipeSearch
//    function displayArticle
//      articleA EventListener for click => elementClick
//      articleA EventListener for contextmenu => articleOpen
//      artTitleDiv.lastChild EventListener for click => recipeSearch
//      artDiv.lastChild EventListener for click => elementClick
//      recipeSearchDiv.lastChild EventListener for click => recipeSearch
//      artDiv.lastChild EventListener for click => elementClick
//    artDiv EventListener for click => elementClick
//    artDiv EventListener for contextmenu => articleOpen
//   window.electron.onEnableSearchButtons
//   window.electron.onCaptchaDetected
//   
//   function Mainline
//    dateInput Eventlistener for input
//    function validateDate
//    startButton EventListener for click
//    dateInput EventListener for change
//    function processDate
//    fileInput EventListener for change

let dateInput = document.getElementById('dateSpec');
let fileInput = document.getElementById('fileSpec');
let startButton = document.getElementById('startButton');
let writeSwitch = document.getElementById('writeSwitch');
let orP = document.getElementById('orP');
let dateForm = document.getElementById('dateForm');
let fileForm = document.getElementById('fileForm');
const mL = document.getElementById('msgs');     // messages list div
const aL = document.getElementById('aList');    // articles list div

let debug = true;

// Function definitions

function Log (text) {
    // If debugging, write text to console.log
    if (debug) {
        console.log(text)
    }
}

function addMsg(msgDiv, msg, opt) {
    // Add a message to the #msgs div
    // If opt { indent: true }, add padding-left to message
    // Called throughout

    if (typeof opt === 'undefined') {
        opt = {
            indent: false
        };
    }
    let para = document.createElement("p");
    para.className = "msg";
    if (opt.indent) {
        para.classList.add("pl-2");
    }
    let txnd = document.createTextNode(msg);
    para.appendChild(txnd);
    msgDiv.appendChild(para);
    return;
}

function remvAllMsg() {
    // Remove all messages in the #msgs div
    // Called throughout

    while (mL.firstChild) {
        mL.removeChild(mL.lastChild);
    }
}

window.electron.onDisplaySpinner( () => {
    // Add a throbber to the page while this app clicks "More" buttons to get the full 
    //  search results
    let loading = document.createElement("div");
    loading.classList = "loading float-left ml-2"
    loading.id = "spinner";
    mL.appendChild(loading);
})


window.electron.onProgressBar( (args) => {
    // Add or update a progress bar showing the articles searched

    function addProgress(now,max) {
        // Input:   now - number of articles retrieved
        //          max - number of articles to be retrieved
        //          searchDomain - 'x section' or 'x keyword' being searched
        // return a <progress> element
    
        Log("addProgress arguments: " + now.toString() + ", " + max.toString())
        window.electron.send('mainAOT', true);
    
        let prog = document.createElement("progress");
        prog.id = "artProg";
        prog.classList = " progress float-left Pbar";
        prog.max = max;
        prog.value = now;
        return prog;
    }

    Log(args)
    let curr = parseInt(args[0]);
    let max = parseInt(args[1]);
    let searchDomain = args[2];
    if (curr == 1) {
        // First time, insert a progress bar

        // Create a float-left div
        let progDiv = document.createElement("div");
        progDiv.classList = "float-left";
        progDiv.id = "Pbar"

        // Create a "Examining n ... articles" <p> element
        let progPara = document.createElement("p");
        progPara.classList = "pr-2 pt-2 float-left m-0 Pbar";
        let txt = "Examining " + args[1] + " " + searchDomain + " articles for recipes…";
        let txnd = document.createTextNode(txt);
        progPara.appendChild(txnd);

        // Add the <p> element and a <progress> element to the float-left div
        progDiv.appendChild(progPara);
        progDiv.appendChild(addProgress(curr,max));

        // Remove the spinner
        mL.removeChild(mL.lastChild);

        // Add the float-left div containing the <progress> element to the messages div
        mL.appendChild(progDiv);

    } else {
        // Subsequently, replace the <progress> element

        let progDiv = document.getElementById('Pbar')
        progDiv.removeChild(progDiv.lastChild);       // Remove the <progress> element
        progDiv.appendChild(addProgress(curr,max));   // and add an updated one
    }
})

window.electron.onKeywordDiv( (arg) => {
    // At the beginning of a keyword seach, add a divider identifying the keyword
    Log("keyword-div received: " + arg);

    // First, remove the existing progress bar, if it exists
    try {
        document.getElementById('Pbar').remove();
    } catch {
        mL.removeChild(mL.lastChild); 
        console.log("No progress-bar")
    }
    // Then, add the divider
    let keywDiv = document.createElement("div");
    keywDiv.className = "keywDiv";
    let divDiv = document.createElement("div");
    divDiv.className = "keydiv divider text-left";
    divDiv.setAttribute('data-content', arg);
    keywDiv.appendChild(divDiv)
    aL.appendChild(keywDiv)

})

window.electron.onProcessEnd( () => {
    // At the end of processing a date, enable all  buttons
    Log("process-end received")
    
    // First, remove the progress bar
    document.getElementById('Pbar').remove();
    
    // Then, enable inputs
    startButton.disabled = false;
    dateInput.disabled = false;

    // And enable all Search buttons
    let searchButtons = document.getElementsByClassName("disen");
    for(let i = 0; i < searchButtons.length; i++) {
        searchButtons[i].disabled = false;
    }

})

window.electron.onArticleDisplay( (args) => {
    // Display an article and its recipes
    // Input:   articleObj,
    //          article recipes,
    //          article type

    function elementClick (evt) {
        // Click event handler for elements
        //  <a> - article title or recipe name
        //  <small> and <div> - list of recipe names
        //  <p> - author
        // Write element HTML to clipboard
        Log("Element clicked");
        evt.preventDefault();
        console.log("Element: " + evt.target.tagName);
        if (evt.target.tagName == "A" || evt.target.tagName == "SMALL") {
            window.electron.clipboardWriteHTML(evt.target.outerHTML);
        } else if (evt.target.tagName == "P" ) {
            window.electron.clipboardWriteText(evt.target.innerText);
        } else if (evt.target.tagName == "DIV" ) {
            window.electron.clipboardWriteHTML(evt.target.firstChild.outerHTML);
        } else {
            console.log("Element not recognized")
        }
    }

    async function articleOpen (evt) {
        // ContextMenu event handler for article <a> elements
        //  IPC send to open article in Chrome

        evt.preventDefault();
        let href = evt.target.href;
        // Validate URL - open only nytimes.com URLs
        let url = new URL(href);
        if (url.hostname.endsWith('nytimes.com')) {
            console.log("Opened article: " + evt.target.innerText);
            console.log(href);
            window.electron.send('article-open', href);
        } else {
            window.electron.send("dialog-error", 
                ['Invalid URL', 'The hostname of \n\n' + href + '\n\n does not end with nytimes.com'])
         }
    }

    function recipeSearch (evt) {
        // Click event handler for recipe search buttons
        // Input: Click event object

        evt.preventDefault();
        Log("recipeSearch entered");
        let all = evt.target.dataset.all === 'true';
        let title = evt.target.dataset.title;

        // Ensure 'title' is an array
        if (all) {
            title = JSON.parse(title);
        } else {
            title = [title];
        }

        let author = evt.target.dataset.author;

        Log("Search arguments -  All: " + all + "\nTitle(s) " + title + "\nAuthor: " + author);

        // Disable all Search buttons
        let searchButtons = document.getElementsByClassName("disen");
        for(let i = 0; i < searchButtons.length; i++) {
            searchButtons[i].disabled = true;
        }

        // Disable the Start button
        startButton.disabled = true;

        // Tell main process to search NYTCooking 
        window.electron.send('author-search', [author, title, all])
    }

    function displayArticle(article, recipes, type) {
        // Append the elements of an article display to the browserWindow

        Log("Display article and recipes:");
        Log("  title; " + article.title)
        Log("  author: " + article.author)
        Log("  href:" + article.link)
        Log("article: " + JSON.stringify(article))
        let numRecipes = recipes.length;
        for (let r = 0; r < numRecipes; r++) {
            Log("   " + recipes[r])
        }

        // Add an 'Article' divider
        let divDiv = document.createElement("div");
        divDiv.className = "divider text-left artdiv";
        divDiv.setAttribute('data-content', type);
        aL.appendChild(divDiv)

        // Create a <div> element for the article display
        let artDiv = document.createElement("div");
        artDiv.className = "ml-1";

        // Create a <div> element for the article title
        let artTitleDiv = document.createElement("div");
        artTitleDiv.className = "float-left";

        // Add an <a> element for the article to the article title <div>
        let articleA = document.createElement("a");
        articleA.className = "float-left";
        articleA.setAttribute('href', article.link);
        articleA.textContent = article.title;
        articleA.addEventListener("click", elementClick, false);
        articleA.addEventListener("contextmenu", articleOpen, false);
        artTitleDiv.appendChild(articleA);

        if (numRecipes > 1) {
            // If there is more than 1 recipe, add a Search All button to the article title <div>
            let searchAllButton = document.createElement("button");
            searchAllButton.classList = "btn float-left btn-sm ml-2 disen"
            searchAllButton.textContent = "Search All";

            // Add data describing the recipes to be searched to the button
            searchAllButton.dataset.title = JSON.stringify(recipes);
            searchAllButton.dataset.author = article.author;
            searchAllButton.dataset.all = true;

            // Disable the button
            searchAllButton.disabled = true;
            
            // Append the button to the page and establish a click listener
            artTitleDiv.appendChild(searchAllButton);
            artTitleDiv.lastChild.addEventListener("click", recipeSearch, false);
        }


        // Append the article title <div> to the article display <div>
        artDiv.appendChild(artTitleDiv);

        // Append a <div> element to clear the previous float-left
        let clearDiv = document.createElement("div");
        clearDiv.className = "clearDiv";
        artDiv.appendChild(clearDiv);

        if (!article.link.includes("cooking.nytimes.com")) {
            // If the article does not link to cooking.nytimes.com,
            //  append author and recipes elements to the article display <div>

            // Create a <p> element for the author, append it to the article display <div> and
            //  listen for click on it
            let Author = document.createElement("p");
            Author.className = "mb-0"
            Author.textContent = article.author;
            artDiv.appendChild(Author);
            artDiv.lastChild.addEventListener("click", elementClick, false);

            // Create a <div> for the recipe list
            let recipesDiv = document.createElement("div");
            recipesDiv.className = "bg-secondary columns col-9 ml-0 mb-2 mt-1"

            // Create a <small> element
            let Recipes = document.createElement("small");

            // Create a recipe search <div> element
            let recipesSearchDiv = document.createElement("div");

            Log("Number of recipes: " + recipes.length.toString());
            for (let i = 0; i < recipes.length; i++) {
                // For each recipe ...
                Log("Recipe: " + i.toString());

                //  ... skip those with no name 
                if (recipes[i] == "Recipe Name not found") {
                    Log("Name not found skipped");
                    continue;
                }

                // Append the recipe name to the <small> element; append a <br> element if
                //  there are more recipes
                Recipes.appendChild(document.createTextNode(recipes[i]))
                if (i < recipes.length-1) {
                    Log("Add linbreak: " + i.toString())
                    let linebreak = document.createElement("br");
                    Recipes.appendChild(linebreak);
                }

                // Create a recipe name <div> element
                let recipeSearchDiv = document.createElement("div");
                recipeSearchDiv.className = "float-left mb-1";

                // Create a recipe name <p> element and append the recipe name to it
                let searchRecipe = document.createElement("p");
                searchRecipe.classList = "float-left mb-0 srchArt"
                searchRecipe.textContent = recipes[i];

                // Create a search <button> element
                let searchButton = document.createElement("button");
                searchButton.classList = "btn float-left btn-sm ml-2 disen"
                searchButton.textContent = "Search";
                searchButton.dataset.title = recipes[i];
                searchButton.dataset.author = article.author;
                searchButton.dataset.all = false;
                searchButton.disabled = true;

                // Append the recipe name <p> element to the recipe name <div> element
                recipeSearchDiv.appendChild(searchRecipe);

                // Append the search <button> element to the recipe name <div> element and
                //  listen for click on the search <button> element 
                recipeSearchDiv.appendChild(searchButton);
                recipeSearchDiv.lastChild.addEventListener("click", recipeSearch, false);

                // Append the recipe name <div> element to the recipe search <div> element
                recipesSearchDiv.appendChild(recipeSearchDiv);

                // Create a <div> element to clear the previous float-left and append it to
                //  the recipe search <div> element
                let clearDiv = document.createElement("div");
                clearDiv.className = "clearDiv";
                recipesSearchDiv.appendChild(clearDiv);
            }

            // Append the <small> element to the recipes list <div>
            recipesDiv.appendChild(Recipes)

            // Append the recipes list <div> to the article display <div> and listen 
            //  for click on the recipes list <div>
            artDiv.appendChild(recipesDiv)
            artDiv.lastChild.addEventListener("click", elementClick, false);

            // Append the recipe search <div> to the article display <div>
            artDiv.appendChild(recipesSearchDiv);
        }

        // Append the article display <div> to the articles list <div>
        aL.appendChild(artDiv)

    }

    // Parse args
    let [article, recipes, type] = args

    // Convert article to array
    article = JSON.parse(article);

    // Display the article and its recipes 
    displayArticle( article, recipes, type );

})

//Enable searchButtons on completion of index.js function authorSearch
window.electron.onEnableSearchButtons( () => {
    Log("enable-searchButtons received")

    // Enable all Search buttons
    let searchButtons = document.getElementsByClassName("disen");
    for(let i = 0; i < searchButtons.length; i++) {
        searchButtons[i].disabled = false;
    }

    // Enable the Start button
    startButton.disabled = false;

})


// On captcha detected, add a message and a button whose click indicates that the 
//  captcha was solved
window.electron.onCaptchaDetected( () => {
    Log("captcha-detected received")

    // Create a <p> element
    let captchaP = document.createElement('p');

    // Add 'Captcha detected!' to the <p> element
    let txnd = document.createTextNode('Captcha detected!');
    captchaP.appendChild(txnd);
    
    // Create a Solved button
    let button = document.createElement('input');
    button.classList = "btn btn-sm ml-2";
    button.id = 'solved';
    button.type = "button";
    button.value = 'Solved';
    button.name = button.id;

    // Add the button to the <p> element
    captchaP.appendChild(button)

    // Insert the <p> element at the beginning of the msgs div
    mL.prepend(captchaP)

    // Listen for the Solved button to be clicked
    button.addEventListener('click', (evt) => {
        evt.preventDefault();
        Log("Captcha solved button clicked")

        // Tell main process that the captcha has been solved
        window.electron.send('captcha-solved')

        // Remove the captcha detected mesage and the Solved button
        captchaP.remove()

    },  {once: true});  // Remove the listener after a click

})

// Mainline function
async function Mainline() {
    Log("Entered Mainline");

    function valDate(date) {
        // Validate that the date is a Sunday or a Wednesday;
        //  Disable the start button if the day is not valid and return -1, else
        //  enable the start button and return 0
        Log("valDate: " + date)

        let day = new Date( date ).getUTCDay();
        Log("Day (0-6) selected: " + day.toString())
        if (![0, 3].includes(day)) {
            Log("date is invalid");
            startButton.disabled = true;
            return -1
        } else {
            Log("date is valid");
            startButton.disabled = false;
            return 0
        }

    }

    function validateDate(e) {
        // dateInput handler for 'input' and 'change' events - 
        //  Calls function valDate to determine that the selected date is 
        //   a Sunday (0) or a Wednesday (3)
        //  valDate disables or enables the Start button and returns 0 (valid date) or
        //   -1 (invalid date)
        //  Remove or add class is-error from/to the dateInput element if the date is
        //   valid/invalid
        Log("validateDate entered")
        if (valDate(e.target.value) < 0) {
            // Not valid, add class is-error to input element
            e.target.classList.add("is-error");
        } else {
            // Valid, remove class is-error from input element
            e.target.classList.remove("is-error");
        }
    }

    // Ask main process for the last searched date; set the input date picker 
    //  to that date
    let lastDate = await window.electron.getLastDate();
    Log("lastDate: " + lastDate);
    dateInput.value = lastDate;

    // Validate input date: Sunday or Wednesday
    if (valDate(lastDate) < 0) {
        // Not valid, add class is-error to input element
        dateInput.classList.add("is-error");
    } else {
        // Valid, remove class is-error from input element
        dateInput.classList.remove("is-error");        
    }

    // Listen for input event in the date picker
    dateInput.addEventListener('input', validateDate);
    dateInput.addEventListener('change', validateDate);
    
    // Listen for a click of the Start button, then call function processDate 
    startButton.addEventListener('click', processDate)

    async function processDate() {
        // Process a date

        // Disable the Start button
        startButton.disabled = true;
        dateInput.disabled = true;

        // Remove testcase file input
        orP.remove()
        fileForm.remove()

        // Remove any previous messages
        remvAllMsg();

        // Remove previous articles
        while (aL.firstChild) {
            aL.removeChild(aL.lastChild);
        }

        // Set displayed URLs to empty
        displayedURLs = [];

        // Get the selected date (yyyy-mm-dd)
        let dateToSearch = dateInput.value;
        let switchValue = writeSwitch.checked;

        // Send the date to process and the testcase switch value to the main process
        window.electron.send('process-date', [dateToSearch, switchValue])

    }

    // When a testcase file is selected, remove the date input elments and
    //  tell the index.js to process the testcase file
    fileInput.addEventListener("change", () => {
        dateForm.remove();
        orP.remove();
        let hrefFile = fileInput.files[0].path.replace("html", "txt")
        window.electron.send('process-file', 
            [fileInput.files[0].path,
             hrefFile
            ]
        )
    }, false);

}

// Initialize browserWindow and set event listeners
Mainline();
