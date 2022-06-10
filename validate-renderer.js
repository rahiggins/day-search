// This file is required by the validate.html file and will
// be executed in the renderer process for that window.
// No Node.js APIs are available in this process.

// Code structure:
//
//  Global variable definitions
//
//  Global function definitions
//      Log
//      Array.prototype.equals
//
//  window.validate.onOkDisplay
//  window.validate.onFinished
//  window.validate.onArticleDisplay
//      function showAttr
//      function createRecipeList
//  window.validate.onArticleSolved

const container = document.getElementById('diff-container')
const okPara = document.getElementById('OK');
const diffContent = document.getElementById('difference').content;
const solvedContent = document.getElementById('solved').content;
const heading1 = document.getElementById('heading1');
const heading2 = document.getElementById('heading2');
const loading = document.getElementById('loading');
let invisible = true;
let debug = true;

function Log (text) {
    // If debugging, write text to console.log
    if (debug) {
        console.log(text)
    }
}

// Define a method to determine if two arrays are equal (https://stackoverflow.com/a/14853974)
// Warn if overriding existing method
if (Array.prototype.equals)
    console.warn("Overriding existing Array.prototype.equals. Possible causes: New API defines the method, there's a framework conflict or you've got double inclusions in your code.");
// attach the .equals method to Array's prototype to call it on any array
Array.prototype.equals = function (array) {
    // if the other array is a falsy value, return
    if (!array) {
      return false;
    }

    // compare lengths - can save a lot of time 
    if (this.length != array.length) {
      return false;
    }        

    for (var i = 0, l=this.length; i < l; i++) {
        // Check if we have nested arrays
        if (this[i] instanceof Array && array[i] instanceof Array) {
            // recurse into the nested arrays
            if (!this[i].equals(array[i])) {
              return false; 
            }                      
        }           
        else if (this[i] != array[i]) {
            // Warning - two different object instances will never be equal: {x:20} != {x:20}
            return false;   
        }           
    } 
    return true;
}
// Hide method from for-in loops (huh?)
Object.defineProperty(Array.prototype, "equals", {enumerable: false});


// When all results are as expected, remove the loading div and
//  say so
window.validate.onOkDisplay( () => {
    loading.remove()
    okPara.textContent = "All results as expected"
})

// When all articles have been validated and some difference were found
//  (and displayed), just remove the loading div
window.validate.onFinished( () => {
    loading.remove()
})

// Display the differences between the current parse of an article and 
//  the parse results stored in the database 
window.validate.onArticleDisplay( (arg) => {
    
    let argsObj = JSON.parse(arg)

    Log("Display seq: " + argsObj.seq.toString())

    // On the first difference display, expose the results headings
    if (invisible) {
        invisible = false;
        heading1.classList.remove('d-invisible');
        heading2.classList.remove('d-invisible');
    }

    // The showAttr function displays results attributes
    function showAttr(attr, label, div, color) {
        // input:   attr -  attribute value
        //          label - attribute name
        //          div -   the div element in which to display the attribute
        //          color - boolean, true for current results, indicating
        //                      that differing results should be colored
        Log("showAttr entered for " + label + ", attr: " + attr + ", color: " + color)

        // Create a <p> element, eliminate its bottom margin and add the 
        //  attribute text
        let p = document.createElement('p');
        p.classList.add('mb-0')
        p.appendChild(document.createTextNode(label + ": " + attr.toString()))

        // If current parse results, color the text red
        if (color) {
            p.classList.add('text-error')
        }

        // Add the <p> element to the page
        div.appendChild(p)
    }   

    // The createRecipeList function displays discovered recipes
    function createRecipeList(array, div, color, improved, comparison) {
        // Input:   array - array of discovered recipe names
        //          div -   the div element in which to display the recipe names
        //          color - boolean, true for current results, indicating
        //                      that differing results should be colored
        //          improved -  only for current results, boolean, true if
        //              the current results are closer to the exprected
        //              results than the database resu;ts
        //          comparison -    only for current results, array:
        //                              [index, currIsMatch, dbIsMatch]
        //                              (see validate.js for more info)
        Log(`createRecipeList entered - color: ${color}, improved: ${improved}`)
        Log("array: " + JSON.stringify(array))
        Log("comparison: " + JSON.stringify(comparison))

        // For each discovered recipe ...
        for (i = 0; i < array.length; i++) {
            Log("Discovered recipe index: " + i.toString())

            // Create a <p> element and set its bottom margin
            var p = document.createElement('p');
            p.classList.add('mb-0')

            // Create a text node comprising the discovered recipe and
            //  append it to the <p> element
            p.appendChild(document.createTextNode(array[i]));


            // If processing a current parse result (color = true),
            //  check if the <p> element should be colored.
            if (color) {
                //console.log("i: " + i.toString())
                //console.log("array[i] != argsObj.dbResult[i])")
                //console.log(array[i] != argsObj.dbResult[i])

                if (array[i] != argsObj.dbResult[i]) {
                    // If the current discovered recipe name differs from the 
                    //  corresponding database recipe name ...

                    if (improved) {
                        // ... and the current parse results are an improvement

                        // Select the comparison array element that corresponds to 
                        //  this current discovered recipe
                        let comparand  = comparison.filter(e => e[0] == i)[0]

                        if (comparand == undefined) {
                            // If no comparison array element corresponds, use the
                            //   ith comparison element
                            comparand = comparison[i]
                        }

                        Log("Improved, comparand: " + JSON.stringify(comparand))
                        // Seq 263: comparand undefined <---<<

                        if (comparand[1] && !comparand[2]) {
                            // If the current recipe matches the expected recipe and the 
                            //  database recipe doesn't, color the current recipe green
                            Log("adding text-success") 
                            p.classList.add('text-success')
                        } else if (!comparand[1] && comparand[2]) {
                            // If the current recipe doesn't match the expected recipe
                            //  but th  database recipe does, color the current recipe red
                            L("adding text-error") 
                            p.classList.add('text-error')
                        }

                    } else {
                        // ... or the current parse results are not
                        //   an improvement, color the current recipe red
                        Log("adding text-error") 
                        p.classList.add('text-error')

                    }
                } 
                    
            }

            // Add the <p> element to the page
            div.appendChild(p)
        }
    }
 
    // Clone the 'difference' template
    let diff = diffContent.cloneNode(true)

    // Acquire the <p> element of 'difference' clone and set its text
    let diffParas = diff.querySelector('p')
    diffParas.textContent = `Seq: ${argsObj.seq.toString()}, Article: ${argsObj.name}`;

    // Acquire the <div> elements for the 'difference' clone
    let diffDivs = diff.querySelectorAll('div')

    if (argsObj.articleClass != argsObj.dbClass) {
        // If the curent parse article class differs from the database
        //  article class, display them
        showAttr(argsObj.articleClass, "hasArticleClass", diffDivs[3], true)
        showAttr(argsObj.dbClass, "hasArticleClass", diffDivs[4], false)
    }

    if (argsObj.articleTitle != argsObj.dbTitle && !argsObj.articleNotSolved) {
        // If the curent parse hasFragmenredTitle attribute differs from
        //  the database hasFragmenredTitle attribute, display them
        showAttr(argsObj.articleTitle, "hasFragmentedTitle", diffDivs[3], true)
        showAttr(argsObj.dbTitle, "hasFragmentedTitle", diffDivs[4], false)
    }

    if (!argsObj.articleResults.equals(argsObj.dbResult)) {
        // If the current parse recipe names differ from the database
        //  recipe names, display them
        createRecipeList(argsObj.articleResults, diffDivs[3], true, argsObj.improved, argsObj.comparison)
        createRecipeList(argsObj.dbResult, diffDivs[4], false)
    }

    // Add the difference to the page
    container.append(diff)

    
})

// Display an article that has been solved, i.e. an article that was
// not solved in the database, but whose current parse matches the
// the expected recipes.
window.validate.onArticleSolved( (arg) => {
    
    let argsObj = JSON.parse(arg)

    Log("Article solved = seq: " + argsObj.seq.toString() + ", Name: " + argsObj.name);

    let solved = solvedContent.cloneNode(true)
    let solvedPara = solved.querySelector('p')
    solvedPara.textContent = `SOLVED seq: ${argsObj.seq.toString()}, Article: ${argsObj.name}`;
    container.append(solved)

})
