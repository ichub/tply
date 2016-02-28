(function ():void {
    const parseDuration:IParseDuration = require("parse-duration");

    enum NodeType {
        Element = 1,
        Attribute = 2,
        Text = 3,
        Comment = 8
    }

    interface IProcessingConfigurationItem {
        tag?: string;
        id?: string;
        cssClass?: string;
        pre: (element:HTMLElement) => void;
        post: (element:HTMLElement) => void;
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
        processing?:IProcessingConfigurationItem[];
        shouldScrollDown?:boolean;
        insertedClass?:string;
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
        private _rootContext:AnimationContext;
        private _status:Status;
        private _config:IConfiguration;
        private _rootFrom:Node;
        private _from:Node;
        private _rootTo:HTMLElement;
        private _to:HTMLElement;
        private _callback:IElementProcessorCallback;
        private _extra:any;
        private _insertedChars:Array<HTMLElement> = [];
        private _cursor:HTMLElement;

        constructor(status:Status,
                    config:IConfiguration,
                    rootFrom:Node,
                    from:Node,
                    rootTo:HTMLElement,
                    to:HTMLElement,
                    callback:IElementProcessorCallback,
                    insertedChars = [],
                    extra:any = null,
                    cursor:HTMLElement = null,
                    rootContext:AnimationContext = null) {
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

        public clone():AnimationContext {
            return new AnimationContext(
                this._status,
                this._config,
                this._rootFrom,
                this._from,
                this._rootTo,
                this._to,
                this._callback,
                this._insertedChars,
                this._extra,
                this._cursor,
            this._rootContext);
        }

        public withRootContext(context:AnimationContext):AnimationContext {
            const clone = this.clone();
            clone._rootContext = context;
            context._rootContext = context;
            return clone;
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

        public get insertedChars():Array<HTMLElement> {
            return this._insertedChars;
        }

        public get cursor():HTMLElement {
            return this._rootContext._cursor;
        }

        set cursor(value:HTMLElement) {
            this._rootContext._cursor = value;
        }
    }

    const innerText = function (element:HTMLElement):string {
        return element.innerText || element.textContent;
    };

    const setInnerText = function (element:HTMLElement, text:string):void {
        if (typeof element.innerText !== "undefined") {
            element.innerText = text;
        } else {
            element.textContent = text;
        }
    };

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

    let isDefined = function (object:any) {
        return typeof object !== "undefined";
    };

    let ignoreCaseEquals = function (left:string, right:string):boolean {
        return left.toLowerCase() === right.toLowerCase();
    };

    let matchElement = function (element:HTMLElement, processingItem:IProcessingConfigurationItem) {
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

                            if (typeof context.config.types[j].styleClasses !== "undefined") {
                                context.fromAsElement.classList.add(context.config.types[j].styleClasses);
                            }

                            context.fromAsElement.setAttribute(
                                "style",
                                context.fromAsElement.getAttribute("style") + ";" + context.config.types[j].style);
                        }
                    }
                }
            }

            if (Array.isArray(context.config.processing)) {
                for (let k = 0; k < context.config.processing.length; k++) {
                    if (matchElement(context.fromAsElement, context.config.processing[k])) {
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

        let dataCharInterval = null;
        let dataPeriodInterval = null;
        let dataCommaInterval = null;
        let dataEndInterval = null;
        let dataWordInterval = null;

        if (typeof referenceTypeNode.getAttribute === "function") {
            dataCharInterval = referenceTypeNode.getAttribute("data-char-interval");
            dataPeriodInterval = referenceTypeNode.getAttribute("data-period-interval");
            dataCommaInterval = referenceTypeNode.getAttribute("data-comma-interval");
            dataEndInterval = referenceTypeNode.getAttribute("data-end-interval");
            dataWordInterval = referenceTypeNode.getAttribute("data-word-interval");
        }

        const charInterval = parseDuration(dataCharInterval || defaultCharInterval);
        const periodInterval = parseDuration(dataPeriodInterval || defaultPeriodInterval);
        const commaInterval = parseDuration(dataCommaInterval || defaultCommaInterval);
        const endInterval = parseDuration(dataEndInterval || defaultEndInterval);
        const wordInterval = parseDuration(dataWordInterval || defaultWordInterval);

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
        setInnerText(charElement, char);

        return charElement;
    };

    /**
     * This is where the magic happens - here we type out text into an HTML Element.
     */
    const writeText = function (context:AnimationContext, text:string):void {
        if (text === "" || text === " ") {
            context.callback(null);
            return;
        }

        if (context.status.isCancelled) {
            context.status.onCancel();
            return;
        }

        const charElement = createCharacterElement(text[0]);
        const interval = mapFirstCharToInterval(context, text);

        const continueWriting = function ():void {
            writeText(context, text.slice(1));
            scrollDown(context.config);
        };

        context.to.appendChild(charElement);
        context.insertedChars.push(<HTMLElement> charElement);

        if (interval === 0) {
            continueWriting();
        } else {
            setTimeout(continueWriting, interval);
        }
    };

    const getCursor = function (context:AnimationContext):HTMLElement {
        const cursor = document.createElement("div");

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

    const createTypeDestination = function ():HTMLElement {
        const destination = document.createElement("span");
        return destination;
    };

    const processTypeNode = function (context:AnimationContext):void {
        switch (context.from.nodeType) {
            case NodeType.Element:
                makeProcessor(function (context) {
                    let appendedRoot = append(context.to, context.fromAsElement);
                    context.callback(appendedRoot);
                })(context.withCallback(function (appendedRoot:HTMLElement) {
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
                }));
                break;
            case NodeType.Text:
                const cursor = getCursor(context);
                const destination = createTypeDestination();
                context.to.appendChild(destination);
                context.to.appendChild(cursor);
                writeText(
                    context
                        .withTo(destination),
                    stripWhitespace(context.fromAsCharacterData.data));
                break;
            default:
                context.callback(null);
                break;
        }
    };

    const processWaitNode = function (context:AnimationContext):void {
        const duration = parseDuration(innerText(context.fromAsElement));

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

    const processDeleteNode = function (context:AnimationContext) {
        let count = 0;
        const charDeleteCount = parseInt(context.fromAsElement.getAttribute("data-chars"), 10);
        const ignoreWhitespace = context.fromAsElement.getAttribute("data-ignore-whitespace") || "false";

        let deleteChar = function () {
            if (count == charDeleteCount) {
                context.callback(null);
                return;
            }

            let index = context.insertedChars.length - 1;
            let currentChar = context.insertedChars[index];

            currentChar.parentElement.removeChild(currentChar);
            context.insertedChars.pop();

            if (!/\s+/.test(innerText(currentChar))) {
                count++;
            }

            setTimeout(deleteChar, 100);
        };

        deleteChar();
    };

    const processDeleteWordsNode = function (context:AnimationContext) {
        let count = 0;
        const wordDeleteCount = parseInt(context.fromAsElement.getAttribute("data-words"), 10);

        let deleteChar = function () {
            if (count == wordDeleteCount) {
                context.callback(null);
                return;
            }

            let index = context.insertedChars.length - 1;
            let currentChar = context.insertedChars[index];

            currentChar.parentElement.removeChild(currentChar);
            context.insertedChars.pop();

            if (/\s+/.test(innerText(currentChar))) {
                count++;
            }

            setTimeout(deleteChar, 100);
        };

        deleteChar();
    };

    const processors:{[key:string]:IElementProcessor} = {
        "type": makeProcessor(processTypeNode),
        "wait": makeProcessor(processWaitNode),
        "clearparent": makeProcessor(processClearParentNode),
        "clearall": makeProcessor(processClearAllNode),
        "repeat": makeProcessor(processRepeatNode),
        "delete": makeProcessor(processDeleteNode),
        "deletewords": makeProcessor(processDeleteWordsNode)
    };


    const processDefaultNode = makeProcessor(function (context:AnimationContext):void {
        const noAnimateContents = context.fromAsElement.getAttribute("data-ignore-tply") === "true";
        const clone = append(context.to, context.fromAsElement, null, noAnimateContents);
        clone.classList.add(context.config.insertedClass || "fadein");

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
                let context = new AnimationContext(
                    cancellation,
                    conf,
                    from,
                    from,
                    to,
                    to,
                    function () {
                        cancellation.onFinish();
                        callback();
                    });

                context = context.withRootContext(context);

                runAnimation(context);
                return cancellation;
            }
        };
})();
