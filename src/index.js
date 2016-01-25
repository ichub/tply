/* globals $, require */

$(()=> {
    "use strict";
    let parseDuration = require("parse-duration");

    let $template = $("#template");
    let $animation = $("#animation");

    var config = JSON.parse($template.find(".config").text());

    var makeProcessor = function (processFn) {
        return function ($node, $root, callback) {
            for (var i = 0; i < $node[0].attributes.length; i++) {
                for (var j = 0; j < config.types.length; j++) {
                    if ($node[0].attributes[i].name === "data-type") {
                        if ($node[0].attributes[i].value === config.types[j].name) {
                            for (var propName in config.types[j].properties) {
                                if (config.types[j].properties.hasOwnProperty(propName)) {
                                    $node.attr(propName, config.types[j].properties[propName]);
                                }
                            }

                            $node.addClass(config.types[j].styleClasses || "");
                            $node.attr("style", $node.attr("style") + ";" + config.types[j].style);
                            processFn($node, $root, callback);
                            return;
                        }
                    }
                }
            }
            processFn($node, $root, callback);
        };
    };

    let append = function ($root, $node, desiredTag) {
        var clone = $node.clone();
        clone.html("");

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
            callback();
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

    let writeText = function (text, $element, callback) {
        if (text === "") {
            callback();
            return;
        }

        let character = text[0];

        if (character === "\n") {
            writeText(text.slice(1), $element);
            return;
        }

        $element.append(`<span class="character">${character}</span>`);

        let interval = mapCharToInteval($element, character, text.length === 1);

        if (interval === 0) {
            writeText(text.slice(1), $element, callback);
            scrollDown();
        } else {
            setTimeout(function () {
                writeText(text.slice(1), $element, callback);
                scrollDown();
            }, interval);
        }
    };

    let processTypeNode = function ($node, $root, callback) {
        let textToType = $node.text().replace(/\s+/g, ' ');
        $node.text("");
        let $clone = append($root, $node, "span");

        writeText(textToType, $clone, callback);
    };

    let processDefaultNode = function ($node, $root, callback) {
        runAnimation($node.contents(), append($root, $node), callback);
    };

    let processors = {
        "type": makeProcessor(processTypeNode),
        "wait": makeProcessor(processWaitNode)
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
            callback();
        } else {
            scrollDown();
            callback();
        }
    };

    let runAnimation = function (nodes, $root, callback = () => {
    }) {
        if (nodes.length === 0) {
            callback();
            return;
        }

        var index = 0;

        let animateRemainingNodes = function () {
            index++;

            if (index < nodes.length) {
                processNode($(nodes[index]).clone(), $root, animateRemainingNodes);
            }
            else {
                callback();
            }
        };

        processNode($(nodes[index]).clone(), $root, animateRemainingNodes);
    };


    runAnimation($template.contents(), $animation);
});