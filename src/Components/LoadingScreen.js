/* 
This is the class for the loading screen that pops up once the user has logged in or refreshed the site, this class is responsible for:
1. Showing on startup
2. Displaying a loading gif, laoding tip, and a overlay over the unpopulated site content
3. Hiding when everything is loaded
*/

// React native imports and css
import React from 'react';
import ReactDOM from 'react-dom';
import '../index.css';

// Loading gif
import loadingAnimation from '../icons/loadingPurple.gif'
import { floor } from 'mathjs';

// Loading tips pulled from a google doc
var loadingTips = [
    "Click and drag the three green lines in the top corner of a meal to move it to another day.",
    "Add notes to a meal in the meal editor to add specific directions.",
    "Press the red X under a day on the calendar to cancel all meals on that day.",
    "Click the meal name to be taken to its recipe page.",
    "Use the filter on the meal selector to search for meal names, types, categories, ingredients, and even words from notes.",
    "Press the export button on the calendar to print or export your calendar as an image.",
    "Press the export button on the shopping list to print or export your shopping list as an image.",
    "Did you know that meal planner pro has over 200 dishes and meals to choose from!",
    "Log back in to view your saved and edited meals.",
    "You can add your own meals by clicking the add meal button in the meal selector section.",
    "Print out the calendar so the whole family can see what meals they’re gonna have for the day."
]

// Gets a random number between the min and max
function random(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min) + min); 
}

// LoadingScreen class
class LoadingScreen extends React.Component {
    constructor(props) {
        super(props)

        // Define a variable if the component should be shown or not
        this.state = {"show": true}

        // Class functions must be binded in React
        this.hide = this.hide.bind(this)
    }

    // Hides the component
    hide() {
        document.getElementById("htmlTag").style["overflow-y"] = "auto" // Turns scrolling back on
        this.setState({"show": false})
    }

    // Render function, called everytime the state updates
    render() {
        return (    // HTML formatting for the gif, overlay, and loading tip, only displays when state.show is true
            <div style={this.state.show ? {"display": "block"} : {"display": "none"}}>
                <div id="loading">
                    <img id="loadingAnimation" src={loadingAnimation}></img>
                    <div id="loadingTip">{loadingTips[random(0,loadingTips.length)]}</div>
                </div>
                <div id="loadingOverlay">
                </div>
            </div>
        )
    }
}

export default LoadingScreen