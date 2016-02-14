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

## Documentation

tply renders the markup within the source element into the destination element. tply renders each element one by one,
in the order that they appear in the source element. In addition to being able to use any existing html element, you
can also use one of these:

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

Here's an example of a wait element which would pause the animation for 100 milliseconds.
```html
<wait>100ms</wait>
```

### `type`
Text within this element is typed out character by character. Each character is a `span` with the `.character` class
applied to it. You can define the style of `.character` as you wish. For example, you could add an animation to fade
each character in, etc.

##### example
```html
<type>this text will be typed out</type>
```