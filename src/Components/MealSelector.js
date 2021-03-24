/* 
This is the mealselector class, it contains the meal selection window AND the meal editor window, usually each window would be put in
seperate components, but these two windows communicate in so many ways that it would be faster to bundle them into a single component.
This class is responsible for:
1. Communicating with the server to fetch meals and update meal data
2. Displaying meals in a filterable and togglable list by communicating with the Meal component
3. Displaying a meal editor that is responsive to selections made in the meal selection window
4. Communicating with the server to import meals
5. Communicating with the calendar to dictate which meals can be picked
*/

// Import react native and css
import React from 'react'
import ReactDOM from 'react-dom'
import '../index.css'

// Import Meal component for displaying the meals in the meal list
import Meal from './Meal'

// Import Images
import editImage from '../icons/edit.png'
import defaultImage from '../icons/default.png'
import filterIcon from '../icons/noFilter.png'
import noFilterIcon from '../icons/filter.png'
import deleteMealIcon from '../icons/delete.png'
import importRecipeIcon from '../icons/import.png'

// Import jquery for sending post requests to host
import $ from "jquery"
import { rightArithShift, thomsonCrossSectionDependencies } from 'mathjs'
var aesjs = require('aes-js')

var domain = "http://127.0.0.1:3000"

// Helper function to retreive the user token which is stored as a cookie
function getCookie(cname) {
    var name = cname + "=";
    var decodedCookie = decodeURIComponent(document.cookie)
    var ca = decodedCookie.split(';')
    for(var i = 0; i <ca.length; i++) {
        var c = ca[i]
        while (c.charAt(0) == ' ') {
        c = c.substring(1)
        }
        if (c.indexOf(name) == 0) {
        return c.substring(name.length, c.length)
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
    var textBytes = aesjs.utils.utf8.toBytes(str)

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
    var encryptedBytes = aesjs.utils.hex.toBytes(str)

    // Decrypting our bytes using AES Counter mode
    var aesCtr = new aesjs.ModeOfOperation.ctr(key, new aesjs.Counter(5))
    var decryptedBytes = aesCtr.decrypt(encryptedBytes)

    // Convert our bytes back into text
    var decryptedText = aesjs.utils.utf8.fromBytes(decryptedBytes)
    return decryptedText
}

// MealSelector component, manages meal selection and editing
class MealSelector extends React.Component {
    constructor(props) {
        super(props)    // Take parameters from parent component

        // Global component variable, every time these are updated React will re-render MealSelector
        this.state = {
            "meals": {}, 
            "selectedmeal": {}, 
            "mealname": "", 
            servings: 1,
            placeholder: "Click on a Meal to Edit",
            filter: "",
            applyFilter: true,
            selectToggle: false
        }

        this.nameJustChanged = false

        // Class methods must be binded in React

        // Meal selection
        this.getMeals               = this.getMeals.bind(this)
        this.toggleFilter           = this.toggleFilter.bind(this)
        this.handleFilterChange     = this.handleFilterChange.bind(this)
        this.filterMeal             = this.filterMeal.bind(this)
        this.enabled                = this.enabled.bind(this)
        this.toggleSelect           = this.toggleSelect.bind(this)

        // Meal editing
        this.fillEditor             = this.fillEditor.bind(this)
        this.handleAddIngredient    = this.handleAddIngredient.bind(this)
        this.addIngredients         = this.addIngredients.bind(this)
        this.handleNumChange        = this.handleNumChange.bind(this)
        this.handleUnitChange       = this.handleUnitChange.bind(this)
        this.handleRemoveItem       = this.handleRemoveItem.bind(this)
        this.handleRemoveType       = this.handleRemoveType.bind(this)
        this.handleRemoveCategory   = this.handleRemoveCategory.bind(this)
        this.handleAddType          = this.handleAddType.bind(this)
        this.handleAddCategory      = this.handleAddCategory.bind(this)
        this.handleNotesUpdate      = this.handleNotesUpdate.bind(this)
        this.handleServingsChange   = this.handleServingsChange.bind(this)
        this.handleNutritionChange  = this.handleNutritionChange.bind(this)
        this.handleNameChange       = this.handleNameChange.bind(this)
        this.editImage              = this.editImage.bind(this)
        this.imageInput             = this.imageInput.bind(this)
        this.deleteMeal             = this.deleteMeal.bind(this)
        this.importRecipe           = this.importRecipe.bind(this)

        // Both
        this.updateData             = this.updateData.bind(this)
        this.stripText              = this.stripText.bind(this)
    }

    // Getter function for the calendar, only returns once meals have been retreived
    getMealsForCalendar(callback=null) {
        if (callback) {                     // A callback is only passed on the initial loading
            this.getMeals(() => {
                callback(this.state.meals)
            })
        } else {
            return this.state.meals
        }
        
    }

    // Retreives meal data from the host
    getMeals(callback=null) {
        $.ajax({
            type: "POST",
            url: domain +"/user_data",
            data: JSON.stringify({ sessionID: this.props.sessionID, uid: getCookie("token")}),  // Send sessionID and UID
            contentType: "application/json; charset=utf-8",
            dataType: "json",
            success: (data) => {
                // Set our meal state to the meal data we got from the host, we must first unecrypt it with the secret parameter and parse it into a JSON object
                this.setState({"meals": JSON.parse(aesDecrypt(data.data,this.props.secret)).meals})

                // A callback is only passed on the initial loading
                if (callback) {
                    callback()
                }
            }
        })
    }

    // Sends modified meal data to the host
    updateData() {
        $.ajax({
            type: "POST",
            url: domain +"/set_data",
            // Send sessionID, user token, and the encrypted meals
            data: JSON.stringify({ sessionID: this.props.sessionID, uid: getCookie("token"), meals: aesEncrypt(JSON.stringify(this.state.meals),this.props.secret)}), 
            contentType: "application/json; charset=utf-8",
            dataType: "json",
            timeout: 3000
        })
    }

    // Triggered on meal click, add meal button click, and calendar meal click, updates info on what meal is currently being edited
    fillEditor(mealname, from=null) {
        if (mealname == "newmeal") {   // If a new meal is created

            // Creates new meal data
            var data = {
                "category":["None"],
                "enabled":true,
                // Default image with the camera icon
                "image": "https://assets.simplecast.com/assets/fallback/default-b7824fcd998f51baf0f0af359a72e760.png",
                "ingredients":false,
                "notes":"",
                "nutrition":{"calories":0,"carbohydrates":0,"cholesterol":0,"fat":0,"protein":0,"sodium":0},
                "servings":1,
                "type":["None"],
                "url":"",
                "name":""
            }

            document.getElementById("meallist").scrollTop = 0
            var meals = this.state.meals
            meals[""] = data
            this.setState({"selectedmeal":data, "mealname":"", "placeholder": "New Meal Name", "meals":meals})   // When state variables change, the component re-renders and so the editor is filled
        } else {
            if (this.state.meals[mealname]) {
                var data = this.state.meals[mealname]
                this.setState({"selectedmeal":data, "mealname":mealname})   // When state variables change, the component re-renders and so the editor is filled
    
                if (from == "calendar") {   // If fillEditor is being called from calendar, scroll to the meal in the meal selector
                    Array.from(document.getElementsByClassName("meal")).forEach((meal) => {
                        if (meal.getElementsByClassName("mealname")[0].innerHTML == mealname) {
                            meal.parentNode.scrollTop = meal.offsetTop               // Scrolls the meallist window to the meal selected
                        }
                    })
                }
            }
        }  
    }

    // Toggle selection of all meals (including filter)
    toggleSelect() {
        var selectToggle = this.state.selectToggle
        var meals = this.state.meals

        // Iterate through each item and toggle if it passes through the filter
        Object.keys(this.state.meals).forEach((mealname) => {
            if (this.filterMeal(this.state.meals[mealname], mealname)) {
                meals[mealname].enabled = selectToggle
            }
        })

        selectToggle = !selectToggle
        this.setState({meals: meals, selectToggle: selectToggle}, () => {
            this.updateData()
        })
    }

    // Callback function for ingredient quantity modifications in the meal editor
    handleNumChange(event) {
        var meals = this.state.meals    // Make copy of meals object, we shouldn't modify state directly in React, only use setState
        meals[this.state.mealname]["ingredients"][event.target.id]["num"] = event.target.value  // Get input value and set to ingredient number
        this.setState({"selectedmeal":meals[this.state.mealname], "meals":meals})   // State variables modified, component re-renders
        this.updateData()
    }

    // Callback function for ingredient unit modifications in the meal editor
    handleUnitChange(event) {
        var meals = this.state.meals    // Make copy of meals object, we shouldn't modify state directly in React, only use setState
        meals[this.state.mealname]["ingredients"][event.target.id]["unit"] = event.target.value
        this.setState({"selectedmeal":meals[this.state.mealname], "meals":meals})   // State variables modified, component re-renders
        this.updateData()
    }

    // Callback function for the remove button in the meal editor for an ingredient
    handleRemoveItem(event) {
        var meals = this.state.meals    // Make copy of meals object, we shouldn't modify state directly in React, only use setState
        meals[this.state.mealname]["ingredients"].splice(event.target.id, 1)    // Removes 1 item at the i index
        this.setState({"selectedmeal":meals[this.state.mealname], "meals":meals})   // State variables modified, component re-renders
        this.updateData()
    }

    // Callback function for the remove button in the meal editor for a type
    handleRemoveType(event) {
        var meals = this.state.meals    // Make copy of meals object, we shouldn't modify state directly in React, only use setState
        meals[this.state.mealname]["type"].splice(event.target.id, 1)    // Removes 1 item at the i index
        if (meals[this.state.mealname]["type"].length == 0) {
            meals[this.state.mealname]["type"].push("None")
        }
        this.setState({"selectedmeal":meals[this.state.mealname], "meals":meals})   // State variables modified, component re-renders 
        this.updateData()
    }

    // Callback function for the remove button in the meal editor for a category
    handleRemoveCategory(event) {
        var meals = this.state.meals    // Make copy of meals object, we shouldn't modify state directly in React, only use setState
        meals[this.state.mealname]["category"].splice(event.target.id, 1)    // Removes 1 item at the i index
        if (meals[this.state.mealname]["category"].length == 0) {
            meals[this.state.mealname]["category"].push("None")
        }
        this.setState({"selectedmeal":meals[this.state.mealname], "meals":meals})   // State variables modified, component re-renders
        this.updateData()
    }

    // Triggered on the click of the green plus under the type accordion
    handleAddType(event) {
        var meals = this.state.meals    // Make copy of meals object, we shouldn't modify state directly in React, only use setState
        var newType = document.getElementById("typeInput").value    // Get value of text input / dropdown
        if (!newType) { return }
        meals[this.state.mealname]["type"].unshift(newType)         // Add new type to the beginning of the array
        this.setState({"selectedmeal":meals[this.state.mealname], "meals":meals})   // State variables modified, component re-renders
        this.updateData()
        document.getElementById("typeInput").value = ""
    }

    // Triggered on the click of the green plus under the category accordion
    handleAddCategory(event) {
        var meals = this.state.meals    
        var newType = document.getElementById("categoryInput").value    // Get value of text input / dropdown

        if (!newType) { return }
        meals[this.state.mealname]["category"].unshift(newType)         // Add new category to the beginning of the array
        this.setState({"selectedmeal":meals[this.state.mealname], "meals":meals}, () => {   
            this.updateData()
        })  
        document.getElementById("categoryInput").value = ""
    }

    // Deletes the currently selected meal
    deleteMeal() {
        if (Object.keys(this.state.selectedmeal).length > 0) {
            var meals = this.state.meals
            delete meals[this.state.mealname]

            this.setState({"selectedmeal":{}, "mealname":"", placeholder: "Click on a Meal to Edit", servings: 1}, () => {
                this.updateData()
            })
        }
    }

    // Called by the ImportRecipe component, adds all the new data to the selected meal
    importRecipe(data) {
        if (Object.keys(this.state.selectedmeal).length > 0) {
            var selectedmeal = this.state.selectedmeal

            // Setting all the properties to the imported 
            selectedmeal.ingredients = data.ingredients
            selectedmeal.nutrition = data.nutrition
            selectedmeal.url = data.url
            selectedmeal.image = data.image
            selectedmeal.servings = data.servings

            this.setState({selectedmeal: selectedmeal})
        }
    }

    // Called when the input ingredient field is submitted
    handleAddIngredient(event) {
        
        var meals = this.state.meals    // Make copy of meals object, we shouldn't modify state directly in React, only use setState
        var num = document.getElementById("num").value                  // Get value of quantity input
        var unit = document.getElementById("unit").value                // Get value of unit dropdown

        if (!meals[this.state.mealname]["ingredients"]) {
            meals[this.state.mealname]["ingredients"] = []
        }

        var ingredient = document.getElementById("ingredient").value    // Get value of ingredient text input
        var specifier = ""
        if (ingredient.match(/\(([^)]+)\)/)) { 
            var specifier = "("+ ingredient.match(/\(([^)]+)\)/)[1] +")"
        }

        var ingredient = ingredient.replace(/ *\([^)]*\) */g, "")         // Pulls out string that isn't in parentheses
        num = (num ? num : -1)  // If num is blank, make the value -1
        meals[this.state.mealname]["ingredients"].unshift({"num": num, "unit": unit, "specifier": specifier, "item": ingredient})
        meals[this.state.mealname]["ingredients"] = this.addIngredients(meals[this.state.mealname])
        this.setState({"selectedmeal":meals[this.state.mealname], "meals":meals}, () => {
            this.updateData()
        })

        document.getElementById("num").value = ""           // Reset the add ingredient prompt
        document.getElementById("unit").value = ""
        document.getElementById("ingredient").value = ""
        
    }

    // Method to add a list of ingredients together
    addIngredients(meal) {
        var ingredients = meal.ingredients

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

                var funit = unit.replace(/ *\([^)]*\) */g, "")       // Use regex to pull the unit from the item

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

    // Triggered on change to the notes text areas
    handleNotesUpdate(event) {
        if (Object.keys(this.state.selectedmeal).length > 0) {      // Check if there is a selectedmeal
            var meals = this.state.meals    

            meals[this.state.mealname]["notes"] = event.target.value    // Get text from textarea
            this.setState(prevState => {
                var meals = Object.assign({}, prevState.meals)
                meals[this.state.mealname]["notes"] = event.target.value
                return { meals }
            }, () => {
                this.updateData()
            })
        }
    }

    // Triggers on change to the servings in the nutrition accordion and recalculates ingredient amount
    handleServingsChange(event) {
        if (Object.keys(this.state.selectedmeal).length > 0) {  // Checks if there is a meal selected
            var servings = event.target.value

            if (event.target.value == "") {     // If there is no value in the input field, add a 1
                servings = "1"
            }

            var meals = this.state.meals 

            var prevServings = meals[this.state.mealname].servings      // Get previous number of servings for calculations
            meals[this.state.mealname].servings = parseInt(servings)    // Get servings number from the input field

            if (meals[this.state.mealname]["ingredients"]) {    // If there are ingredients in the list

                // Iterate through each ingredient
                meals[this.state.mealname]["ingredients"] = meals[this.state.mealname]["ingredients"].map(ingredient => {
                    if (ingredient["num"] != -1) {  // If the ingredient has a number, convert it
                        ingredient["num"] = (ingredient["num"] / prevServings) * parseInt(servings)
                    }
                    return ingredient
                })
            }

            this.setState({"selectedmeal":meals[this.state.mealname], "meals":meals}, () => {
                this.updateData()
            })
            
        }
    }

    // Triggers on change of a nutrition component and updates the data
    handleNutritionChange(event) {
        var meals = this.state.meals

        meals[this.state.mealname].nutrition[event.target.id] = event.target.value      // Uses the id from the element to store the new value their
        this.setState({"selectedmeal":meals[this.state.mealname], "meals":meals}, () => {
            this.updateData()
        })

    }

    // Called when the name of the selected meal is changed in the meal editor
    handleNameChange(event) {
        if (Object.keys(this.state.selectedmeal).length > 0) {  // Checks that a meal has been selected
            var meals = this.state.meals

            meals[event.target.value] = meals[this.state.mealname]  // Creates a new but identical meal 
            delete meals[this.state.mealname]

            this.nameJustChanged = true
            this.setState({"selectedmeal":meals[event.target.value], "meals":meals, "mealname":event.target.value})
            this.updateData()
        }
    }

    // Called on filter input change, updates the filter keyword
    handleFilterChange(event) {
        this.setState({filter: event.target.value})
    }

    // Called on filter button click, enables/disables filtering
    toggleFilter() {
        this.setState({applyFilter: !this.state.applyFilter})
    }

    // Checks if a meal has any data that includes the filter keywords
    filterMeal(meal, mealname) {
        var filter = this.state.filter.toLowerCase()

        // Check if the filter is in the item name or notes
        if (mealname.toLowerCase().includes(filter) || (meal.notes && meal.notes.toLowerCase().includes(filter))) {
            return true
        }

        // Check if the filter is in any of the meal's types
        for (var type of meal.type) {
            if (type.toLowerCase().includes(filter)) {
                return true
            }
        }

        // Check if the filter is any of the meal's categories
        for (var category of meal.category) {
            if (category.toLowerCase().includes(filter)) {
                return true
            }
        }

        // Iterate through the meal's ingredients to see if any of the item names contain our filter keyword
        if (meal.ingredients) {
            for (var ingredient of meal.ingredients) {
                if (ingredient.item.toLowerCase().includes(filter)) { 
                    return true
                }
            }
        }

        // If the filter is in none of the above, return false
        return false
    }

    // Triggered on toggle to the switch in the meal component
    enabled(event, mealname) {
        var meals = this.state.meals

        meals[mealname].enabled = event.target.checked
        this.setState({"meals":meals}, () => {
            this.updateData()
        })
    }

    // Triggered on click of the pen icon on the meal image
    editImage() {
        if (Object.keys(this.state.selectedmeal).length > 0) {  // If there is a selected meal, click the invisible fileselector
            document.getElementById('fileselector').click()
        }
    }

    // Called on click of fileselector
    imageInput() {
        var meals = this.state.meals    

        const reader = new FileReader()
        var file = document.getElementById('fileselector').files[0] // Get the first file chosen

        // When image is loaded update the data and re-render
        reader.addEventListener("load", () => {
            meals[this.state.mealname]["image"] = reader.result
            this.setState({"selectedmeal":meals[this.state.mealname], "meals":meals})
            this.updateData()
        }, false);

        if (file) {
            reader.readAsDataURL(file)
        }
    }

    // Strips a string to a certain amount of characters and adds a "..."
    stripText(text, n) {
        if (text.length > n) {
            return text.slice(0,n-3) + "..."
        } else {
            return text
        }
    }

    // Runs after the component has rendered for the first time, just sets up the style logic for the accordian menu in the meal editor
    componentDidMount () {
        var acc = document.getElementsByClassName("accordion")
        var i

        // Iterate through each accordion
        for (i = 0; i < acc.length; i++) {
            acc[i].addEventListener("click", function () {    // Triggers on accordion click and toggles showing the contents of the accordions
                this.classList.toggle("active")

                var panel = this.nextElementSibling

                if (panel.style.display === "block") {
                    panel.style.display = "none"
                } else {
                    panel.style.display = "block"
                }
            })
        }

        
    }

    // Runs after the component is rendered
    componentDidUpdate() {
        if (this.nameJustChanged) {
            Array.from(document.getElementsByClassName("meal")).forEach((meal) => {
                if (meal.getElementsByClassName("mealname")[0].innerHTML == this.state.mealname) {  
                    meal.parentNode.scrollTop = meal.offsetTop       // Scrolls in the meallist to selectedmeal
                }
            })
            this.nameJustChanged = false
        }
    }

    
    // Render function
    render() {
        
        // If it is the first time rendering, get meals
        if (getCookie("token") && this.props.secret && Object.keys(this.state.meals).length === 0) {
            this.getMeals()
        }

        
        var meals = []

        Object.keys(this.state.meals).sort((a, b) => {              // First sort the meals alphabetically case insensitive
            return a.toLowerCase().localeCompare(b.toLowerCase())
        }).forEach(meal => {                                        // Iterate through each meal and return the meal component
            if (this.state.applyFilter) {
                if (this.filterMeal(this.state.meals[meal], meal) ) {
                    meals.push(<Meal name={meal} data={this.state.meals[meal]} onClick={() => this.fillEditor(meal)} selectedMeal={this.state.mealname} enabled={this.enabled}/>)
                }
            } else {
                meals.push(<Meal name={meal} data={this.state.meals[meal]} onClick={() => this.fillEditor(meal)} selectedMeal={this.state.mealname} enabled={this.enabled}/>)
            }
            
        })

        var types = []
        var categories = []
        var ingredients = []

        if (Object.keys(this.state.selectedmeal).length > 0) {
            var servings = this.state.selectedmeal.servings
        } else {
            var servings = ""
        }
        

        // If there is a meal thats selected, fill the accordian menu with the types, categories, and ingredients
        if (Object.keys(this.state.selectedmeal).length > 0) {

            // Add an input field to the type accordion
            types.push(
                <div class="item">
                    <input list="types" type="text" id="typeInput"/>
                    
                    <datalist id="types">
                        <option value="Breakfast"></option>
                        <option value="Lunch"></option>
                        <option value="Dinner"></option>
                        <option value="Dessert"></option>
                        <option value="Snack"></option>
                    </datalist>
                    <span class="plusicon" onClick={this.handleAddType}>+</span>
                </div>
            )

            var i = 0   // We're gonna keep track of the index so we can use it to identify the type in the callback function

            // Iterate through each type in the selectedmeal to fill the type accordion
            this.state.selectedmeal.type.forEach(type => {
                if (type != "None") {
                    types.push(
                        <div class="item">
                            <p>{type}</p>
                            <span class="xicon" id={i} onClick={this.handleRemoveType}>✕</span>
                        </div>
                    )
                    i++
                }
            })
            
            // Fill the unit dropdown with the unit options
            var options = ["Chicken","Beef","Salad","Soup","Stew","Pasta","Egg","Pork","Fish","Sandwich","Seafood","Baked","Fried","Bread","Pizza"].map(category => {
                return(<option value={category}></option>)
            })

            // Add a input field for adding new categories
            categories.push(
                <div class="item">
                    <input list="categories" type="text" id="categoryInput"/>
                    
                    <datalist id="categories" value="category">
                        {options}
                    </datalist>
                    <span class="plusicon" onClick={this.handleAddCategory}>+</span>
                </div>
            )

            var i = 0   // We're gonna keep track of the index so we can use it to identify the category in the callback function

            // Iterate through each category in the selected meal to fill the category accordion
            this.state.selectedmeal.category.forEach(category => {
                if (category != "None") {
                    categories.push(
                        <div class="item">
                            <p>{category}</p>
                            <span class="xicon" id={i} onClick={this.handleRemoveCategory}>✕</span>
                        </div>
                    )
                    i++
                }
            })

            // Fill the unit dropdown with the unit options
            var options = ["teaspoon","tablespoon","cup","pint","ounce","package","slice","pinch","clove","piece","pound"].map((unit) => {
                return (<option value={unit}>{unit}</option>)
            })

            // Add a empty ingredient component for the inpuwtting of new ingredients
            ingredients.push(
                <div>
                    <div class="item" class="addingredient">
                        <input type="number" min="0" id="num"/>
                        <select id="unit">
                            <option value=""></option>
                            {options}
                        </select>
                        <input type="text" id="ingredient"></input>
                        <span class="plusicon" onClick={this.handleAddIngredient} style={{transform: "translate(0px,-15px)"}}>+</span>
                    </div>
                </div>
            )

            var i = 0   // We're gonna keep track of the index so we can use it to identify the ingredient in the callback function
            if (this.state.selectedmeal.ingredients) {

                // Iterate through each ingredient
                this.state.selectedmeal.ingredients.forEach(ingredient => {
                    if (ingredient.num == -1) { 
                        ingredients.push(       // Add the ingredient component if there is no number
                            <div class="item">
                                <p>{ingredient.unit +" "+ ingredient.specifier +" "+ ingredient.item}</p>
                                <span class="xicon" id={i} onClick={this.handleRemoveItem}>✕</span>
                            </div>
                        )
                    } else {
                        // Fill the unit dropdown with the unit options
                        var options = ["teaspoon","tablespoon","cup","pint","ounce","package","slice","pinch","clove","piece","pound","jar"].map((unit) => {
                            if (unit != ingredient.unit) {
                                return (<option value={unit}>{unit}</option>)
                            }
                        })

                        ingredients.push(   // Add the ingredient component to the ingredient list
                            <div class="item">
                                <input type="number" id={i} min="0" value={ingredient.num} onChange={this.handleNumChange}/>
                                <select value={ingredient.unit} id={i} onChange={this.handleUnitChange} style={ingredient.unit ? {"display":"inline"} : {"display":"none"}}>
                                    <option value="DEFAULT">{ingredient.unit}</option>
                                    {options}
                                </select>
                                <p>{this.stripText(ingredient.specifier +" "+ ingredient.item,29)}</p>
                                <span class="xicon" id={i} onClick={this.handleRemoveItem}>✕</span>
                            </div>
                        )
                    }
                    i++
                })
            }
            
            // Iterate through each cmponent of the nutrition info
            var nutritionInfo = Object.keys(this.state.selectedmeal.nutrition).map(info => {
                var unit = ""
                if (info == "protein" || info == "carbohydrates" || info == "fat") { unit = "(g)"}  // If the unit is in grams, add a (g)
                if (info == "sodium" || info == "cholesterol") { unit = "(mg)"}                     // If the unit is in milligrams, add a (mg)

                return (    // Format the nutrition component
                    <div class="item nutritionitem">
                        {info[0].toUpperCase() + info.slice(1) + " "+ unit}
                        <input type="number" id={info} min="0" style={{float: "right", "margin-right":"10px"}} onChange={this.handleNutritionChange} value={this.state.selectedmeal.nutrition[info]}/>
                    </div>
                )
            })
        }
        

        // If there are notes fill the notes section with them
        var notes = this.state.selectedmeal["notes"]
        if (!notes) {
            notes = ""
        }

        // If there is an image to the selected meal, show it. Otherwise, show the deafault camera icon.
        var mealEditorImage = defaultImage
        if (this.state.selectedmeal.image) {
            mealEditorImage = this.state.selectedmeal.image
        }

        return (    // Format the meal selection window and the meal editor window
            <div>
                <div id="mealselector" class="w3-card-4 w3-margin">
                    <div id="header" style={{"margin-bottom": "0px",height: "40px"}}>
                        <h3 style={{"display": "inline-block", "margin": "0px"}}>Meal Selection</h3>
                        <div id="filterParent">
                            <input id="filterText" value={this.state.filter} placeholder="Filter" onChange={this.handleFilterChange}></input>
                            <button id="filterButton" class="w3-button w3-hover-white w3-round-large" onClick={this.toggleFilter}>
                                <img id="filterIcon" src={this.state.applyFilter ? filterIcon : noFilterIcon}></img>
                            </button>
                        </div>
                    </div>
                    <div id="meallist">
                        {meals}
                    </div>
                    <div id="footer" style={{"margin-top":"0px"}}>
                        <button class="addmealbutton w3-button w3-hover-white w3-round-large" onClick={() => this.fillEditor("newmeal")}>Add Meal</button>
                        <button class="selecttogglebutton w3-button w3-hover-white w3-round-large" onClick={this.toggleSelect}>{this.state.selectToggle ? "Select All" : "Deselect All"}</button>
                    </div>
                </div>

                <div id="mealeditor" class="w3-card-4 w3-margin">
                    <div id="header" style={{"margin-bottom": "0px",height: "40px"}}>
                        <h3 style={{"margin-top":"0px","display": "inline-block"}}>Meal Editor</h3>
                        <button id="deleteMealButtonEditor" onClick={this.props.showWarning}>
                            <img id="deleteMealIcon" src={deleteMealIcon}></img>
                        </button>
                        <button id="importRecipe" onClick={this.props.showImport}>
                            <img id="importRecipeIcon" src={importRecipeIcon}></img>
                        </button>
                    </div>
                    <div id="editor">
                        <button class="accordion">Types</button>
                        <div class="panel">{types}</div>
                        
                        <button class="accordion">Categories</button>
                        <div class="panel">{categories}</div>

                        
                        <input type="number" min="1" max="100" value={servings} onChange={this.handleServingsChange} id="servings"/>
                        <button class="accordion">Ingredients<span style={{float: "right", "margin-right": "8px"}}>Servings</span></button>
                        <div class="panel">
                            {ingredients}
                        </div>

                        <button class="accordion">Nutrition <span style={{color: "gray"}}>(Per Serving)</span></button>
                        <div class="panel">{nutritionInfo}</div>

                        <button class="accordion">Notes</button>
                        <div class="panel">
                            <textarea onChange={this.handleNotesUpdate} value={notes}></textarea>
                        </div>
                    </div>
                    <div id="footer" style={{height:"40px",transform:"translate(0,10px)"}}>
                        <img class="mealimage" id="mealEditorImage" style={{height:"35px"}} src={mealEditorImage}></img>
                        <input type="file" id="fileselector" style={{display: "none"}} onChange={this.imageInput}></input>
                        <button id="editImageButton"><img id="editImage" src={editImage} onClick={this.editImage}></img></button>
                        <input style={{display:"inline","width":"45%","transform":"translate(-10px,0px)"}} onChange={this.handleNameChange} value={this.state.mealname} placeholder={this.state.placeholder}></input>
                    </div>
                </div>
            </div>
        )
    }
}

export default MealSelector