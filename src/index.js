/* 
This is the main application program, it contains all parts of the app except the homepage, it is responsible for:
1. Communicating with the server to establish a shared key
2. Coordinating loading
3. Rendering all the components and fostering communication between them
*/

// Importing React framework
import React from 'react';
import ReactDOM from 'react-dom';

// Importing Components
import AccountManager from './Components/AccountManager'
import Calendar from './Components/Calendar'
import MealSelector from './Components/MealSelector'
import ShoppingList from './Components/ShoppingList'
import NutritionInfo from './Components/NutritionInfo'
import Export from './Components/Export'
import LoadingScreen from './Components/LoadingScreen'
import Warning from './Components/Warning'
import ImportRecipe from './Components/ImportRecipe'
import CalendarRules from './Components/CalendarRules'

// Importing css for style
import './index.css';

// Import jquery for sending post requests to host
import $ from "jquery"

var mathjs = require('mathjs')
var domain = "http://127.0.0.1:3000"

// Helper function to set browser cookies
function setCookie(cname, cvalue, exdays) {
  var d = new Date();
  d.setTime(d.getTime() + (exdays*24*60*60*1000));
  var expires = "expires="+ d.toUTCString();
  document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
}

// Helper function to get browser cookies
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

// Get random number between min and max, maximum is exclusive and the minimum is inclusive
function random(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min) + min); 
}

// Main container component for the entire application
class Application extends React.Component {
  constructor(props) {
    super(props)
    // Properties for the class to be passed on to other components, generates a random sessionID
    this.state = {token: getCookie("token"), username: '', password: '', sessionID: random(0,100000000), key: 0}
    this.hadSignedUp = false

    // Methods must be binded in React
    this.connect = this.connect.bind(this)
    this.random = this.random.bind(this)
    this.powerModulo = this.powerModulo.bind(this)
    this.updateToken = this.updateToken.bind(this)
    this.showInformation = this.showInformation.bind(this)
    this.hideInformation = this.hideInformation.bind(this)
    this.logout = this.logout.bind(this)

    // Create references to some components so their functions can be called between components
    this.calendar = null;
    this.nutritionInfo = React.createRef()
    this.shoppingList = React.createRef()
    this.loadingScreen = React.createRef()
    this.connect()
  }

  // returns a ^ b % c, mathjs is used to prevent javascript from rounding large numbers
  powerModulo(a,b,c) {
      return mathjs.number(mathjs.mod(mathjs.pow(mathjs.bignumber(a),mathjs.bignumber(b)),mathjs.bignumber(c)))
  }

  // Get random number between min and max, maximum is exclusive and the minimum is inclusive
  random(min, max) {
      min = Math.ceil(min);
      max = Math.floor(max);
      return Math.floor(Math.random() * (max - min) + min); 
  }

  // Updates the token by fetching it from cookies and re-rendering
  updateToken() {
    this.setState({
      token: getCookie("token")
    })
  }

  // Communicates with the server to come up with a common key
  connect() {
    $.ajax({  // Sends a post request to the server at /exchange1
      type: "POST",
      url: domain+"/exchange1",
      // Send sessionID to identify the client
      data: JSON.stringify({ sessionID: this.state.sessionID }),
      contentType: "application/json; charset=utf-8",
      dataType: "json",
      // We will recieve p, g, B from diffier hellman
      success: (data) => {
          var p = data.p
          
          var g = data.g
          var B = data.B
          
          var a = this.random(0, 20) // Generate random host secret, range is arbitrary, but since this number is in the exponent it needs to be relatively small or else the product will be ridiculously large
          
          var A = this.powerModulo(g,a,p) // A = g^a % p
          
          this.setState({key: this.powerModulo(B, a, p)}) // Set our key to B^a % p
          $.ajax({   // Send a post reqest with our calculations so the server can calculate the common key
              type: "POST",
              url: domain+"/exchange2",
              // Send session ID and A
              data: JSON.stringify({ sessionID: this.state.sessionID, A: A }),
              contentType: "application/json; charset=utf-8",
              dataType: "json"
          })
      }
  });
  }

  // Logs out by just removing the token and reloading the page
  logout() {
    document.cookie = "token="
    window.location.reload(false);
  }

  showInformation() {
    document.getElementById('Information').style.display='block'
  }

  hideInformation() {
    document.getElementById('Information').style.display='none'
  }

  // Triggers population of data in the nutition info and shopping list once the calendar is loaded, as well as hiding the loading screen
  calendarLoaded() {
    this.nutritionInfo.reloadNutrition()
    this.shoppingList.getIngredients()
    this.loadingScreen.hide()
  }

  // Render method, called each time the state changes
  render() {
    console.log(window.location.pathname)
    if (window.location.pathname == "/app/" || window.location.pathname == "/app") {
      if (this.state.token) {   // Display the meal selector and calendar if user is logged in
        return (  // Renders all the components as well as hidden components
          <div style={{height: "auto", "overflow": "hidden"}}>
            
            <LoadingScreen ref={instance => { this.loadingScreen = instance }}/>
  
            
  
            <Export ref={instance => { this.export = instance }}  />
  
            <ImportRecipe ref={instance => {this.importRecipe = instance}} 
                          importData={(data) => {this.mealselector.importRecipe(data)}}
                          sessionID={this.state.sessionID} 
                          secret={this.state.key}/>
  
            <CalendarRules sessionID={this.state.sessionID} 
                           secret={this.state.key}
                           updateRulesets={(rulesets) => {this.calendar.updateRuleset(rulesets)}}
                           ref={instance => {this.calendarRules = instance}} />
  
            <MealSelector sessionID={this.state.sessionID} 
                          secret={this.state.key}
                          showWarning={() => this.warning.show()}
                          showImport={() => this.importRecipe.show()}
                          ref={instance => { this.mealselector = instance }}/>

            <Warning ref={instance => { this.warning = instance }} 
                                deleteMeal={() => this.mealselector.deleteMeal()}/>  

            <Calendar showExport={(comp) => this.export.show(comp)}
                      showCalendarRules={(rulesets, currentRuleset, days, types) => this.calendarRules.show(rulesets, currentRuleset, days, types)}
                      hadSignedUp={this.hadSignedUp} 
                      sessionID={this.state.sessionID} 
                      secret={this.state.key} 
                      fillEditor={(meal,from) => this.mealselector.fillEditor(meal,from)} 
                      getMeals={(callback) => this.mealselector.getMealsForCalendar(callback)}
                      calendarLoaded={() => this.calendarLoaded()}
                      ref={instance => { this.calendar = instance }}/>
  
            <ShoppingList showExport={(element) => this.export.show(element)}
                          hadSignedUp={this.hadSignedUp} 
                          sessionID={this.state.sessionID} 
                          getCalendar={() => this.calendar.getterCalendar()} 
                          ref={instance => {this.shoppingList = instance}}
                          secret={this.state.key}/>
  
            <NutritionInfo  getCalendar={(callback) => this.calendar.getterCalendar(callback)} 
                            ref={instance => {this.nutritionInfo = instance}}
                            hadSignedUp={this.hadSignedUp} 
                            secret={this.state.key}/>
  
            
  
            <span id="logout" onClick={this.logout}>Log Out</span>
          </div>
        )
      } else {          // Display the Login/Signup page if user is not logged in
        this.hadSignedUp = true
        document.getElementById("root").scrollTop = 0
        return (
          <div>
            <AccountManager sessionID={this.state.sessionID} secret={this.state.key} updateToken={this.updateToken} />
          </div>
        );
      }
    } else if (window.location.pathname == "/") {
      document.body.scrollTop = document.documentElement.scrollTop = 0;
      return (
        <div id="homepage">
          <div class="bgimg w3-container" >
            <center class="">
              <b style={{"margin-bottom": "0px", "color":"#977390", "font-size":"70px", "text-shadow":"2px 2px 0 #444", "display": "block"}}>Meal Planner Pro</b>
              <i class="w3-xlarge slogan">The Outline you Always Needed!</i>
              <img id="burgerImg" src="FinalBurger.png" alt="Burger"/>
            </center>
            <div class="w3-display-bottomleft w3-container w3-xlarge">
              <button onClick={this.showInformation} class=" w3-btn w3-clear w3-border w3-border-grey w3-round-large" style={{"color":"#977390", "position":"static"}}>Information</button>
              <button onClick={() => {window.location.href = '/app'}} class=" w3-btn w3-clear w3-border w3-border-grey w3-round-large" style={{"color":"#977390", "margin-left": "8px"}}>Launch App</button>
          </div>
        </div>

        <div id="Information" class="w3-modal" style={{"color":"#ffcc99"}}>
          <div class="w3-modal-content w3-animate-zoom">
            <div class="w3-container w3-display-container" style={{"color":"#977390", "background-color":"#ffcc99"}}>
              <span onClick={this.hideInformation} class="w3-button w3-display-topright w3-large">x</span>
              <h1>What is Meal Planner Pro?</h1>
            </div>
            <div class="w3-container w3-display-container w3-large" style={{"color":"#ffcc99", "background-color":"#977390"}}>
              <p>Meal planner pro is an extremely intuitive and easy-to-use application that can benefit and organize your eating habits. With over 200 meals to select and choose from, Meal Planner Pro will make a calendar populated with meals, an ingredient list, and nutrition info based on the meals you selected.</p>
            </div>
            <div class="w3-container w3-display-container" style={{"color":"#977390", "background-color":"#ffcc99"}}>
              <h1>How Does the Calender Work?</h1>
            </div>
            <div class="w3-container w3-display-container w3-large" style={{"color":"#ffcc99", "background-color":"#977390"}}>
              <p>The calendar is one of the most crucial parts of the website. It is very customizable and easy to use. The calendar fills with new foods that you choose throughout the week. By default, the calendar populates with three separate meals per day, for each day in the week. If you want to add another meal per day, you can always just add a row to the calendar and choose the type of food that you want for that row. You can move and delete foods from the calendar as well. If you would like to print the calendar you can do so by pressing the export button on the top right of the section.</p>
            </div>
            <div class="w3-container w3-display-container" style={{"color":"#977390", "background-color":"#ffcc99"}}>
              <h1>How do you use the Ingredient List?</h1>
            </div>
            <div class="w3-container w3-display-container w3-large" style={{"color":"#ffcc99", "background-color":"#977390"}}>
              <p>The Ingredient list is intended to be used as a way to check off items you already have from the list and as a shopping list of sorts. The list is created from the information of each meal taken from the calendar and will accurately generate the exact amount of ingredients you will need for the entire week. You can also check the ingredients needed for any singular day of the week. You can also print out this list so you can bring the list to the grocery store with you.</p>
            </div>
            <div class="w3-container w3-display-container" style={{"color":"#977390", "background-color":"#ffcc99"}}>
            <h1>What Kind of Meals are Avaliable?</h1>
            </div>
            <div class="w3-container w3-display-container w3-large" style={{"color":"#ffcc99", "background-color":"#977390"}}>
              <p>With over 200 meals on Meal Planner Pro, and the ability to add new meals, the options are limitless. Below are just a few of the meals we have on our website.</p>
            </div>
            <img id="foodImg" src="Food.png" alt="Food"/>
            <div class="w3-container w3-display-container" style={{"color":"#977390", "background-color":"#ffcc99"}}>
              <h1>Anymore Questions, Concerns, or Issues?</h1>
            </div>
            <div class="w3-container w3-display-container w3-large" style={{"color":"#ffcc99", "background-color":"#977390"}}>
              <h2>Contact Us:</h2>
              <h2>frankbevivino@gmail.com</h2>
              <h2>max.j.segal@gmail.com</h2>
            </div>
          </div>
        </div>
      </div>
        
      )
    }
    
  }
}

// Render the react Application component to the div with id "root" in index.html
ReactDOM.render(
  /*<Router basename={'/app'}>
    <Route path={`${process.env.PUBLIC_URL}/`} component={Application} />
  </Router>,*/
  <Application/>,
  document.getElementById('root')
);
