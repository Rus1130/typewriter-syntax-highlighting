const path = require("path");
const vscode = require("vscode");
const { LanguageClient, TransportKind } = require("vscode-languageclient/node");

let client;

function activate(context) {
    const serverModule = context.asAbsolutePath(path.join("server", "server.js"));

    const serverOptions = {
        run: { module: serverModule, transport: TransportKind.ipc },
        debug: {
            module: serverModule,
            transport: TransportKind.ipc,
            options: { execArgv: ["--nolazy", "--inspect=6009"] }
        }
    };

    const clientOptions = {
        documentSelector: [{ scheme: "file", language: "typewriter" }]
    };

    client = new LanguageClient(
        "twLanguageServer",
        "Typewriter Language Server",
        serverOptions,
        clientOptions
    );

    const disposable = client.start();
    context.subscriptions.push(disposable);

    // ✅ Register the `typewriter.preview` command
    const previewCommand = vscode.commands.registerCommand("typewriter.preview", async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage("No active Typewriter document to preview.");
            return;
        }

        let text = editor.document.getText();
        const panel = vscode.window.createWebviewPanel(
            "typewriterPreview",
            "Typewriter Preview",
            vscode.ViewColumn.Beside,
            { enableScripts: true }
        );

        text = text
            .replaceAll(/\{\{#([\s\S]*?)#\}\}/g, "")
            .replaceAll(/(?<!\\)\[speed (\d+?)(?<!\\)\]/g, "")
            .replaceAll(/(?<!\\)\[sleep (\d+?)(?<!\\)\]/g, "")
            .replaceAll(/(?<!\\)\[speeddefault(?<!\\)\]/g, "")
            .replaceAll(/(?<!\\)\[newpage(?<!\\)\]/g, '<hr><div>--- New Page ---</div><hr>')
            .replaceAll(/(?<!\\)\[newline(?<!\\)\]/g, "<br>")
            .replaceAll(/(?<!\\)\[linebreak(?<!\\)\]/g, "<br><br>")
            .replaceAll(/(?<!\\)\/(.*?)(?<!\\)\//g, "<i>$1</i>")
            .replaceAll(/(?<!\\)\*(.*?)(?<!\\)\*/g, "<b>$1</b>")
            .replaceAll(/(?<!\\)_(.*?)(?<!\\)_/g, "<u>$1</u>")
            .replaceAll(/(?<!\\)-(.*?)(?<!\\)-/g, "<s>$1</s>")

            let currentFg = "#ffffff";
            let currentBg = "#000000";

            function toRGB(str) {
                const match = str.trim().match(/^#([0-9a-fA-F]{6})$/);
                if (match) return `#${match[1]}`;

                const nums = str.trim().split(/\s+/).map(Number);
                if (nums.length === 3 && nums.every(n => !isNaN(n) && n >= 0 && n <= 255))
                    return `rgb(${nums.join(",")})`;

                return null; // invalid color — ignore
            }

            text = text.replace(/\[(color|background)\s+([^\]]+)\]|\[reset(color|bg)\]|\[invert\]/g, (match, type, value, resetType) => {
                if (type === "color" && value) {
                    const color = toRGB(value);
                    if (color) currentFg = color;
                } else if (type === "background" && value) {
                    const color = toRGB(value);
                    if (color) currentBg = color;
                } else if (resetType === "color") {
                    currentFg = "#ffffff";
                } else if (resetType === "bg") {
                    currentBg = "#000000";
                } else if (match === "[invert]") {
                    const temp = currentFg;
                    currentFg = currentBg;
                    currentBg = temp;
                }
                return `</span><span style="color: ${currentFg}; background-color: ${currentBg};">`;
            });

            // Start wrapped in a span with default colors

            text = text.replaceAll(/\\(.)/g, "$1");

            text = `<span style="color: ${currentFg}; background-color: ${currentBg};">${text}</span>`;

        // Basic preview placeholder — you can replace with your real preview logic
        panel.webview.html = 
        `<!DOCTYPE html>
            <style>
                #out, body {
                    overflow-x: hidden;
                    scrollbar-width: none;
                    background-color: black;
                    color: white;
                    margin-right: 0;
                    padding-top: 17px;
                }
                * {
                    font-family: monospace;
                    user-select: auto;
                }
                .button {
                    margin-bottom: 1px;
                    display: block;
                    cursor: pointer;
                }
                .button:hover, .typewriter3-newpage:hover {
                    background-color: white;
                    color: black;
                }
            </style>
            <body>
                ${text}
            </body>
        </html>`;
    });

    context.subscriptions.push(previewCommand);
}

function deactivate() {
    if (client) return client.stop();
}

module.exports = { activate, deactivate };