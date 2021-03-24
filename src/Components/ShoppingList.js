/* 
This is the class for the Shopping List window, it is responsible for:
1. Pulling ingredients from the calendar
2. Adding ingredients together
3. Displaying ingredients into a list
*/

// Imports for React native and css
import React from 'react';
import ReactDOM from 'react-dom';
import '../index.css';

// Import icons
import reload from '../icons/reload.png'
import exportIcon from "../icons/export.png"

// Jquery for sending ingredient data to the server and AES to encrypt/decrypt
import $ from "jquery"
var aesjs = require('aes-js');

var domain = "http://127.0.0.1:3000"

// Fraction parallel lists for converting decimals to unicode fractions and comparing them
var fractions = [1/2, 1/3, 2/3, 1/4, 3/4, 1/5, 2/5, 3/5, 4/5, 1/6, 5/6, 1/8, 3/8, 5/8, 7/8]
var fractionsUnicode = ["½", "⅓", "⅔", "¼", "¾", "⅕", "⅖", "⅗", "⅘", "⅙", "⅚", "⅛", "⅜", "⅝", "⅞"]
function isFractionEqual(num, fraction) {
    return (num % 1).toFixed(7).slice(0,-1) == (fraction).toFixed(7).slice(0,-1)
}

// Helper function to retreive the user token which is stored as a cookie
function getCookie(cname) {
    var name = cname + "=";
    var decodedCookie = decodeURIComponent(document.cookie);
    var ca = decodedCookie.split(';');
    for(var i = 0; i <ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) == ' ') {
        c = c.substring(1);
        }
        if (c.indexOf(name) == 0) {
        return c.substring(name.length, c.length);
        }
    }
    return "";
}

// Takes in an integer and returns a 128-bit array to be used as a key for AES
function generate128BitKey(s) {
    var key = []
    for (var i = 0; i < 16; i++) {  // If s is 15 then the array will be: [15, 16, 17, 18, 19...]
        key.push(s + i)
    }
    return key
}

// Encrypts string using s as a key and AES as the cipher
function aesEncrypt(str, s) {
    // Turns our integer key into a 128-bit key
    var key = generate128BitKey(s)

    // Converting our text into to bytes
    var textBytes = aesjs.utils.utf8.toBytes(str);

    // Encyrypting our bytes using AES Counter mode
    var aesCtr = new aesjs.ModeOfOperation.ctr(key, new aesjs.Counter(5))
    var encryptedBytes = aesCtr.encrypt(textBytes)

    // Converting back to text for easy handling in communication
    var finalResult = aesjs.utils.hex.fromBytes(encryptedBytes)
    return finalResult
}

// Decrypts string using s as a key and AES as the cipher
function aesDecrypt(str, s) {
    // Turns our integer key into a 128-bit key
    var key = generate128BitKey(s)

    // Convert our string back to bytes
    var encryptedBytes = aesjs.utils.hex.toBytes(str);

    // Decrypting our bytes using AES Counter mode
    var aesCtr = new aesjs.ModeOfOperation.ctr(key, new aesjs.Counter(5));
    var decryptedBytes = aesCtr.decrypt(encryptedBytes);

    // Convert our bytes back into text
    var decryptedText = aesjs.utils.utf8.fromBytes(decryptedBytes);
    return decryptedText
}

// Class for shopping list
class ShoppingList extends React.Component {
    constructor(props) {
        super(props)
        // Class properties for storing the shopping list, the days to include in the shopping list
        this.state = {ingredients: [], checklistDays: {"Sunday":true,"Monday":true,"Tuesday":true,"Wednesday":true,"Thursday":true,"Friday":true,"Saturday":true}}

        // In React we must bind functions 
        this.getIngredients =           this.getIngredients.bind(this)
        this.addIngredients =           this.addIngredients.bind(this)
        this.applyAll =                 this.applyAll.bind(this)
        this.checkDay =                 this.checkDay.bind(this)
        this.exportList =               this.exportList.bind(this)
        this.toggleIngredient =         this.toggleIngredient.bind(this)
        this.removeIngredient =         this.removeIngredient.bind(this)
    }

    // Converts the shopping list to a more simplified version for printing
    exportList() {

        // Iterate through each ingredient
        var ingredients = this.state.ingredients.map(ingredient => {
            var text = "";
            if (ingredient.num > 0) {   // If there is a number (its not -1)
                for (var i = 0; i < fractions.length; i++) {                    // Convert any decimal fractions to unicode fractions
                    if (isFractionEqual(ingredient.num, fractions[i])) { 
                        text += fractionsUnicode[i] + " "
                        break
                    }
                } 
                if (text.length > 0 && Math.floor(ingredient.num) > 0) {    // If there is a unicode fraction and there is a remainder add the together
                    text = Math.floor(ingredient.num) + text
                } 
                if (text.length == 0) {                                     // Round decimals to two digits after the decimal point
                    text += Math.round(ingredient.num * 100) / 100 + " "
                }
            }
            if (ingredient.unit)        { text += ingredient.unit + " " }       // If there is a unit, add it
            if (ingredient.specifier)   { text += ingredient.specifier + " "}   // If there is a specifier, add it
            text += ingredient.item
            return (
                <div class="ingredientExport">
                    <input class="ingredientCheckbox" type="checkbox" checked={ingredient.checked} onChange={(e) => this.toggleIngredient(i)}></input>
                    <span >{text}</span>
                </div>
            )
        })

        // If there is no ingredients, add a text saying there are no ingredients
        if (ingredients.length == 0) {
            ingredients.push(
                <div id="noIngredients">
                    <i style={{color: "#ccc"}}>There are no meals on your calendar.</i>
                </div>
            )
        }

        if (ingredients.length > 32 && ingredients.length <= 64) {  // If there is between 32 and 64 ingredients, format export ingredients into two columns
            var ingredients1 = ingredients.slice(0,Math.floor(ingredients.length/2))    // Get first half of ingredients
            var ingredients2 = ingredients.slice(Math.floor(ingredients.length/2)+1)    // Get second half of ingredients

            this.props.showExport ( // Send export to the export window
                <div>
                    <div id="listCol1">{ingredients1}</div>
                    <div id="listCol2">{ingredients2}</div>
                </div>
            )
        } else if (ingredients.length > 64) {                       // If there is any more than 64 ingredients, format into one column
            console.log("num 2")
            var ingredients1 = ingredients.slice(0,Math.floor(ingredients.length/3))    // Get first third
            var ingredients2 = ingredients.slice(Math.floor(ingredients.length/3)+1,2*Math.floor(ingredients.length/3)) // Get second third
            var ingredients3 = ingredients.slice(2*Math.floor(ingredients.length/3)+1)  // Get the last thid

            this.props.showExport ( // Send export to the export window
                <div>
                    <div id="listCol1">{ingredients1}</div>
                    <div id="listCol2">{ingredients2}</div>
                    <div id="listCol3">{ingredients3}</div>
                </div>
            )
        } else {
            this.props.showExport ( // Just send the ingredients back in one column if there are less than 32 ingredients
                <div>
                    <div id="listCol1">{ingredients}</div>
                </div>
            )
        }
        
    }

    // Send shopping list data back to the server to be saved
    updateData() {
        // Send post request to the /set_data listener
        $.ajax({
            type: "POST",
            url: domain +"/set_data",
            // Sends session id, user id, and the encrypted shopping list to the server
            data: JSON.stringify({ 
                sessionID: this.props.sessionID, 
                uid: getCookie("token"), 
                shoppinglist: aesEncrypt(JSON.stringify(this.state.ingredients),this.props.secret), 
            }),
            contentType: "application/json; charset=utf-8",
            dataType: "json"
        });
    }

    // Called when a day checkbox is checked, toggles that checkbox and updates the shopping list
    checkDay(event, day) {
        var checklistDays = this.state.checklistDays    // Make copy of the checklist days data and edit it to the updated value
        checklistDays[day] = event.target.checked

        this.setState({checklistDays: checklistDays}, () => {   // Save the new checklist days, get the ingredients, and update the data to the server
            this.getIngredients()   
            this.updateData()
        })
    }

    applyAll() {
        // Set all of the checklist days to true
        this.setState({checklistDays: {"Sunday":true,"Monday":true,"Tuesday":true,"Wednesday":true,"Thursday":true,"Friday":true,"Saturday":true}}, () => {
            this.getIngredients()
        })
    }

    // Method to add a list of ingredients together
    addIngredients(ingredients) {

        // First we must sort the ingredients by item so we can add them together
        var sorted_by_item = {}

        // Iterate through each ingredient
        ingredients.forEach(ingredient => {
            if (ingredient) {
                if (sorted_by_item[ingredient["item"]]) {       // If the ingredient is in the json, add the ingredient to the list, otherwise start a list
                    sorted_by_item[ingredient["item"]].push(ingredient)
                } else {
                    sorted_by_item[ingredient["item"]] = [ingredient]
                }
            }
        })           
                           
                    
        var final_list = {}
    
        Object.keys(sorted_by_item).forEach(item => {   // Go through each type of item in the sorted_items
            var sorted_foods = sorted_by_item[item]     // Get the array for each type of item
            var additions = {}
            sorted_foods.forEach(food => {              // Iterate through each food in this array

                 // Converting to common units
                if (food["unit"] == "tablespoon"){      
                    food["num"] *= 3
                    food["unit"] = "teaspoon"
                } else if (food["unit"] == "cup") {
                    food["num"] *= 48
                    food["unit"] = "teaspoon"
                } else if (food["unit"] == "ounce") {
                    food["num"] *= 6
                    food["unit"] = "teaspoon"
                } 

                var specifier = ""
                if (food["specifier"] != "") {  // Adds specifer to ingredient name if there is one
                    specifier = " " + food["specifier"]
                }

                // Adds ingredients together with a common unit and specifer
                if (additions[food["unit"] + specifier]) {
                    additions[food["unit"] + specifier] += parseFloat(food["num"])
                } else {
                    additions[food["unit"] + specifier] = parseFloat(food["num"])
                }
            })

            final_list[item] = additions    // Adds the added ingredient info to the final list under the ingredient's name
        })
    
        var product = []

        // Iterate through each ingredient item on the list
        Object.keys(final_list).forEach(item => {
            Object.keys(final_list[item]).forEach(unit => {
                var specifier = ""
                if (unit.match(/\(([^)]+)\)/)) {    // If there is something in the ingredient that looks like: (specifer) inthe unit pull it out
                    var specifier = "("+ unit.match(/\(([^)]+)\)/)[1] +")"
                }

                var funit = unit.replace(/ *\([^)]*\) */g, "");     // Use regex to pull the unit from the item

                var num = final_list[item][unit]        // Get number
                if (funit == "teaspoon" && num >= 3) {  // Convert to common measurements
                    funit = "tablespoon"
                    num = num / 3
                }
                if (funit == "tablespoon" && num >= 16) {
                    funit = "cup"
                    num = num / 16
                }

                // Save ingredient data to the product
                product.push({"item":item, "unit":funit, "num":num, "specifier":specifier})
            })
            
        })

        return product
    }

    // Get the list of ingredients from the calendar
    getIngredients() {
        var calendar = this.props.getCalendar()
        var ingredients = []

        // Iterate through each meal in the calendar and add it ingredients to a list as well as adding a checked property to keep track of which ingredients are checked
        Object.keys(calendar).forEach(type => {
            Object.keys(calendar[type]).forEach(day => {
                if (this.state.checklistDays[day]) {
                    var meal = calendar[type][day]
                    meal.checked = false
                    ingredients = ingredients.concat(meal.ingredients)
                }
            })
        })  
        this.setState({ingredients: this.addIngredients(ingredients)})  // Before saving the ingredients, add those with common units and ingredient names together
    }

    // Called when an ingredient is checked, reverses its checked property
    toggleIngredient(event) {
        var ingredients = this.state.ingredients
        ingredients[event.target.id].checked = !ingredients[event.target.id].checked
        this.setState({ingredients: ingredients}, () => {
            this.updateData()
        })
    }

    // Removes an ingredient from the list
    removeIngredient(event) {
        var ingredients = this.state.ingredients
        ingredients.splice(event.target.id, 1)
        this.setState({ingredients: ingredients}, () => {
            this.updateData()
        })
    }

    // Render function, called everytime there is a change in state
    render() {

        var n = -1;
        var ingredients = this.state.ingredients.map(ingredient => {
            n++

            var text = "";
            if (ingredient.num > 0) {   // If their is an amount to the ingredient (its not -1)
                for (var i = 0; i < fractions.length; i++) {                // Find a match to the decimal to a unicode fraction
                    if (isFractionEqual(ingredient.num, fractions[i])) { 
                        text += fractionsUnicode[i] + " "
                        break
                    }
                } 
                if (text.length > 0 && Math.floor(ingredient.num) > 0) {    // If there is a unicode fractice and a whole number, add them together
                    text = Math.floor(ingredient.num) + text
                } 
                if (text.length == 0) {                                     // If the number couldnt be simplified to a fraction, round the number to two digits after the decimal point
                    text += Math.round(ingredient.num * 100) / 100 + " "
                }
            }

            if (ingredient.unit)        { text += ingredient.unit + " " }       // Add a unit if there is one
            if (ingredient.specifier)   { text += ingredient.specifier + " "}   // Add a specifier if there is one
            text += ingredient.item

            return (    // Format the ingredient information
                <div class="ingredient">
                    <input class="ingredientCheckbox" type="checkbox" checked={ingredient.checked} id={n} onChange={this.toggleIngredient}></input>
                    <span>{text}</span>
                    <span class="xicon" id={n} onClick={this.removeIngredient}>✕</span>
                </div>
            )
            
        })
        if (ingredients.length == 0) {  // If there are no ingredients just put some text that says thate
            ingredients.push(
                <div id="noIngredients">
                    <i style={{color: "#ccc"}}>There are no meals on your calendar.</i>
                </div>
            )
        }

        // Iterate through each of the days and add a checkbox, checked if the checkbox is true
        var dayCheckboxes = Object.keys(this.state.checklistDays).map(day => {
            return (
                <span class="dayCheck"><input type="checkbox" checked={this.state.checklistDays[day]} onChange={(e) => this.checkDay(e,day)}></input>{day} </span>
            )
        })

        return (    // Format the shoppinglist window
                <div id="shoppinglist" class="w3-card-4 w3-margin">
                    <div id="header" style={{height: "40px", "margin-bottom":"-15px"}}>
                        <h3>Shopping List</h3>
                        <button class="reloadButtonList" onClick={this.getIngredients}><img id="reloadIconList" src={reload}></img></button>
                        <button class="exportButtonList" onClick={this.exportList}><img id="exportIconList" src={exportIcon}></img></button>
                    </div>
                    <div id="shoppinglistbody">
                        {ingredients}
                    </div>
                    <div id="footer" style={{"margin-top":"0px"}}>
                        <div style={{transform: "translate(0px, 3px)"}}>
                            {dayCheckboxes}
                            <button id="applyAll" onClick={this.applyAll}>Apply All</button>
                        </div>
                    </div>
                </div>
        )
        
    }
}

export default ShoppingList;