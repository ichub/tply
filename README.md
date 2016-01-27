# tply

This project allows you to simulate character-by-character typing within a webpage.

## usage

Put a reference to the tply source file at the top of your html:

    <script src="tply.js"></script>

Then, in your html, have two elements - a source, and a destination. tply will read the elements from the source,
and write them in sequentially into the destination. Then, call the tply script to animate.


    <div id="template">
        this is the source
    </div>
    
    <div id="animation">
    this is the destination
    </div>
    
    <script>tply.animate(document.getElementById("template"), document.getElementById("animation"));</script>


If you so choose, you can pass in a configuration object to the `animate` function, which will change the behavior
of the animation. For example:

    <script>
        tply.animate(
            document.getElementById("template"),
            document.getElementById("animation"),
            {
                processing: [
                    {
                        tag: "code",
                        post: function(element) {
                            hljs.highlightBlock(element);
                        }
                    }
                ]
            });
    </script>

### config options
#### `processing`
