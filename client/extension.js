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

    // ✅ define disposable before pushing
    const disposable = client.start();

    context.subscriptions.push(disposable);
}

function deactivate() {
    if (client) return client.stop();
}

module.exports = { activate, deactivate };