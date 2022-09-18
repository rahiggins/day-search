// initYear creates a startObj.txt file for a given year.
// The article sequence number must also be provided.


// External modules used
const {app, BrowserWindow} = require('electron');
const { ipcMain } = require('electron');
const path = require('path');
const mysql = require('mysql2/promise');
const needle = require('needle')
const puppeteer = require('puppeteer')
const cheerio = require('cheerio')
const fs = require('fs'); // Filesystem functions
const appPath = process.cwd();
const startObjFile = appPath + '/startObj.txt'

// Global variables
let debug = true;
let startObj = new Object();

// Set the year and the sequence number
startObj.year = '1999';
startObj.seq = 1943;

function Log (text) {
    // If debugging, write text to console.log
    if (debug) {
        console.log(text)
    }
}

async function mainline() {
    // Main process 

    async function getYear(year) {
        // Get the table rows from the local NYT Food and Drink web page
        //  for the specified year
        // Input: year (string)
        // Output: {
        //  valid: boolean,
        //  func: a Cheerio query function bound to the year's web page,
        //  rows: a Cheerio object comprising the table rows of the web page
        // }

        // The URL of the local NYT Food and Drink web page
        //  for the specified year
        let url = 'http://localhost:8888/R/index.php?y=' + year

        // Get the web page; return {valid: false} if the page does not exist
        resp = await needle("get", url, {follow_max: 10});
        if (resp.body.includes("The stuff in the URL following the question mark does not compute")) {            
            console.log("No such year - " + year)
            return {valid: false}
        }

        // Create a Cheerio query function for the web page
        let $ = cheerio.load(resp.body);
    
        return {
            valid: true,
            func: $,
            rows: $('tr')
        }
    }

    function createDateRowIndices($, tableRows) {
        // Create an array of $('tr') indices comprising the rows specifying
        //  a date (dd/dd/dddd)
        // Input:   $, a query function bound to the year's web page
        //          tableRows, a Cheerio object comprising the table 
        //           rows of the web page
        // Output:  dateRowIndices, an array of the indices in the tableRows
        //           object of rows that contain a 'dd/dd/dddd' date
        let dateRowIndices = [];

        // Filter tableRows for rows that match dd/dd/dddd
        let tableCol1 = $(tableRows).filter((i, row) => {
            //let rowDataElements = $('td', row);
            //let dayRow = $(rowDataElements[0]).text().match(/\d{2}\/\d{2}\/\d{4}/)
            let dayRow = $('td', row).eq(0).text().match(/\d{2}\/\d{2}\/\d{4}/)

            if (dayRow != null) {
                // If the row matches dd/dd/dddd, add its index to the
                //  dateRowIndices array
                dateRowIndices.push(i)
            }
            return dayRow != null
        })

        return dateRowIndices
    }

    // Get the previous year's data
    let yearObj = await getYear(startObj.year)

    if (yearObj.valid) {
        // If a previous year is available ...

        // Set the Cheerio query function and the table rows Cheerio
        //  object for the next year to be processed
        $ = yearObj.func;
        tableRows = yearObj.rows

        // Update the startObj for the next year
        
        // Create an array of indices corresponding to the tableRows
        //  entries that start a new date
        startObj.dateArray = createDateRowIndices($, tableRows);

        // Set dateIndex to the last date of the year
        startObj.dateIndex = startObj.dateArray.length - 1;

        // Indicate that this is a new year
        startObj.objNew = true;

        console.log(startObj);
        console.log(JSON.stringify(startObj));

        // Write the next year's startObj to the app directory
        fs.writeFileSync(startObjFile, JSON.stringify(startObj), 'utf8');

        // Set dateIndex and dateRowIndices for the next year and repeat processing
        dateIndex = startObj.dateIndex;
        dateRowIndices = startObj.dateArray
    } else {
        // If there are no more years to process, exit the loop
        console.log("Year " + startObj.year + " does not exist")
    }
    return

}

mainline()