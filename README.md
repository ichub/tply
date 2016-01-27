# tply

This project allows you to simulate character-by-character typing within a webpage.

## usage

Put a reference to the tply source file at the top of your html:
```html
<script src="tply.js"></script>
```
Then, in your html, have two elements - a source, and a destination. tply will read the elements from the source,
and write them in sequentially into the destination. Then, call the tply script to animate.

```html
<div id="template">
    this is the source
</div>

<div id="animation">
this is the destination
</div>

<script>
    tply.animate(
        document.getElementById("template"), 
        document.getElementById("animation"));
</script>
```

If you so choose, you can pass in a configuration object to the `animate` function, which will change the behavior
of the animation. For example:]

```html
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
```
### config options
#### `processing`
If you want to process elements before or after they are inserted into the destination, use this. Each item in the `processing` array can have the following properties:

* `tag` **(required)** the tag of elements to process. If you want to process all `div`s, set `tag` to be `"div"`
* `pre` **(optional)** a function which takes one parameter - an html element - and does whatever you want with it
* `post`**(optional)** just like `pre`, but processes the element after it's been inserted into the DOM

Example config object with explanation:

```javascript
{
    processing: [
        {
            tag: "h1",
            pre: function(element) {
                element.innerText += "Robert'); DROP TABLE Students;--" 
            },
            post: function(element) {
                element.parentNode.style.background = "red";
            }
        }
    ]
}
```

Given this config object, tmly will append the string `"Robert'); DROP TABLE Students;--"` inside all `<h1></h1>` elements within the animation. Additionally, it will set the background of the parent of each `h1` to be red. Note that the second change would not work during pre-processing, because at that point the element would not be inserted into the DOM yet, and thus not have a parent node.

#### `types`
If you find yourself typing out `data-char-interval` and co. too often, perhaps you could use types. Types allow you to pre-define these attributes, and reuse common 'types'. Each object in the `types` array can have the following properties:

* `name` **(required)** the name of the type
* `properties` **(required)** key-value of all the attributes you want the elements with this type to have
* `styleClasses` **(optional)** a string with css classes which all elements with this type should have
* `style` **(optional)** raw css which the `style` attribute of elements with this type should have.
