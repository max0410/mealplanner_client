/* 
This is the class for the calendar window, it is responsible for:
1. Communicating with the server to save calendar data
2. Communicating with the mealselector to show clicked meals and get meals that are enabled
3. Display each meal cell and makes them interactive
4. Displays each type as a row of meal cells that can all be manipulated at once
5. Displays each day as a column of meal cells that can be enabled/disbaled at once
6. Communicates with the rule generator
7. Uses rules from the rule generator to generate the meal cells
8. Communicating with nutrition info and shopping list to convey data
*/

// Import for React native and the css
import React, { useLayoutEffect } from 'react'
import ReactDOM from 'react-dom'
import '../index.css'

// Icon image imports
import reload from '../icons/reload.png'
import reloadblue from '../icons/reloadblue.png'
import checkmark from "../icons/tick.png"
import greenCheckmark from "../icons/greentick.png"
import plus from "../icons/plus.png"
import exportIcon from "../icons/export.png"
import hamburger from "../icons/hamburger.png"
import editRulesIcon from '../icons/editRules.png'

// Import jquery for sending post requests to host
import $ from "jquery"
var aesjs = require('aes-js')

var domain = "http://127.0.0.1:3000"

// Global variables for dragging calendar cells and rows
var draggedFrom = []
var draggedTo = []
var draggedFromType = ""
var draggedToType = ""

// Helper function to retreive the user token which is stored as a cookie
function getCookie(cname) {
    var name = cname + "="
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
    return ""
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

// When we try and copy objects in javascript, javascript will just create a reference. Using jsonCopy, we can create a deep copy of the src.
function jsonCopy(src) {
  return JSON.parse(JSON.stringify(src))
}

// Class for the calendar window
class Calendar extends React.Component {
  constructor(props) {
    super(props)

    // Class properties to store data on the calendat and the rulesets
    this.state = {types: [], "days": {}, meals: {}, calendar: {}, calendarJSX: [], overallServings: 2, rulesets: {}, currentRuleset: 0}
    
    // Class methods must be binded in react
    this.getData =                this.getData.bind(this)
    this.generateCalendar =       this.generateCalendar.bind(this)
    this.reloadMeal =             this.reloadMeal.bind(this)
    this.deleteMeal =             this.deleteMeal.bind(this)
    this.toggleDay =              this.toggleDay.bind(this)
    this.updateData =             this.updateData.bind(this)
    this.addType =                this.addType.bind(this)
    this.typeNameChange =         this.typeNameChange.bind(this)
    this.overallServingsUpdate =  this.overallServingsUpdate.bind(this)
    this.applyServingsOverride =  this.applyServingsOverride.bind(this)
    this.changeMealServings =     this.changeMealServings.bind(this)
    this.getCalendar =            this.getCalendar.bind(this)
    this.getCalendarExport =      this.getCalendarExport.bind(this)
    this.editRules =              this.editRules.bind(this)
    this.updateRuleset =          this.updateRuleset.bind(this)
    this.changeCurrentRuleset =   this.changeCurrentRuleset.bind(this)
    this.getAllowedMeals =        this.getAllowedMeals.bind(this)
    this.filterMeal =             this.filterMeal.bind(this)
    this.ruleIsValid =            this.ruleIsValid.bind(this)
    this.getTotals =              this.getTotals.bind(this)
    this.getRepeats =             this.getRepeats.bind(this)
    this.getCategoriesPresent =   this.getCategoriesPresent.bind(this)
  }

  // Retreives user data from the host
  getData(callback = null) {
    $.ajax({
        type: "POST",
        url: domain +"/user_data",
        data: JSON.stringify({ sessionID: this.props.sessionID, uid: getCookie("token")}),  // Send sessionID and UID
        contentType: "application/json; charset=utf-8",
        dataType: "json",
        success: (data) => {
            // Set our meal state to the meal data we got from the host, we must first unecrypt it with the secret parameter and parse it into a JSON object
            var data = JSON.parse(aesDecrypt(data.data,this.props.secret))
            this.setState({
              "meals": data.meals, 
              "types": data.types, 
              "days": data.days, 
              "calendar": data.calendar, 
              "rulesets": data.rulesets,
              "currentRuleset": data.currentRuleset
            }, () => {
              if (callback) { callback() }
            })
        },
        error: (e) => {
            console.log(e)
        }
    })
  }

  // Sends state data to the server
  updateData() {
    $.ajax({  // Sends a post request to the server at /set_data
        type: "POST",
        url: domain +"/set_data",
        // Send sessionID, userID, and encrypted calendar information
        data: JSON.stringify({ 
          sessionID: this.props.sessionID, 
          uid: getCookie("token"), 
          days: aesEncrypt(JSON.stringify(this.state.days),this.props.secret), 
          types: aesEncrypt(JSON.stringify(this.state.types),this.props.secret),
          calendar: aesEncrypt(JSON.stringify(this.state.calendar),this.props.secret)
        }),
        contentType: "application/json; charset=utf-8",
        dataType: "json"
    })
  }

  // Function called by CalendarRules to update ruleset information on the calendar
  updateRuleset(rulesets) {
    this.setState({rulesets: rulesets}, () => {
      if (this.state.currentRuleset >= rulesets.length) {   // If a ruleset was deleted and the calendar was using that ruleset, change the current ruleset index
        this.setState({currentRuleset: rulesets.length-1})
      }
    })
  }

  // Triggered on change in the ruleset dropdown
  changeCurrentRuleset(event) {
    this.setState({currentRuleset: event.target.value})
  }

  // A getter function for getting calendar data for other components such as the shoppinglist or the nutrition info
  getterCalendar(callback = null) {
    if (callback) {
      this.getData(() => {
        callback(this.state.calendar)
      })
    } else {
      return this.state.calendar
    }
  }

  // Function for checking if a selector would be selecting for a certain day and type
  mealSelected(selector, day, type) {
    return ((selector.select == "day" && selector.parameters.includes(day)) || (selector.select == "type" && selector.parameters.includes(type)) || selector.parameters.includes("all"))
  }

  // Checks if rule isn't a new one or has any empty fields
  ruleIsValid(rule) {
    if (!rule.new) {

      // Iterates through each parameter to see if any are empty
      for (var parameter of Object.keys(rule.parameters)) {
        if (!rule.parameters[parameter]) {
          return false
        }
      }

      return true
    } else {
      return false
    }
  }

  // Checks if a meal has any data that includes the filter keywords, if it does return true, otherwise false
  filterMeal(filter, meal, mealname) {

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
    for (var ingredient of meal.ingredients) {
        if (ingredient.item.toLowerCase().includes(filter)) { 
            return true
        }
    }

    // If the filter is in none of the above, return false
    return false
  }

  // Gets the total number of a category in the calendar based upon rule data
  getTotals(calendar, selector, rule) {

    // Check if the selector is plural
    var selectorIsPlural = selector.parameters.length > 1 || selector.parameters.includes("all")

    var total = 0
    var totalEach = {}
    selector.parameters.forEach((parameter) => {
      if (selector.select == "day") {

        // Iterate through each type on the calendar
        Object.keys(calendar).forEach((type) => {

          if (this.state.days[parameter] && calendar[type] && calendar[type][parameter] && Object.keys(calendar[type][parameter]).length > 2) {  // Check if their is an actual meal there
            if (calendar[type][parameter].category.includes(rule.parameters.category)) {  // Check if the meal has the category that rule is matching for
              if (selectorIsPlural) { 
                if (rule.parameters.for == "all") {   // Check if the rule is checking total for all parameters
                  total++
                } else {                              // Check if the rule is checking total for each of the parameters
                  if (totalEach[parameter]) { 
                    totalEach[parameter]++
                  } else {
                    totalEach[parameter] = 1
                  }                         
                }
              } else {
                total++
              }
            }
          }

        })
      } else {
        if (calendar[parameter]) {
          // Iterate through each day on the calendar given the type in the selector
          Object.keys(calendar[parameter]).forEach((day) => {
            if (this.state.days[day] && calendar[parameter] && calendar[parameter][day]  && Object.keys(calendar[parameter][day]).length != 1) {  // Check if their is an actual meal there
              if (calendar[parameter][day].category.includes(rule.parameters.category)) { // Check if the meal has the category that the rule is matching for
                if (selectorIsPlural) { 
                  if (rule.parameters.for == "all") {   // Check if the rule is checking total for all parameters
                    total++
                  } else {                              // Check if the rule is checking total for each of the parameters
                    if (totalEach[parameter]) { 
                      totalEach[parameter]++
                    } else {
                      totalEach[parameter] = 1
                    }                         
                  }
                } else {
                  total++
                }
              }
            }
          })
        }
        
      }
    })

    return [total, totalEach]
  }

  // Get the amount of repeats of a specified category before the current meal
  getRepeats(calendar, selector, rule, mealType, mealDay) {
    if (selector.select == "day") {

      var typesBefore = this.state.types.slice(0,this.state.types.indexOf(mealType))  // Get the types before the current meal

      var repeats = 0   // Int to keep track of the number of time that the category has been repeated in the mealDay

      // Iterate through each type before the mealType for the mealDay specified
      typesBefore.forEach((type) => {
        if (this.state.days[mealDay] && calendar[type] && calendar[type][mealDay] && Object.keys(calendar[type][mealDay]).length != 1) {  // Check if their is an actual meal there
          if (calendar[type][mealDay].category == rule.parameters.category) {  // Check if meal has category that we are checking for
            repeats++
          }
        }
      })

      return repeats

    } else {

      // Get a ordered list of the days of week filtered out for days that aren't included on the calendar
      var days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Satuday"].filter((day) => {
        return this.state.days[day]
      })
      var daysBefore = days.slice(0,days.indexOf(mealDay))  // Get the days before the current meal

      var repeats = 0   // Int to keep track of the number of time that the category has been repeated in the mealType

      // Iterate through each day before the mealDay for the mealType specified
      daysBefore.forEach((day) => {
        if (this.state.days[mealDay] && calendar[mealType] && calendar[mealType][day] && Object.keys(calendar[mealType][day]).length != 1) {  // Check if their is an actual meal there
          if (calendar[mealType][day].category == rule.parameters.category) {  // Check if meal has category that we are checking for
            repeats++
          }
        }
      })

      return repeats
    }
  }

  // Determines whether or not a meal matches the rule and totals from the calendar
  checkMealConditions(meal, rule, total) {
    if (meal.category.includes(rule.parameters.category) && rule.parameters.condition == "at most") {     // Meal includes category and rule is "at most"
      return total < rule.parameters.amount
    } else if (rule.parameters.condition == "at least") {   // If rule condition is atleast, keep returning true for ONLY meals with category until the meal total matches the atleast
      if (meal.category.includes(rule.parameters.category) && total < rule.parameters.amount) {           // Meal includes category and has a total that is less than the rules amount
        return true
      } else if (!meal.category.includes(rule.parameters.category) && total < rule.parameters.amount) {   // Meal doesn't include category and has a total that is less than the rules amount
        return false 
      } else {
        return true
      }
    } else if (rule.parameters.condition == "exactly") {  // If rule condition is exactly, keep returning true for ONLY meals with category until the meal total matches the exactly, then only return false for meals with that category
      if (meal.category.includes(rule.parameters.category) && total < rule.parameters.amount) {           // Meal includes category and has a total that is less than the rules amount
        return true
      } else if (!meal.category.includes(rule.parameters.category) && total < rule.parameters.amount) {   // Meal doesn't include category and has a total that is less than the rules amount
        return false 
      } else if (meal.category.includes(rule.parameters.category) && total >= rule.parameters.amount) {   // Meal includes category and has a total that is greater or equal to the rule amount
        return false 
      } else {
        return true
      }
    } else {
      return true
    }
  }

  // Gets list of categories that are used in the meal list
  getCategoriesPresent() {
    var categories = []

    // Iterate through each meal and add the category lists together
    Object.keys(this.state.meals).forEach((mealname) => {
      var meal = this.state.meals[mealname]
      categories = categories.concat(meal.category)
    })
    
    return categories
  }

  // Get a list of allowed meals for each cell in the calendar
  getAllowedMeals(calendar, type, day) {

    // Get a list of meals with the type provided and enabled in the meal selector
    var mealsWithType = Object.keys(this.state.meals).filter(meal => this.state.meals[meal].type.includes(type) && this.state.meals[meal].enabled) 
    var allowedMeals = mealsWithType

    // Iterate through the selectors in the current ruleset
    var ruleset = this.state.rulesets[this.state.currentRuleset].slice() // Creates an exact copy of the array so when we change it, the changes won't show in CalendarRules
    ruleset.forEach((selector) => {
      var selector = jsonCopy(selector)
      if (selector.parameters && this.mealSelected(selector, day, type)) {   // Check if the meal would be selected by the selector

        if (selector.parameters.includes("all")) {  // Convert the all parameter into a list of parameters
          if (selector.select == "day") {
            selector.parameters = Object.keys(this.state.days).filter((day) => {return this.state.days[day]})
          } else {
            selector.parameters = this.state.types
          }
        }

        var categoriesPresent = this.getCategoriesPresent()  // Get a list of the categories present in meal selector so when the rule specifies "all" as the category we can find all of those categories

        // Iterate through each rule in the selector
        // Usually I'd use a forEach or for..of loop for something like this but selector.rules will be expanding while we iterate so we need to use a classic for loop here
        for (var i = 0; i < selector.rules.length; i++) {  
          var rule = Object.assign({}, selector.rules[i])     

          // If the rule is a total or repeats and has a category as "all", add a identical rule for each category
          if (rule.parameters && rule.rule != "Filter" && rule.parameters.category == "all" && !rule.new) {  

            // Iterate through every category present 
            categoriesPresent.forEach((category) => {
              var newRuleParameters = Object.assign({}, rule.parameters)  // Create a copy of the rule's parameter and change to the new category
              newRuleParameters.category = category

              selector.rules.push({   // Create a new identical rule but with that new category
                rule: rule.rule,
                parameters: newRuleParameters
              })
            })

            selector.rules.splice(i, 1)  // Remove current rule with the "all" category and move to the next rule
            continue
          }

          if (this.ruleIsValid(rule)) {     // Check if the rule isn't the new input rule or has any empty fields
            
            if (rule.rule == "Filter") {      // If the rule is a Filter
                allowedMeals = allowedMeals.filter((mealname) => {   // Filter through each of the allowedMeals
                  var meal = this.state.meals[mealname]
                  var isFiltered = this.filterMeal(rule.parameters.filter.toLowerCase(), meal, mealname)
                  if (rule.parameters.type == "exclude") {   // If the type is exclude, only return true for items that would not be filtered
                    return !isFiltered
                  } else {                        // If the type is apply, only return true for items that would be filtered
                    return isFiltered
                  }
                })
            } else if (rule.rule == "Total") {  // If the rule is a Total

              var totals = this.getTotals(calendar, selector, rule) // Get totals
              var total = totals[0]
              var totalEach = totals[1]

              var selectorIsPlural = selector.parameters.length > 1 || selector.parameters.includes("all")

              allowedMeals = allowedMeals.filter((mealname) => {   // Filter through each of the allowedMeals
                var meal = this.state.meals[mealname]
                
                if (selectorIsPlural) {
                  if (rule.parameters.condition == "for") {
                    if (selector.select == "day") {
                      return this.checkMealConditions(meal, rule, totalEach[day])
                    } else {
                      return this.checkMealConditions(meal, rule, totalEach[type])
                    }
                  } else {
                    return this.checkMealConditions(meal, rule, total)
                  }
                } else {
                  return this.checkMealConditions(meal, rule, total)
                }
                
              })
            } else if (rule.rule == "Repeats") {

              var repeats = this.getRepeats(calendar, selector, rule, type, day)  // Get repeats

              allowedMeals = allowedMeals.filter((mealname) => {  // Filter through each of the allowedMeals
                var meal = this.state.meals[mealname]

                if (rule.parameters.category == meal.category) {  // If the meal matches the rule's category than only allow it if its number of repeats is lower than the rule amount
                  return rule.parameters.amount > repeats
                } else {                                          // Otherwise just return true
                  return true
                }
              })
            }
            
          }
        }
      }
    })
    return allowedMeals
  }

  // Generates a JSON object of the calendar organized into types (the rows) and days (the columns)
generateCalendar() {

  // First fetch meal deta
  this.setState({meals: this.props.getMeals()}, () => {
    var calendar = {}

    // Only generate if the calendar successfully retreived the list of types
    if (this.state.types) {

      // Iterate through each type
      this.state.types.forEach(type => {
        calendar[type] = {}

        // Iterate through each day
        Object.keys(this.state.days).forEach(day => {

          // Get a list of meals that are allowed based upon the meal's day, type, and the ruleset rules
          var allowedMeals = this.getAllowedMeals(calendar, type, day)
          try {   // Error handling, if we reference a type and day that does not exist, than proceed to the catch

            // Check if a already meal exists in the calendar JSON
            if ((this.state.days[day] && Object.keys(this.state.calendar[type][day]).length != 1) || this.state.calendar[type][day].noGen) {
              var mealname = allowedMeals[Math.floor(Math.random() * allowedMeals.length)]  // Get random meal
              var meal = this.state.meals[mealname]

              if (meal) {   // If the random meal is not undefined
                meal["name"] = mealname
                meal["hovered"] = false
                meal["mealexists"] = true

                if (meal.ingredients) {   // Check that the meal has ingredients

                  // Iterate through each ingredient and convert quantities based on the overallServings number
                  meal.ingredients = meal.ingredients.map(ingredient => { 
                      if (ingredient["num"] != -1) {
                          ingredient["num"] = (ingredient["num"] / meal.servings) * parseInt(this.state.overallServings)
                      }
                      return ingredient
                  })
                  meal["servings"] = this.state.overallServings // Apply the overall servings to the meal's servings

                }

                calendar[type][day] = meal   
              } else if (allowedMeals.length == 0) {  // If their is a calendar cell that exists but it cannot be generated because the rules do not permit it, add a noGen property
                calendar[type][day] = {"noGen": true}
              } else {                                // If their is no meal but not because there are none that can be generated, set mealexists to fakse
                calendar[type][day] = {"mealexists": false}
              }
            } else if (Object.keys(this.state.calendar[type][day]).length == 1 && this.state.calendar[type][day].mealexists) {  // If the meal exists and the cell exists than set mealexists to true
              calendar[type][day] = {"mealexists": true}
            } else {    // Otherwise set to false
              calendar[type][day] = {"mealexists": false}
            }
          } catch (e) {   // If the calendar cell is undefined
            var mealname = allowedMeals[Math.floor(Math.random() * allowedMeals.length)]  // Get random meal
            var meal = this.state.meals[mealname]

            if (meal) {   // If the meal is valid
              meal["name"] = mealname
              meal["hovered"] = false
              meal["mealexists"] = true

              // Iterate through each ingredient and convert quantities based on the overallServings number
              if (meal.ingredients) {
                meal.ingredients = meal.ingredients.map(ingredient => {
                    if (ingredient["num"] != -1) {
                        ingredient["num"] = (ingredient["num"] / meal.servings) * parseInt(this.state.overallServings)
                    }
                    return ingredient
                })
                meal["servings"] = this.state.overallServings // Apply the overall servings to the meal's servings
              }
              calendar[type][day] = meal   
            } else if (allowedMeals.length == 0) {  // If their is a calendar cell that exists but it cannot be generated because the rules do not permit it, add a noGen property
              calendar[type][day] = {"noGen": true}
            } else {
              calendar[type][day] = {"mealexists": false} // If their is no meal but not because there are none that can be generated, set mealexists to fakse
            }
          }
        })
      })
      this.setState({calendar: calendar, "calendarJSX": this.getCalendar(calendar)}, () => {
        this.updateData()
      })
    }
  })
}

  // Gets a simplified version of the JSX for the calendar for printing and exporting
  getCalendarExport() {
    var calendar = this.state.calendar
    var result = []

    // If the calendar has type
    if (this.state.types) {

      // Iterate through each type
      this.state.types.forEach(type => {
        var row = new Array(7)  // Create an empty row array

        // Iterate through each day
        Object.keys(this.state.days).forEach(day => {
          var meal = {}
          if (type){
            if (!calendar[type]) {
              row[i] = (
                <th class="empty">
                </th>
              )
              return
            }
            var meal = calendar[type][day]
          }

          // Get the index of the day so we can put the day columns in order
          var i = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"].indexOf(day)
          if (!meal) {
            row[i] = (
              <th class="empty">
              </th>
            )
            return
          }

          // Get a meal cell 
          if (this.state.days[day] && Object.keys(meal).length > 1) {
            row[i] = (
              <th class="mealcellExport">
                <div class="celltextExport"><a class="meallinkExport" href={meal.url} target="_blank">{meal.name}</a></div>
              </th>
            )
          } else {
            // Get meal buttons
            row[i] = (
              <th class="empty">
                <img src={greenCheckmark} class="emptyCheckmark" style={this.state.days[day] && type && meal["mealexists"] ? {display: "block"} : {"display": "none"} }></img>
              </th>
            )
          }
          
        })
        if (type) {   // If the type exists create a row for it
          row.unshift(
            <th>
              <span class="typeInputExport">{type}</span>
            </th>
          )
        } else {
          row.unshift(
            <th class="vertInputCell">
              <span class="typeInput"></span>
            </th>
          )
        }
        
        result.push(
          <tr class="mealrowExport">{row}</tr>
        )
      })
    }

    return (    // Format the simplified calendars
      <div class="w3-card-4 w3-margin w3-border-2021-illuminating" id="calendarExport">
        <div id="header" style={{height: "50px"}}>
          <h3 style={{display: "inline"}}>Calendar</h3>
        </div>
        <div id="calendarbody">
          <table>
            <tr id="row1">
              <th style={{"background-color": "#969696"}}></th><th>Sunday</th><th>Monday</th><th>Tuesday</th><th>Wednesday</th><th>Thursday</th><th>Friday</th><th>Saturday</th>
            </tr>
            {result}
          </table>
        </div>
        <div id="footer" style={{"margin-top":"0px"}}>
        </div>
      </div>
    )
  }

  // Gets the calendar JSX
  getCalendar(calendar) {
    var result = []

    // If the calendar has any types
    if (this.state.types) {

      // Iterate through each type
      this.state.types.forEach(type => {
        var row = new Array(7)  // Create an empty array for the row

        // Iterate through each day
        Object.keys(this.state.days).forEach(day => {
          var meal = {}
          if (type){
            if (!calendar[type]) {
              row[i] = (
                <th class="empty" onDragOver={() => draggedTo = [type,day]}>
                </th>
              )
              return
            }
            var meal = calendar[type][day]
          }

          // Get the index of the day so we can put the day columns in order
          var i = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"].indexOf(day)
          if (!meal) {
            row[i] = (
              <th class="empty" onDragOver={() => draggedTo = [type,day]}>
              </th>
            )
            return
          }

          // Get a meall cell
          if (this.state.days[day] && Object.keys(meal).filter((property) => property != "checked").length > 1) {
            row[i] = (
              <th class="mealcell" onClick={() => this.props.fillEditor(meal.name,"calendar")} onDragOver={() => draggedTo = [type,day]} onDragStart={() => draggedFrom = [type,day]}>
                <img class="mealimage cellimage" src={meal.image} draggable="false"></img>
                <div class="celltext"><a class="meallink" href={meal.url} target="_blank">{meal.name}</a></div>
                <div class="deleteMeal" onClick={() => this.deleteMeal(type,day)}>✕</div>
                <img class="reloadMeal" src={reloadblue} onClick={() => this.reloadMeal(type,day)} draggable="false"></img>
                <img class="dragMeal" src={hamburger} draggable="false"></img>
                <div class="cellservings"><input class="numservings" ondrop="return false;" type="number" min="1" onChange={(event) => this.changeMealServings(event, type,day)} value={meal.servings}></input> <div class="numservingstext">Servings</div></div>
              </th>
            )
          } else {  // Get a empty meal cell
            row[i] = (
              <th class="empty" onDragOver={() => draggedTo = [type,day]} >
                <img src={greenCheckmark} class="emptyCheckmark" onClick={() => this.reloadMeal(type,day)} style={this.state.days[day] && type && meal["mealexists"] ? {display: "block"} : {"display": "none"} }></img>
              </th>
            )
          }
          
        })

        // Get a type row 
        if (type) {
          row.unshift(
            <th class="typeRow" onDragStart={() => draggedFromType = type} onDragOver={() => draggedToType = type}>
              <span class="typeInput"><input type="text" style={{width: '70px', "text-align": "center"}} onChange={(event) => this.typeNameChange(event, type)} value={type}></input></span>
              <div class="deleteMeal" onClick={() => this.deleteRow(type)}>✕</div>
              <img class="reloadRow" src={reloadblue} onClick={() => this.reloadRow(type)} draggable="false"></img>
              <img class="dragMeal" src={hamburger} draggable="false"></img>
            </th>
          )
        } else {  // Get an empty type row
          row.unshift(
            <th class="vertInputCell">
              <span class="typeInput"><input type="text" style={{width: '70px', "text-align": "center"}} onChange={(event) => this.typeNameChange(event, type)}></input></span>
              <div class="deleteMeal" onClick={() => this.deleteRow(type)}>✕</div>
              <img class="reloadRow" src={reloadblue} draggable="false"></img>
              <img class="dragMeal" src={hamburger} draggable="false"></img>
            </th>
          )
        }
        
        result.push(
          <tr class="mealrow">{row}</tr>
        )
      })
    }

    // Formatting has created an empty margin at the bottom of the page, so the window height is fixed. So, when calendar height changes, we must change the height of the window.
    document.getElementById("root").style.height = 875 + this.state.types.length*90 + "px"
    this.updateData()

    return result
  }

  // Changes the name of a type
  typeNameChange(event, type) {
    var value = event.target.value

    var types = this.state.types
    var calendar = this.state.calendar
    var index = types.indexOf(type)

    // Only update name if it doesn't have the word "handle" in it, when dragging types, sometimes the row element can be dragged into the input field, where the word "handle" will be added
    if (!value.includes("handle")) {
      types[index] = value                // Update type list
      calendar[value] = calendar[type]    // Create a new calendar property after the new type
      delete calendar[type]               // Delete the old type property

      this.setState({types: types}, () => {
        this.setState({calendar: calendar, "calendarJSX": this.getCalendar(calendar)}, ()=> {
          this.updateData()
        })
      })
    }
  }

  // Generates a meal/reloads it given a type and day
  reloadMeal(type, day) {

    // Fetch the meal list from the meal selector
    this.setState({meals: this.props.getMeals()}, () => {
      var allowedMeals = this.getAllowedMeals(this.state.calendar, type, day)        // Get a list of meals that can fit the type, day, and rule restrictions
      var mealname = allowedMeals[Math.floor(Math.random() * allowedMeals.length)]  // Get random meal
      var meal = this.state.meals[mealname]
      var calendar = this.state.calendar
      
      if (meal) {   // If the meal is valid
        meal["name"] = mealname
        meal["hovered"] = false
        meal["mealexists"] = true

        // If the meal has ingredients, convert each ingredient amount to match the overallServings
        if (meal.ingredients) {
          // Iterate through each ingredient
          meal.ingredients = meal.ingredients.map(ingredient => {
              if (ingredient["num"] != -1) {    // If the ingredient has an amount, convert the servings to the overallServings
                  ingredient["num"] = (ingredient["num"] / meal.servings) * parseInt(this.state.overallServings)
              }
              return ingredient
          })
          meal["servings"] = this.state.overallServings
        }
        calendar[type][day] = meal   

      } else if (allowedMeals.length == 0) {    // If the rules don't allow for the meal's existence, make it no gen
        calendar[type][day] = {"noGen": true}
      } else {
        calendar[type][day] = {"mealexists": false}
      }

      this.setState({calendar: calendar, "calendarJSX": this.getCalendar(calendar)})
    })
  }

  // Triggered on reload button on a row, reloads each meal in a row
  reloadRow(type) {

    // Get meal data first
    this.setState({meals: this.props.getMeals()}, () => {
      var calendar = this.state.calendar
      
      // Iterate through each meal and reload it
      Object.keys(calendar[type]).forEach(day => {
        this.reloadMeal(type, day)
      })

      this.setState({calendar: calendar, "calendarJSX": this.getCalendar(calendar)}, () => {
        this.updateData()
      })
    })
  }

  // Deletes a meal by overriding its contents with a mealexists propety
  deleteMeal(type, day) {
    var calendar = this.state.calendar
    calendar[type][day] = {"mealexists": true}
    this.setState({calendar: calendar, "calendarJSX": this.getCalendar(calendar)})
  }

  // Deletes an entire row by removing the type from the types list and deleting the type property from the calendar
  deleteRow(type, day) {
    var types = this.state.types
    var calendar = this.state.calendar

    if (types.length == 1) {  // Prevents user from completing deleting all types
      return
    }

    // Delete type from types list by filtering it out, deletes type property from calendar
    types = types.filter(e => e != type)
    delete calendar[type]

    this.setState({types: types}, () => {
      this.setState({calendar: calendar, "calendarJSX": this.getCalendar(calendar)}, () => {
        this.updateData()
      })
    })
  }

  // Adds a new row in the calendar
  addType() {
    var types = this.state.types
    var calendar = this.state.calendar

    // Add a new type "null" with empty data for each day
    types.push(null)
    calendar[null] = {"Sunday":{},"Monday":{},"Tuesday":{},"Wednesday":{},"Thursday":{},"Friday":{},"Saturday":{}}

    this.setState({types: types}, () => {
      this.setState({calendar: calendar, "calendarJSX": this.getCalendar(calendar)})
    })
  }

  // Updates the overallServings of the calendar when their is a change in the input field
  overallServingsUpdate(event) {
    this.setState({overallServings: event.target.value})
  }

  // Triggered on change to the servings input field in a meal cell, adjust ingredient quantities
  changeMealServings(event, type,day) {
    var calendar = this.state.calendar
    if (calendar[type][day].ingredients) {

      // Iterate through each ingredient
      calendar[type][day].ingredients = calendar[type][day].ingredients.map(ingredient => {
          if (ingredient["num"] != -1) {    // If the ingredient has a number, convert the number to match the new servings
              ingredient["num"] = (ingredient["num"] / calendar[type][day].servings) * parseInt(event.target.value)
          }
          return ingredient
      })

      calendar[type][day].servings = event.target.value
    }
    this.setState({calendar: calendar, "calendarJSX": this.getCalendar(calendar)})
  }

  // Triggered after render, sets up dragging behavior of rows and cells
  componentDidUpdate() {

    // Iterates through each meal cell
    Array.from(document.getElementsByClassName("mealcell")).forEach(draggable => {
      var handle = draggable.getElementsByClassName("dragMeal")[0]  // Gets the DOM for the handle in the cell
      var target = false

      handle.onmousedown = function(e) {  // If handle is clicked, make the meal cell draggable
          e.target.parentNode.setAttribute('draggable', 'true')
      }

      handle.onmouseup = function(e) {    // If handle is not clicked, make the meal cell not draggable
          e.target.parentNode.setAttribute('draggable', 'false')
      }

      // When an element is dropped
      draggable.ondragend = (e) => {
        e.target.setAttribute('draggable', 'false') // Make the element not draggable again

        var calendar = this.state.calendar

        // Check if the meal we are dragging to is not empty
        if (Object.keys(calendar[draggedTo[0]][draggedTo[1]]).length > 2) {

          // Swap elements
          var temp = calendar[draggedFrom[0]][draggedFrom[1]]
          calendar[draggedFrom[0]][draggedFrom[1]] = calendar[draggedTo[0]][draggedTo[1]]
          calendar[draggedTo[0]][draggedTo[1]] = temp

          this.setState({calendar: calendar, "calendarJSX": this.getCalendar(calendar)}, () => {
            this.updateData()
          })
        }
      }
    })
    
    // Iterates through each meal row
    Array.from(document.getElementsByClassName("mealrow")).forEach(draggable => {
      var handle = draggable.getElementsByClassName("dragMeal")[0]  // Get the meal row handle
      var target = false

      handle.onmousedown = function(e) {  // If handle is clicked, make the meal row draggable
          e.target.parentNode.setAttribute('draggable', 'true')
      }

      handle.onmouseup = function(e) {    // If handle is not clicked, make the meal row not draggable
          e.target.parentNode.setAttribute('draggable', 'false')
      }

      // When element is dropped
      draggable.ondragend = (e) => {
        e.target.setAttribute('draggable', 'false')   // Make dragging false again

        if (draggedFromType && draggedToType) {
          var types = this.state.types

          // Get the indexes of the types so we can manipulate them in the list
          var fromIndex = types.indexOf(draggedFromType)
          var toIndex = types.indexOf(draggedToType)

          if (fromIndex > toIndex) {    // If dragging element from down to top, put from element before to element
            types.splice(toIndex, 0, types[fromIndex])
            types.splice(fromIndex+1, 1)
          } else {                      // If dragging element from top to down, put from element after to element
            types.splice(toIndex+1, 0, types[fromIndex])
            types.splice(fromIndex, 1)
          }
          
          // Reset drag types
          draggedFromType = ""
          draggedToType = ""
  
          this.setState({types: types}, () => {
            this.setState({"calendarJSX": this.getCalendar(this.state.calendar)}, () => {
              this.updateData()
            })
          })
        }
      }
    })
  }

  // Toggles a day when the day button is clicked on the bottom
  toggleDay(day) {
    var days = this.state.days
    days[day] = !days[day]  // Toggles day boolean

    if (days[day]) {    // If the day is true

      // Go through each type in the day and relaod it
      Object.keys(this.state.calendar).forEach(type => {
        this.reloadMeal(type,day)
      })

      this.setState({days: days}, () => {
        this.setState({"calendarJSX": this.getCalendar(this.state.calendar)})
      })
    } else {            // If the day is false
      var calendar = this.state.calendar
      
      // Go through each type in the day and set it so it doesn't exist
      Object.keys(calendar).forEach(type => {
        calendar[type][day] = {"mealexists":false}
      })

      this.setState({days: days, calendar: calendar}, () => {
        this.setState({"calendarJSX": this.getCalendar(this.state.calendar)}, () => {
          this.updateData()
        })
      })
    }
    
  }

  // Applies the overallServings number to all meals in the calendar
  applyServingsOverride() {
    var calendar = this.state.calendar

    // Iterate through each cell by going to each type and day
    this.state.types.forEach(type => {
      Object.keys(this.state.days).forEach(day => {

        if (Object.keys(calendar[type][day]).length > 1) {  // If the meal cell is populated with a meal
          if (calendar[type][day].ingredients) {            // ...and the meal cell has ingredients

            // Iterate through each ingredient in the meal
            calendar[type][day].ingredients = calendar[type][day].ingredients.map(ingredient => {

                // If the ingredient has a number convert it based on the new servings
                if (ingredient["num"] != -1) {
                    ingredient["num"] = (ingredient["num"] / calendar[type][day].servings) * parseInt(this.state.overallServings)
                }
                return ingredient
            })

          }
          calendar[type][day].servings = this.state.overallServings
        }

      })
    })
    this.setState({calendar: calendar, "calendarJSX": this.getCalendar(calendar)})
  }

  // Triggered on edit ruleset button click, communicates with CalendarRules to send data and display the window
  editRules() {
    this.props.showCalendarRules(this.state.rulesets, this.state.currentRuleset, this.state.days, this.state.types)
  }

  // Called when the calendar is first rendered
  componentDidMount() { 
    if (this.props.hadSignedUp) {   // If the user is signed in, generate the calendar
      this.getData(() => {
        this.props.getMeals((meals) => {
          this.generateCalendar()
          this.props.calendarLoaded()
        })
      })
    }
  }

  // Called when the calendar receives parameters from the application
  componentWillReceiveProps() {

    // Get data from the server
    this.getData(() => {
      this.props.getMeals((meals) => {  // Get meal data
        if (this.state.calendar["default"]) { // If calendar data is empty generate new calendar
          this.generateCalendar()
        } else {                              // If calendar data is full get the JSX for the calendar
          this.setState({"calendarJSX": this.getCalendar(this.state.calendar)})
        }
        this.props.calendarLoaded()   // Communicate with other components to populate
      })
    })
  }

  render() {

    // Iterate through each day and add either a check button or X button at the bottom
    var buttons = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].map(day => {
      if (this.state.days[day]) { 
        return (<th style={{"background-color": "#f0756e", "color": "white"}} onClick={() => this.toggleDay(day)}>✖</th>)}
      else { 
        return (<th style={{"background-color":"#60cc6c"}} onClick={() => this.toggleDay(day)}><img class="check" src={checkmark}></img></th>) 
      }
    })
    buttons.unshift(<th style={{"background-color": "white"}} onClick={this.addType}><img style={{"height": "15px", "width": "15px"}}src={plus}></img></th>)

    var rulesetOptions = []

    // If there are rulesets than add each ruleset as an option in the select
    if (this.state.rulesets.length > 0) {
        var i = -1

        // Iterate through each ruleset and add an option for the ruleset dropdown
        rulesetOptions = this.state.rulesets.map((ruleset) => {
            i++

            return (
                <option value={i}>{"Ruleset " + (i+1)}</option>
            )
        })
    }

    return (  // Format calendar
      <div class="w3-card-4 w3-margin w3-border-2021-illuminating" id="calendar">
        <div id="header" style={{height: "50px"}}>
          <h3 style={{display: "inline"}}>Calendar</h3>
          <span id="servingsOverride">Plan for <input id="servingsOverrideInput" type="number" min="1" onChange={this.overallServingsUpdate} value={this.state.overallServings}></input> servings.</span>
          <button id="servingsApply" onClick={this.applyServingsOverride}>Apply</button>
          <button class="reloadButton" onClick={this.generateCalendar}><img id="reloadIcon" src={reload}></img></button>
          <button class="exportButton" onClick={() => this.props.showExport(this.getCalendarExport())}><img id="exportIcon" src={exportIcon}></img></button>
          <button class="editRulesButton" onClick={this.editRules}><img id="editRulesIcon" src={editRulesIcon}></img></button>
          <select id="calendarRulesetSelector" value={this.state.currentRuleset} onChange={this.changeCurrentRuleset}>
            {rulesetOptions}
          </select>
        </div>
        <div id="calendarbody">
          <table id="calendartable">
            <tr id="row1">
              <th style={{"background-color": "#969696"}}></th><th>Sunday</th><th>Monday</th><th>Tuesday</th><th>Wednesday</th><th>Thursday</th><th>Friday</th><th>Saturday</th>
            </tr>
            {this.state.calendarJSX}
            <tr id="row1">
              {buttons}
            </tr>
          </table>
        </div>
        <div id="footer" style={{"margin-top":"0px"}}>
          <div id="savedAutomatically">Saved Automatically</div>
        </div>
      </div>
    )
  }
}

export default Calendar