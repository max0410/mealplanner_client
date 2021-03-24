/* 
This is the export class that shows up when you click the export button on the calendar or the shopping list, its resposible for:
1. Converting html elements to png and jpg
2. Showing the element as an image preview
3. Sending the element to be printed
*/

// Imports for react native and the css
import React from 'react'
import ReactDOM from 'react-dom'
import '../index.css'

// Imports needed to take html and turn it into images
import * as htmlToImage from 'html-to-image'
import { toPng, toJpeg, toBlob, toPixelData, toSvg } from 'html-to-image'

function hiddenClone(element){
    // Create clone of element
    var clone = element.cloneNode(true)
    
    // Position element relatively within the 
    // body but still out of the viewport
    var style = clone.style
    style.position = 'relative'
    style.top = window.innerHeight + 'px'
    style.left = 0
    
    // Append clone to body and return the clone
    document.body.appendChild(clone)
    return clone
}

// Returns new html tab for printing
function ImagetoPrint(source) {
    return "<html><head><scri"+"pt>function step1(){\n" +
            "setTimeout('step2()', 10);}\n" +
            "function step2(){window.print();window.close()}\n" +
            "</scri" + "pt></head><body onload='step1()'>\n" +
            "<img src='" + source + "' /></body></html>"
}

// Function that takess an image and prints
function PrintImage(source) {
    var Pagelink = "about:blank"
    var pwa = window.open(Pagelink, "_new")   // Opens a new page with the image
    pwa.document.open()
    pwa.document.write(ImagetoPrint(source))
    pwa.document.close()
}

// Export class
class Export extends React.Component {
    constructor(props) {
        super(props)
        // Class properties for keepng track of whether to display or not and saving the element to export
        this.state = {display: false, element: null}

        // In React class methods must be defined
        this.show =     this.show.bind(this)
        this.hide =     this.hide.bind(this)
        this.print =    this.print.bind(this)
        this.png =      this.png.bind(this)
        this.jpg =      this.jpg.bind(this)
    }
    
    // Prints the element
    print() {
        
        var element = this.state.element
        ReactDOM.render(element, document.getElementById("hiddenCalendarParent"))   // Converts JSX to a DOM element
        document.getElementById("hiddenCalendarParent").style.display = "block"     // Shows hiddenCalendarParent so it can be captured by htmlToImage

        var node = document.getElementById('hiddenCalendarParent');
        htmlToImage.toPng(node)
            .then((dataUrl) => {
                PrintImage(dataUrl)
                document.getElementById("hiddenCalendarParent").style.display = "none"  // Hides hiddenCalendarParent
                this.hide()
            })
            .catch((error) => {
                console.error(error);
            });
    }

    // Exports the element as a jpeg
    jpg() {
        
        var element = this.state.element
        ReactDOM.render(element, document.getElementById("hiddenCalendarParent"))   // Converts JSX to a DOM element
        document.getElementById("hiddenCalendarParent").style.display = "block"     // Shows hiddenCalendarParent so it can be captured by htmlToImage

        var node = document.getElementById('hiddenCalendarParent');
        htmlToImage.toJpeg(node)
            .then((dataUrl) => {
                
                // Create a <a> download tag, sets its source to the png, and clicks it
                var a = document.createElement("a"); 
                a.href = dataUrl
                a.download = "export.jpeg"
                a.click()                // Clicks the download link so it downloads automatically
                document.getElementById("hiddenCalendarParent").style.display = "none"  // Hides hiddenCalendarParent
                this.hide()
            })
            .catch((error) => {   // Error catching
                console.error(error);    
            });
    }

    // Exports the element as a png
    png() {
        var element = this.state.element
        ReactDOM.render(element, document.getElementById("hiddenCalendarParent"))   // Converts JSX to a DOM element
        document.getElementById("hiddenCalendarParent").style.display = "block"     // Shows hiddenCalendarParent so it can be captured by htmlToImage

        var node = document.getElementById('hiddenCalendarParent');
        htmlToImage.toPng(node)     // Gets the node as a png base 64
            .then((dataUrl) => {

                // Create a <a> download tag, sets its source to the png, and clicks it
                var a = document.createElement("a") 
                a.href = dataUrl           
                a.download = "export.png"  
                a.click()                   // Clicks the download link so it downloads automatically
                document.getElementById("hiddenCalendarParent").style.display = "none"  // Hides hiddenCalendarParent

                this.hide()
            })
            .catch((error) => {     // Error catching
                console.error(error)
            });
    }

    // Shows the export window and loads in a preview of the export content
    show(element) {
        this.state.element = element
        ReactDOM.render(element, document.getElementById("hiddenCalendarParent"))   // Converts JSX to a DOM element
        
        // Displays the export window
        this.setState({display: true}, () => {
            var node = document.getElementById('hiddenCalendarParent');

            document.getElementById('hiddenCalendarParent').style.display = 'block';    // Shows hiddenCalendarParent so it can be captured by htmlToImage    
            htmlToImage.toPng(node).then((dataUrl) => { // Gets the node as a png base 64

                var img = new Image();                  // Creates an class from the dataURL
                img.src = dataUrl;
                img.width = node.offsetWidth / 3.5      // Resizing the image to be smaller
                img.height = node.offsetHeight / 3.5
                img.id = "exportImage"

                document.getElementById('hiddenCalendarParent').style.display = 'none';     // Hides hiddenCalendarParent
                
                // Making the image the background of the preview box so if it bigger than the window it won't overflow
                document.getElementById("exportContentParent").style.backgroundImage = "url('"+ img.src +"')"
                document.getElementById("exportContentParent").style.backgroundSize = img.width +"px 250px"
                
                // Positioning the image based upon what element it is
                if (element.props.id == "calendarExport") {
                    document.getElementById("exportImage").style.top = "35%"
                    document.getElementById("exportImage").style.left = "1%"
                } else {
                    document.getElementById("exportImage").style.top = "0%"
                    document.getElementById("exportImage").style.left = "0%"
                }
                
                
            })
            .catch((error) => {
                console.error(error);
            });
        })
    }

    // Hide the export window
    hide() {
        this.setState({display: false})
    }

    // Render function, triggered each time their is a state change
    render() {
        if (this.state.display) {   // If display is true show the export window
            return (                // Render the export window over a gray overlay
                <div>
                    <div id="overlay">
                    </div>
                    <div id="export" class="w3-card-4 w3-margin">
                        <div id="header" style={{height: "40px", "margin-bottom":"0px"}}>
                            <h3 style={{display: "inline"}}>Export</h3>
                            <button class="exitExport" onClick={this.hide}>✕</button>
                        </div>
                        <div id="exportBody">
                            <div id="exportContentParent"></div>
                            <div id="exportButtons">
                                <button class="exportChoice" onClick={this.print}>Print</button>
                                <button class="exportChoice" onClick={this.png}>Download as PNG</button>
                                <button class="exportChoice" onClick={this.jpg}>Download as JPEG</button>
                            </div>
                        </div>
                    </div>
                </div>
            )
        } else {                // Otherwise don't show anything
            return (        
                <div style={{display: "none"}}></div>
            )
        }
    }
}

export default Export