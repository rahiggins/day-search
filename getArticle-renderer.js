// This file is required by the getArticle.html file and will
// be executed in the renderer process for that window.
// No Node.js APIs are available in this process.

// Code structure:

// Define DOM elements used
const mL = document.getElementById('msgs');     // messages list div
const dateP = document.getElementById('dateP');
const articleTitleP = document.getElementById('articleTitle');
const expectedRecipesTA = document.getElementById('expectedRecipes');
const hasArticleClassCB = document.getElementById('hasArticleClass');
const hasTitlePunctCB = document.getElementById('hasTitlePunct');
const isNotSolvedCB = document.getElementById('isNotSolved');
const hasFragmentedTitleCB = document.getElementById('hasFragmentedTitle');
const hasUnquantifiedIngredientCB = document.getElementById('hasUnquantifiedIngredient');
const skipButton = document.getElementById('skipButton');
const saveButton = document.getElementById('saveButton');
const saveQuitButton = document.getElementById('saveQuitButton');
const quitButton = document.getElementById('quitButton');

// Global variables
let articleInfo;                // Article information object passed to the
//                                  article-display handler

let debug = true;               // Write to console.log if true
let expectedChanged = false;    // Expected recipes initially not changed                
let lastDate = null;            // First time value for lastDate

// Establish button event listeners
skipButton.addEventListener('click', processClick, false);
saveButton.addEventListener('click', processClick, false);
saveQuitButton.addEventListener('click', processClick, false);
quitButton.addEventListener('click', processClick, false);


// Function definitions

function Log (text) {
    // If debugging, write text to console.log
    if (debug) {
        console.log(text)
    }
}

async function saveArticle() {
    // Called when a Save button is clicked.
    // Create an articleResponse object that specifies changes to the 
    //  articleInfo object passed to the renderer process via
    //  onArticleDisplay.
    // Invoke 'save-article' in the main process, passing the 
    //  articleResponse object

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
        //hasArticleClass: articleInfo.hasArticleClass,
        hasArticleClass: hasArticleClassCB.checked,
        //hasTitlePunct: articleInfo.hasTitlePunct,
        hasTitlePunct: hasTitlePunctCB.checked,
        isNotSolved: isNotSolved,
        //hasFragmentedTitle: articleInfo.hasFragmentedTitle,
        hasFragmentedTitle: hasFragmentedTitleCB.checked,
        //hasUnquantifiedIngredient: articleInfo.hasUnquantifiedIngredient
        hasUnquantifiedIngredient: hasUnquantifiedIngredientCB.checked,
        expectedRecipes: expectedRecipes
    }
    //if (hasArticleClassCB.checked != articleInfo.hasArticleClass) {
    //    articleResponse.hasArticleClass = hasArticleClassCB.checked
    //}
//
    //if (hasTitlePunctCB.checked != articleInfo.hasTitlePunct) {
    //    articleResponse.hasTitlePunct = hasTitlePunctCB.checked
    //}
//
    //if (hasUnquantifiedIngredientCB.checked != articleInfo.hasUnquantifiedIngredient) {
    //    articleResponse.hasUnquantifiedIngredient = hasUnquantifiedIngredientCB.checked
    //}
//
    //if (hasFragmentedTitleCB.checked != articleInfo.hasFragmentedTitle) {
    //    articleResponse.hasFragmentedTitle = hasFragmentedTitleCB.checked
    //}    

    console.log("saveArticle:")
    console.log(articleResponse)

    console.log("Stringified:")
    console.log(JSON.stringify(articleResponse))

    // Save the article to the database.
    // Invoke the main process handler for 'save-article', passing the
    //  articleResponse object and wait for its completion.
    let result = await window.getA.invoke('save-article', JSON.stringify(articleResponse))
    console.log(result)

}

// Process a button click
function processClick(evt) {
    evt.preventDefault();
    Log(evt.target.id + " clicked");

    // For the button clicked ...
    switch (evt.target.id) {
        case 'saveButton':
            // Save the article to the database and continue with the next
            //  article
            saveArticle()
            window.getA.send('next')
            break;
        case 'quitButton':
            // Quit the app
            window.getA.send('quit')
            break;
        case 'saveQuitButton':
            // Save the article then quit the app
            saveArticle();
            //window.getA.send('next')
            window.getA.send('quit')
            break;
        case 'skipButton':
            // Skip to the next article
            window.getA.send('next')
            break;
    }

}

// Listen for input in the expected recipes textarea
expectedRecipesTA.addEventListener('input', () => {
    // On expected recipes textarea input ...
    console.log("expectedRecipes changed")

    // Indicate that the recipes might have been changed
    expectedChanged = true;
})

window.getA.onArticleDisplay( (arg) => {
    // The main process sent 'article-display'.  The argument passed is
    //  a stringified articleInfo object
    articleInfo = JSON.parse(arg);

    // Set the article date.  If the date is different from the 
    //  previously displayed date, use the warning color.  The app
    //  can be quit cleanly when the previous date's articles have all
    //  been processed.
    dateP.innerText = articleInfo.date;
    if (lastDate == null) {
        lastDate = articleInfo.date;
    } else {
        if (articleInfo.date != lastDate) {
            dateP.classList.add('text-warning')
            lastDate = articleInfo.date;
        } else (
            dateP.classList.remove('text-warning')
        )
    }

    // Set the title
    articleTitleP.innerText = "Seq: " + articleInfo.seq.toString() + ",  Article: " + articleInfo.rawTitle;

    // Adjust the depth of the recipes textarea
    expectedRecipesTA.rows = articleInfo.recipes.split('\n').length;

    // Set the discovered recipes and indicate that they haven't 
    //  been changed yet
    expectedRecipesTA.value = articleInfo.recipes;
    expectedChanged = false;

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

})

// On captcha detected, add a message
window.getA.onCaptchaDetected( () => {
    Log("captcha-detected received")

    // Create a <p> element
    let captchaP = document.createElement('p');

    // Add 'Captcha detected!' to the <p> element
    let txnd = document.createTextNode('Captcha detected!');
    captchaP.appendChild(txnd);
    captchaP.classList.add('text-error')

    // Insert the <p> element at the beginning of the msgs div
    mL.prepend(captchaP)

})

// On captcha solved, remove the 'Captcha detected' message
window.getA.onCaptchaSolved( () => {
    Log("captcha-solved received")

    // Remove messages
    while (mL.firstChild) {
        mL.removeChild(mL.lastChild);
    }
})
