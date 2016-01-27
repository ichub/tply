/* globals $, require */

(function () {
    "use strict";
    let parseDuration = require("parse-duration");

    var config = {types: []};

    var makeProcessor = function (processFn) {
        return function ($node, $root, callback) {
            var rawNode = $node[0];
            var callBackProxy = callback;

            for (var i = 0; i < rawNode.attributes.length; i++) {
                for (var j = 0; j < config.types.length; j++) {
                    if (rawNode.attributes[i].name === "data-type") {
                        if (rawNode.attributes[i].value === config.types[j].name) {
                            for (var propName in config.types[j].properties) {
                                if (config.types[j].properties.hasOwnProperty(propName)) {
                                    $node.attr(propName, config.types[j].properties[propName]);
                                }
                            }

                            $node.addClass(config.types[j].styleClasses || "");
                            $node.attr("style", $node.attr("style") + ";" + config.types[j].style);
                        }
                    }
                }
            }

            for (var i = 0; i < config.processing.length; i++) {
                let proc = config.processing[i];

                if ($node.prop("tagName").toLowerCase() == proc.tag.toLowerCase()) {
                    if (typeof proc.pre === "function") {
                        proc.pre(rawNode);
                    }

                    if (typeof proc.post === "function") {
                        callBackProxy = function(element) {
                            proc.post(element);
                            callback(element);
                        }
                    }
                }
            }

            processFn($node, $root, callBackProxy);
        };
    };

    let append = function ($root, $node, desiredTag, justCopyIt) {
        justCopyIt = justCopyIt || false;

        var clone = $node.clone();
        if (!justCopyIt) {
            clone.html("");
        }

        if (typeof desiredTag !== 'undefined') {
            clone = $(`<${desiredTag}>${clone.html()}</${desiredTag}>`);

            $.each($node.prop("attributes"), function () {
                clone.attr(this.name, this.value);
            });

            clone.className = $node.className;
        }

        $root.append(clone);
        return clone;
    };

    let NodeType = {
        element: 1,
        attribute: 2,
        text: 3,
        comment: 8
    };

    let processWaitNode = function ($node, $root, callback) {
        let duration = parseDuration($node.text());

        setTimeout(function () {
            callback(null);
        }, duration);
    };

    let scrollDown = function () {
        window.scroll(0, document.documentElement.offsetHeight);
    };

    let mapCharToInteval = function ($node, char, isEnd) {
        let defaultCharInterval = "50ms";
        let defaultPeriodInterval = "500ms";
        let defaultCommaInterval = "300ms";
        let defaultEndInterval = "0ms";
        let defaultWordInterval = "0ms";

        let charInterval = parseDuration($node.attr("data-char-interval") || defaultCharInterval);
        let periodInterval = parseDuration($node.attr("data-period-interval") || defaultPeriodInterval);
        let commaInterval = parseDuration($node.attr("data-comma-interval") || defaultCommaInterval);
        let endInterval = parseDuration($node.attr("data-end-interval") || defaultEndInterval);
        let wordInterval = parseDuration($node.attr("data-word-interval") || defaultWordInterval);

        if ($node.attr("data-robot")) {
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

    let writeText = function (text, $typeNode, $element, callback) {
        if (text === "") {
            if (typeof callback === "undefined") {
                return;
            }
            callback(null);
            return;
        }

        let character = text[0];

        if (character === "\n") {
            writeText(text.slice(1), $element, callback);
            return;
        }

        $element.append(`<span class="character">${character}</span>`);

        let interval = mapCharToInteval($typeNode, character, text.length === 1);

        if (interval === 0) {
            writeText(text.slice(1), $typeNode, $element, callback);
            scrollDown();
        } else {
            setTimeout(function () {
                writeText(text.slice(1), $typeNode, $element, callback);
                scrollDown();
            }, interval);
        }
    };

    let processTypeNode = function ($node, $root, callback, $topLevelTypeNode) {
        $topLevelTypeNode = $topLevelTypeNode || $node;
        let contents = $node.contents();

        if (contents.length >= 1) {
            var index = 0;
            let appendedRoot = append($root, $node);

            let processNextContent = function () {
                if (index < contents.length) {
                    processTypeNode($(contents[index++]), appendedRoot, processNextContent, $topLevelTypeNode);
                } else {
                    callback(null);
                }
            };

            processNextContent();
        } else {
            if ($node[0].nodeType == NodeType.text) {
                writeText(($node.text() || $node[0].data).replace(/\n/, '').replace(/\s\s+/g, ' '), $topLevelTypeNode, $root, callback);
            } else {
                callback(null);
            }
        }
    };

    let processDefaultNode = makeProcessor(function ($node, $root, callback) {
        let clone = append($root, $node);
        clone.addClass("fadein");
        runAnimation($node[0], $node.contents(), clone, callback);
    });

    let processors = {
        "type": makeProcessor(processTypeNode),
        "wait": makeProcessor(processWaitNode),
    };

    let processNode = function ($node, $root, callback) {
        if ($node[0].nodeType === NodeType.element) {
            let tag = $node.prop("tagName").toLowerCase();

            let matchingProcessor = processors[tag];

            if (typeof matchingProcessor !== "undefined") {
                matchingProcessor($node, $root, callback);
            } else {
                processDefaultNode($node, $root, callback);
            }
        } else if ($node[0].nodeType === NodeType.text) {
            $root.append($node.text());
            scrollDown();
            callback(null);
        } else {
            scrollDown();
            callback(null);
        }
    };

    let runAnimation = function (parent, nodes, $root, callback = () => {
    }) {
        if (nodes.length === 0) {
            callback(parent);
            return;
        }

        var index = 0;

        let animateRemainingNodes = function (node) {
            index++;

            if (index < nodes.length) {
                processNode($(nodes[index]).clone(), $root, animateRemainingNodes);
            }
            else {
                callback($root[0]);
            }
        };

        processNode($(nodes[index]).clone(), $root, animateRemainingNodes);
    };

    window.tply = window.tply || {
            animate: function (from, to, conf) {
                config = conf;
                runAnimation($(from)[0], $(from).contents(), $(to));
            }
        }
})();