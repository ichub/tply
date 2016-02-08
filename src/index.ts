(function ():void {
    let parseDuration:IParseDuration = require("parse-duration");

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
        (context:AnimationContext,
         cancellation:Cancellation,
         config:IConfiguration,
         node:HTMLElement | Node,
         root:HTMLElement,
         callback:IProcessorCallback,
         ...params:any[]): void;
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

        get from():Node {
            return this._from;
        }

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

    /**
     * Since the DOM is a tree, and to process a node we need to process its children too. Since
     * processing each node could take an arbitrary amount of time (ie. it is asynchronous,
     * we need to be able to chain together the processing of nodes. This method processes each
     * element in a given array with a given function, handing off execution to process the next
     * element after the completion of processing of the previous one. At the end, after the final
     * element is processed, this function calls the `callback` method with the `defaultCallbackParam`
     * as the value.
     * @param items - An array-like object of items to process.
     * @param processFn - A function that processes an item, and calls a callback after finishing.
     * @param callback - Function to call after all elements have been processed.
     * @param defaultCallbackParam - The default value to pass the `callback` function.
     */
    let executeCallbackChain = function<T, U>(items:ISimpleArray<T>,
                                              processFn:(item:T, callback:() => void) => void,
                                              callback:(param:U) => void,
                                              defaultCallbackParam:U):void {
        let index = 0;

        let process = function ():void {
            if (index < items.length) {
                processFn(items[index++], process);
            } else {
                callback(defaultCallbackParam);
            }
        };

        process();
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
    let makeProxy = function<T> (original:T, wrapper:Function):T {
        return <T> <any> function ():void {
            let argsArray = Array.prototype.slice.call(arguments);
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
        return function (context:AnimationContext,
                         cancellation:Cancellation,
                         config:IConfiguration,
                         node:HTMLElement,
                         root:HTMLElement,
                         callback:IProcessorCallback):void {

            if (context.from != node || context.to != root) {
                debugger;
            }

            if (cancellation.isCancelled) {
                cancellation.onCancel();
                // not calling the callback effectively
                // stops the animation - this is deliberate.
                return;
            }

            let callBackProxy = callback;

            for (let i = 0; i < node.attributes.length; i++) {
                if (!Array.isArray(config.types)) {
                    break;
                }

                for (let j = 0; j < config.types.length; j++) {
                    if (node.attributes[i].name === "data-type") {
                        if (node.attributes[i].value === config.types[j].name) {
                            for (let propName in config.types[j].properties) {
                                if (config.types[j].properties.hasOwnProperty(propName)) {
                                    node.setAttribute(propName, config.types[j].properties[propName]);
                                }
                            }

                            node.classList.add(config.types[j].styleClasses || "");
                            node.setAttribute("style", node.getAttribute("style") + ";" + config.types[j].style);
                        }
                    }
                }
            }

            if (Array.isArray(config.processing)) {
                for (let k = 0; k < config.processing.length; k++) {
                    if (node.tagName.toLowerCase() === config.processing[k].tag.toLowerCase()) {
                        if (typeof config.processing[k].pre === "function") {
                            config.processing[k].pre(node);
                        }

                        if (typeof config.processing[k].post === "function") {
                            callBackProxy = makeProxy<IProcessorCallback>(
                                callBackProxy,
                                function (element:HTMLElement, originalCallback:IProcessorCallback):void {
                                    config.processing[k].post(element);
                                    originalCallback(element);
                                });
                        }
                    }
                }
            }

            processFn(context.withCallback(callBackProxy), cancellation, config, node, root, callBackProxy);
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
    let append = function (config:IConfiguration,
                           root:HTMLElement,
                           node:HTMLElement,
                           desiredTag:string = null,
                           justCopyIt:boolean = false):HTMLElement {
        let clone = <HTMLElement>node.cloneNode(true);

        if (!justCopyIt) {
            clone.innerHTML = "";
        }

        if (desiredTag !== null) {
            let clonedInnerHtml = clone.innerHTML;

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

    let processWaitNode = function (context:AnimationContext,
                                    cancellation:Cancellation,
                                    config:IConfiguration,
                                    node:HTMLElement,
                                    root:HTMLElement,
                                    callback:IProcessorCallback):void {
        let duration = parseDuration(node.innerText);

        setTimeout(
            function ():void {
                callback(null);
            },
            duration);
    };

    let scrollDown = function (config:IConfiguration):void {
        return;
        window.scroll(0, document.documentElement.offsetHeight);
    };

    let mapCharToInterval = function (config:IConfiguration, node:HTMLElement, char:string, isEnd:boolean):number {
        let defaultCharInterval = "50ms";
        let defaultPeriodInterval = "500ms";
        let defaultCommaInterval = "300ms";
        let defaultEndInterval = "0ms";
        let defaultWordInterval = "0ms";

        let charInterval = parseDuration(node.getAttribute("data-char-interval") || defaultCharInterval);
        let periodInterval = parseDuration(node.getAttribute("data-period-interval") || defaultPeriodInterval);
        let commaInterval = parseDuration(node.getAttribute("data-comma-interval") || defaultCommaInterval);
        let endInterval = parseDuration(node.getAttribute("data-end-interval") || defaultEndInterval);
        let wordInterval = parseDuration(node.getAttribute("data-word-interval") || defaultWordInterval);

        if (node.getAttribute("data-robot")) {
            charInterval = 0;
            periodInterval = 0;
            commaInterval = 0;
            endInterval = 2000;
            wordInterval = 100;
        }

        if (isEnd) {
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

    let createCharacterElement = function (char:string):Node {
        let charElement = document.createElement("span");
        charElement.classList.add("character");
        charElement.innerText = char;

        return charElement;
    };

    /**
     * This is where the magic happens - here we type out text into an HTML Element.
     */
    let writeText = function (cancellation:Cancellation,
                              config:IConfiguration,
                              text:string,
                              typeNode:HTMLElement,
                              element:HTMLElement,
                              callback:IProcessorCallback):void {
        if (text === "") {
            callback(null);
            return;
        }

        if (cancellation.isCancelled) {
            cancellation.onCancel();
            // again, not calling the callback effectively stops
            // the animation.
            return;
        }

        element.appendChild(createCharacterElement(text[0]));

        let interval = mapCharToInterval(config, typeNode, text[0], text.length === 1);

        let finish = function ():void {
            writeText(cancellation, config, text.slice(1), typeNode, element, callback);
            scrollDown(config);
        };

        if (interval === 0) {
            finish();
        } else {
            setTimeout(finish, interval);
        }
    };

    let processTypeNode = function (context:AnimationContext,
                                    cancellation:Cancellation,
                                    config:IConfiguration,
                                    node:Node,
                                    root:HTMLElement,
                                    callback:IProcessorCallback,
                                    topLevelTypeNode:HTMLElement):void {
        topLevelTypeNode = topLevelTypeNode || <HTMLElement> node;

        if (node.childNodes.length >= 1) {
            let appendedRoot = append(config, root, <HTMLElement> node);

            executeCallbackChain<Node, Node>(
                node.childNodes,
                function (node:Node, callback:IVoidCallback):void {
                    processTypeNode(context.withTo(appendedRoot).withCallback(callback).withExtra(topLevelTypeNode), cancellation, config, node, appendedRoot, callback, topLevelTypeNode);
                },
                callback,
                null
            );
        } else {
            if (node.nodeType === NodeType.Text) {
                writeText(
                    cancellation,
                    config,
                    stripWhitespace((<CharacterData> node).data),
                    topLevelTypeNode,
                    root,
                    callback);
            } else {
                callback(null);
            }
        }
    };

    let processors:{[key:string]:IProcessor} = {
        "type": makeProcessor(processTypeNode),
        "wait": makeProcessor(processWaitNode)
    };

    let processNode = function (context:AnimationContext,
                                cancellation:Cancellation,
                                config:IConfiguration,
                                node:Node,
                                root:HTMLElement,
                                callback:IProcessorCallback):void {
        if (node.nodeType === NodeType.Element) {
            let tag = (<HTMLElement>node).tagName.toLowerCase();
            let matchingProcessor = processors[tag] || processDefaultNode;
            matchingProcessor(context, cancellation, config, node, root, callback);
        } else if (node.nodeType === NodeType.Text) {
            root.appendChild(document.createTextNode((<CharacterData> node).data));
            scrollDown(config);
            callback(null);
        } else {
            scrollDown(config);
            callback(null);
        }
    };

    let runAnimation = function (context:AnimationContext,
                                 cancellation:Cancellation,
                                 config:IConfiguration,
                                 parent:HTMLElement,
                                 nodes:NodeList,
                                 root:HTMLElement,
                                 callback:IProcessorCallback):void {
        executeCallbackChain<Node, Node>(
            nodes,
            function (node:Node, callback:IVoidCallback):void {
                const clone = node.cloneNode(true);

                processNode(context.withFrom(<HTMLElement> clone).withCallback(callback), cancellation, config, clone, root, callback);
            },
            callback,
            root
        );
    };

    let processDefaultNode = makeProcessor(function (context:AnimationContext,
                                                     cancellation:Cancellation,
                                                     config:IConfiguration,
                                                     node:HTMLElement,
                                                     root:HTMLElement,
                                                     callback:IProcessorCallback):void {
        let noAnimateContents = node.getAttribute("data-ignore-tply") === "true";
        let clone = append(config, root, node, null, noAnimateContents);
        clone.classList.add("fadein");

        if (noAnimateContents) {
            callback(clone);
        } else {
            runAnimation(context.withTo(clone), cancellation, config, node, node.childNodes, clone, callback);
        }
    });

    (<any> window).tply = (<any> window).tply || {
            animate: function (from:HTMLElement,
                               to:HTMLElement,
                               conf:IConfiguration = {},
                               callback:() => void = () => null):Cancellation {
                let cancellation = new Cancellation();
                let context = new AnimationContext(cancellation, conf, from, to, callback);

                runAnimation(context, cancellation, conf, from, from.childNodes, to, callback);

                return cancellation;
            }
        };
})();
