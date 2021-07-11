// Author version

const { ipcRenderer } = require('electron'); // InterProcess Communications
const { clipboard } = require('electron');  // System clipboard API

const authorP = document.getElementById("author");
const clearButton = document.getElementById("clearButton");
const stopButton = document.getElementById("stopButton");
const closeButton = document.getElementById("closeButton");
const mL = document.getElementById('msgs');
const xL = document.getElementById('exact');
const fL = document.getElementById('fuzzy');



// Function definiitions//

function addProgress(now,max) {
    // Add/update a progress bar
    // Called from searchClick
    // Input:   now - number of articles retrieved
    //          max - number of articles to be retrieved
    // return a progress bar element//
    let prog = document.createElement("progress");
    prog.id = "pgProg";
    prog.classList = " progress float-left";
    prog.style.marginTop = "11px"; // aligns progress bar with adjacent text, derived empirically
    prog.max = max;
    prog.value = now;
    return prog;
}

async function displayRecipe(evt, args) {
    // Add a recipe <article> element to the designated section, exact or fuzzy
    // Called from searchClick
    // Input:   <article> element HTML,
    //          display section, "exact" ot "fuzzy"

    let section;
    if (args[1] == "exact") {
        section = xL;
    } else {
        section = fL;
    }

    // Create a template element
    let temp = document.createElement('template');

    // Set the template's HTML to the <article> element's HTML
    temp.innerHTML = args[0];

    // Append the <article> element to the designated section,
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
    //  Stop search by setting continueWithResultsPages to false
    console.log("Clear clicked");
    console.log("evt type: " + typeof evt)
    if (typeof evt == "object") {
        evt.preventDefault();
    }

    while (xL.firstChild) {
        xL.removeChild(xL.lastChild);
    }
    while (fL.firstChild) {
        fL.removeChild(fL.lastChild);
    }
    while (mL.firstChild) {
        mL.removeChild(mL.lastChild);
    }
    clearButton.disabled = true;
    continueWithResultsPages = false;
}

async function stopClick (evt) {
    // Click event handler for Stop button
    //  Send Stop request to main process
    console.log("Stop clicked");
    evt.preventDefault();
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

    // Add EventListener for Search button click Call function searchClick.
    // Add EventListener for Stop button click. Call function stopClick.
    // Add EventListener for Clear button click. Call function clearClick.
    console.log("Mainline: Adding event listener to Search & Clear buttons");
    stopButton.addEventListener("click", stopClick, false);
    clearButton.addEventListener("click", clearClick, false);
    closeButton.addEventListener("click", closeClick, false);

    let searchArgs = await ipcRenderer.invoke('getSearchArgs');
    console.log("Got searchArgs: " + searchArgs);
    authorP.innerHTML  = "Searching for " + searchArgs[1] + "<br>by " + searchArgs[0];

    ipcRenderer.on("set-title", (evt, searchArgs) => {
        console.log("Set searchArgs: " + searchArgs);
        authorP.innerHTML  = "Searching for " + searchArgs[1] + "<br>by " + searchArgs[0];
    })

    ipcRenderer.on('progress-bar', (evt, args) => {

        let processingPage = args[0];
        let pages = args[1];
        if (processingPage == 1) {
            let para = document.createElement("p");
            para.classList = "pr-2 pt-2 float-left m-0 text-tiny";
            let txt = "Searching " + pages.toString() + " result pages... "
            let txnd = document.createTextNode(txt);
            para.appendChild(txnd);
            mL.appendChild(para);
            mL.appendChild(addProgress(processingPage,pages));
        } else {
            mL.removeChild(mL.lastChild);
            mL.appendChild(addProgress(processingPage,pages));
        }
    })

    ipcRenderer.on('no-results', (evt, arg) => {
        while (mL.firstChild) {
            mL.removeChild(mL.firstChild);
        }

        let noResP = document.createElement("p");
        noResP.classList = "text-error m-0 mt-2";
        let txt = "No results" + arg;
        let txnd = document.createTextNode(txt);
        noResP.appendChild(txnd);;
        mL.appendChild(noResP);
    })

    ipcRenderer.on('clear-messages', (evt, arg) => {
        while (mL.firstChild) {
            mL.removeChild(mL.firstChild);
        }
    })

    
    

    ipcRenderer.on('display-recipe', displayRecipe)
    
}

// End of function definitions

Mainline(); // Launch puppeteer and add event listener for Search button