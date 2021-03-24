/* 
This is the class for the warning that pops up when you go to delete a meal, this class is responsible for:
1. Showing when the delete button is hit on the mealselector based upon the showWarning cookie
2. Modifying the showWarning cookie if the checkbox is clicked
3. Deleting the meal and hiding if the delete meal button is clicked
4. Not deleting the meal and hiding if the close button is clicked
*/


// React native imports and css
import React from 'react'
import ReactDOM from 'react-dom'
import '../index.css'

// Helper function to set browser cookies
function setCookie(cname, cvalue, exdays) {
    var d = new Date()
    d.setTime(d.getTime() + (exdays*24*60*60*1000))
    var expires = "expires="+ d.toUTCString()
    document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/"
}

// Helper function to get browser cookies
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

// Warning class
class Warning extends React.Component {
    constructor(props) {
        super(props)
        this.state = {display: false}   // A class property for keeping track if the warning should be showing or not

        // React component functions must be binded
        this.show =             this.show.bind(this)
        this.hide =             this.hide.bind(this)
        this.deleteMeal =       this.deleteMeal.bind(this)
        this.dontShowAgain =    this.dontShowAgain.bind(this)
    }

    // Function to show the warning conditional on the cookie
    show() {
        if (getCookie("showWarning") == "false") {  // If the cookie showWarning is false just delete the meal, don't show the warning
            this.props.deleteMeal()
        } else {                                    // Otherwise show the warning window
            this.setState({display: true})
        }
    }

    // Function to hide the window
    hide() {
        this.setState({display: false})
    }

    // Function to tell the mealselector to delete the meal and hide this window
    deleteMeal() {
        this.props.deleteMeal()
        this.hide()
    }

    // Modify the showWarning cookie
    dontShowAgain() {
        setCookie("showWarning", false, 100)
    }

    // Render function, triggers every time there is a state change
    render() {

        if (this.state.display) {   // Only display this html is the display state is true
            return (
                <div>
                    <div id="overlay">
                    </div>
                    <div id="warning" class="w3-card-4 w3-margin">
                        <div id="header" style={{height: "40px", "margin-bottom":"0px"}}>
                            <h3 style={{display: "inline"}}>Delete Meal</h3>
                            <button class="exitWarning" onClick={this.hide}>✕</button>
                        </div>
                        <div id="warningBody">
                            <div id="warningText">Are you sure you want to delete this meal? This action cannot be reversed.</div>
                            <button id="confirmWarningButton" onClick={this.deleteMeal}>Delete Meal</button>
                        </div>
                        <div id="footer" style={{"margin-top":"0px"}}>
                            <input type="checkbox" id="warningCheck" onChange={this.dontShowAgain}></input> <div id="checkText">Don't show this warning again</div>
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

export default Warning