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
//    fuction removeOr
//    fucntion showReset
//    function elementClick
//    function articleOpen
//    function recipeSearch
//    function createArticleTitle
// 
//   window.electron.onDisplaySpinner
//   window.electron.onProgressBar
//    function addProgress
//   window.electron.onKeywordDiv
//   window.electron.onProcessEnd
//   window.electron.onArticleSave
//     function displayArticleForCopy
//          function displayArticle
//              function createAuthor
//              function createRecipeLists
//     function saveArticle
//     function articleView
//   window.electron.onArticleDisplay
//    function displayArticle
//      function createAuthor
//          authorP EventListener for click => elementClick
//      function createRecipeLists
//          recipeListSmall EventListener for click => elementClick
//          recipeListSmall parent EventListener for click => elementClick
//          searchButton EventListener for click => recipeSearch
//      searchAllButton EventListener for click => recipeSearch
//   window.electron.onEnableSearchButtons
//   window.electron.onEnableSaveButtons
//   window.electron.onCaptchaDetected
//   window.electron.onCaptchaSolved
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
const progDiv = document.getElementById('Pbar'); // progress bar div
const aL = document.getElementById('aList');    // articles list div

let debug = true;
let expectedChanged = false;    // Expected recipes initially not changed
let complete;                   // Value of lastStoredDateObj.complete

// Article save template content
let articleSaveContent = document.getElementById("article-save").content;

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
        window.electron.send('write-HTML', classlessArticleNode.outerHTML.replace(' class=""', "" ));
    } else if (evt.target.tagName == "SMALL") {
        window.electron.send('write-HTML', evt.target.outerHTML);
    } else if (evt.target.tagName == "P" ) {
        window.electron.send('write-text', evt.target.innerText);
    } else if (evt.target.tagName == "DIV" ) {
        window.electron.send('write-HTML', evt.target.firstElementChild.outerHTML);
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

function createArticleTitle(articleTitleContent, type, title, url) {
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
    //let articleContainer = articleTitle.querySelector(".container");

    // Identify the divider element and set its content to the
    //  article type
    let articleDivider = articleTitle.querySelector(".divider");
    articleDivider.setAttribute('data-content', type);

    // Identify the article title <a> element, set its
    //  href attribute and text content, and add event listeners
    let articleA = articleTitle.querySelector("a");
    articleA.setAttribute('href', url);
    articleA.textContent = title;
    articleA.addEventListener("click", elementClick, false);
    articleA.addEventListener("contextmenu", articleOpen, false);

    Log("function createArticleTitle exiting")
    //return [articleTitle, articleContainer]

    return [articleTitle]

}

window.electron.onDisplaySpinner( () => {
    // Add a throbber to the page while this app clicks "More" buttons to get the full 
    //  search results
    let loading = document.createElement("div");
    loading.classList = "loading float-left ml-2 mt-2"
    loading.id = "spinner";
    mL.appendChild(loading);
})

window.electron.onRemoveSpinner( () => {
    // Remove the throbber
    let spinner = document.getElementById("spinner");
    spinner.remove();
    remvAllMsg()
})


window.electron.onProgressBar( (args) => {
    // Add or update a progress bar showing the articles searched

    function addProgress(now,max) {
        // Input:   now - number of articles retrieved
        //          max - number of articles to be retrieved
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
    let firstTime = args[2];

    // Probably no spinner in restructured version
    // // Remove the spinner
    // mL.removeChild(mL.lastChild);

    if (firstTime) {
        // First time, insert a progress bar

        // Create a "Examining n ... articles" <p> element
        let progPara = document.createElement("p");
        progPara.classList = "pr-2 pt-2 float-left m-0 Pbar";
        let txt = "Examining " + args[1] + " articles for recipes…";
        let txnd = document.createTextNode(txt);
        progPara.appendChild(txnd);

        // Add the <p> element and a <progress> element to the float-left div
        progDiv.appendChild(progPara);
        progDiv.appendChild(addProgress(curr,max));

    } else {
        // Subsequently, replace the <progress> element

        progDiv.removeChild(progDiv.lastChild);       // Remove the <progress> element
        progDiv.appendChild(addProgress(curr,max));   // and add an updated one
    }
})

window.electron.onShowMsg( (msg, remove = true) => {
    // Display a message
    Log("show-msg received:");

    // Remove previous messages, conditionally
    if (remove) {
        remvAllMsg()
    }
    
    addMsg(mL, msg)

})

window.electron.onKeywordDiv( (arg) => {
    // At the beginning of a keyword seach, add a message identifying the keyword
    Log("keyword-div received: " + arg);

    // Add the divider
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

    // And enable all Save buttons
    let saveButtons = document.getElementsByClassName("disen");
    for(let i = 0; i < saveButtons.length; i++) {
        saveButtons[i].disabled = false;
    }

})

window.electron.onArticleSave( (arg) => {
    // Add an article and its discovered recipes to the window
    // Input: stringified articleInfo object

    async function displayArticleForCopy(articleResponse, articleInfo, enclosingDiv) {
        // Display an article and its recipes
        // Input:   articleObj,
        //          article recipes,
        //          article type
        //          (optional) expected results
        // Input:   articleResponse,
        //          articleInfo,
        //          enclosingDiv
        Log("displayArticleForCopy entered");
        
        function displayArticle(articleResponse, articleInfo, enclosingDiv) {
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
                        searchButton.dataset.author = articleInfo.author;
                        //searchButton.disabled = true;
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
            Log("  title; " + articleInfo.title)
            Log("  author: " + articleInfo.author)
            Log("  href:" + articleInfo.URL)

            if (articleResponse.isNotSolved) {
                recipes = articleResponse.expectedRecipes.split("\n")
            } else {
                recipes = articleInfo.recipes.split("\n")
            }
            let numRecipes = recipes.length;
        
            // There are 3 flavors of article display:
            //  1) An NYT Cooking recipe - display only article title (== recipe name)
            //  2) An article from a date search or a testcase file - display all 
            //      components
            //  3) A Validate deviation - display small-font recipe lists,  both
            //      discovered and expected
            if (articleInfo.URL.includes("cooking.nytimes.com")) {
                // For an NYT Cooking recipe ...
    
                // Create an article title component without a Search All button 
                let [articleTitle] = createArticleTitle(articleTitleContent, articleInfo.type, articleInfo.title, articleInfo.URL);
    
                // Add the article title component to the browser window
                encl.appendChild(articleTitle);
        
            } else {
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
                let [articleTitle, articleContainer] = createArticleTitle(content, articleInfo.type, articleInfo.title, articleInfo.URL);
        
                if (numRecipes > 1) {
                    // If necessary, add info to the Search All button element
                    //  and add a click event listener
                    let searchAllButton = articleTitle.querySelector("button");
                    searchAllButton.dataset.title = JSON.stringify(recipes);
                    searchAllButton.dataset.author = articleInfo.author;
                    //searchAllButton.disabled = true;
                    searchAllButton.addEventListener("click", recipeSearch, false);
                }
    
                // Add the author name to the article title component
                [articleTitle] = createAuthor(articleTitle, articleInfo.author);
    
                // Add the article title component to the browser window
                enclosingDiv.appendChild(articleTitle);
    
                // Create recipe name lists: small-font names and names with Search buttons
                recipeList = createRecipeLists(recipes);
    
                // Append those lists to the article
                enclosingDiv.appendChild(recipeList);

            }
        
            Log("function displayArticle exiting")
        
        }
    
        // Display the arse args
        displayArticle( articleResponse, articleInfo, enclosingDiv );
    
    }

    async function saveArticle(evt) {
        // Called when a Save button is clicked.
        // Create an articleResponse object that specifies changes to the 
        //  articleInfo object passed to the renderer process via
        //  onArticleDisplay.
        // Invoke 'save-article' in the main process, passing the 
        //  articleResponse object
        evt.preventDefault();
        console.log('saveArticle entered')

        let articleInfoString = evt.target.dataset.articleInfo;    
        let articleInfo = JSON.parse(articleInfoString)
        console.log("articleInfo stringified: " + articleInfoString)
    
        // Set these values assuming the discovered recipes are correct
        let isNotSolved = false;
        let expectedRecipes = null;
    
        // But if the discovered recipes were changed, change those values
        if (expectedChanged) {
            console.log("expectedChanged true")
            if (articleInfo.recipes != expectedRecipesTA.value) {
                console.log("Discovered and expected recipes differ")
                isNotSolved = true;
                expectedRecipes = expectedRecipesTA.value
            }
        }
    
        // Create the articleResponse object
        let articleResponse = {
            hasArticleClass: hasArticleClassCB.checked,
            hasTitlePunct: hasTitlePunctCB.checked,
            isNotSolved: isNotSolved,
            hasFragmentedTitle: hasFragmentedTitleCB.checked,
            hasUnquantifiedIngredient: hasUnquantifiedIngredientCB.checked,
            expectedRecipes: expectedRecipes
        }
    
        console.log("saveArticle:")
        console.log(articleResponse)
    
        console.log("Stringified:")
        console.log(JSON.stringify(articleResponse))
    
        // Save the article to the database.
        // Invoke the main process handler for 'save-article', passing the
        //  articleResponse object and the related articleInfo object,
        //  and wait for its completion.
        let result = await window.electron.saveArticle([JSON.stringify(articleResponse), articleInfoString])
        console.log(result)

        let enclosingDivIDSelector = "#id" + articleInfo.seq.toString();
        let enclosingDiv = document.querySelector(enclosingDivIDSelector);
        while (enclosingDiv.firstChild) {
            enclosingDiv.removeChild(enclosingDiv.lastChild);
        }

        console.log("typeof articleInfo: " + typeof articleInfo)
        console.log(JSON.stringify(articleInfo))

        await displayArticleForCopy(articleResponse, articleInfo, enclosingDiv)       

    }

    async function articleView (evt) {
        // Click event handler for viewButton
        //  IPC send to open article in Chrome

        evt.preventDefault();
        console.log('articleView entered')

        let url = evt.target.dataset.url;
        console.log("url: " + url)
        // Validate URL - open only nytimes.com URLs
        let chkHostUrl = new URL(url);
        if (chkHostUrl.hostname.endsWith('nytimes.com')) {
            window.electron.send('article-open', url);
        } else {
            window.electron.send("dialog-error", 
                ['Invalid URL', 'The hostname of \n\n' + url + '\n\n does not end with nytimes.com'])
         }
    }


    Log("onArticleSave entered");
    console.log("arg (articleInfo):")
    console.log(arg)

    let articleInfo = JSON.parse(arg)

    let articleSave = articleSaveContent.cloneNode(true);

    let enclosingDiv = articleSave.querySelector("div")
    enclosingDiv.id = "id" + articleInfo.seq.toString()


    // Identify the divider element and set its content to the
    //  article type
    let articleDivider = articleSave.querySelector(".divider");
    articleDivider.setAttribute('data-content', articleInfo.type);

    let articleTitleTA = articleSave.querySelector("#articleTitle")
    articleTitleTA.innerText = "Seq: " + articleInfo.seq.toString() + ",   " + articleInfo.date + " Article: " + articleInfo.rawTitle;

    let expectedRecipesTA = articleSave.querySelector("#expectedRecipes");


    // Listen for input in the expected recipes textarea
    expectedRecipesTA.addEventListener('input', () => {
        // On expected recipes textarea input ...
        console.log("expectedRecipes changed")

        // Indicate that the recipes might have been changed
        expectedChanged = true;
    })

    // Adjust the depth of the recipes textarea
    expectedRecipesTA.rows = articleInfo.recipes.split('\n').length;

    // Set the discovered recipes and indicate that they haven't 
    //  been changed yet
    expectedRecipesTA.value = articleInfo.recipes;
    expectedChanged = false;

    let hasArticleClassCB =  articleSave.querySelector("#hasArticleClass");
    let hasTitlePunctCB =  articleSave.querySelector("#hasTitlePunct");
    let hasFragmentedTitleCB =  articleSave.querySelector("#hasFragmentedTitle");
    let hasUnquantifiedIngredientCB =  articleSave.querySelector("#hasUnquantifiedIngredient");

    // Set the checkboxes
    if (articleInfo.hasArticleClass) {
        hasArticleClassCB.checked = true;
    } else {
        hasArticleClassCB.checked = false;
    }
    if (articleInfo.hasTitlePunct) {
        hasTitlePunctCB.checked = true;
    } else {
        hasTitlePunctCB.checked = false;
    }
    if (articleInfo.hasFragmentedTitle) {
        hasFragmentedTitleCB.checked = true;
    } else {
        hasFragmentedTitleCB.checked = false;
    }
    if (articleInfo.hasUnquantifiedIngredient) {
        hasUnquantifiedIngredientCB.checked = true;
    } else {
        hasUnquantifiedIngredientCB.checked = false;
    }

    let saveButton = articleSave.getElementById('saveButton');
    saveButton.disabled = true;
    saveButton.dataset.articleInfo = JSON.stringify(articleInfo);
    saveButton.addEventListener('click', saveArticle, false);

    let viewButton = articleSave.getElementById('viewButton');
    viewButton.disabled = true;
    viewButton.dataset.url = articleInfo.URL;
    viewButton.addEventListener('click', articleView, false);

    aL.appendChild(articleSave);



})

window.electron.onArticleDisplay( (args) => {
    // Display an article and its recipes
    // Input:   articleObj,
    //          article type
    //          (optional) expected results
    Log("onArticleDisplay entered");

    function displayArticle(artObj, type, expectedRecipes) {
        // Append the components of an article display to the browserWindow
        // - Article title {Search All}
        // - {Author}
        // - {small-font recipe name list}
        // - {Recipe name Search} (possibly repeated)
        // Input:   - articleObj
        //          - article type (e.g. Article, Tasting, cooking.nytimes.com, etc)
        //          - array of expected recipe names (optional, implies Validate)
        Log("function displayArticle entered")

        // 
        /// Function definitions
        //
        
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
                    searchButton.dataset.author = artObj.author;
                    //searchButton.disabled = true;
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
        Log("  title; " + artObj.title)
        Log("  author: " + artObj.author)
        Log("  href:" + artObj.link)
        Log("article: " + JSON.stringify(artObj))
    
        // Just to be clear, (expectedRecipes != null) => Validate button clicked
        if (expectedRecipes != null) {
            validating = true;
        } else {
            validating = false
        }

        let recipes = [artObj.title]
        let recipeList

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
        if (artObj.link.includes("cooking.nytimes.com")) {
            // For an NYT Cooking recipe ...

            // Create an article title component without a Search All button 
            let [articleTitle] = createArticleTitle(articleTitleContent, type, artObj.title, artObj.link);

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
            let [articleTitle, articleContainer] = createArticleTitle(content, type, artObj.title, artObj.link);
    
            if (numRecipes > 1) {
                // If necessary, add info to the Search All button element
                //  and add a click event listener
                let searchAllButton = articleTitle.querySelector("button");
                searchAllButton.dataset.title = JSON.stringify(recipes);
                searchAllButton.dataset.author = artObj.author;
                //searchAllButton.disabled = true;
                searchAllButton.addEventListener("click", recipeSearch, false);
            }

            // Add the author name to the article title component
            [articleTitle] = createAuthor(articleTitle, artObj.author);

            // Add the article title component to the browser window
            aL.appendChild(articleTitle);

            // Create recipe name lists: small-font names and names with Search buttons
            recipeList = createRecipeLists(recipes);

            // Append those lists to the article
            articleContainer.appendChild(recipeList);
    
        
    
        } else {
            // For Validate deviations ...

            // Create an article title component 
            let [articleTitle, articleContainer] = createArticleTitle(articleTitleContent, type, artObj.title, artObj.link);

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
    let [articleObjString, type, expectedRecipes] = args

    // Convert article to array
    let articleObj = JSON.parse(articleObjString);

    // Display the article and its recipes 
    displayArticle(articleObj, type, expectedRecipes);

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

// Enable savehButtons on completion of index.js function
window.electron.onEnableSaveButtons( () => {
    Log("enable-saveButtons received")

    // Enable all Search buttons
    let saveButtons = document.getElementsByClassName("disen");
    for(let i = 0; i < saveButtons.length; i++) {
        saveButtons[i].disabled = false;
    }

    // Enable the Start button
    //startButton.disabled = false;

})


// On captcha detected, add a message and a button whose click indicates that the 
//  captcha was solved
window.electron.onCaptchaDetected( () => {
    Log("captcha-detected received")

    // Create a <p> element
    let captchaP = document.createElement('p');
    captchaP.classList.add("text-warning", "msg");

    // Add 'Captcha detected!' to the <p> element
    let txnd = document.createTextNode('Captcha detected!');
    captchaP.appendChild(txnd);

    // Insert the <p> element at the beginning of the msgs div
    mL.prepend(captchaP)

})

// On captcha solved, remove the 'Captcha detected' message
window.electron.onCaptchaSolved( () => {
    Log("captcha-solved received")

    // Remove the captcha detected mesage and the Solved button
    let msgs = mL.children;
    for (let m = 0; m<msgs.length; m++) {
        if (msgs[m].classList.contains('text-warning')) {
            msgs[m].remove()
        }
    }

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

    // Ask main process for the next date to search; set the input date picker 
    //  to that date
    let nextDateObjString = await window.electron.getNextDate();
    let nextDateObj = JSON.parse(nextDateObjString)
    let nextDate = nextDateObj.nextDate
    complete = nextDateObj.complete
    Log("nextDate: " + nextDate);
    dateInput.value = nextDate;

    if (complete) {

        // Validate input date: Sunday or Wednesday
        if (valDate(nextDate) < 0) {
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

    } else {

        startButton.disabled = true;
        dateInput.disabled = true;

        // Get the selected date (yyyy-mm-dd)
        let dateToSearch = dateInput.value;

        // Send the date to process to the main process
        window.electron.send('process-date', dateToSearch)

    }

    async function processDate() {
        // Process a date

        // Disable the Start button
        startButton.disabled = true;
        dateInput.disabled = true;

        // Show reset button
        //showReset();

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
