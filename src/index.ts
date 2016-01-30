(function () {
    let parseDuration = require("parse-duration");

    interface Configuration {
        types?: [ {
            name: string,
            properties?: any,
            styleClasses?: string,
            style?: string
        }],
        processing?: [ {
            tag: string,
            pre: (element:HTMLElement) => void,
            post: (element:HTMLElement) => void
        }]
    }

    interface ProcessorCallback {
        (element:HTMLElement): void;
    }

    interface Processor {
        (config:Configuration, node:HTMLElement, root:HTMLElement, callback:ProcessorCallback): void
    }

    var makeProcessor = function (processFn) {
        return function (config, node, root, callback) {
            var callBackProxy = callback;

            for (var i = 0; i < node.attributes.length; i++) {
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
                    let proc = config.processing[k];

                    if (node.tagName.toLowerCase() === proc.tag.toLowerCase()) {
                        if (typeof proc.pre === "function") {
                            proc.pre(node);
                        }

                        if (typeof proc.post === "function") {
                            callBackProxy = function (element) {
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

    let append = function (config, root, node, desiredTag, justCopyIt) {
        justCopyIt = justCopyIt || false;

        var clone = node.cloneNode(true);
        if (!justCopyIt) {
            clone.innerHTML = "";
        }

        if (typeof desiredTag !== 'undefined' && desiredTag !== null) {
            var clonedInnerHtml = clone.innerHTML;
            clone = document.createElement(desiredTag);
            clone.innerHTML = clonedInnerHtml;


            node.attributes.forEach(function (attr) {
                clone.setAttribute(attr.name, attr.value);
            });

            clone.className = node.className;
        }

        root.appendChild(clone);
        return clone;
    };

    let NodeType = {
        element: 1,
        attribute: 2,
        text: 3,
        comment: 8
    };

    let processWaitNode = function (config, node, root, callback) {
        let duration = parseDuration(node.innerText);

        setTimeout(function () {
            callback(null);
        }, duration);
    };

    let scrollDown = function (config) {
        return;
        window.scroll(0, document.documentElement.offsetHeight);
    };

    let mapCharToInteval = function (config, node, char, isEnd) {
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

    let writeText = function (config, text, typeNode, element, callback) {
        if (text === "") {
            if (typeof callback === "undefined") {
                return;
            }
            callback(null);
            return;
        }

        let char = text[0];

        let character = document.createElement("span");
        character.classList.add("character");
        character.innerText = char;
        element.appendChild(character);

        let interval = mapCharToInteval(config, typeNode, char, text.length === 1);

        if (interval === 0) {
            writeText(config, text.slice(1), typeNode, element, callback);
            scrollDown(config);
        } else {
            setTimeout(function () {
                writeText(config, text.slice(1), typeNode, element, callback);
                scrollDown();
            }, interval);
        }
    };

    let processTypeNode = function (config, node, root, callback, topLevelTypeNode) {
        topLevelTypeNode = topLevelTypeNode || node;
        let contents = node.childNodes;

        if (contents.length >= 1) {
            var index = 0;
            let appendedRoot = append(config, root, node);

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
                writeText(config, (node.innerText || node.data).replace(/\n/, '').replace(/\s\s+/g, ' '), topLevelTypeNode, root, callback);
            } else {
                callback(null);
            }
        }
    };

    let processDefaultNode = makeProcessor(function (config, node, root, callback) {
        var clone;

        if (node.getAttribute("data-ignore-tply") === "true") {
            clone = append(config, root, node, null, true);
            clone.classList.add("fadein");
            callback(clone);
        } else {
            clone = append(config, root, node);
            clone.classList.add("fadein");
            runAnimation(config, node, node.childNodes, clone, callback);
        }
    });

    let processors = {
        "type": makeProcessor(processTypeNode),
        "wait": makeProcessor(processWaitNode)
    };

    let processNode = function (config, node, root, callback) {
        if (node.nodeType === NodeType.element) {
            let tag = node.tagName.toLowerCase();

            let matchingProcessor = processors[tag];

            if (typeof matchingProcessor !== "undefined") {
                matchingProcessor(config, node, root, callback);
            } else {
                processDefaultNode(config, node, root, callback);
            }
        } else if (node.nodeType === NodeType.text) {
            root.appendChild(document.createTextNode(node.data));
            scrollDown(config);
            callback(null);
        } else {
            scrollDown(config);
            callback(null);
        }
    };

    let runAnimation = function (config, parent, nodes, root, callback = () => {
    }) {
        if (nodes.length === 0) {
            callback(parent);
            return;
        }

        var index = 0;

        let animateRemainingNodes = function () {
            index++;

            if (index < nodes.length) {
                processNode(config, nodes[index].cloneNode(true), root, animateRemainingNodes);
            }
            else {
                callback(root);
            }
        };

        processNode(config, nodes[index].cloneNode(true), root, animateRemainingNodes);
    };

    window.tply = window.tply || {
            animate: function (from, to, conf, callback) {
                runAnimation(conf || {}, from, from.childNodes, to, callback);
            }
        };
})();