const vscode = require("vscode");
const path = require("path");
const { LanguageClient, TransportKind } = require("vscode-languageclient/node");

let client;
let panel; // webview panel reference

function activate(context) {
    const serverModule = context.asAbsolutePath(path.join("server", "server.js"));
    const serverOptions = {
        run: { module: serverModule, transport: TransportKind.ipc },
        debug: { module: serverModule, transport: TransportKind.ipc },
    };

    const clientOptions = {
        documentSelector: [{ scheme: "file", language: "plaintext" }],
    };

    client = new LanguageClient(
        "typewriterServer",
        "Typewriter Language Server",
        serverOptions,
        clientOptions
    );

    context.subscriptions.push(client.start());

    // Register a command to open the live preview
    context.subscriptions.push(
        vscode.commands.registerCommand("typewriter.showPreview", async () => {
            if (!panel) {
                panel = vscode.window.createWebviewPanel(
                    "typewriterPreview",
                    "Typewriter Preview",
                    vscode.ViewColumn.Beside,
                    { enableScripts: true }
                );
            }

            const editor = vscode.window.activeTextEditor;
            if (!editor) return;
            const text = editor.document.getText();
            const rendered = await client.sendRequest("typewriter/render", { text });
            updateWebview(panel, rendered);

            // Update as you type
            vscode.workspace.onDidChangeTextDocument(async (event) => {
                if (event.document === editor.document) {
                    const newText = event.document.getText();
                    const updated = await client.sendRequest("typewriter/render", { text: newText });
                    updateWebview(panel, updated);
                }
            });
        })
    );
}

function updateWebview(panel, htmlContent) {
    panel.webview.html = `
        <style>
            body {
                overflow-x: hidden;
                scrollbar-width: none;
                background-color: black;
                color: white;
                margin-right: 0;
                padding-top: 20px;
            }
            * {
                font-family: monospace;
                user-select: auto;
            }
        </style>
        <body>
            ${htmlContent}
        </body>
    `;
}

function deactivate() {
    if (client) return client.stop();
}

module.exports = { activate, deactivate };