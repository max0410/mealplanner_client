/*
This is the class for the NutritionInfo window, this class is responsible for:
1. Pulling data from the calendar
2. Adding together nutrition info from each meal
3. Categeorizing the nutrition info into seperate days
4. Outputting the nutrition info in a tabbed window
*/

// React native imports and css
import React from 'react';
import ReactDOM from 'react-dom';
import '../index.css';

// Image imports
import reload from '../icons/reload.png'
import exportIcon from "../icons/export.png"

// NutritionInfo Class
class NutritionInfo extends React.Component {
    constructor(props) {
        super(props)

        // Define nutrition info variables, the nutrtion info its self, the current tab, and the servings to calculate for
        this.state = {nutritions: {}, day: "Total", servings: 1}    

        // We must bind class functions in React
        this.setDay =           this.setDay.bind(this)
        this.reloadNutrition =  this.reloadNutrition.bind(this)
        this.getNutrition =     this.getNutrition.bind(this)
        this.changeServings =   this.changeServings.bind(this)
    }

    // Function to handle changes in the total servings to calculate
    changeServings(event) {
        this.setState({servings: event.target.value}, () => {   // Set the servings state to the input value than re-calculate nutrition
            this.setState({nutritions: this.getNutrition()})
        })
    }

    // Function that returns the nutrition info data tobe displayed in the window
    getNutrition() {
        var calendar = this.props.getCalendar() // Retreive the calendar from the calendar class

        // Creates an empty data structure for each tab on the nutrition info window
        var nutritions = {"Total":{},"Sunday":{},"Monday":{},"Tuesday":{},"Wednesday":{},"Thursday":{},"Friday":{},"Saturday":{}}

        // Iterates through each meal in the calendar by going through each type and day
        Object.keys(calendar).forEach(type => {
            Object.keys(calendar[type]).forEach(day => {

                 // If the meal has a nutrition section, proceed (empty meals will not have a nutrition section and will therefore be disregarded)
                if (calendar[type][day].nutrition && Object.keys(calendar[type][day]).length > 1) {   

                    // Iterate through each part of the nutrition section (calories, carbs, protein, etc.)
                    Object.keys(calendar[type][day].nutrition).forEach(nutrition => {   
                        var mealNutrition = calendar[type][day].nutrition

                        // Add the nutrition amounts multipled by the servings to the appropriate section in the tabs
                        if (nutritions[day][nutrition]) {
                            nutritions[day][nutrition] += mealNutrition[nutrition] * this.state.servings 
                        } else {
                            nutritions[day][nutrition] = mealNutrition[nutrition] * this.state.servings
                        }

                        // Add the nutrition info multipled by the servings to the total tab
                        if (nutritions["Total"][nutrition]) {
                            nutritions["Total"][nutrition] += mealNutrition[nutrition] * this.state.servings
                        } else {
                            nutritions["Total"][nutrition] = mealNutrition[nutrition] * this.state.servings
                        }

                    })
                }

            })
        })

        return nutritions   // Return nutrition tab data to be displayed
    }

    // Refreshes the nutrition info by fetching the meals again from the calendar and recalulating nutrition
    reloadNutrition() {
        this.setState({nutritions: this.getNutrition()})
    }

    // Changes the tab
    setDay(day) {
        this.setState({day: day, nutritions: this.getNutrition()})
    }

    // Render function, called each time their is a state change
    render () {

        // Loop through each day and create a tab at the top of Nutrition window
        var tabs = ["Total","Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].map(tab => {
            return (    // Return a button element that calls setDay on a click and changes color based on the current tab selected
                <button class="nutritionTab" onClick={() => this.setDay(tab)} style={(tab == this.state.day) ? {"background-color": "#ccc"} : {"background-color": ""}}>{tab}</button>
            )
        })

        // Display nutrition info only if their is nutrition info to display
        if (Object.keys(this.state.nutritions).length > 0) {    

            // Iterate through each tab of data stored and get the html elements
            var nutritionInfoElements = Object.keys(this.state.nutritions[this.state.day]).map(nutrition => {

                // Formats the output values for each nutrition component
                var nutritionDescriptor = nutrition.charAt(0).toUpperCase() + nutrition.slice(1) + ": " // Capitalizes first letter of string and a colon to the end
                var nutritionNumber = this.state.nutritions[this.state.day][nutrition]  
                var nutritionNumber = Math.round(nutritionNumber * 100) / 100   // Rounds to two digits after the demimal points

                if (nutrition == "protein" || nutrition == "carbohydrates" || nutrition == "fat") { // Add a g to the end of nutrition components measured in grams
                    nutritionNumber += " g"
                } else if (nutrition == "cholesterol" || nutrition == "sodium") {   // Add a mg to the end of nutrition components measured in milligrams                
                    nutritionNumber += " mg"
                }

                return (    // Return the html element for one nutrition component
                    <div class="nutritionInfoElement">
                        <span class="nutritionDescriptor">{nutritionDescriptor}</span>
                        <span class="nutritionNumber">{nutritionNumber}</span>
                    </div>
                )

            })
        }

        return (    // Returns the html for the formatting of the tabs and nutrition components within the Nutrition Info window
            <div id="nutritioninfo" class="w3-card-4 w3-margin">
                <div id="header" style={{height: "40px", "margin-bottom":"0px"}}>
                    <h3 style={{display: "inline"}}>Nutrition Info</h3>
                    <span id="servingsNutrition">Per <input id="servingsNutritionInput" type="number" min="1" value={this.state.servings} onChange={this.changeServings}></input> servings.</span>
                    <button class="reloadButtonList nutButton" onClick={this.reloadNutrition}><img id="reloadIconList" src={reload}></img></button>
                </div>
                <div id="nutritioninfobody">
                    <div id="nutitionNavBar">{tabs}</div>
                    {nutritionInfoElements}
                </div>
                <div id="footer" style={{"margin-top":"0px"}}>
                    <div style={{transform: "translate(0px, 3px)"}}>
                    </div>
                </div>
            </div>
        )
    }
}

export default NutritionInfo