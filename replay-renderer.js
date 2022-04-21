// This file is required by the getArticle.html file and will
// be executed in the renderer process for that window.
// No Node.js APIs are available in this process.

// Code structure:

// Define DOM elements used 
const seqNum = document.getElementById('seq');
const replayButton = document.getElementById('replayButton');
const testcaseSwitch = document.getElementById('testcase')
const dateP = document.getElementById('dateP');
const articleTitleP = document.getElementById('articleTitle');
const expectedRecipesTA = document.getElementById('expectedRecipes');
const hasArticleClassCB = document.getElementById('hasArticleClass');
const hasTitlePunctCB = document.getElementById('hasTitlePunct');
const isNotSolvedCB = document.getElementById('isNotSolved');
const hasFragmentedTitleCB = document.getElementById('hasFragmentedTitle');
const hasUnquantifiedIngredientCB = document.getElementById('hasUnquantifiedIngredient');

async function mainline() {

    seqNum.focus()

    replayButton.addEventListener('click', async (evt) => {
        evt.preventDefault();
        console.log(seqNum.value)
        console.log("Testcase: " + testcaseSwitch.checked)

        let result = await window.replay.invoke('replay', [seqNum.value, 'articles', testcaseSwitch.checked]);
        let articleInfo = JSON.parse(result)

        // Set the title
        articleTitleP.innerText = articleInfo.rawTitle;

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

        seqNum.value = ''
        seqNum.focus()

    })

}

mainline()