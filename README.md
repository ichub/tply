# tply

This library allows you to simulate text being typed out character by character. Heres a "hello world" example:

```html
<html>
    <head>
        <script src="the_path_to_tply.js"></script>
        <style>
            #source {
                display: none;
            }
        </style>
    </head>
    <body>
        <div id="source">
            <type>this text is typed out!</type>
        </div>
        <div id="destination">
        </div>
        
        <script>
            tply.animate(
                document.getElementById("source"),
                document.getElementById("destination"));
        </script>
    </body>
</html>
```

## Documentation - Js
tply renders the markup within the source element into the destination element. tply renders each element one by one,
in the order that they appear in the source element. You can create a template within html (make sure to hide it using 
css, or your content will show up twice), and then render it into a destination element.

```javascript
// this will use the contents of the element with the id 'source' as the template,
// and render it into the element with the id 'destination'.
tply.animate(
    document.getElementById("source"),
    document.getElementById("destination"));
```

Sometimes it is nice to be able to cancel an animation, either due to user input, or because the animation
would continue infinitely otherwise. tply returns a `Cancellation` object when you call `animate`, which allows you
to cancel an animation that is in progress.

```javascript
let cancellation = tply.animate(
    document.getElementById("source"),
    document.getElementById("destination"));

// cancel the animation and stop its execution after one second
setTimeout(
    function() {
        cancellation.cancel(function() {
            alert("cancelled!");
        });
    },
    1000);
```

In addition to pasing in the source and destination of the animation, you can pass in a 3rd, optional, argument,
with more configuration.

```javascript
tply.animate(
    document.getElementById("source"),
    document.getElementById("destination"),
    {
        types: [
            name: "",
            properties: {
                "data-prop1": "value1",
                "data-prop2": "value2"
            },
            styleClasses: "",
            style: ""
        ],
        processing: [
            tag: "div",
            pre: function(element) {
            },
            post: function(element) {
            }
        ]
    });
```

## Documentation - HTML

In addition to being able to use any existing html element, you can also use one of these:

### `wait`
This element pauses the animation for a specified amount of time. Times can be specified in the format specified by the
`parse-duration` npm module, which can be found [here](https://www.npmjs.com/package/parse-duration). Here are some
example durations taken from that page:
```text
1ns  => 1 / 1e6 
1μs  => 1 / 1000 
1ms  => 1 
1s   => ms * 1000 
1m   => s * 60 
1h   => m * 60 
1d   => h * 24 
1w   => d * 7 
1y   => d * 365.25 
```

##### example
```html
<wait>100ms</wait>
```

### `type`
Text within this element is typed out character by character. Each character is a `span` with the `.character` class
applied to it. You can define the style of `.character` as you wish. For example, you could add an animation to fade
each character in, etc.

##### attributes
* `data-char-interval` - the time to pause after each character is typed out, in the same format as the `wait` tag.
* `data-period-interval` - the time to wait after a period (`.`) character.
* `data-comma-interval` - the time to wait after a comma.
* `data-end-interval` - the time to wait after the last character in the type element.
* `data-word-interval` - the time to wait after each word.

##### example
```html
<type>this text will be typed out</type>
```

### `repeat`
The stuff within a `repeat` element will be repeated a given amount of times.

##### attributes
* `data-repeat` - either a number or `'infinity'`, signifying the amount of times to repeat the content.

##### example
```html
<repeat data-repeat="5">
    <type>this will be repeated 5 times</type>
    <wait>500ms</wait>
</repeat>
```

### `clear_parent`
Removes all children of its parent element.

##### example
``` html
<div id="remove_my_children">
    <type>this is some text</type>
    <img src="a source"/>
    <wait>500ms</wait>
    <clear_parent></clear_parent>
<div>
```

### `clear_all`
Removes all children of the root animation source.

##### example
```html
<div>
    wow
    <div>
        nice
        <span><clear_all></clear_all></span>
    </div>
</div>
```