class Typewriter3 {
    /**
     * @description tags: [newline], [linebreak], [newpage], [speed1] to [speed5], [speeddefault], [sleep], [typewriter-complete]
     * comments can be added with {{# ... #}}, allows newlines inside of comment
     * @param {String} text - The text to be typed.
     * @param {HTMLElement} outputElement - The HTML element where the text will be displayed.
     * @param {Object} options - Options for the typewriter effect.
     * @param {Number} [options.charDelay=100] - Delay between typing each character in milliseconds.
     * @param {Number} [options.newlineDelay=0] - Delay after typing a newline character in milliseconds. The [linebreak] tag uses the same delay as [newline].
     * @param {Object} [options.styles] - Object defining style characters.
     * @param {String} [options.styles.italic="/"] - Character to italicize text. Default is "/text/".
     * @param {String} [options.styles.bold="*"] - Character to bold text. Default is "*text*".
     * @param {String} [options.styles.underline="_"] - Character to underline text. Default is "_text_".
     * @param {String} [options.styles.strikethrough="-"] - Character to strikethrough text. Default is "-text-".
     * @param {String} [options.styles.escape="\\"] - Character to escape special characters. Default is "\text".
     * @param {Object<string, number>} [options.customDelays] - Custom delays for specific characters.
     * @param {Function} [options.onCharacterDisplayed] - Callback function that is called after each character is displayed.
     * @param {Function} [options.onToken] - Callback function that is called after each token is processed.
     * @param {Function} [options.onFunctionTag] - Callback function that is triggered when the [function] tag is encountered.
     * @param {Function} [options.onFinish] - Callback function that is called when typing is finished.
     * @param {String} [options.newpageText="New Page"] - Text to display for new page breaks. can be styled by editing the CSS class "typewriter-newpage"
     * @param {String} [options.defaultTextColor="#000000"] - Default text color.
     * @param {String} [options.defaultBackgroundColor="#FFFFFF"] - Default background color.
     * @param {Boolean} [options.completionBar=false] - Whether to show a completion bar at the bottom of the screen.
     * @param {Boolean} [options.instant=false] - If true, the text will be displayed instantly without typing effect.
     * @param {Boolean} [options.variableOutput=false] - If true, the output will be as a string instead of directly modifying the DOM.
     */
    constructor(text, outputElement, options = {}) {
        const defaultOptions = {
            charDelay: 100,
            newlineDelay: 200,
            styles: {
                italic: "/",
                bold: "*",
                underline: "_",
                strikethrough: "-",
                escape: "\\",
            },
            customDelays: {},
            onCharacterDisplayed: function() {}, // Callback function for when a character is displayed
            onFunctionTag: function() {}, // Callback function for when a function tag is encountered
            onToken: function() {}, // Callback function for when a token is processed
            onFinish: function() {}, // Callback function for when typing is finished
            newpageText: "New Page",
            defaultTextColor: "#000000",
            defaultBackgroundColor: "#FFFFFF",
            completionBar: false,
            instant: false,
            variableOutput: false,
        };

        options = {
            charDelay: options?.charDelay || defaultOptions.charDelay,
            newlineDelay: options?.newlineDelay || defaultOptions.newlineDelay,
            styles: {
                italic: options?.styles?.italic || defaultOptions.styles.italic,
                bold: options?.styles?.bold || defaultOptions.styles.bold,
                underline: options?.styles?.underline || defaultOptions.styles.underline,
                strikethrough: options?.styles?.strikethrough || defaultOptions.styles.strikethrough,
                escape: options?.styles?.escape || defaultOptions.styles.escape,
            },
            customDelays: options?.customDelays || defaultOptions.customDelays,
            onCharacterDisplayed: options?.onCharacterDisplayed || defaultOptions.onCharacterDisplayed,
            onFunctionTag: options?.onFunctionTag || defaultOptions.onFunctionTag,
            onToken: options?.onToken || defaultOptions.onToken,
            onFinish: options?.onFinish || defaultOptions.onFinish,
            newpageText: options?.newpageText || defaultOptions.newpageText,
            defaultTextColor: options?.defaultTextColor || defaultOptions.defaultTextColor,
            defaultBackgroundColor: options?.defaultBackgroundColor || defaultOptions.defaultBackgroundColor,
            completionBar: options?.completionBar || defaultOptions.completionBar,
            instant: options?.instant || defaultOptions.instant,
            variableOutput: options?.variableOutput || defaultOptions.variableOutput,
        };

        this.text = text.replaceAll("\n", "").replaceAll("\r", "");

        // remove {{# ... #}}
        this.text = this.text.replace(/\{\{#[\s\S]*?#\}\}/g, "");
        this.elem = outputElement;
        this.options = options;
        this.playing = false;
        this.pageDone = false;
        this.index = 0;
        this.timeoutID = null;
        this.speedTagOverride = null;
        this._speedOverride = null;
        this.currentTextColor = options.defaultTextColor;
        this.currentBackgroundColor = options.defaultBackgroundColor;
        this.output = "";

        if(this.options.completionBar) {
            this.completionBarElement = document.createElement("div");
            this.completionBarElement.style.position = "fixed";
            this.completionBarElement.style.left = "0";
            this.completionBarElement.style.top = "0";
            this.completionBarElement.style.width = "0%";
            this.completionBarElement.style.height = "5px";
            this.completionBarElement.style.backgroundColor = "white";
            this.completionBarElement.style.zIndex = "9999";
            document.body.appendChild(this.completionBarElement);
        }

        class Token {
            constructor(content, type, delay, styles) {
                this.content = content;
                this.type = type;
                this.delay = delay;
                this.styles = styles;
                this.color = options.defaultTextColor;
            }
        }

        let preQueue = [...this.text].map((char, index) => new Token(char, "undecided", options.charDelay, []));

        let currentStyles = {
            italic: false,
            bold: false,
            underline: false,
            strikethrough: false,
        };

        let escaping = false;

        let insideTag = false;

        preQueue.forEach((token, i) => {
            if (escaping) {
                token.type = "display";
                escaping = false;
                return;
            }

            if (token.content === options.styles.escape) {
                token.type = "delete";
                escaping = true;
            } else if (token.content === "[") {
                token.type = "tag";
                insideTag = true;
            } else if (token.content === "]") {
                token.type = "tag";
                insideTag = false;
            } else if(insideTag) {
                token.type = "tag";
            } else if([options.styles.italic, options.styles.bold, options.styles.underline, options.styles.strikethrough].includes(token.content)) {
                token.type = "styling";
            } else {
                token.type = "display";
            }
        });

        preQueue = preQueue.filter(token => token.type !== "delete");

        preQueue.forEach((token, i) => {
            if(token.type === "styling") {
                if(token.content === options.styles.italic) {
                    currentStyles.italic = !currentStyles.italic;
                } else if(token.content === options.styles.bold) {
                    currentStyles.bold = !currentStyles.bold;
                    token.type = "delete";
                } else if(token.content === options.styles.underline) {
                    currentStyles.underline = !currentStyles.underline;
                    token.type = "delete";
                } else if(token.content === options.styles.strikethrough) {
                    currentStyles.strikethrough = !currentStyles.strikethrough;
                    token.type = "delete";
                }
            }

            token.styles = Object.keys(currentStyles).filter(key => currentStyles[key]);
        });

        preQueue = preQueue.filter(token => token.type !== "styling");

        const combined = [];
        let currentTag = null;

        for (const token of preQueue) {
            if (token.type === "tag") {
                // Start a new tag sequence
                if (!currentTag) {
                    currentTag = new Token(token.content, "tag", token.delay, token.styles);
                } else {
                    // Continue building the current tag
                    currentTag.content += token.content;
                }

                // If we’ve reached a closing bracket, finalize the tag
                if (token.content === ']') {
                    combined.push(currentTag);
                    currentTag = null;
                }
            } else {
                // If a non-tag appears while building a tag, close it just in case
                if (currentTag) {
                    combined.push(currentTag);
                    currentTag = null;
                }

                // Push the current display (or other) token as-is
                combined.push(token);
            }
        }

        // Edge case: if a tag was never closed
        if (currentTag) combined.push(currentTag);

        preQueue = combined;

        preQueue.forEach((token, i) => {
            if(token.type === "tag") {
                let tagName = token.content.slice(1, -1).split(" ")[0]
                let tagArguments = token.content.slice(1, -1).split(" ").slice(1);
                token.name = tagName;
                token.arguments = tagArguments;
            }
        })

        this.queue = structuredClone(preQueue);

        this.queue.forEach((token, i) => {
            if(options.customDelays[token.content]) {
                token.delay = options.customDelays[token.content];
            }
        });
    }

    speedOverride(number){
        this._speedOverride = number;
    }

    start() {
        this.output = "";
        if(this.options.instant){
            for(let i = 0; i < this.queue.length; i++){
                let token = this.queue[i];
                this.renderToken(token);
            }
        } else {        
            this.playing = true;
            if (this.index === 0) this.elem.innerHTML = "";

            if (this.timeoutID) clearTimeout(this.timeoutID);

            let processNext = () => {
                if (!this.playing || this.index >= this.queue.length) {
                    this.playing = false;
                    return;
                }

                let token = this.queue[this.index];
                let returnedToken = this.renderToken(token);
                this.index++;

                if(this.index >= this.queue.length) {
                    this.options?.onFinish();
                    this.playing = false;
                    return;
                }

                this.timeoutID = setTimeout(processNext, this._speedOverride ?? returnedToken.delay);
            };

            processNext();
        }
    }

    renderToken(token) {
        if(this.options.completionBar) this.completionBarElement.style.width = `${(this.index + 1) / this.queue.length * 100}%`;
        this.options.onToken?.(token);

        let slept = false;

        if(this.options.variableOutput){
            // variable output
            if(token.type === "display"){
                let content = token.content;
                if (token.styles.includes("italic")) content = `<i>${content}</i>`;
                if (token.styles.includes("bold")) content = `<b>${content}</b>`;
                if (token.styles.includes("underline")) content = `<u>${content}</u>`;
                if (token.styles.includes("strikethrough")) content = `<s>${content}</s>`;
                let span = `<span data-index="${this.index}" style="color: ${this.currentTextColor}; background-color: ${this.currentBackgroundColor}">${content}</span>`;
                this.output += span;
                this.options.onCharacterDisplayed?.(token);
            } else if (token.type === "tag") {
                switch(token.name) {
                    case "invert": {
                        let tempTextColor = this.currentTextColor;
                        this.currentTextColor = this.currentBackgroundColor;
                        this.currentBackgroundColor = tempTextColor;
                    } break;

                    case "hr": {
                        this.output += `<hr>`;
                        token.delay = this.options.charDelay;
                    } break;

                    case "tab": {
                        this.output += `${"&nbsp;".repeat(parseInt(token.arguments[0]) || 4)}`;
                        token.delay = this.options.charDelay;
                    } break;

                    case "newline": {
                        this.output += `<br>`;
                        token.delay = this.options.newlineDelay;
                    } break;

                    case "linebreak": {
                        this.output += `<br><br>`;
                        token.delay = this.options.newlineDelay;
                    } break;

                    case "newpage": {
                        this.output += `<hr><div>${this.options.newpageText}</div><hr>`;
                    } break;

                    case "speeddefault": {
                        this.speedTagOverride = null;
                    } break;

                    case "speed": {
                        let speed = parseInt(token.arguments[0]) || this.options.charDelay;
                        this.speedTagOverride = speed;
                    } break;

                    case "sleep": {
                        let speed = parseInt(token.arguments[0]) || 1000;
                        token.delay = speed;
                        slept = true;
                    } break;

                    case "function": {
                        if(this.playing){
                            this.options.onFunctionTag?.();
                        }
                    } break;

                    case "color": {
                        if(token.arguments[0].startsWith("#")) {
                            this.currentTextColor = token.arguments[0];
                        } else {
                            this.currentTextColor = `rgb(${token.arguments[0]}, ${token.arguments[1]}, ${token.arguments[2]})`;
                        }
                    } break;

                    case "resetcolor": {
                        this.currentTextColor = this.options.defaultTextColor;
                    } break;

                    case "background": {
                        if(token.arguments[0].startsWith("#")) {
                            this.currentBackgroundColor = token.arguments[0];
                        } else {
                            this.currentBackgroundColor = `rgb(${token.arguments[0]}, ${token.arguments[1]}, ${token.arguments[2]})`;
                        }
                    } break;

                    case "resetbg": {
                        this.currentBackgroundColor = this.options.defaultBackgroundColor;
                    } break;
                }
            }
        } else {
            // dom output
            if(token.type === "display"){
                let content = token.content;
                if (token.styles.includes("italic")) content = `<i>${content}</i>`;
                if (token.styles.includes("bold")) content = `<b>${content}</b>`;
                if (token.styles.includes("underline")) content = `<u>${content}</u>`;
                if (token.styles.includes("strikethrough")) content = `<s>${content}</s>`;
                let span = document.createElement("span");
                span.style.color = this.currentTextColor;
                span.style.backgroundColor = this.currentBackgroundColor;
                span.innerHTML = content;
                span.setAttribute("data-index", this.index);
                this.elem.appendChild(span);
                window.scrollTo(window.scrollX, document.body.scrollHeight);
                this.options.onCharacterDisplayed?.(token);
            } else if (token.type === "tag") {
                switch(token.name) {
                    case "invert": {
                        let tempTextColor = this.currentTextColor;
                        this.currentTextColor = this.currentBackgroundColor;
                        this.currentBackgroundColor = tempTextColor;
                    } break;

                    case "hr": {
                        let hr = document.createElement("hr");
                        this.elem.appendChild(hr);
                        token.delay = this.options.charDelay;
                    } break;

                    case "tab": {
                        let tabSpace = document.createElement("span");
                        let spaceCount = parseInt(token.arguments[0]) || 4;
                        tabSpace.innerHTML = "&nbsp;".repeat(spaceCount);
                        token.delay = this.options.charDelay;
                        this.elem.appendChild(tabSpace);
                    } break;

                    case "newline": {
                        this.elem.appendChild(document.createElement("br"));
                        token.delay = this.options.newlineDelay;
                    } break;

                    case "linebreak": {
                        this.elem.appendChild(document.createElement("br"));
                        this.elem.appendChild(document.createElement("br"));
                        token.delay = this.options.newlineDelay;
                    } break;

                    case "newpage": {
                        this.pause();
                        let pageBreak = document.createElement("div");
                        pageBreak.textContent = this.options.newpageText;
                        pageBreak.style.cursor = "pointer";
                        pageBreak.classList.add("typewriter3-newpage");
                        this.pageDone = true;
                        pageBreak.addEventListener("click", () => {
                            this.elem.innerHTML = "";
                            this.pageDone = false;
                            this.resume();
                        });
                        this.elem.appendChild(pageBreak);
                        window.scrollTo(window.scrollX, document.body.scrollHeight);
                    } break;

                    case "speeddefault": {
                        this.speedTagOverride = null;
                    } break;

                    case "speed": {
                        let speed = parseInt(token.arguments[0]) || this.options.charDelay;
                        this.speedTagOverride = speed;
                    } break;

                    case "sleep": {
                        let speed = parseInt(token.arguments[0]) || 1000;
                        token.delay = speed;
                        slept = true;
                    } break;

                    case "function": {
                        if(this.playing){
                            this.options.onFunctionTag?.();
                        }
                    } break;

                    case "color": {
                        if(token.arguments[0].startsWith("#")) {
                            this.currentTextColor = token.arguments[0];
                        } else {
                            this.currentTextColor = `rgb(${token.arguments[0]}, ${token.arguments[1]}, ${token.arguments[2]})`;
                        }
                    } break;

                    case "resetcolor": {
                        this.currentTextColor = this.options.defaultTextColor;
                    } break;

                    case "background": {
                        if(token.arguments[0].startsWith("#")) {
                            this.currentBackgroundColor = token.arguments[0];
                        } else {
                            this.currentBackgroundColor = `rgb(${token.arguments[0]}, ${token.arguments[1]}, ${token.arguments[2]})`;
                        }
                    } break;

                    case "resetbg": {
                        this.currentBackgroundColor = this.options.defaultBackgroundColor;
                    } break;
                }
            }
        }

        if(this.speedTagOverride != null && slept == false) token.delay = this.speedTagOverride;

        return token;
    }

    pause(){
        if(this.pageDone) return;
        this.playing = false;
    }

    togglePause(){
        if(this.pageDone) return;
        this.playing = !this.playing;
        if(this.playing) this.resume();
    }

    resume(){
        if(this.pageDone) return;
        if (this.index < this.queue.length) {
            this.playing = true;
            this.start();
        }
    }

    restart() {
        if(this.pageDone) return;
        this.playing = false;
        this.index = 0;
        this.start();
    }
}

module.exports = { Typewriter3 }