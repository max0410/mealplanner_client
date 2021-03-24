// React native imports and css
import React from 'react';
import ReactDOM from 'react-dom';
import '../index.css';

// Jquery for sending ajax calls to the server
import $ from "jquery"

// Javascript beautiful soup clone, used to scrape data from html
import JSSoup from 'jssoup'; 

// Server domain
var domain = "http://127.0.0.1:3000"

// Parallel lists for fractional integers and their unicode values
var fractions = [1/2, 1/3, 2/3, 1/4, 3/4, 1/5, 2/5, 3/5, 4/5, 1/6, 5/6, 1/8, 3/8, 5/8, 7/8]
var fractionsUnicode = ["½", "⅓", "⅔", "¼", "¾", "⅕", "⅖", "⅗", "⅘", "⅙", "⅚", "⅛", "⅜", "⅝", "⅞"]

// Parses the numbers taken from ingredient info
function parseNum(word) {
    if (!isNaN(word)) {     // If the word is just a number and not a unicode fraction that return as an int
        return parseInt(word)
    } else {                // Otherwise convert the unicode fraction
        for (var i = 0; i < fractions.length; i++) {    // Iterate through each unicode fraction and finc the one that matches, return the appropriate integer
            if(word == fractionsUnicode[i]) {
                return fractions[i]
            }
        }
    }
    return -1
}

// Identify and return the index of specifers in the ingredient, specifiers are stuff like: "(7 ounce)", "(6 inch)"
function parseSpecifier(words, i) {
    var specifier = ""
    var word = words[i]    // Get i word from ingredient
    try {
        if (word.includes("(") && word.includes(")")) {     // Checks if word looks like this: "(specifier)"
            specifier = word
            return [specifier, i+1]
        } else if (word.includes("(")) {
            var n = i
            for (var w of words.slice(i)) { // Iterates through words after the "(string"  
                i += 1
                specifier += " " + w
                if (w.includes(")")) {          // Checks if word looks like this: "string)""
                    return [specifier.trim(), i+1]
                }
            }
            return ["", n]
        } else {
            return ["", i]
        }
    } catch (e) {           // If the ingredient doesn't have enough words, just return empty
        return ["", i]
    }
}

// Define a list of units to be parsed
var units = ["teaspoon","tablespoon","cup","pint","ounce","package","slice","pinch","clove","piece","pound","can","container","jar"]

// De-pluralize the unit in the ingredient and see if it matches one of our listed units
function parseUnit(word) {
    if (word.slice(-1) == "s") {    // If the last character is an s, cut the string so it excludes the last character
        word = word.slice(0,-1)
    }
    if (units.includes(word)) {     // If the unit given is in our listen of units, it is valid an return it
        return word
    } else {                        // Otherwise, return nothing
        return ""
    }
}

// Uses regex to find a substring inside another string but only if that substring is its own word
// Examples: "by", "by the sea" -> true, "by", "bartleby" -> false
function isMatch(searchOnString, searchText) {
    searchText = searchText.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    return searchOnString.match(new RegExp("\\b"+searchText+"\\b", "i")) != null;
}
  
// Checks if the ingredient can be categorized from a standarized list of ingredients
function categorize(ingredient, knownUnit, categories) {
    var result = ""
    ingredient = ingredient.toLowerCase()   // Turn ingredient string to lower case

    // Split the contents of the category file into seperate lines, each line is a different recipe
    var categories = categories.split("\n")

    // Iterate through each of our standardized ingredients
    categories.forEach((category) => {
        category = category.trim()  // remove whitespace from category
        
        // # If the ingredient name is within the category, disregarding plurality of the ingredient name, proceed
        if (isMatch(ingredient, category) || (ingredient.includes(category.slice(0,-1)) && category.slice(-1) == "s")) {
            //if (category.split(" ").length > result.split(" ").length || result == "") {
            // # Only proceed if the ingredient unit is in the category, the unit not is empty, or neither, not both
            if (!(category.includes(knownUnit) && knownUnit != "")) {
                result = category
            }
        }
    })

    return result
}
    
// Use regex to check if the url is valid
function validateURL(value) {
    return /^(?:(?:(?:https?|ftp):)?\/\/)(?:\S+(?::\S*)?@)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)(?:\.(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)*(?:\.(?:[a-z\u00a1-\uffff]{2,})))(?::\d{2,5})?(?:[/?#]\S*)?$/i.test(value);
}

// ImportRecipe class
class ImportRecipe extends React.Component {
    constructor(props) {
        super(props)

        // Class properties to keep track of whether or not the window  should be displayed and the url to import
        this.state = {display: false, url: ""}  

        // Class methods must be binded in React
        this.show =             this.show.bind(this)
        this.hide =             this.hide.bind(this)
        this.importData =       this.importData.bind(this)
        this.updateURL =        this.updateURL.bind(this)
        this.parseRecipe =      this.parseRecipe.bind(this)
    }

    // Shows the import recipe window
    show() {
        this.setState({display: true})
    }

    // Hides the import recipe window
    hide() {
        this.setState({display: false})
    }

    // Updates the url when there is a change in the url input
    updateURL(event) {
        this.setState({url: event.target.value})
    }

    parseRecipe(url, callback) {
        var result = {}     // Create empty meal data structure
        console.log("start parse")
        // Make POST call to /recipe_url server
        $.ajax({
            type: "POST",
            url: domain +"/recipe_url",
            data: JSON.stringify({ url: url }),  // Send url
            contentType: "application/json; charset=utf-8",
            dataType: "json",
            success: (data) => {
                var categories = data.categories    // Receives list of category ingredients and html of recipe webpage
                var html = data.data
                var soup = new JSSoup(html);    // Parse html

                // Get each piece of nutrition info
                var nutritions = soup.find("div", {"class": "recipe-nutrition-section"}).find("div", {"class": "section-body"}).getText().trim()
                
                // Get meal image
                result["image"] = soup.find("div", {"class": "image-container"}).find("img").attrs.src
                
                // Scrape each ingredient element
                var ingredients = soup.findAll("span", {"class": "ingredients-item-name"}).map((element) => {
                    return element.getText().trim()
                })

                // Scrape the number of servings
                result["servings"] = parseInt(soup.findAll("div", {"class": "two-subcol-content-wrapper"})[1].find("div", {"class": "recipe-meta-item"}).find("div", {"class": "recipe-meta-item-body"}).getText().trim())
                
                // Set metadata for each meal
                result["enabled"] = true
                result["url"] = url
                
                // Parse nutrition components

                result["nutrition"] = {}
                var nutrition = nutritions.trim()

                // Iterate through each nutrition compopone
                nutrition.split(";").forEach((component) => {
                    component = component.split(".")[0].trim()  // Remove double spaces
                    var parts = component.split(" ")            // Split component into its parts

                    // Remove units from ingredient amount and convert to integer
                    if (parts[1] == "calories") {
                        result["nutrition"][parts[1]] = parseInt(parts[0].replace("g","").replace("mg","").replace("m",""))
                    } else {
                        result["nutrition"][parts[0]] = parseInt(parts[1].replace("g","").replace("mg","").replace("m",""))
                    }
                })
                
                // Parse ingredient components

                result["ingredients"] = []

                // Iterate through each ingredient
                ingredients.forEach((ingredient) => {
                    ingredient = ingredient.replace(/ +(?= )/g,''); // Remove double spaces
                    var words = ingredient.split(" ")               // Split ingredient into words

                    // Create empty ingredient data structure
                    var data = { "num": parseNum(words[0]), "specifier": "", "unit": "", "item": ""}

                    // Parse ingredient amount and specifier
                    if (parseNum(words[1]) != -1) {
                        data["num"] += parseNum(words[1])           
                        var specifierData = parseSpecifier(words,2)
                        data["specifier"] = specifierData[0]
                        var i = specifierData[1]
                    } else {
                        var specifierData = parseSpecifier(words,1)
                        data["specifier"] = specifierData[0]
                        var i = specifierData[1]
                    }

                    // Parse unit and ingredient name
                    data["unit"] = parseUnit(words[i])
                    data["item"] = categorize(ingredient, data["unit"], categories)

                    // Add ingredient to array
                    result["ingredients"].push(data)

                })

                callback(result)    // Return meal result
            },
            error: (e) => {
                console.log(e)
            }
        });
        
    }

    // Start process of importing recipe data
    importData() {
        var url = this.state.url
        if (url != "" && url.includes("allrecipes") && validateURL(url)) {  // Make sure URL is valid and an allrecipes link
            this.parseRecipe(url, (result) => {     // Parse recipe then tell mealselector to import data and hide import recipe window
                this.props.importData(result)
                this.hide()
            }) 
        }
        
    }

    // Render function, triggered on state change
    render() {

        if (this.state.display) {   // Display URL input form, window, and overlay if display is true
            return (
                <div>
                    <div id="overlay">
                    </div>
                    <div id="import" class="w3-card-4 w3-margin">
                        <div id="header" style={{height: "40px", "margin-bottom":"0px"}}>
                            <h3 style={{display: "inline"}}>Import Recipe</h3>
                            <button class="exitWarning" onClick={this.hide}>✕</button>
                        </div>
                        <div id="importBody">
                            <p>Import nutrition information and ingredients from the web. Currently MealPlannerPro only supports allrecipes.com.</p> 
                            <input placeholder="allrecipes.com URL" onChange={(event) => this.updateURL(event)}></input>
                            <button id="importRecipeButton" onClick={this.importData}>Import Recipe</button>
                            <p style={{color: "#f0756e", "margin-top": "10px"}}>Note: This action will override any nutrition information and ingredients for this meal.</p>
                        </div>
                    </div>
                </div>
            )
        } else {                // Otherwise display nothing
            return (
                <div style={{display: "none"}}></div>
            )
        }
        
    }
}

export default ImportRecipe
