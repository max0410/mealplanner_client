/* 
This is class for the meal listings within the meal selector, this class is responsible for:
1. Displaying meal information for one meal
2. Communicating with the meal selector when the meal is clicked or toggled
*/

// React Native imports and css
import React from 'react';
import ReactDOM from 'react-dom';
import '../index.css';

// Meal class
class Meal extends React.Component {
  constructor(props) {
      super(props)

      // Class methods must be binded in React
      this.stripText = this.stripText.bind(this)
  }

  // Function to cut off text at a certain character count
  stripText(text, n) {
    if (text.length > n) {
        return text.slice(0,n-3) + "..."
    } else {
        return text
    }
  }

  // Render function, called whenever the calendar renders a meal
  render() {
    return (  // Formatting for the meal data
      <div class="meal" onClick={this.props.onClick} style={(this.props.name == this.props.selectedMeal) ? {"background-color": "#ccc"} : {}}>
          <div class="data1">
            <img class="mealimage" src={this.props.data.image} draggable="false"></img>
            <a class="meallink" href={this.props.data.url} target="_blank"><span class="mealname">{this.stripText(this.props.name,45)}</span></a>
          </div>
          <div class="type">
            <div>{this.stripText(this.props.data.type[0],10)}</div>
          </div>
          <div class="category">
            <div>{this.stripText(this.props.data.category[0],10)}</div>
          </div>
          <label class="switch">
            <input type="checkbox" checked={this.props.data.enabled} onChange={(e) => this.props.enabled(e, this.props.name)}></input>
            <span class="slider round"></span>
        </label>
      </div>
    )
  }
}

export default Meal;