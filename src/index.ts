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
        shouldScrollDown?:boolean;
    }

    interface IElementProcessorCallback extends Function {
        (element:Node | void): void;
    }

    interface IElementProcessor {
        (context:AnimationContext): void;
    }

    interface IVoidCallback {
        ():void;
    }

    /**
     * This class is in charge of keeping track of the cancellation state of a given
     * animation. Since some animations can be super long, there may arise a need to cancel
     * one at some time or another.
     */
    class Status {
        private _isCancelled:boolean = false;
        private _isFinished:boolean = false;

        private cancellationListeners:Array<() => void> = [];
        private finishedListeners:Array<() => void> = [];

        public cancel(callback?:IVoidCallback):void {
            if (typeof callback !== "undefined") {
                this.registerCancellationListener(callback);
            }

            this._isCancelled = true;
        }

        public registerCancellationListener(listener:() => void):void {
            this.cancellationListeners.push(listener);
        }

        public registerFinishedListener(listener:() => void):void {
            this.finishedListeners.push(listener);
        }

        public onCancel():void {
            this.cancellationListeners.forEach((listener:() => void):void => {
                listener();
            });
        }

        public onFinish():void {
            this._isFinished = true;

            this.finishedListeners.forEach((listener:() => void):void => {
                listener();
            });
        }

        public get isCancelled():boolean {
            return this._isCancelled;
        }

        public get isFinished():boolean {
            return this._isFinished;
        }
    }

    class AnimationContext {
        private _status:Status;
        private _config:IConfiguration;
        private _rootFrom:Node;
        private _from:Node;
        private _rootTo:HTMLElement;
        private _to:HTMLElement;
        private _callback:IElementProcessorCallback;
        private _extra:any;

        constructor(status:Status,
                    config:IConfiguration,
                    rootFrom:Node,
                    from:Node,
                    rootTo:HTMLElement,
                    to:HTMLElement,
                    callback:IElementProcessorCallback) {
            this._status = status;
            this._config = config;
            this._rootFrom = rootFrom;
            this._from = from;
            this._rootTo = rootTo;
            this._to = to;
            this._callback = callback;
        }

        public clone():AnimationContext {
            return new AnimationContext(
                this._status,
                this._config,
                this._rootFrom,
                this._from,
                this._rootTo,
                this._to,
                this._callback);
        }

        public withFrom(root:Node):AnimationContext {
            const clone = this.clone();
            clone._from = root;
            return clone;
        }

        public withTo(node:HTMLElement):AnimationContext {
            const clone = this.clone();
            clone._to = node;
            return clone;
        }

        public withCallback(callback:IElementProcessorCallback):AnimationContext {
            const clone = this.clone();
            clone._callback = callback;
            return clone;
        }

        public withExtra(extra:any):AnimationContext {
            const clone = this.clone();
            clone._extra = extra;
            return clone;
        }

        get status():Status {
            return this._status;
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

        get callback():IElementProcessorCallback {
            return this._callback;
        }

        get extra():any {
            return this._extra;
        }

        get rootFrom():Node {
            return this._rootFrom;
        }

        get rootTo():HTMLElement {
            return this._rootTo;
        }
    }

    const asynchronouslyProcessNodes = function (context:AnimationContext,
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

    const stripWhitespace = function (text:string):string {
        return text.replace(/\n/, "").replace(/\s\s+/g, " ");
    };

    const removeChildren = function (element:HTMLElement):void {
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
    let makeProcessor = function (processFn:IElementProcessor):IElementProcessor {
        return function (context:AnimationContext):void {
            if (context.status.isCancelled) {
                context.status.onCancel();
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
                            context.fromAsElement.setAttribute(
                                "style",
                                context.fromAsElement.getAttribute("style") + ";" + context.config.types[j].style);
                        }
                    }
                }
            }

            if (Array.isArray(context.config.processing)) {
                for (let k = 0; k < context.config.processing.length; k++) {
                    if (context.fromAsElement.tagName.toLowerCase() === context.config.processing[k].tag.toLowerCase()) {
                        if (typeof context.config.processing[k].pre === "function") {
                            context.config.processing[k].pre(context.fromAsElement);
                        }

                        if (typeof context.config.processing[k].post === "function") {
                            callBackProxy = wrapFunction<IElementProcessorCallback>(
                                callBackProxy,
                                function (element:HTMLElement, originalCallback:IElementProcessorCallback):void {
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
     * @param root - The element to which the clone will be appended.
     * @param node - The element to clone and append.
     * @param desiredTag - The desired tag that the clone should be (ie. 'div', 'a', 'span', etc.)
     * @param deepCopy - If true, copy the children too, if false do not copy the children.
     */
    const append = function (root:HTMLElement,
                             node:HTMLElement,
                             desiredTag:string = null,
                             deepCopy:boolean = false):HTMLElement {
        let clone = <HTMLElement> node.cloneNode(true);

        if (!deepCopy) {
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

    const scrollDown = function (config:IConfiguration):void {
        if (config.shouldScrollDown) {
            window.scroll(0, document.documentElement.offsetHeight);
        }
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

        if (context.status.isCancelled) {
            context.status.onCancel();
            return;
        }

        context.to.appendChild(createCharacterElement(text[0]));

        const interval = mapFirstCharToInterval(context, text);

        const continueWriting = function ():void {
            writeText(context, text.slice(1));
            scrollDown(context.config);
        };

        if (interval === 0) {
            continueWriting();
        } else {
            setTimeout(continueWriting, interval);
        }
    };

    const processTypeNode = function (context:AnimationContext):void {
        switch (context.from.nodeType) {
            case NodeType.Element:
                const appendedRoot = append(context.to, context.fromAsElement);
                asynchronouslyProcessNodes(
                    context,
                    function (node:Node, callback:IVoidCallback):void {
                        processTypeNode(
                            context
                                .withTo(appendedRoot)
                                .withFrom(node)
                                .withCallback(callback)
                                .withExtra(context.extra || context.from));
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

    const processWaitNode = function (context:AnimationContext):void {
        const duration = parseDuration(context.fromAsElement.innerText);

        setTimeout(
            function ():void {
                context.callback(null);
            },
            duration);
    };

    const processClearParentNode = function (context:AnimationContext):void {
        removeChildren(context.to);
        context.callback(null);
    };

    const processClearAllNode = function (context:AnimationContext):void {
        removeChildren(context.rootTo);
        context.callback(null);
    };

    const processRepeatNode = function (context:AnimationContext):void {
        const repeatAttr = context.fromAsElement.getAttribute("data-repeat");
        let repeats = 1;

        if (repeatAttr === "infinite") {
            repeats = -1;
        } else if (typeof repeatAttr !== "undefined") {
            repeats = parseInt(repeatAttr, 10);
        }

        let index = 0;

        const clone = append(context.to, context.fromAsElement);

        const processAgain = function ():void {
            if (index++ < repeats || repeats === -1) {
                asynchronouslyProcessNodes(
                    context.withCallback(processAgain),
                    function (node:Node, callback:IVoidCallback):void {
                        processNode(context.withFrom(node).withCallback(callback).withTo(clone));
                    });
            } else {
                context.callback(null);
            }
        };

        processAgain();
    };

    const processors:{[key:string]:IElementProcessor} = {
        "type": makeProcessor(processTypeNode),
        "wait": makeProcessor(processWaitNode),
        "clear_parent": makeProcessor(processClearParentNode),
        "clear_all": makeProcessor(processClearAllNode),
        "repeat": makeProcessor(processRepeatNode)
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
        asynchronouslyProcessNodes(
            context,
            function (node:Node, callback:IVoidCallback):void {
                processNode(
                    context
                        .withFrom(node.cloneNode(true))
                        .withCallback(callback));
            },
            context.to);
    };

    (<any> window).tply = (<any> window).tply || {
            animate: function (from:HTMLElement,
                               to:HTMLElement,
                               conf:IConfiguration = {},
                               callback:() => void = () => null):Status {
                const cancellation = new Status();
                runAnimation(new AnimationContext(
                    cancellation,
                    conf,
                    from,
                    from,
                    to,
                    to,
                    function () {
                        cancellation.onFinish();
                        callback();
                    }));
                return cancellation;
            }
        };
})();
