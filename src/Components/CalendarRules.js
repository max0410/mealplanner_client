/* 
This is the class for the calendar rule generation window that pops up when you click the edit ruleset button on the
top right of the calendar, this class is resposible for:
1. Allowing the user to input selectors and rules
2. Communicating with the server so these rules are saved
3. Communicating with the calendar so it always has up to date rules
*/

// Imports for react native and css
import React from 'react'
import ReactDOM from 'react-dom'
import '../index.css'

// Jquery for sending data to the server
import $ from "jquery"

// Icons used
import deleteRulesetIcon from '../icons/delete.png'
import addRulesetIcon from '../icons/addRuleset.png'

// AES for data encryption
var aesjs = require('aes-js');
var domain = "http://127.0.0.1:3000"

// Helper function to retreive the user token which is stored as a cookie
function getCookie(cname) {
    var name = cname + "=";
    var decodedCookie = decodeURIComponent(document.cookie);
    var ca = decodedCookie.split(';');
    for(var i = 0; i <ca.length; i++) {
        var c = ca[i]
        while (c.charAt(0) == ' ') {
        c = c.substring(1)
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
    var textBytes = aesjs.utils.utf8.toBytes(str)

    // Encyrypting our bytes using AES Counter mode
    var aesCtr = new aesjs.ModeOfOperation.ctr(key, new aesjs.Counter(5))
    var encryptedBytes = aesCtr.encrypt(textBytes)

    // Converting back to text for easy handling in communication
    var finalResult = aesjs.utils.hex.fromBytes(encryptedBytes)
    return finalResult
}

// Returns a string with the first letter capitalized
function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1)
}

class CalendarRules extends React.Component {
    constructor(props) {
        super(props)

        // Store class properties for display of window, rule data, currentRuleset, and the days and types included in the calendar
        this.state = {
            display: false, 
            rulesets: {}, 
            currentRuleset: 0, 
            days: {}, 
            types: []
        }

        // We must bind class methods in react
        this.show =                     this.show.bind(this)
        this.hide =                     this.hide.bind(this)
        this.updateData =               this.updateData.bind(this)
        this.getSelectors =             this.getSelectors.bind(this)
        this.getSelectorParameters =    this.getSelectorParameters.bind(this)
        this.addSelector =              this.addSelector.bind(this)
        this.removeSelector =           this.removeSelector.bind(this)
        this.getRules =                 this.getRules.bind(this)
        this.selectorSelectChange =     this.selectorSelectChange.bind(this)
        this.selectorParameterChange =  this.selectorParameterChange.bind(this)
        this.addSelectorParameter =     this.addSelectorParameter.bind(this)
        this.removeSelectorParameter =  this.removeSelectorParameter.bind(this)
        this.removeSelectorRule =       this.removeSelectorRule.bind(this)
        this.changeRuleParameter =      this.changeRuleParameter.bind(this)
        this.showPanel =                this.showPanel.bind(this)
        this.changeRuleType =           this.changeRuleType.bind(this)
        this.addRule =                  this.addRule.bind(this)
        this.deleteRuleset =            this.deleteRuleset.bind(this)
        this.addRuleset =               this.addRuleset.bind(this)
        this.changeRuleset =            this.changeRuleset.bind(this)
    }

    // Sends modified ruleset to the host
    updateData() {
        this.props.updateRulesets(this.state.rulesets)
        $.ajax({
            type: "POST",
            url: domain +"/set_data",
            // Send sessionID, user token, and the encrypted rulesetand currentRuleset
            data: JSON.stringify({ 
                sessionID: this.props.sessionID, 
                uid: getCookie("token"), 
                rulesets: aesEncrypt(JSON.stringify(this.state.rulesets),this.props.secret),
                currentRuleset: aesEncrypt(JSON.stringify(this.state.currentRuleset),this.props.secret)
            }), 
            contentType: "application/json; charset=utf-8",
            dataType: "json"
        });
    }

    // Shows the CalendarRules window and stores data needed for rule generation
    show(rulesets, currentRuleset, days, types) {
        this.setState({display: true, rulesets: rulesets, currentRuleset: currentRuleset, days: days, types: types})  
    }

    // Hides the CalendarRules window
    hide() {
        this.setState({display: false})
    }

    // Adds a new placeholder ruleset when triggered by the add ruleset button
    addRuleset() {
        var rulesets = this.state.rulesets
        rulesets.push(["placeholder"])
        this.setState({rulesets: rulesets, currentRuleset: rulesets.length-1}, () => {
            this.updateData()
        })
    }

    // Deletes the current ruleset
    deleteRuleset() {
        var rulesets = this.state.rulesets

        rulesets.splice(this.state.currentRuleset, 1)   // Deletes the ruleset at the currentRuleset index

        if (rulesets.length > 0) {  // If there is still more rulesets, just set currentRuleset to one less than before
            this.setState({rulesets: rulesets, currentRuleset: this.state.currentRuleset-1}, () => {
                this.updateData()
            })
        } else {                    // If there are no more rulesets, add an empty one and set currentRuleset to 0
            rulesets.push(["placeholder"])
            this.setState({rulesets: rulesets, currentRuleset: 0}, () => {
                this.updateData()
            })
        }
    }

    // Triggers on selection of a new ruleset in the ruleset dropdown
    changeRuleset(event) {
        this.setState({currentRuleset: event.target.value}, () => {
            this.updateData()
        })
    }

    // Triggers on change from type to day or vice versa in a selector
    selectorSelectChange(event) {
        var rulesets = this.state.rulesets

        // Event.target.id refers to the number of selector
        rulesets[this.state.currentRuleset][event.target.id].select = event.target.value
        rulesets[this.state.currentRuleset][event.target.id].parameters = [""]

        this.setState({rulesets: rulesets}, () => {
            this.updateData()
        })
    }

    // Triggers on change to a parameter in a selector, selectorNum is the # selector
    selectorParameterChange(event, selectorNum) {
        var rulesets = this.state.rulesets

        // The id is the index of the selector
        rulesets[this.state.currentRuleset][selectorNum].parameters[event.target.id] = event.target.value
        this.setState({rulesets: rulesets}, () => {
            this.updateData()
        })
    }

    // Triggers on the plus button next to the parameters in a selector
    addSelectorParameter(event) {
        var rulesets = this.state.rulesets

        // Only adds selector if doing so wouldn't overflow the rule selector window
        if (rulesets[this.state.currentRuleset][event.target.id].parameters.length <= Math.floor((event.target.parentNode.parentNode.offsetWidth - 350) / 100)) {
            // If the first parameter is already all, then don't add a new parameter
            if (rulesets[this.state.currentRuleset][event.target.id].parameters[0] != "all") {
                rulesets[this.state.currentRuleset][event.target.id].parameters.push("")
            }
        }

        this.setState({rulesets: rulesets}, () => {
            this.updateData()
        })
    }

    // Triggered on click of the minus button to the right of the selector parameters
    removeSelectorParameter(event) {
        var rulesets = this.state.rulesets

        // Only trigger if there are 2 or more parameters
        if (rulesets[this.state.currentRuleset][event.target.id].parameters.length > 1) {
            rulesets[this.state.currentRuleset][event.target.id].parameters.splice(-1,1)
        }

        this.setState({rulesets: rulesets}, () => {
            this.updateData()
        })
    }

    // Triggers on click to the X button to the right of a rule
    removeSelectorRule(event, selectorNum) {
        var rulesets = this.state.rulesets

        rulesets[this.state.currentRuleset][selectorNum].rules.splice(event.target.id, 1)   // Deletes the rule

        this.setState({rulesets: rulesets}, () => {
            this.updateData()
        })
    }

    // Method triggered on change to any input field on a rule
    changeRuleParameter(event, selectorNum, parameter) {
        var rulesets = this.state.rulesets

        // Gets the new value of the field and uses the "parameter" parameter to identify the field in the data
        rulesets[this.state.currentRuleset][selectorNum].rules[event.target.id].parameters[parameter] = event.target.value

        this.setState({rulesets: rulesets}, () => {
            this.updateData()
        })
    }

    // Triggered on change to the type of rule in the new rule, adjusts the data structure to match different rule types
    changeRuleType(event, selectorNum) {
        var rulesets = this.state.rulesets

        var selectorParameters = rulesets[this.state.currentRuleset][selectorNum].parameters
        rulesets[this.state.currentRuleset][selectorNum].rules[event.target.id].rule = event.target.value

        if (event.target.value == "Total") {            // Matches to the total rule
            rulesets[this.state.currentRuleset][selectorNum].rules[event.target.id].parameters = {
                "condition": "",
                "amount": null,
                "category": "",
                "for": ""
            }
            
        } else if (event.target.value == "Repeats") {   // Matches to the repeats rule
            rulesets[this.state.currentRuleset][selectorNum].rules[event.target.id].parameters = {
                "amount": null,
                "category": ""
            }
        } else {                                        // Matches to the filter rule
            rulesets[this.state.currentRuleset][selectorNum].rules[event.target.id].parameters = {
                "type": "",
                "filter": ""
            }
        }

        this.setState({rulesets: rulesets}, () => {
            this.updateData()
        })
    }

    // Returns the parameters for a specified selector
    getSelectorParameters(selector, selectorNum) {
        
        // Add the options for the dropdowns
        if (selector.select == "type") {        // If it is a type, add each of the calendar types
            var options = this.state.types.map((type) => {
                return (
                    <option value={type}>{type}</option>
                )
            })

            // Add all and empty options
            options.unshift((<option value="all">All</option>))
            options.push((<option value="" hidden></option>))
        } else if (selector.select == "day") {  // If it is a day, add each of the calendar days that aren't deselected
            var options = Object.keys(this.state.days).map((day) => {
                if (this.state.days[day]) {
                    return (
                        <option value={day}>{day}</option>
                    )
                }
            })

            // Add all and empty options 
            options.unshift((<option value="all">All</option>))
            options.push((<option value="" hidden></option>))
        }
        

        var i = -1

        // Iterate through parameter and get JSX
        var parameters = selector.parameters.map((parameter) => {   
            i++  
            return (    // Select tag with the options defined above
                <select class="selectorParameter" id={i} value={parameter} onChange={(e) => this.selectorParameterChange(e, selectorNum)}>
                    {options}
                </select>
            )
        })

        return parameters
    }

    // Triggered on the plus button on a rule input field
    addRule(event, selectorNum) {
        var rulesets = this.state.rulesets
        var rule = rulesets[this.state.currentRuleset][selectorNum].rules[0]
        var selectorParameters = rulesets[this.state.currentRuleset][selectorNum].parameters

        if (!rule.rule) {   // If the rule doesn't have a defined rule type yet, don't add this rule
            return
        }

        var parameters = rule.parameters

        // Iterate through each parameterin the rules
        for (var parameter of Object.keys(parameters)) {
            if ((selectorParameters.includes("all") || selectorParameters.length > 1) && selectorParameters) {  // If the selector is plural
                if (parameter == "for" && parameters[parameter] == "") {    // If the for parameter is not present, then don't add this rule
                    return
                } 
            } else {    // If the selector is not plural
                if (!parameters[parameter] && parameter != "for") {     // If the selector isn't the for parameter, check if its empty, if it is empty, don't add this rule
                    return  
                } else if (parameter == "for" && parameters[parameter] == "") {     // If the parameter is the for parameter and it is empty, set it to "all"
                    rulesets[this.state.currentRuleset][selectorNum].rules[0].parameters.for = "all"
                }
            }
        }

        var newRule = rulesets[this.state.currentRuleset][selectorNum].rules[0]

        newRule["new"] = false                                                      // Designate the rule as no longer new
        rulesets[this.state.currentRuleset][selectorNum].rules.splice(0, 1)         // Delete the new rule
        rulesets[this.state.currentRuleset][selectorNum].rules.unshift(newRule)     // Take the previously new rule and add it the beginning of the list
        rulesets[this.state.currentRuleset][selectorNum].rules.unshift({            // Add a new empty rule input field
            "new": true,
            "rule": "", 
            "parameters": {}
        })

        this.setState({rulesets: rulesets}, () => {
            this.updateData()
        })
    }

    // Returns JSX of the rules for a specified selector
    getRules(selector, selectorNum) {

        // Generate the options for the category dropdown
        var categoryOptions = ["All", "Chicken","Beef","Salad","Soup","Stew","Pasta","Egg","Pork","Fish","Sandwich","Seafood","Baked","Fried","Bread","Pizza"].map(category => {
            return(<option value={category}/>)
        })
        categoryOptions.push(<option value="" hidden/>)

        var i = -1
        // Generate each rule element
        var rules = selector.rules.map((rule) => {
            i++

            // Get the rule parameters
            var parameters = rule.parameters

            if ((selector.parameters.includes("all") || selector.parameters.length > 1) && parameters) {    // If there are multiple selector parameters, add the for (each/all) parameter
                var forSelector = (
                    <div class="forSelector">
                        <div style={{display: "inline"}}>for </div>
                        <select value={parameters.for} class="forSelectorSelect" id={i} onChange={(e) => this.changeRuleParameter(e, selectorNum, "for")}>
                            <option value="" selected disabled hidden></option>
                            <option value="each">each</option>
                            <option value="all">all</option>
                        </select>
                    </div>
                )
            } else {        // If there is just one selector parameter, don't show the for (each/all) option
                var forSelector = (
                    <div style={{display: "none"}}></div>
                )
            }
            
            var ruleName;
            if (rule.new) { // If it is a new rule make the rulename a selector
                ruleName = (
                    <select class="selectSelector" value={rule.rule} id={i} onChange={(e) => this.changeRuleType(e, selectorNum)}>
                        <option value="" selected disabled hidden></option>
                        <option value="Total">Total</option>
                        <option value="Repeats">Repeats</option>
                        <option value="Filter">Filter</option>
                    </select>
                )
            } else {        // Otherwise just make it the name of the rule type
                ruleName = rule.rule
            }

            var actionButton;
            if (rule.new) {         // If the rule is new make the rightmost button an add rule button
                actionButton = (
                    <span class="plusiconrule" id={i} onClick={(e) => this.addRule(e, selectorNum)}>+</span>
                )
            } else {                // Otherwise make it a remove rule button
                actionButton = (    
                    <span class="xicon" id={i} onClick={(e) => this.removeSelectorRule(e, selectorNum)}>✕</span>
                )
            }

            if (rule.rule == "Total") {      // If the rule is a "total" command
                var category = capitalize(parameters.category)
                return (
                    <table class="rule">
                        <tr>
                            <th class="ruleName" style={{"background-color":"red"}}>
                                {ruleName}
                            </th>
                            <th class="ruleParameters">
                                <select selected={parameters.condition} value={parameters.condition} class="ruleCondition" id={i} onChange={(e) => this.changeRuleParameter(e, selectorNum, "condition")}>
                                    <option value="" selected disabled hidden></option>
                                    <option value="at most">At most</option>
                                    <option value="exactly">Exactly</option>
                                    <option value="at least">At least</option>
                                </select>
                                <input type="number" min="0" value={parameters.amount} id={i} onChange={(e) => this.changeRuleParameter(e, selectorNum, "amount")}></input>
                                <input type="text" list="categoryOptions" class="catgeoryInput" value={category} id={i} onChange={(e) => this.changeRuleParameter(e, selectorNum, "category")}/>
                                <datalist id="categoryOptions" >
                                    {categoryOptions}
                                </datalist>
                                <div class="mealsText">meals</div>
                                {forSelector}
                                {actionButton}
                            </th>
                        </tr>
                    </table>
                )
            } else if (rule.rule == "Filter") {     // If the rule is a "filter" command
                return (
                    <table class="rule">
                        <tr>
                            <th class="ruleName" style={{"background-color":"green"}}>
                                {ruleName}
                            </th>
                            <th class="ruleParameters">
                                <select value={parameters.type} class="ruleCondition" id={i} onChange={(e) => this.changeRuleParameter(e, selectorNum, "type")}>
                                    <option value="" selected disabled hidden></option>
                                    <option value="exclude">Exclude</option>
                                    <option value="apply">Apply</option>
                                </select>
                                <input type="text" class="filterInput" value={parameters.filter} id={i} onChange={(e) => this.changeRuleParameter(e, selectorNum, "filter")}/>
                                {actionButton}
                            </th>
                        </tr>
                    </table>
                )
            } else if (rule.rule == "Repeats") {    // If the rule is a "repeats" command
                var category = capitalize(parameters.category)
                return (
                    <table class="rule">
                        <tr>
                            <th class="ruleName" style={{"background-color":"blue"}}>
                                {ruleName}
                            </th>
                            <th class="ruleParameters">
                                <div class="filterRuleText">At most</div>
                                <input type="number" min="0" value={parameters.amount} id={i} onChange={(e) => this.changeRuleParameter(e, selectorNum, "amount")}></input>
                                <input type="text" list="categoryOptions" class="catgeoryInput" value={category} id={i} onChange={(e) => this.changeRuleParameter(e, selectorNum, "category")}/>
                                <datalist id="categoryOptions">
                                    {categoryOptions}
                                </datalist>
                                <div class="filterRuleText2">meals in a row</div>
                                {actionButton}
                            </th>
                        </tr>
                    </table>
                )
            } else {                            // Otherwise display a empty new rule
                return (
                    <table class="rule">
                        <tr>
                            <th class="ruleName" style={{"background-color":"#ccc"}}>
                                {ruleName}
                            </th>
                            <th class="ruleParameters">
                                {actionButton}
                            </th>
                        </tr>
                    </table>
                )
            }
        })

        return rules
    }

    // Shows the rules under a selecotr on click
    showPanel(event) {
        if (event.target.className.includes("accordion")) {

            // Toggles css by changing class name
            if (event.target.className === "accordion") {
                event.target.className = "accordion active";
            } else if (event.target.className === "accordion active"){
                event.target.className = "accordion";
            }
    
            var panel = event.target.nextElementSibling;
            
            // Toggles display of rules 
            if (panel.style.display === "block") {
                panel.style.display = "none";
            } else if (panel.style.display === "none" || !panel.style.display){
                panel.style.display = "block";
            }
        }
    }

    // Triggered on the X button to the right of a selector
    removeSelector(event) {
        var rulesets = this.state.rulesets

        rulesets[this.state.currentRuleset].splice(event.target.id, 1)  // Deletes the selector

        this.setState({rulesets: rulesets}, () => {
            this.updateData()
        })
    }

    // Adds a empty selector when add selector button is pressed
    addSelector() {
        var rulesets = this.state.rulesets

        // Create empty datastructure for the selector with an input field rule
        rulesets[this.state.currentRuleset].push({
            "select": "",
            "parameters": [""],
            "rules": [
                {
                    "new": true,
                    "rule": "", 
                    "parameters": {}
                }
            ]
        })

        if (rulesets[0] == "placeholder") {     // If there are placeholder selectors just remove them
            rulesets = rulesets.splice(0,1)
        }

        this.setState({rulesets: rulesets}, () => {
            this.updateData()
        })
    }

    // Get each selector in the current ruleset
    getSelectors() {
        var selectors = []

        // First check that the ruleset exists and there are selectors in it
        if (this.state.rulesets.length > 0 && this.state.rulesets[this.state.currentRuleset]) {
            var i = -1

            // Iterate through each selector in the ruleset
            for (var selector of this.state.rulesets[this.state.currentRuleset]) {
                i++

                if (selector != "placeholder") {    // If its not a placeholder selector then display

                    var parameters = this.getSelectorParameters(selector, i)    // Get the JSX for the parameters in the selector
    
                    var rules = this.getRules(selector, i)                      // Get the JSX for the rules in the selector
                    
                    // Condition to check if adding a new selector would overflow the rule selector window
                    var allowAdding = this.state.rulesets[this.state.currentRuleset][i].parameters.length <= Math.floor((window.innerWidth*0.7 - 350) / 100) && this.state.rulesets[this.state.currentRuleset][i].parameters[0] != "all"
                    
                    selectors.push(     // Format the selector component
                        <div>
                            <button class="accordionSelector" onClick={this.showPanel}>
                                <div class="selectorSection1">
                                    <span class="selectText">Select</span>
                                    <select id="select" value={selector.select} id={i} onChange={this.selectorSelectChange} class="selectorParameter">
                                        <option value="" selected disabled hidden></option>
                                        <option value="type">Type</option>
                                        <option value="day">Day</option>
                                    </select>
                                </div>
                                <div class="selectorSection2">
                                    {parameters}
                                    <span class="addParameter" onClick={this.addSelectorParameter} id={i} style={allowAdding ? {color: "green"} : {color: "gray"}}>+</span>
                                    <span class="removeParameter" onClick={this.removeSelectorParameter} id={i} style={parameters.length > 1 ? {color: "red"} : {color: "gray"}}>-</span>
                                </div>
                                <span class="xicon" id={i} onClick={this.removeSelector}>✕</span>
                            </button>
                            <div class="panel" style={{"padding-left": "0px"}}>{rules}</div>
                        </div>
                    )
                }
            }
        }

        if (selectors.length == 0) {    // If there are no selectors just add text saying that
            selectors.push(
                <div id="noIngredients">
                    <i style={{color: "#ccc"}}>There are no selectors here. Click "Add Selectors" to make new rules.</i>
                </div>
            )
        }

        return selectors
    }

    // Render function, triggered everytime their is a state change
    render() {
        var selectors = this.getSelectors()     // Gets the selector and the rules under them

        var rulesetOptions = []
        if (this.state.rulesets.length > 0) {   // If there are rules
            var i = -1

            // Iterate through each rule and add a new option to the ruleset dropdown
            rulesetOptions = this.state.rulesets.map((ruleset) => {
                i++
    
                return (
                    <option value={i}>{"Ruleset " + (i+1)}</option>
                )
            })
        }
        

        if (this.state.display) {   // If display is true display the calendar rules window over an overlay
            return (    
                <div>
                    <div id="overlay">
                    </div>
                    <div id="ruleEditor" class="w3-card-4 w3-margin">
                        <div id="header" style={{height: "40px", "margin-bottom":"0px"}}>
                            <h3 style={{display: "inline"}}>Calendar Generation Rules</h3>
                            <button class="exitRulesEditor" onClick={this.hide}>✕</button>
                        </div>
                        <div id="rulesEditorBody">
                            {selectors}
                        </div>
                        <div id="footer" style={{"margin-top":"0px"}}>
                            <button id="addSelectorButton" onClick={this.addSelector}>Add Selector</button>
                            <button id="deleteRuleset" onClick={this.deleteRuleset}>
                                <img id="deleteRulesetIcon" src={deleteRulesetIcon}></img>
                            </button>
                            <button id="addRuleset" onClick={this.addRuleset}>
                                <img id="addRulesetIcon" src={addRulesetIcon}></img>
                            </button>
                            <select id="rulesetSelector" value={this.state.currentRuleset} onChange={this.changeRuleset}>
                                {rulesetOptions}
                            </select>
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

export default CalendarRules
