// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// No Node.js APIs are available in this process.

// Code structure:
//
//   Mainline
//    Launch Puppeteer
//    EventListener handler for Start button

const { ipcRenderer } = require('electron'); // InterProcess Communications
const { clipboard } = require('electron');  // System clipboard API

let dateInput = document.getElementById('dateSpec');
let startButton = document.getElementById('startButton');
let writeSwitch = document.getElementById('writeSwitch');
const mL = document.getElementById('msgs');     // messages list div
const aL = document.getElementById('aList');     // messages list div

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

ipcRenderer.on('display-spinner', () => {
    let loading = document.createElement("div");
    loading.classList = "loading float-left ml-2"
    loading.id = "spinner";
    mL.appendChild(loading);
})


ipcRenderer.on('progress-bar', (e, args) => {
    // Add or update a progress bar showing the articles searched

    function addProgress(now,max) {
        // Input:   now - number of articles retrieved
        //          max - number of articles to be retrieved
        //          searchDomain - 'x section' or 'x keyword' being searched
        // return a <progress> element
    
        Log("addProgress arguments: " + now.toString() + ", " + max.toString())
        ipcRenderer.send('mainAOT', true)
    
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
        let txt = "Searching " + args[1] + " " + searchDomain + " articles for recipes…";
        let txnd = document.createTextNode(txt);
        progPara.appendChild(txnd);

        // Add the <p> element and a <progress> element to the float-left div
        progDiv.appendChild(progPara);
        progDiv.appendChild(addProgress(curr,max));

        // Add the float-left div to the messages div
        mL.removeChild(mL.lastChild); 
        mL.appendChild(progDiv);
    } else {
        // Subsequently, replace the <progress> element
        let progDiv = document.getElementById('Pbar')
        progDiv.removeChild(progDiv.lastChild);       // Remove the <progress> element
        progDiv.appendChild(addProgress(curr,max));   // and add an updated one
    }
})

ipcRenderer.on('keyword-div', (e, args) => {
    Log("keyword-div received: " + args[0])
    // Remove the existing progress bar
    try {
        document.getElementById('Pbar').remove();
    } catch {
        mL.removeChild(mL.lastChild); 
        console.log("No progress-bar")
    }
    // Add an keyword divider
    let keywDiv = document.createElement("div");
    keywDiv.className = "keywDiv";
    let divDiv = document.createElement("div");
    divDiv.className = "keydiv divider text-left";
    divDiv.setAttribute('data-content', args[0]);
    keywDiv.appendChild(divDiv)
    aL.appendChild(keywDiv)

})

ipcRenderer.on('process-end', (e, args) => {
    Log("process-end received")
    document.getElementById('Pbar').remove();
    startButton.disabled = false;
    dateInput.disabled = false;

    // Enable all Search buttons
    let searchButtons = document.getElementsByClassName("disen");
    for(let i = 0; i < searchButtons.length; i++) {
        searchButtons[i].disabled = false;
    }

})

ipcRenderer.on('article-display', (e, args) => {

    function elementClick (evt) {
        // Click event handler for recipes (<article> elements)
        //  Form link element for recipe and write to clipboard
        Log("Element clicked");
        evt.preventDefault();
        console.log("Element: " + evt.target.tagName);
        if (evt.target.tagName == "A" || evt.target.tagName == "SMALL") {
            clipboard.writeHTML(evt.target.outerHTML);
        } else if (evt.target.tagName == "P" ) {
            clipboard.writeText(evt.target.innerText);
        } else if (evt.target.tagName == "DIV" ) {
            clipboard.writeHTML(evt.target.firstChild.outerHTML);
        } else {
            console.log("Element not recognized")
        }
    }

    function recipeSearch (evt) {
        evt.preventDefault();
        //let title = evt.target.previousSibling.innerText;
        let title = evt.target.dataset.title;
        console.log("recipeSearch entered for " + title)
        //let author = evt.target.parentNode.parentNode.parentNode.childNodes[1].innerText;
        let author = evt.target.dataset.author;
        console.log("Author: " + author)

        // Disable all Search buttons
        let searchButtons = document.getElementsByClassName("disen");
        for(let i = 0; i < searchButtons.length; i++) {
            searchButtons[i].disabled = true;
        }

        // Disable the Start button
        startButton.disabled = true;

        ipcRenderer.send('author-search', [author, title])
    }

    function displayArticle(article, recipes, type) {
        console.log("Display article and recipes:");
        console.log("  " + article.title)
        console.log("  " + author)
        for (r in recipes) {
            console.log("   " + recipes[r])
        }

        // Add an 'Article' divider
        let divDiv = document.createElement("div");
        divDiv.className = "divider text-left artdiv";
        divDiv.setAttribute('data-content', type);
        aL.appendChild(divDiv)

        let artDiv = document.createElement("div");
        artDiv.className = "ml-1";

        // Add an <a> element for the article
        let articleA = document.createElement("a");
        articleA.setAttribute('href', article.link);
        articleA.textContent = article.title;
        artDiv.appendChild(articleA);
        artDiv.lastChild.addEventListener("click", elementClick, false);

        if (!article.link.includes("cooking.nytimes.com")) {
            // If the article does not link to cooking.nytimes.com,
            //  add author and recipes elements

            let Author = document.createElement("p");
            Author.className = "mb-0"
            Author.textContent = article.author;
            artDiv.appendChild(Author);
            artDiv.lastChild.addEventListener("click", elementClick, false);

            let recipesDiv = document.createElement("div");
            recipesDiv.className = "bg-secondary columns col-9 ml-0 mb-2 mt-1"
            let Recipes = document.createElement("small");
            let recipesSearchDiv = document.createElement("div");

            let clearDiv = document.createElement("div");
            clearDiv.className = "clearDiv";

            console.log("Number of recipes: " + recipes.length.toString());
            for (i = 0; i<recipes.length; i++) {
                console.log("Recipe: " + i.toString());
                if (recipes[i] == "Recipe Name not found") {
                    Log("Name not found skipped");
                    continue;
                }
                Recipes.appendChild(document.createTextNode(recipes[i]))
                if (i < recipes.length-1) {
                    console.log("Add linbreak: " + i.toString())
                    let linebreak = document.createElement("br");
                    Recipes.appendChild(linebreak);
                }
                let recipeSearchDiv = document.createElement("div");
                recipeSearchDiv.className = "float-left mb-1";
                let searchRecipe = document.createElement("p");
                searchRecipe.classList = "float-left mb-0 srchArt"
                searchRecipe.textContent = recipes[i];

                let searchButton = document.createElement("button");
                searchButton.classList = "btn float-left btn-sm ml-2 disen"
                searchButton.textContent = "Search";
                searchButton.dataset.title = recipes[i];
                searchButton.dataset.author = article.author;
                searchButton.disabled = true;
                recipeSearchDiv.appendChild(searchRecipe);
                recipeSearchDiv.appendChild(searchButton);
                recipeSearchDiv.lastChild.addEventListener("click", recipeSearch, false);
                recipesSearchDiv.appendChild(recipeSearchDiv);
                let clearDiv = document.createElement("div");
                clearDiv.className = "clearDiv";
                recipesSearchDiv.appendChild(clearDiv);
            }
            recipesDiv.appendChild(Recipes)
            artDiv.appendChild(recipesDiv)
            artDiv.lastChild.addEventListener("click", elementClick, false);

            artDiv.appendChild(recipesSearchDiv);
        }

        aL.appendChild(artDiv)

    }

    let article = JSON.parse(args[0]);
    author = article.author;
    let recipes = args[1];
    let type = args[2];
    displayArticle( article, recipes, type );

})

//Enable searchButtons on completion of index.js function authorSearch
ipcRenderer.on('enable-searchButtons', (e, args) => {
    Log("enable-searchButtons received")

    // Enable all Search buttons
    let searchButtons = document.getElementsByClassName("disen");
    for(let i = 0; i < searchButtons.length; i++) {
        searchButtons[i].disabled = false;
    }

    // Enable the Start button
    startButton.disabled = false;

})

// Mainline function
async function Mainline() {
    console.log("Entered Mainline");

    // Ask main process for the last searched date set the input date picker 
    //  to that date
    let lastDate = await ipcRenderer.invoke('getLastDate');
    Log("lastDate: " + lastDate);
    dateInput.value = lastDate;

    // Launch Puppeteer
    // await launchPup();
    // await connectPup()

    // Listen for input event in the date picker
    dateInput.addEventListener('input', validateDate);

    function validateDate(e) {
        Log("validateDate entered")
        let day = new Date( e.target.value ).getUTCDay();
        Log("Day (0-6) selected: " + day.toString())
        if (![0, 3].includes(day)) {
            e.target.classList.add("is-error");
        } else {
            e.target.classList.remove("is-error");
        }
    }
    
    // Listen for a click of the Start button, then call function processDate 
    startButton.addEventListener('click', processDate)

    // When the date is changed, enable the Start button
    dateInput.addEventListener("change", () => {
        startButton.disabled = false;
    }, false);

    async function processDate() {

        // Disable the Start button
        startButton.disabled = true;
        dateInput.disabled = true;

        // Remove any previous messages
        remvAllMsg();

        // Remove previous articles
        while (aL.firstChild) {
            aL.removeChild(aL.lastChild);
        }

        // Set displayed URLs to empty
        displayedURLs = [];

        //let pages = await browser.pages();
        //console.log("Pages: " + pages.length.toString())
        //for (let j = 2; j < pages.length; j++) {
        //    await pages[j].close()
        //} 

        // Get the selected date (yyyy-mm-dd)
        let dateToSearch = dateInput.value;
        let switchValue = writeSwitch.checked;

        // Send the date to search to the main process
        //ipcRenderer.send('process-date', dateToSearch);
        ipcRenderer.send('process-date', [dateToSearch, switchValue])

        // Tell the main process to record the last searched date
        //ipcRenderer.send('new-date', dateToSearch);

    }

}

Mainline(); // Launch puppeteer and add event listener for Start button