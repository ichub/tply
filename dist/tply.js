(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){

var duration = /(-?\d*\.?\d+(?:e[-+]?\d+)?)\s*([a-zμ]*)/ig

module.exports = parse

/**
 * conversion ratios
 */

parse.nanosecond =
parse.ns = 1 / 1e6

parse.μs =
parse.microsecond = 1 / 1e3

parse.millisecond =
parse.ms = 1

parse.second =
parse.sec =
parse.s = parse.ms * 1000

parse.minute =
parse.min =
parse.m = parse.s * 60

parse.hour =
parse.hr =
parse.h = parse.m * 60

parse.day =
parse.d = parse.h * 24

parse.week =
parse.wk =
parse.w = parse.d * 7

parse.month = parse.d * (365.25 / 12)

parse.year =
parse.yr =
parse.y = parse.d * 365.25

/**
 * convert `str` to ms
 *
 * @param {String} str
 * @return {Number}
 */

function parse(str){
  var result = 0
  str.replace(duration, function(_, n, units){
    units = parse[units]
      || parse[units.toLowerCase().replace(/s$/, '')]
      || 1
    result += parseFloat(n, 10) * units
  })
  return result
}

},{}],2:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

(function () {
    var parseDuration = require("parse-duration");
    var NodeType;
    (function (NodeType) {
        NodeType[NodeType["Element"] = 1] = "Element";
        NodeType[NodeType["Attribute"] = 2] = "Attribute";
        NodeType[NodeType["Text"] = 3] = "Text";
        NodeType[NodeType["Comment"] = 8] = "Comment";
    })(NodeType || (NodeType = {}));
    /**
     * This class is in charge of keeping track of the cancellation state of a given
     * animation. Since some animations can be super long, there may arise a need to cancel
     * one at some time or another.
     */

    var Status = function () {
        function Status() {
            _classCallCheck(this, Status);

            this._isCancelled = false;
            this._isFinished = false;
            this.cancellationListeners = [];
            this.finishedListeners = [];
        }

        _createClass(Status, [{
            key: "cancel",
            value: function cancel(callback) {
                if (typeof callback !== "undefined") {
                    this.registerCancellationListener(callback);
                }
                this._isCancelled = true;
            }
        }, {
            key: "registerCancellationListener",
            value: function registerCancellationListener(listener) {
                this.cancellationListeners.push(listener);
            }
        }, {
            key: "registerFinishedListener",
            value: function registerFinishedListener(listener) {
                this.finishedListeners.push(listener);
            }
        }, {
            key: "onCancel",
            value: function onCancel() {
                this.cancellationListeners.forEach(function (listener) {
                    listener();
                });
            }
        }, {
            key: "onFinish",
            value: function onFinish() {
                this._isFinished = true;
                this.finishedListeners.forEach(function (listener) {
                    listener();
                });
            }
        }, {
            key: "isCancelled",
            get: function get() {
                return this._isCancelled;
            }
        }, {
            key: "isFinished",
            get: function get() {
                return this._isFinished;
            }
        }]);

        return Status;
    }();

    var AnimationContext = function () {
        function AnimationContext(status, config, rootFrom, from, rootTo, to, callback) {
            var insertedChars = arguments.length <= 7 || arguments[7] === undefined ? [] : arguments[7];
            var extra = arguments.length <= 8 || arguments[8] === undefined ? null : arguments[8];
            var cursor = arguments.length <= 9 || arguments[9] === undefined ? null : arguments[9];
            var rootContext = arguments.length <= 10 || arguments[10] === undefined ? null : arguments[10];

            _classCallCheck(this, AnimationContext);

            this._insertedChars = [];
            this._status = status;
            this._config = config;
            this._rootFrom = rootFrom;
            this._from = from;
            this._rootTo = rootTo;
            this._to = to;
            this._callback = callback;
            this._insertedChars = insertedChars;
            this._extra = extra;
            this._cursor = cursor;
            this._rootContext = rootContext;
        }

        _createClass(AnimationContext, [{
            key: "clone",
            value: function clone() {
                return new AnimationContext(this._status, this._config, this._rootFrom, this._from, this._rootTo, this._to, this._callback, this._insertedChars, this._extra, this._cursor, this._rootContext);
            }
        }, {
            key: "withRootContext",
            value: function withRootContext(context) {
                var clone = this.clone();
                clone._rootContext = context;
                context._rootContext = context;
                return clone;
            }
        }, {
            key: "withFrom",
            value: function withFrom(root) {
                var clone = this.clone();
                clone._from = root;
                return clone;
            }
        }, {
            key: "withTo",
            value: function withTo(node) {
                var clone = this.clone();
                clone._to = node;
                return clone;
            }
        }, {
            key: "withCallback",
            value: function withCallback(callback) {
                var clone = this.clone();
                clone._callback = callback;
                return clone;
            }
        }, {
            key: "withExtra",
            value: function withExtra(extra) {
                var clone = this.clone();
                clone._extra = extra;
                return clone;
            }
        }, {
            key: "status",
            get: function get() {
                return this._status;
            }
        }, {
            key: "config",
            get: function get() {
                return this._config;
            }
            /**
             * This is the node which we are currently cloning and animating
             * into the destination. It is located somewhere within the template
             * element.
             * @returns {Node}
             */

        }, {
            key: "from",
            get: function get() {
                return this._from;
            }
        }, {
            key: "fromAsElement",
            get: function get() {
                return this._from;
            }
        }, {
            key: "fromAsCharacterData",
            get: function get() {
                return this._from;
            }
            /**
             * This is the element INTO which we are cloning and animating
             * an element.
             * @returns {HTMLElement}
             */

        }, {
            key: "to",
            get: function get() {
                return this._to;
            }
        }, {
            key: "callback",
            get: function get() {
                return this._callback;
            }
        }, {
            key: "extra",
            get: function get() {
                return this._extra;
            }
        }, {
            key: "rootFrom",
            get: function get() {
                return this._rootFrom;
            }
        }, {
            key: "rootTo",
            get: function get() {
                return this._rootTo;
            }
        }, {
            key: "insertedChars",
            get: function get() {
                return this._insertedChars;
            }
        }, {
            key: "cursor",
            get: function get() {
                return this._rootContext._cursor;
            },
            set: function set(value) {
                this._rootContext._cursor = value;
            }
        }]);

        return AnimationContext;
    }();

    var innerText = function innerText(element) {
        return element.innerText || element.textContent;
    };
    var setInnerText = function setInnerText(element, text) {
        if (typeof element.innerText !== "undefined") {
            element.innerText = text;
        } else {
            element.textContent = text;
        }
    };
    var asynchronouslyProcessNodes = function asynchronouslyProcessNodes(context, processFn) {
        var callbackParam = arguments.length <= 2 || arguments[2] === undefined ? null : arguments[2];

        var index = 0;
        var processNextItem = function processNextItem() {
            if (index < context.from.childNodes.length) {
                processFn(context.from.childNodes[index++], processNextItem);
            } else {
                context.callback(callbackParam);
            }
        };
        processNextItem();
    };
    var stripWhitespace = function stripWhitespace(text) {
        return text.replace(/\n/, "").replace(/\s\s+/g, " ");
    };
    var removeChildren = function removeChildren(element) {
        element.innerHTML = "";
    };
    /**
     * Wraps a given function in another one, which is responsible for calling
     * the original one if the original one needs to be executed.
     * @param original - A function to wrap.
     * @param wrapper - Function that should be called in place of the original one,
     * has the same parameters as the original one, with an additional parameter at the
     * end, which is the original function. Do with the original function as you wish -
     * call or don't - up to you.
     * @returns - Function with the same signature as the original one.
     */
    var wrapFunction = function wrapFunction(original, wrapper) {
        return function () {
            var argsArray = Array.prototype.slice.call(arguments);
            argsArray.push(original);
            wrapper.apply(this, argsArray);
        };
    };
    var isDefined = function isDefined(object) {
        return typeof object !== "undefined";
    };
    var ignoreCaseEquals = function ignoreCaseEquals(left, right) {
        return left.toLowerCase() === right.toLowerCase();
    };
    var matchElement = function matchElement(element, processingItem) {
        if (isDefined(processingItem.tag)) {
            if (!ignoreCaseEquals(element.tagName, processingItem.tag)) {
                return false;
            }
        }
        if (isDefined(processingItem.id)) {
            if (element.id !== processingItem.id) {
                return false;
            }
        }
        if (isDefined(processingItem.cssClass)) {
            if (!element.classList.contains(processingItem.cssClass)) {
                return false;
            }
        }
        return true;
    };
    /**
     * Wraps a processor that does animation with some extra logic which enables us to
     * pre- and post- process elements, style them, and give them extra attributes defined
     * by the configuration. Additionally, stops the animation if it is cancelled.
     * @param processFn
     */
    var makeProcessor = function makeProcessor(processFn) {
        return function (context) {
            if (context.status.isCancelled) {
                context.status.onCancel();
                // not calling the callback effectively
                // stops the animation - this is deliberate.
                return;
            }
            var callBackProxy = context.callback;
            for (var i = 0; i < context.fromAsElement.attributes.length; i++) {
                if (!Array.isArray(context.config.types)) {
                    break;
                }
                for (var j = 0; j < context.config.types.length; j++) {
                    if (context.from.attributes[i].name === "data-type") {
                        if (context.from.attributes[i].value === context.config.types[j].name) {
                            for (var propName in context.config.types[j].properties) {
                                if (context.config.types[j].properties.hasOwnProperty(propName)) {
                                    context.fromAsElement.setAttribute(propName, context.config.types[j].properties[propName]);
                                }
                            }
                            if (typeof context.config.types[j].styleClasses !== "undefined") {
                                context.fromAsElement.classList.add(context.config.types[j].styleClasses);
                            }
                            context.fromAsElement.setAttribute("style", context.fromAsElement.getAttribute("style") + ";" + context.config.types[j].style);
                        }
                    }
                }
            }
            if (Array.isArray(context.config.processing)) {
                var _loop = function _loop(k) {
                    if (matchElement(context.fromAsElement, context.config.processing[k])) {
                        if (typeof context.config.processing[k].pre === "function") {
                            context.config.processing[k].pre(context.fromAsElement);
                        }
                        if (typeof context.config.processing[k].post === "function") {
                            callBackProxy = wrapFunction(callBackProxy, function (element, originalCallback) {
                                context.config.processing[k].post(element);
                                originalCallback(element);
                            });
                        }
                    }
                };

                for (var k = 0; k < context.config.processing.length; k++) {
                    _loop(k);
                }
            }
            processFn(context.withCallback(callBackProxy));
        };
    };
    /**
     * Appends a clone of an HTML Element to another one, conditionally removing
     * all of its children.
     * @param root - The element to which the clone will be appended.
     * @param node - The element to clone and append.
     * @param desiredTag - The desired tag that the clone should be (ie. 'div', 'a', 'span', etc.)
     * @param deepCopy - If true, copy the children too, if false do not copy the children.
     */
    var append = function append(root, node) {
        var desiredTag = arguments.length <= 2 || arguments[2] === undefined ? null : arguments[2];
        var deepCopy = arguments.length <= 3 || arguments[3] === undefined ? false : arguments[3];

        var clone = node.cloneNode(true);
        if (!deepCopy) {
            clone.innerHTML = "";
        }
        if (desiredTag !== null) {
            var clonedInnerHtml = clone.innerHTML;
            clone = document.createElement(desiredTag);
            clone.innerHTML = clonedInnerHtml;
            for (var i = 0; i < node.attributes.length; i++) {
                clone.setAttribute(node.attributes[i].name, node.attributes[i].value);
            }
            clone.className = node.className;
        }
        root.appendChild(clone);
        return clone;
    };
    var scrollDown = function scrollDown(config) {
        if (config.shouldScrollDown) {
            window.scroll(0, document.documentElement.offsetHeight);
        }
    };
    var mapFirstCharToInterval = function mapFirstCharToInterval(context, text) {
        var referenceTypeNode = context.extra || context.from;
        var defaultCharInterval = "50ms";
        var defaultPeriodInterval = "500ms";
        var defaultCommaInterval = "300ms";
        var defaultEndInterval = "0ms";
        var defaultWordInterval = "0ms";
        var dataCharInterval = null;
        var dataPeriodInterval = null;
        var dataCommaInterval = null;
        var dataEndInterval = null;
        var dataWordInterval = null;
        if (typeof referenceTypeNode.getAttribute === "function") {
            dataCharInterval = referenceTypeNode.getAttribute("data-char-interval");
            dataPeriodInterval = referenceTypeNode.getAttribute("data-period-interval");
            dataCommaInterval = referenceTypeNode.getAttribute("data-comma-interval");
            dataEndInterval = referenceTypeNode.getAttribute("data-end-interval");
            dataWordInterval = referenceTypeNode.getAttribute("data-word-interval");
        }
        var charInterval = parseDuration(dataCharInterval || defaultCharInterval);
        var periodInterval = parseDuration(dataPeriodInterval || defaultPeriodInterval);
        var commaInterval = parseDuration(dataCommaInterval || defaultCommaInterval);
        var endInterval = parseDuration(dataEndInterval || defaultEndInterval);
        var wordInterval = parseDuration(dataWordInterval || defaultWordInterval);
        var char = text[0];
        if (text.length === 1) {
            return endInterval;
        } else if (char === "." || char === "?" || char === "!") {
            return Math.max(charInterval, periodInterval);
        } else if (char === " ") {
            return Math.max(wordInterval, charInterval);
        } else if (char === ",") {
            return Math.max(charInterval, commaInterval);
        }
        return charInterval;
    };
    var createCharacterElement = function createCharacterElement(char) {
        var charElement = document.createElement("span");
        charElement.classList.add("character");
        setInnerText(charElement, char);
        return charElement;
    };
    /**
     * This is where the magic happens - here we type out text into an HTML Element.
     */
    var writeText = function writeText(context, text) {
        if (text === "" || text === " ") {
            context.callback(null);
            return;
        }
        if (context.status.isCancelled) {
            context.status.onCancel();
            return;
        }
        var charElement = createCharacterElement(text[0]);
        var interval = mapFirstCharToInterval(context, text);
        var continueWriting = function continueWriting() {
            writeText(context, text.slice(1));
            scrollDown(context.config);
        };
        context.to.appendChild(charElement);
        context.insertedChars.push(charElement);
        if (interval === 0) {
            continueWriting();
        } else {
            setTimeout(continueWriting, interval);
        }
    };
    var getCursor = function getCursor(context) {
        var cursor = document.createElement("div");
        cursor.style.display = "inline-block";
        cursor.style.width = "0.5em";
        cursor.style.height = "1em";
        cursor.style.backgroundColor = "black";
        cursor.style.marginLeft = "3px";
        cursor.classList.add("cursor");
        if (context.cursor !== null) {
            context.cursor.parentNode.removeChild(context.cursor);
        }
        context.cursor = cursor;
        return cursor;
    };
    var createTypeDestination = function createTypeDestination() {
        var destination = document.createElement("span");
        return destination;
    };
    var processTypeNode = function processTypeNode(context) {
        switch (context.from.nodeType) {
            case NodeType.Element:
                makeProcessor(function (context) {
                    var appendedRoot = append(context.to, context.fromAsElement);
                    context.callback(appendedRoot);
                })(context.withCallback(function (appendedRoot) {
                    asynchronouslyProcessNodes(context, function (node, callback) {
                        processTypeNode(context.withTo(appendedRoot).withFrom(node).withCallback(callback).withExtra(context.extra || context.from));
                    });
                }));
                break;
            case NodeType.Text:
                var cursor = getCursor(context);
                var destination = createTypeDestination();
                context.to.appendChild(destination);
                context.to.appendChild(cursor);
                writeText(context.withTo(destination), stripWhitespace(context.fromAsCharacterData.data));
                break;
            default:
                context.callback(null);
                break;
        }
    };
    var processWaitNode = function processWaitNode(context) {
        var duration = parseDuration(innerText(context.fromAsElement));
        setTimeout(function () {
            context.callback(null);
        }, duration);
    };
    var processClearParentNode = function processClearParentNode(context) {
        removeChildren(context.to);
        context.callback(null);
    };
    var processClearAllNode = function processClearAllNode(context) {
        removeChildren(context.rootTo);
        context.callback(null);
    };
    var processRepeatNode = function processRepeatNode(context) {
        var repeatAttr = context.fromAsElement.getAttribute("data-repeat");
        var repeats = 1;
        if (repeatAttr === "infinite") {
            repeats = -1;
        } else if (typeof repeatAttr !== "undefined") {
            repeats = parseInt(repeatAttr, 10);
        }
        var index = 0;
        var clone = append(context.to, context.fromAsElement);
        var processAgain = function processAgain() {
            if (index++ < repeats || repeats === -1) {
                asynchronouslyProcessNodes(context.withCallback(processAgain), function (node, callback) {
                    processNode(context.withFrom(node).withCallback(callback).withTo(clone));
                });
            } else {
                context.callback(null);
            }
        };
        processAgain();
    };
    var processDeleteNode = function processDeleteNode(context) {
        var count = 0;
        var charDeleteCount = parseInt(context.fromAsElement.getAttribute("data-chars"), 10);
        var ignoreWhitespace = context.fromAsElement.getAttribute("data-ignore-whitespace") || "false";
        var deleteChar = function deleteChar() {
            if (count == charDeleteCount) {
                context.callback(null);
                return;
            }
            var index = context.insertedChars.length - 1;
            var currentChar = context.insertedChars[index];
            currentChar.parentElement.removeChild(currentChar);
            context.insertedChars.pop();
            if (!/\s+/.test(innerText(currentChar))) {
                count++;
            }
            setTimeout(deleteChar, 100);
        };
        deleteChar();
    };
    var processDeleteWordsNode = function processDeleteWordsNode(context) {
        var count = 0;
        var wordDeleteCount = parseInt(context.fromAsElement.getAttribute("data-words"), 10);
        var deleteChar = function deleteChar() {
            if (count == wordDeleteCount) {
                context.callback(null);
                return;
            }
            var index = context.insertedChars.length - 1;
            var currentChar = context.insertedChars[index];
            currentChar.parentElement.removeChild(currentChar);
            context.insertedChars.pop();
            if (/\s+/.test(innerText(currentChar))) {
                count++;
            }
            setTimeout(deleteChar, 100);
        };
        deleteChar();
    };
    var processors = {
        "type": makeProcessor(processTypeNode),
        "wait": makeProcessor(processWaitNode),
        "clearparent": makeProcessor(processClearParentNode),
        "clearall": makeProcessor(processClearAllNode),
        "repeat": makeProcessor(processRepeatNode),
        "delete": makeProcessor(processDeleteNode),
        "deletewords": makeProcessor(processDeleteWordsNode)
    };
    var processDefaultNode = makeProcessor(function (context) {
        var noAnimateContents = context.fromAsElement.getAttribute("data-ignore-tply") === "true";
        var clone = append(context.to, context.fromAsElement, null, noAnimateContents);
        clone.classList.add(context.config.insertedClass || "fadein");
        if (noAnimateContents) {
            context.callback(clone);
        } else {
            runAnimation(context.withTo(clone));
        }
    });
    var processNode = function processNode(context) {
        switch (context.from.nodeType) {
            case NodeType.Element:
                var tag = context.fromAsElement.tagName.toLowerCase();
                var matchingProcessor = processors[tag] || processDefaultNode;
                matchingProcessor(context);
                break;
            case NodeType.Text:
                context.to.appendChild(document.createTextNode(context.fromAsCharacterData.data));
                scrollDown(context.config);
                context.callback(null);
                break;
            default:
                scrollDown(context.config);
                context.callback(null);
                break;
        }
    };
    var runAnimation = function runAnimation(context) {
        asynchronouslyProcessNodes(context, function (node, callback) {
            processNode(context.withFrom(node.cloneNode(true)).withCallback(callback));
        }, context.to);
    };
    window.tply = window.tply || {
        animate: function animate(from, to) {
            var conf = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];
            var callback = arguments.length <= 3 || arguments[3] === undefined ? function () {
                return null;
            } : arguments[3];

            var cancellation = new Status();
            var context = new AnimationContext(cancellation, conf, from, from, to, to, function () {
                cancellation.onFinish();
                callback();
            });
            context = context.withRootContext(context);
            runAnimation(context);
            return cancellation;
        }
    };
})();
},{"parse-duration":1}]},{},[2])