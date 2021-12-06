// Author version

const { ipcRenderer } = require('electron'); // InterProcess Communications
const { clipboard } = require('electron');  // System clipboard API

const recipesDiv = document.getElementById("recipes");
const authorP = document.getElementById("author");
const clearButton = document.getElementById("clearButton");
const stopButton = document.getElementById("stopButton");
const closeButton = document.getElementById("closeButton");
const mL = document.getElementById('msgs');

var sections;       // Array of <section> elements
var sectionIDs;     // Array of <section> element IDs
var sectionNeedsGrid;   // Array of booleans



// Function definiitions//

function addRecipeDiv(name) {

    let nameHash = name.hashCode();

    let recipeDiv = document.createElement('div');
    recipeDiv.id = nameHash;

    let nameDiv = document.createElement('div');
    nameDiv.classList = 'divider text-left';
    nameDiv.dataset.content = name;

    let sectDiv = document.createElement('div');
    sectDiv.classList = "pl-2 ml-2";

    let exactH6 = document.createElement('h6');
    exactH6.textContent = 'Exact match';

    let fuzzyH6 = document.createElement('h6');
    fuzzyH6.textContent = 'Fuzzy match';

    let exactSect = document.createElement('section');
    exactSect.classList = 'recipe-card-list track-card-params';
    //exactSect.dataset.layout = 'grid';
    exactSect.id = nameHash + "exact"

    let fuzzySect = document.createElement('section');
    fuzzySect.classList = 'recipe-card-list track-card-params';
    //fuzzySect.dataset.layout = 'grid';
    fuzzySect.id = nameHash + "fuzzy"

    sectDiv.appendChild(exactH6);
    sectDiv.appendChild(exactSect);
    sectDiv.appendChild(fuzzyH6);
    sectDiv.appendChild(fuzzySect)

    recipeDiv.appendChild(nameDiv);
    recipeDiv.appendChild(sectDiv)
    recipesDiv.appendChild(recipeDiv);
}

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
    //          target recipe name

    // Create a hash of the target recipe name, which will be used to display the recipe
    //  in the appropriate location
    let nameHash = args[2].hashCode();
    let displaySection = nameHash + args[1];
    console.log("Display: " + args[2] + " at " + displaySection)
    let displaySectionIndex = sectionIDs.indexOf(displaySection);

    let section = sections[displaySectionIndex];

    if (sectionNeedsGrid[displaySectionIndex]) {
        section.dataset.layout = 'grid';
        sectionNeedsGrid[displaySectionIndex] = false;
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

String.prototype.hashCode = function(){
	var hash = 0;
	if (this.length == 0) return hash;
	for (i = 0; i < this.length; i++) {
		char = this.charCodeAt(i);
		hash = ((hash<<5)-hash)+char;
		hash = hash & hash; // Convert to 32bit integer
	}
	return hash;
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
    let [author, name, all] = searchArgs;
    console.log("author: " + author);
    console.log("name: " + name)
    console.log("all: " + all)

    if (all) {
        searchFor = "multiple recipes"
    } else (
        searchFor = name[0]
    )

    authorP.innerHTML  = "Searching for: " + searchFor + "<br>by " + searchArgs[0];

    for (let i = 0; i < name.length; i++) {
        addRecipeDiv(name[i]);
    }

    console.log("Gather sections")
    sections = document.getElementsByTagName('section')
    console.log("Number of sections: " + sections.length.toString())
    sectionIDs = [];
    sectionNeedsGrid = [];
    for (let i = 0; i < sections.length; i++) {
        sectionNeedsGrid.push(true);
        sectionIDs.push(sections[i].id);
        console.log("SectionID: " + sections[i].id)
    }

    ipcRenderer.on("set-name", (evt, searchArgs) => {
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