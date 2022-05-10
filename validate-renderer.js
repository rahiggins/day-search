
const container = document.getElementById('diff-container')
const okPara = document.getElementById('OK');
const diffContent = document.getElementById('difference').content;
const heading1 = document.getElementById('heading1');
const heading2 = document.getElementById('heading2');
const loading = document.getElementById('loading');
let invisible = true

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



window.validate.onOkDisplay( () => {
    loading.remove()
    okPara.textContent = "All results as expected"
})

window.validate.onArticleDisplay( (arg) => {
    
    let argsObj = JSON.parse(arg)

    if (invisible) {
        invisible = false;
        heading1.classList.remove('d-invisible');
        heading2.classList.remove('d-invisible');
        loading.remove()
    }

   function showClass(prop, div, color) {
       console.log("showClass entered")
       console.log("prop: " + prop + ", color: " + color)
            let p = document.createElement('p');
            p.classList.add('mb-0')
            p.appendChild(document.createTextNode("hasArticleClass: " + prop.toString()))
            if (color) {
                if (prop != argsObj.dbClass) {
                    p.classList.add('text-error')
                }
            }
            div.appendChild(p)
    }   

    function createRecipeList(array, div, color) {
        console.log("createRecipeList entered")
        console.log("array: " + array + ", color: " + color)
        for (i = 0; i < array.length; i++) {
            let p = document.createElement('p');
            p.classList.add('mb-0')
            p.appendChild(document.createTextNode(array[i]))
            if (color) {
                if (array[i] != argsObj.dbResult[i]) {
                    p.classList.add('text-error')
                }
            }
            div.appendChild(p)
        }
    }
 
    let diff = diffContent.cloneNode(true)
    let diffParas = diff.querySelector('p')
    diffParas.textContent = `Seq: ${argsObj.seq.toString()}, Article: ${argsObj.name}`;
    let diffDivs = diff.querySelectorAll('div')

    if (argsObj.articleClass != argsObj.dbClass) {
        showClass(argsObj.articleClass, diffDivs[3], true)
        showClass(argsObj.dbClass, diffDivs[4], false)
    }

    if (!argsObj.articleResults.equals(argsObj.dbResult)) {
        createRecipeList(argsObj.articleResults, diffDivs[3], true)
        createRecipeList(argsObj.dbResult, diffDivs[4], false)
    }

    container.append(diff)

    
})
