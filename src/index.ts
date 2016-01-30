(function () {
    let parseDuration = require("parse-duration");

    interface Configuration {
        types?: [{
            name: string,
            properties?: any,
            styleClasses?: string,
            style?: string
        }],
        processing?: [{
            tag: string,
            pre: (element:HTMLElement) => void,
            post: (element:HTMLElement) => void
        }]
    }

    interface ProcessorCallback {
        (element:HTMLElement | void): void;
    }

    interface Processor {
        (config:Configuration,
         node:HTMLElement | Node,
         root:HTMLElement,
         callback:ProcessorCallback,
         ...params:any[]): void
    }

    interface IVoidCallback {
        ():void;
    }

    interface ISimpleArray<T> {
        length: number;
        [index: number]: T;
    }

    let executeCallbackChain = function<T, U>(items:ISimpleArray<T>, processFn:(item:T, callback:() => void) => void, callback:(U) => void, defaultCallbackParam:U) {
        let index = 0;

        let process = function () {
            if (index < items.length) {
                processFn(items[index++], process);
            } else {
                callback(defaultCallbackParam);
            }
        };

        process();
    };

    var makeProcessor = function (processFn:Processor):Processor {
        return function (config:Configuration,
                         node:HTMLElement,
                         root:HTMLElement,
                         callback:ProcessorCallback) {
            var callBackProxy = callback;

            for (let i = 0; i < node.attributes.length; i++) {
                if (typeof !Array.isArray(config.types)) {
                    break;
                }

                for (var j = 0; j < config.types.length; j++) {
                    if (node.attributes[i].name === "data-type") {
                        if (node.attributes[i].value === config.types[j].name) {
                            for (var propName in config.types[j].properties) {
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

                for (var k = 0; k < config.processing.length; k++) {
                    var proc = config.processing[k];

                    if (node.tagName.toLowerCase() === proc.tag.toLowerCase()) {
                        if (typeof proc.pre === "function") {
                            proc.pre(node);
                        }

                        if (typeof proc.post === "function") {
                            callBackProxy = function (element:HTMLElement) {
                                proc.post(element);
                                callback(element);
                            };
                        }
                    }
                }
            }

            processFn(config, node, root, callBackProxy);
        };
    };


    let append = function (config:Configuration, root:HTMLElement, node:HTMLElement, desiredTag:string = null, justCopyIt:boolean = false):HTMLElement {
        var clone = <HTMLElement>node.cloneNode(true);

        if (!justCopyIt) {
            clone.innerHTML = "";
        }

        if (desiredTag !== null) {
            var clonedInnerHtml = clone.innerHTML;

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

    const NodeType = {
        element: 1,
        attribute: 2,
        text: 3,
        comment: 8
    };

    let processWaitNode = function (config:Configuration, node:HTMLElement, root:HTMLElement, callback:ProcessorCallback):void {
        let duration = parseDuration(node.innerText);

        setTimeout(function () {
            callback(null);
        }, duration);
    };

    let scrollDown = function (config:Configuration):void {
        return;
        window.scroll(0, document.documentElement.offsetHeight);
    };

    let mapCharToInteval = function (config:Configuration, node:HTMLElement, char:string, isEnd:boolean):number {
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

    let createCharacterElement = function(char:string): Node {
        let charElement = document.createElement("span");
        charElement.classList.add("character");
        charElement.innerText = char;

        return charElement;
    };

    let writeText = function (config:Configuration, text:string, typeNode:HTMLElement, element:HTMLElement, callback:ProcessorCallback):void {
        if (text === "") {
            callback(null);
            return;
        }

        element.appendChild(createCharacterElement(text[0]));

        let interval = mapCharToInteval(config, typeNode, text[0], text.length === 1);

        let finish = function() {
            writeText(config, text.slice(1), typeNode, element, callback);
            scrollDown(config);
        };

        if (interval === 0) {
            finish();
        } else {
            setTimeout(finish, interval);
        }
    };

    let processTypeNode = function (config:Configuration, node:Node, root:HTMLElement, callback:ProcessorCallback, topLevelTypeNode:HTMLElement) {
        topLevelTypeNode = topLevelTypeNode || <HTMLElement> node;
        let contents = node.childNodes;

        if (contents.length >= 1) {
            var index = 0;
            let appendedRoot = append(config, root, <HTMLElement>node);

            let processNextContent = function () {
                if (index < contents.length) {
                    processTypeNode(config, contents[index++], appendedRoot, processNextContent, topLevelTypeNode);
                } else {
                    callback(null);
                }
            };

            processNextContent();
        } else {
            if (node.nodeType === NodeType.text) {
                let textNode = <CharacterData>node;

                writeText(config, textNode.data.replace(/\n/, '').replace(/\s\s+/g, ' '), topLevelTypeNode, root, callback);
            } else {
                callback(null);
            }
        }
    };

    let processDefaultNode = makeProcessor(function (config:Configuration, node:HTMLElement, root:HTMLElement, callback:ProcessorCallback):void {
        let noAnimateContents = node.getAttribute("data-ignore-tply") === "true";

        let clone = append(config, root, node, null, noAnimateContents);
        clone.classList.add("fadein");

        if (noAnimateContents) {
            callback(clone);
        } else {
            runAnimation(config, node, node.childNodes, clone, callback);
        }
    });

    let processors = {
        "type": makeProcessor(processTypeNode),
        "wait": makeProcessor(processWaitNode)
    };

    let processNode = function (config:Configuration, node:Node, root:HTMLElement, callback:ProcessorCallback) {
        if (node.nodeType === NodeType.element) {
            let tag = (<HTMLElement>node).tagName.toLowerCase();

            let matchingProcessor = processors[tag] || processDefaultNode;

            matchingProcessor(config, node, root, callback);
        } else if (node.nodeType === NodeType.text) {
            root.appendChild(document.createTextNode((<CharacterData> node).data));
            scrollDown(config);
            callback(null);
        } else {
            scrollDown(config);
            callback(null);
        }
    };

    let runAnimation = function (config:Configuration, parent:HTMLElement, nodes:NodeList, root:HTMLElement, callback:ProcessorCallback) {
        executeCallbackChain<Node, Node>(
            nodes,
            function (node:Node, callback:IVoidCallback) {
                processNode(config, node.cloneNode(true), root, callback);
            },
            callback,
            root
        );
    };

    (<any> window).tply = (<any> window).tply || {
            animate: function (from, to, conf, callback = () => null) {
                runAnimation(conf || {}, from, from.childNodes, to, callback);
            }
        };
})();