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

        const text = editor.document.getText();
        const panel = vscode.window.createWebviewPanel(
            "typewriterPreview",
            "Typewriter Preview",
            vscode.ViewColumn.Beside,
            { enableScripts: true }
        );

        // Basic preview placeholder — you can replace with your real preview logic
        panel.webview.html = `hi!`
    });

    context.subscriptions.push(previewCommand);
}

function deactivate() {
    if (client) return client.stop();
}

module.exports = { activate, deactivate };