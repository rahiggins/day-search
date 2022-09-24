// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// No Node.js APIs are available in this process.

// Code structure:
//
//  Global variable definitions
//
//  Global function definitions
//    function Log
//    function setDefaults
//    function addMsg
//    function remvAllMsg
//    fucntion showReset
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
//      function createArticleTitle
//          articleA EventListener for click => elementClick
//          articleA EventListener for contextmenu => articleOpen
//      function createAuthor
//          authorP EventListener for click => elementClick
//      function createRecipeLists
//          recipeListSmall EventListener for click => elementClick
//          recipeListSmall parent EventListener for click => elementClick
//          searchButton EventListener for click => recipeSearch
//      searchAllButton EventListener for click => recipeSearch
//   window.electron.onEnableSearchButtons
//   window.electron.onCaptchaDetected
//     button EventListener for click
//        
//   function Mainline
//    dateInput Eventlistener for input
//    function validateDate
//    startButton EventListener for click
//    dateInput EventListener for change
//    function processDate

let dateInput = document.getElementById('dateSpec');
let startButton = document.getElementById('startButton');
let dateForm = document.getElementById('dateForm');
const resetButton = document.getElementById("resetButton")
const mL = document.getElementById('msgs');     // messages list div
const aL = document.getElementById('aList');    // articles list div

let debug = true;

// Article title template content, without and with Search All button
let articleTitleContent = document.getElementById("article-title").content;
let articleTitleSearchAllContent = document.getElementById("article-title-searchAll").content;

// Recipe list template content, without and with error background
let recipeListContent = document.getElementById("recipe-list").content;
let recipeListErrorContent = document.getElementById("recipe-list-error").content;

// Recipe name template content, for typical and long recipe names
let recipeNameContent = document.getElementById("recipe-name").content;
let recipeNameLongContent = document.getElementById("recipe-name-long").content;

// Function definitions

function Log (text) {
    // If debugging, write text to console.log
    if (debug) {
        console.log(text)
    }
}

function setDefaults(options, defaults){
    // Set default values of an options object
    // Input:   - an options object
    //          - an object containing default option values
    // Output:  - an object containing the input object values plus default 
    //              values for options missing in the input object

    if (options === undefined) { options = {}} 
    for (const key in defaults) {
        options[key] = key in options ? options[key] : defaults[key];
    }
    return options
}

function addMsg(msgDiv, msg, options) {
    // Add a message to the #msgs div
    // If opt { indent: true }, add padding-left to message
    // If opt { color: class}, add 'class' to p.classList if 'class" != 'default'
    // Called throughout

    // Define options defaults
    const optionsDefaults = {
        indent: false,
        color: "default"
    };

    // Add missing option defaults to the options object
    options = setDefaults(options, optionsDefaults)

    let para = document.createElement("p");
    para.className = "msg";
    if (options.indent) {
        para.classList.add("pl-2");
    }
    if (options.color != "default") {
        para.classList.add(options.color);
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

function removeOr () {
    let Ors = document.getElementsByClassName("or");
    while (Ors.length > 0) Ors[0].remove();
}

function showReset () {
    resetButton.disabled = true;
    resetButton.classList.remove('d-invisible')
    resetButton.addEventListener('click', () => {
        window.electron.send("reset-window")
    });
}

window.electron.onDisplaySpinner( () => {
    // Add a throbber to the page while this app clicks "More" buttons to get the full 
    //  search results
    let loading = document.createElement("div");
    loading.classList = "loading float-left ml-2 mt-2"
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
        Log("No progress-bar")
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
    // At the end of processing a date or Validate, enable all  buttons
    Log("process-end received")
    
    // First, remove the progress bar, if there is one
    let pbar = document.getElementById('Pbar');
    if (pbar) {
        pbar.remove()
    }
    
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
    //          (optional) expected results
    Log("onArticleDisplay entered");

    function elementClick (evt) {
        // Click event handler for elements
        //  <a> - article title or recipe name
        //  <small> and <div> - list of recipe names
        //  <p> - author
        // Write element HTML to clipboard
        Log("Element clicked");
        evt.preventDefault();
        Log("Element: " + evt.target.tagName);
        if (evt.target.tagName == "A") {
            // Remove class from <a> elements before writing to clipboard
            //   (class="float-left" was added when Seach All buttons were added)
            //   (This may no longer be needed; "float-left" is no longer used)
            // Class is not applicable to paste target and recipe_url_verify.py 
            //  did not expect it
            let classlessArticleNode =  evt.target.cloneNode(true);
            classlessArticleNode.className="";
            window.electron.clipboardWriteHTML(classlessArticleNode.outerHTML.replace(' class=""', "" ));
        } else if (evt.target.tagName == "SMALL") {
            window.electron.clipboardWriteHTML(evt.target.outerHTML);
        } else if (evt.target.tagName == "P" ) {
            window.electron.clipboardWriteText(evt.target.innerText);
        } else if (evt.target.tagName == "DIV" ) {
            window.electron.clipboardWriteHTML(evt.target.firstElementChild.outerHTML);
        } else {
            Log("Element not recognized")
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

    function displayArticle(article, recipes, type, expectedRecipes) {
        // Append the components of an article display to the browserWindow
        // - Article title {Search All}
        // - {Author}
        // - {small-font recipe name list}
        // - {Recipe name Search} (possibly repeated)
        // Input:   - articleObj
        //          - array of recipe names
        //          - article type (e.g. Article, Tasting, cooking.nytimes.com, etc)
        //          - array of expected recipe names (optional, implies Validate)
        Log("function displayArticle entered")
    
        //
        /// Function definitions
        //
        
        function createArticleTitle(articleTitleContent) {
            // Create an article title component
            // - Divider with article type
            // - Article title with href and click and double-click listeners
            // - optional Search All button
            // Input:   - content of an article-title template
            // Output:  - [article title element, article container element]
            Log("function createArticleTitle entered")    

            // Clone the article-tile template content
            let articleTitle = articleTitleContent.cloneNode(true);

            // Identify the article container element; other elements will be
            //  appended to this
            let articleContainer = articleTitle.querySelector(".container");

            // Identify the divider element and set its content to the
            //  article type
            let articleDivider = articleTitle.querySelector(".divider");
            articleDivider.setAttribute('data-content', type);

            // Identify the article title <a> element, set its
            //  href attribute and text content, and add event listeners
            let articleA = articleTitle.querySelector("a");
            articleA.setAttribute('href', article.link);
            articleA.textContent = article.title;
            articleA.addEventListener("click", elementClick, false);
            articleA.addEventListener("contextmenu", articleOpen, false);

            Log("function createArticleTitle exiting")
            return [articleTitle, articleContainer]
    
        }
    
        function createAuthor (articleTitle, author) {
            // Add the author name to the article title element, along with
            //  a click event listener
            // Input:   - article title element
            //          - author name
            // Output:  - article title element   
            Log("function createAuthor entered")

            // Identify the article title <p> element, set its text to 
            //  the author name and add a click event listener
            let authorP = articleTitle.querySelector("p");
            authorP.textContent = author;
            authorP.addEventListener("click", elementClick, false);
            
            Log("function createAuthor exiting")
            return [articleTitle]
        }

        function createRecipeLists(recipes, options) {
            // Create lists of recipe names
            //  - small-font list of recipe names
            //  - recipe name and Search button combinations, repeated
            // Input:   - array of recipe names
            //          - options object:
            //              -- boolean to add recipe name and Search button 
            //                  combinations, default is true
            //              -- boolean to select bg-error for small-font 
            //                  list of recipe names, default is false
            // Output:  recipe list component
            Log("function createRecipeLists entered");

            // Define variables created in this function
            let recipeList; // template content clone
            let recipeName; // template content clone

            // Define options defaults
            const optionsDefaults = {
                error: false,
                addRecipeSearchButtons: true
            };
        
            // Add missing option defaults
            options = setDefaults(options, optionsDefaults);
 
            // Clone the recipe-list template content; indentify its 
            //  <small> element and add a click event listener to the 
            //  <small> element

            // if options.error is true, use the recipe list template that
            //  specifies class bg-error, else use the template that specifies
            //  bg-secondary
            if ( options.error ) {
                recipeList = recipeListErrorContent.cloneNode(true);
            } else {
                recipeList = recipeListContent.cloneNode(true);
            }

            // Add a click event listener to the recipe list <small> element
            let recipeListSmall = recipeList.querySelector("small")
            recipeListSmall.addEventListener("click", elementClick, false);

            // Add a click event listener to the parent <div> element of the <small> element
            recipeListSmall.parentNode.addEventListener("click", elementClick, false);

            // Identify the <div> element to contain the recipe name and Search
            //  button combinations
            let recipeDiv = recipeList.lastElementChild;

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
                recipeListSmall.appendChild(document.createTextNode(recipes[i]))
                if (i < recipes.length-1) {
                    let linebreak = document.createElement("br");
                    recipeListSmall.appendChild(linebreak);
                }

                if ( options.addRecipeSearchButtons ) {
                    // If recipe name and Search button combinations are to be
                    //  added ...    
                    
                    // KLUDGE
                    // For recipe names longer 52, choose the recipe name template that
                    //  uses class col-sm-auto, instead of col-md-auto.
                    // This avoids a scroll bar on long recipe names, instead
                    //  wrapping the recipe name.  How does it do that?
                    if (recipes[i].length > 52) {
                        recipeName = recipeNameLongContent.cloneNode(true);
                    } else {
                        recipeName = recipeNameContent.cloneNode(true);
                    }

                    // Set the recipe name component's <p> element text to the 
                    //  recipe name
                    recipeName.querySelector("p").textContent = recipes[i];
    
                    // Identify the Search button element, set its data-title
                    //  and data-author attributes, and add a click event listener
                    let searchButton = recipeName.querySelector("button");
                    searchButton.dataset.title = recipes[i];
                    searchButton.dataset.author = article.author;
                    searchButton.disabled = true;
                    searchButton.addEventListener("click", recipeSearch, false);

                    // Add the recipe name and Search button combination to
                    //  the recipe list component
                    recipeDiv.appendChild(recipeName);
                }
            }
    
            Log("function createRecipeLists exiting")
            // Return the recipe list component
            return recipeList
        }

        // 
        /// End of function definitions
        //
    
        Log("Display article and recipes:");
        Log("  title; " + article.title)
        Log("  author: " + article.author)
        Log("  href:" + article.link)
        Log("article: " + JSON.stringify(article))
    
        // Just to be clear, (expectedRecipes != null) => Validate button clicked
        if (expectedRecipes != null) {
            validating = true;
        } else {
            validating = false
        }
    
        Log("Discovered recipes:")
        let numRecipes = recipes.length;
        for (let r = 0; r < numRecipes; r++) {
            Log("   " + recipes[r])
        }
        if (validating) {
            Log("Expected recipes:")
            let exNumRecipes = expectedRecipes.length;
            for (let r = 0; r < exNumRecipes; r++) {
                Log("   " + expectedRecipes[r])
            }
        }
    
        // There are 3 flavors of article display:
        //  1) An NYT Cooking recipe - display only article title (== recipe name)
        //  2) An article from a date search or a testcase file - display all 
        //      components
        //  3) A Validate deviation - display small-font recipe lists,  both
        //      discovered and expected
        if (article.link.includes("cooking.nytimes.com")) {
            // For an NYT Cooking recipe ...

            // Create an article title component without a Search All button 
            let [articleTitle] = createArticleTitle(articleTitleContent);

            // Add the article title component to the browser window
            aL.appendChild(articleTitle);
    
        } else if (!validating) {
            // For date search and testcase file results ...
    
            let content;
            if (numRecipes > 1) {
                // If there are multiple recipes, the article title will be 
                //  followed by a Search All button
                content = articleTitleSearchAllContent
            } else {
                content = articleTitleContent
            }
    
            // Create an article title component
            let [articleTitle, articleContainer] = createArticleTitle(content);
    
            if (numRecipes > 1) {
                // If necessary, add info to the Search All button element
                //  and add a click event listener
                let searchAllButton = articleTitle.querySelector("button");
                searchAllButton.dataset.title = JSON.stringify(recipes);
                searchAllButton.dataset.author = article.author;
                searchAllButton.disabled = true;
                searchAllButton.addEventListener("click", recipeSearch, false);
            }

            // Add the author name to the article title component
            [articleTitle] = createAuthor(articleTitle, article.author);

            // Add the article title component to the browser window
            aL.appendChild(articleTitle);

            // Create recipe name lists: small-font names and names with Search buttons
            recipeList = createRecipeLists(recipes);

            // Append those lists to the article
            articleContainer.appendChild(recipeList);
    
        
    
        } else {
            // For Validate deviations ...

            // Create an article title component 
            let [articleTitle, articleContainer] = createArticleTitle(articleTitleContent);

            // Append the article title component to the browser window
            aL.appendChild(articleTitle);
 
            // Create a small-font list of the unexpected recipe names with the error background,
            //  no recipe name/Search button combinations
            recipeList = createRecipeLists(recipes, {addRecipeSearchButtons: false, error: true});
    
            // Append that small-font list to the article
            articleContainer.appendChild(recipeList);

            // Create a small-font list of the expected recipe names,
            //  no recipe name/Search button combinations
            recipeList = createRecipeLists(expectedRecipes, {addRecipeSearchButtons: false});

            // Append that small-font list to the article
            articleContainer.appendChild(recipeList);
    
        }
    
        Log("function displayArticle exiting")
    
    }

    // Parse args
    let [article, recipes, type, expectedRecipes] = args

    // Convert article to array
    article = JSON.parse(article);

    // Display the article and its recipes 
    displayArticle( article, recipes, type, expectedRecipes );

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

        // Show reset button
        showReset();

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

        // Send the date to process to the main process
        window.electron.send('process-date', dateToSearch)

    }

}

// Initialize browserWindow and set event listeners
Mainline();
