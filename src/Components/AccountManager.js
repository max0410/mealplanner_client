/* 
This is the account manager window that pops up when the user is not signed in, it is resposible for:
1. Allowing the user to input their user information
2. Sending and encrypting user information to the server
3. Retreiving a user token and sending back to the application
*/

// Import react native and css
import React from 'react';
import ReactDOM from 'react-dom';
import '../index.css';

// Import jquery for sending post requests to host and AES for encryption
import $ from "jquery"
var domain = "http://127.0.0.1:3000"
var aesjs = require('aes-js');

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

// Method to set cookie in browser
function setCookie(cname, cvalue, exdays) {
    var d = new Date();
    d.setTime(d.getTime() + (exdays*24*60*60*1000));
    var expires = "expires="+ d.toUTCString();
    document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
}

class AccountManager extends React.Component {
    constructor(props) {
        super(props);
        // Properties to save user inputs
        this.state = {email: '', password: '', repassword: '', loginText: '', signupText: ''}
    
        // Class methods must be binded in React js
        this.login = this.login.bind(this);
        this.signup = this.signup.bind(this);
    }

    // Login function, encrypts user data and sends it to back end
    login() {
        var email = this.state.email;       // Retrieve email and password from state object
        var password = this.state.password; 

        var encryptedEmail = aesEncrypt(email, this.props.secret)        // Encrypt email and password with our key that we get from the props
        var encryptedPassword = aesEncrypt(password, this.props.secret)

        // Send POST request to the server at the /login listener
        $.ajax({
            type: "POST",
            url: domain +"/login",
            data: JSON.stringify({ sessionID: this.props.sessionID, email: encryptedEmail, password: encryptedPassword }),  // Send sessionID, email, and password
            contentType: "application/json; charset=utf-8",
            dataType: "json",
            success: (data) => {
                setCookie("token",data.token,100)   // If the user exists and password is correct set the token cookie to the token we recieved
                this.props.updateToken()
            },
            // Handle firebase errors and display on the account manager
            error: (xhr,status,error) => {
                var message = xhr.responseJSON.message
                console.log(message)
                if (message == "auth/invalid-email" || message == "auth/user-not-found") {
                    this.setState({loginText: "Email doesn't have an account."})
                } else if (message == "auth/wrong-password") {
                    this.setState({loginText: "Incorrect password."})
                } 
                
            }
        });
    }

    signup() {
        var email = this.state.email;
        var password = this.state.password; 
        var repassword = this.state.repassword; 

        // Check that both passwords match, if not respond with an error and exit from method
        if (password != repassword) {
            this.setState({signupText: "Both passwords must match."})
            return
        }

        // Encrypt the email and password using AES
        var encryptedEmail = aesEncrypt(email, this.props.secret)
        var encryptedPassword = aesEncrypt(password, this.props.secret)

        $.ajax({
            type: "POST",
            url: domain +"/signup",
            // Send sessionID, encrypted email and password
            data: JSON.stringify({ sessionID: this.props.sessionID, email: encryptedEmail, password: encryptedPassword }),
            contentType: "application/json; charset=utf-8",
            dataType: "json",
            // If we successfully sign in, save the received token as a cookie, which will trigger the app into starting
            success: (data) => {
                setCookie("token",data.token,100)
                this.props.updateToken()
            },
            // Parse firebase account errors and display on the account manager
            error: (xhr,status,error) => {
                console.log("!")
                var message = xhr.responseJSON.message
                if (message == "auth/invalid-password") {
                    this.setState({signupText: "Password must be atleast 6 characters."})
                } else if (message == "auth/email-already-exists") {
                    this.setState({signupText: "Email already has an account"})
                } else if (message == "auth/invalid-email") {
                    this.setState({signupText: "Email must be valid."})
                } else if (message == "auth/invalid-email") {
                    this.setState({signupText: "Email must be valid."})
                }
            }
        });
    }

    // Render function, called every time there is a state change
    render() {
        return (    // Format the account manager
            <div class="w3-container">
                <div class="w3-card w3-round-large w3-panel w3-white"  id="accountManager">
                    <center><h1>Welcome to Meal Planner</h1></center>
                    <hr/>

                    <h3>Login</h3>
                    Email <br/>
                    <input  onChange={(e) => this.setState({email: e.target.value})}></input> <br/>
                    Password <br/>
                    <input  type="password" onChange={(e) => this.setState({password: e.target.value})}></input><br/>
                    <span><button id="login" onClick={this.login} class="w3-btn w3-round-medium w3-text-white">Log In</button>
                    <span style={{color: "#785589", "margin-left": "5px"}}>{this.state.loginText}</span>
                    </span>
                    

                    <hr/>
                    <h3>Sign Up</h3>
                    Email <br/>
                    <input onChange={(e) => this.setState({email: e.target.value})}></input><br/>
                    Password <br/>
                    <input type="password" onChange={(e) => this.setState({password: e.target.value})}></input><br/>
                    Repeat Password <br/>
                    <input type="password" onChange={(e) => this.setState({repassword: e.target.value})}></input><br/>
                    <span><button id="signup" onClick={this.signup} class="w3-btn w3-round-medium w3-text-white">Sign Up</button>
                    <span style={{color: "#785589", "margin-left": "5px"}}>{this.state.signupText}</span>
                    </span>
                </div>
            </div>
        )
    }
}

export default AccountManager;