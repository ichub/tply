(function ():void {
    const parseDuration:IParseDuration = require("parse-duration");

    enum NodeType {
        Element = 1,
        Attribute = 2,
        Text = 3,
        Comment = 8
    }

    /**
     * Type of object used to configure the behavior of tply for a given animation.
     */
    interface IConfiguration {
        types?: [{
            name: string,
            properties?: any,
            styleClasses?: string,
            style?: string
        }];
        processing?: [{
            tag: string,
            pre: (element:HTMLElement) => void,
            post: (element:HTMLElement) => void
        }];
    }

    /**
     * When a processor finishes processing its given element and that element's children,
     * it yields control back to its parent by calling this function. The `element` parameter
     * is a reference to the element which the processor inserted into the DOM.
     */
    interface IProcessorCallback extends Function {
        (element:HTMLElement | Node | void): void;
    }

    /**
     * Processors are in charge of animating a given element or node. They should respond to
     * cancellation requests (most of the time this works by default, since it is injected
     * into the processor using the {@link makeProcessor} function). They should yield control
     * back to the caller once animation is completed using the `callback` function. There is a
     * `...params:any[]` parameter because some processors may be recursive, and pass extra
     * parameters to themselves on subsequent runs.
     */
    interface IProcessor {
        (context:AnimationContext): void;
    }

    interface IVoidCallback {
        ():void;
    }

    /**
     * This is necessary because the {@link NodeList} object prototype et. al. are severely
     * crippled versions of JavaScript arrays, and don't support simple things like `forEach`,
     * `map`, `filter`, etc. If we just want to be able to get the length of these shady types,
     * and index on them, this interface provides a generic way of doing that.
     */
    interface ISimpleArray<T> {
        length: number;
        [index: number]: T;
    }

    /**
     * This class is in charge of keeping track of the cancellation state of a given
     * animation. Since some animations can be super long, there may arise a need to cancel
     * one at some time or another.
     */
    class Cancellation {
        private _isCancelled:boolean = false;
        private cancellationListeners:Array<() => void> = [];

        public cancel():void {
            this._isCancelled = true;
        }

        public registerCancellationListener(listener:() => void):void {
            this.cancellationListeners.push(listener);
        }

        public onCancel():void {
            this.cancellationListeners.forEach((listener:() => void):void => {
                listener();
            });
        }

        public get isCancelled():boolean {
            return this._isCancelled;
        }
    }

    class AnimationContext {
        private _cancellation:Cancellation;
        private _config:IConfiguration;
        private _from:Node;
        private _to:HTMLElement;
        private _callback:IProcessorCallback;
        private _extra:any;

        constructor(cancellation:Cancellation,
                    config:IConfiguration,
                    currentNode:Node,
                    currentRoot:HTMLElement,
                    callback:IProcessorCallback) {
            this._cancellation = cancellation;
            this._config = config;
            this._from = currentNode;
            this._to = currentRoot;
            this._callback = callback;
        }

        public clone():AnimationContext {
            return new AnimationContext(
                this._cancellation,
                this._config,
                this._from,
                this._to,
                this._callback);
        }

        public withFrom(root:Node):AnimationContext {
            const clone = this.clone();
            clone._from = root;
            return clone;
        }

        public withTo(node:HTMLElement) {
            const clone = this.clone();
            clone._to = node;
            return clone;
        }

        public withCallback(callback:IProcessorCallback):AnimationContext {
            const clone = this.clone();
            clone._callback = callback;
            return clone;
        }

        public withExtra(extra:any):AnimationContext {
            const clone = this.clone();
            clone._extra = extra;
            return clone;
        }

        get cancellation():Cancellation {
            return this._cancellation;
        }

        get config():IConfiguration {
            return this._config;
        }

        /**
         * This is the node which we are currently cloning and animating
         * into the destination. It is located somewhere within the template
         * element.
         * @returns {Node}
         */
        get from():Node {
            return this._from;
        }

        get fromAsElement():HTMLElement {
            return <HTMLElement> this._from;
        }

        get fromAsCharacterData():CharacterData {
            return <CharacterData> this._from;
        }

        /**
         * This is the element INTO which we are cloning and animating
         * an element.
         * @returns {HTMLElement}
         */
        get to():HTMLElement {
            return this._to;
        }

        get callback():IProcessorCallback {
            return this._callback;
        }

        get extra():any {
            return this._extra;
        }
    }

    let asynchronouslyProcessNodes = function (context:AnimationContext,
                                               processFn:(item:Node, callback:() => void) => void,
                                               callbackParam:Node = null):void {
        let index = 0;

        const processNextItem = function ():void {
            if (index < context.from.childNodes.length) {
                processFn(context.from.childNodes[index++], processNextItem);
            } else {
                context.callback(callbackParam);
            }
        };

        processNextItem();
    };

    let stripWhitespace = function (text:string):string {
        return text.replace(/\n/, "").replace(/\s\s+/g, " ");
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
    let wrapFunction = function<T> (original:T, wrapper:Function):T {
        return <T> <any> function ():void {
            const argsArray = Array.prototype.slice.call(arguments);
            argsArray.push(original);

            wrapper.apply(this, argsArray);
        };
    };

    /**
     * Wraps a processor that does animation with some extra logic which enables us to
     * pre- and post- process elements, style them, and give them extra attributes defined
     * by the configuration. Additionally, stops the animation if it is cancelled.
     * @param processFn
     */
    let makeProcessor = function (processFn:IProcessor):IProcessor {
        return function (context:AnimationContext):void {
            if (context.cancellation.isCancelled) {
                context.cancellation.onCancel();
                // not calling the callback effectively
                // stops the animation - this is deliberate.
                return;
            }

            let callBackProxy = context.callback;

            for (let i = 0; i < context.fromAsElement.attributes.length; i++) {
                if (!Array.isArray(context.config.types)) {
                    break;
                }

                for (let j = 0; j < context.config.types.length; j++) {
                    if (context.from.attributes[i].name === "data-type") {
                        if (context.from.attributes[i].value === context.config.types[j].name) {
                            for (let propName in context.config.types[j].properties) {
                                if (context.config.types[j].properties.hasOwnProperty(propName)) {
                                    context.fromAsElement.setAttribute(propName, context.config.types[j].properties[propName]);
                                }
                            }

                            context.fromAsElement.classList.add(context.config.types[j].styleClasses || "");
                            context.fromAsElement.setAttribute("style", context.fromAsElement.getAttribute("style") + ";" + context.config.types[j].style);
                        }
                    }
                }
            }

            if (Array.isArray(context.config.processing)) {
                for (let k = 0; k < context.config.processing.length; k++) {
                    if (context.fromAsElement.tagName.toLowerCase() === context.config.processing[k].tag.toLowerCase()) {
                        if (typeof context.config.processing[k].pre === "function") {
                            context.config.processing[k].pre(context.from);
                        }

                        if (typeof context.config.processing[k].post === "function") {
                            callBackProxy = wrapFunction<IProcessorCallback>(
                                callBackProxy,
                                function (element:HTMLElement, originalCallback:IProcessorCallback):void {
                                    context.config.processing[k].post(element);
                                    originalCallback(element);
                                });
                        }
                    }
                }
            }

            processFn(context.withCallback(callBackProxy));
        };
    };


    /**
     * Appends a clone of an HTML Element to another one, conditionally removing
     * all of its children.
     * @param config - Configuration for options.
     * @param root - The element to which the clone will be appended.
     * @param node - The element to clone and append.
     * @param desiredTag - The desired tag that the clone should be (ie. 'div', 'a', 'span', etc.)
     * @param justCopyIt - If true, copy the children too, if false do not copy the children.
     */
    const append = function (root:HTMLElement,
                             node:HTMLElement,
                             desiredTag:string = null,
                             justCopyIt:boolean = false):HTMLElement {
        let clone = <HTMLElement> node.cloneNode(true);

        if (!justCopyIt) {
            clone.innerHTML = "";
        }

        if (desiredTag !== null) {
            const clonedInnerHtml = clone.innerHTML;

            clone = document.createElement(desiredTag);
            clone.innerHTML = clonedInnerHtml;

            for (let i = 0; i < node.attributes.length; i++) {
                clone.setAttribute(node.attributes[i].name, node.attributes[i].value);
            }

            clone.className = node.className;
        }

        root.appendChild(clone);
        return clone;
    };

    const processWaitNode = function (context:AnimationContext):void {
        const duration = parseDuration(context.fromAsElement.innerText);

        setTimeout(
            function ():void {
                context.callback(null);
            },
            duration);
    };

    const scrollDown = function (config:IConfiguration):void {
        return;
        window.scroll(0, document.documentElement.offsetHeight);
    };

    const mapFirstCharToInterval = function (context:AnimationContext, text:string):number {
        const referenceTypeNode:HTMLElement = context.extra || context.from;

        const defaultCharInterval = "50ms";
        const defaultPeriodInterval = "500ms";
        const defaultCommaInterval = "300ms";
        const defaultEndInterval = "0ms";
        const defaultWordInterval = "0ms";

        const charInterval = parseDuration(referenceTypeNode.getAttribute("data-char-interval") || defaultCharInterval);
        const periodInterval = parseDuration(referenceTypeNode.getAttribute("data-period-interval") || defaultPeriodInterval);
        const commaInterval = parseDuration(referenceTypeNode.getAttribute("data-comma-interval") || defaultCommaInterval);
        const endInterval = parseDuration(referenceTypeNode.getAttribute("data-end-interval") || defaultEndInterval);
        const wordInterval = parseDuration(referenceTypeNode.getAttribute("data-word-interval") || defaultWordInterval);

        const char = text[0];

        if (text.length == 1) {
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

    const createCharacterElement = function (char:string):Node {
        const charElement = document.createElement("span");
        charElement.classList.add("character");
        charElement.innerText = char;

        return charElement;
    };

    /**
     * This is where the magic happens - here we type out text into an HTML Element.
     */
    const writeText = function (context:AnimationContext, text:string):void {
        if (text === "") {
            context.callback(null);
            return;
        }

        if (context.cancellation.isCancelled) {
            context.cancellation.onCancel();
            // again, not calling the callback effectively stops
            // the animation.
            return;
        }

        context.to.appendChild(createCharacterElement(text[0]));

        const interval = mapFirstCharToInterval(context, text);

        const finish = function ():void {
            writeText(context, text.slice(1));
            scrollDown(context.config);
        };

        if (interval === 0) {
            finish();
        } else {
            setTimeout(finish, interval);
        }
    };

    const processTypeNode = function (context:AnimationContext):void {
        switch (context.from.nodeType) {
            case NodeType.Element:
                const appendedRoot = append(context.to, context.fromAsElement);

                asynchronouslyProcessNodes<Node, Node>(
                    context,
                    function (node:Node, callback:IVoidCallback):void {
                        processTypeNode(context.withTo(appendedRoot).withFrom(node).withCallback(callback).withExtra(context.extra || context.from));
                    });
                break;
            case NodeType.Text:
                writeText(context, stripWhitespace(context.fromAsCharacterData.data));
                break;
            default:
                context.callback(null);
                break;
        }
    };

    const processors:{[key:string]:IProcessor} = {
        "type": makeProcessor(processTypeNode),
        "wait": makeProcessor(processWaitNode)
    };

    const processNode = function (context:AnimationContext):void {
        switch (context.from.nodeType) {
            case NodeType.Element:
                const tag = context.fromAsElement.tagName.toLowerCase();
                const matchingProcessor = processors[tag] || processDefaultNode;
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

    const runAnimation = function (context:AnimationContext):void {
        asynchronouslyProcessNodes<Node, Node>(
            context,
            function (node:Node, callback:IVoidCallback):void {
                processNode(
                    context
                        .withFrom(node.cloneNode(true))
                        .withCallback(callback));
            },
            context.to);
    };

    const processDefaultNode = makeProcessor(function (context:AnimationContext):void {
        const noAnimateContents = context.fromAsElement.getAttribute("data-ignore-tply") === "true";
        const clone = append(context.to, context.fromAsElement, null, noAnimateContents);
        clone.classList.add("fadein");

        if (noAnimateContents) {
            context.callback(clone);
        } else {
            runAnimation(context.withTo(clone));
        }
    });

    (<any> window).tply = (<any> window).tply || {
            animate: function (from:HTMLElement,
                               to:HTMLElement,
                               conf:IConfiguration = {},
                               callback:() => void = () => null):Cancellation {
                const cancellation = new Cancellation();
                runAnimation(new AnimationContext(cancellation, conf, from, to, callback));
                return cancellation;
            }
        };
})();
