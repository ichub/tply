(function () {
    "use strict";
    let parseDuration = require("parse-duration");

    var config = {types: []};

    var makeProcessor = function (processFn) {
        return function (node, root, callback) {
            var callBackProxy = callback;

            for (var i = 0; i < node.attributes.length; i++) {
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

            processFn(node, root, callBackProxy);
        };
    };

    let append = function (root, node, desiredTag, justCopyIt) {
        justCopyIt = justCopyIt || false;

        var clone = node.cloneNode(true);
        if (!justCopyIt) {
            clone.innerHTML = "";
        }

        if (typeof desiredTag !== 'undefined') {
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

    let processWaitNode = function (node, root, callback) {
        let duration = parseDuration(node.innerText);

        setTimeout(function () {
            callback(null);
        }, duration);
    };

    let scrollDown = function () {
        window.scroll(0, document.documentElement.offsetHeight);
    };

    let mapCharToInteval = function (node, char, isEnd) {
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

    let writeText = function (text, typeNode, element, callback) {
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

        let interval = mapCharToInteval(typeNode, char, text.length === 1);

        if (interval === 0) {
            writeText(text.slice(1), typeNode, element, callback);
            scrollDown();
        } else {
            setTimeout(function () {
                writeText(text.slice(1), typeNode, element, callback);
                scrollDown();
            }, interval);
        }
    };

    let processTypeNode = function (node, root, callback, topLevelTypeNode) {
        topLevelTypeNode = topLevelTypeNode || node;
        let contents = node.childNodes;

        if (contents.length >= 1) {
            var index = 0;
            let appendedRoot = append(root, node);

            let processNextContent = function () {
                if (index < contents.length) {
                    processTypeNode(contents[index++], appendedRoot, processNextContent, topLevelTypeNode);
                } else {
                    callback(null);
                }
            };

            processNextContent();
        } else {
            if (node.nodeType === NodeType.text) {
                writeText((node.innerText || node.data).replace(/\n/, '').replace(/\s\s+/g, ' '), topLevelTypeNode, root, callback);
            } else {
                callback(null);
            }
        }
    };

    let processDefaultNode = makeProcessor(function (node, root, callback) {
        let clone = append(root, node);
        clone.classList.add("fadein");
        runAnimation(node, node.childNodes, clone, callback);
    });

    let processors = {
        "type": makeProcessor(processTypeNode),
        "wait": makeProcessor(processWaitNode),
    };

    let processNode = function (node, root, callback) {
        if (node.nodeType === NodeType.element) {
            let tag = node.tagName.toLowerCase();

            let matchingProcessor = processors[tag];

            if (typeof matchingProcessor !== "undefined") {
                matchingProcessor(node, root, callback);
            } else {
                processDefaultNode(node, root, callback);
            }
        } else if (node.nodeType === NodeType.text) {
            root.appendChild(document.createTextNode(node.data));
            scrollDown();
            callback(null);
        } else {
            scrollDown();
            callback(null);
        }
    };

    let runAnimation = function (parent, nodes, root, callback = () => {
    }) {
        if (nodes.length === 0) {
            callback(parent);
            return;
        }

        var index = 0;

        let animateRemainingNodes = function () {
            index++;

            if (index < nodes.length) {
                processNode(nodes[index].cloneNode(true), root, animateRemainingNodes);
            }
            else {
                callback(root);
            }
        };

        processNode(nodes[index].cloneNode(true), root, animateRemainingNodes);
    };

    window.tply = window.tply || {
            animate: function (from, to, conf) {
                config = conf;
                runAnimation(from, from.childNodes, to);
            }
        };
})();