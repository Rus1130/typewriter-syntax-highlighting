const {
    createConnection,
    TextDocuments,
    ProposedFeatures,
    CompletionItemKind,
    DiagnosticSeverity,
    InsertTextFormat
} = require("vscode-languageserver/node");
const { TextDocument } = require("vscode-languageserver-textdocument");

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

connection.onInitialize(() => ({
    capabilities: {
        textDocumentSync: documents.syncKind,
        completionProvider: {
            triggerCharacters: ['['], // 👈 trigger IntelliSense when > is typed
        },
    }
}));

const TAGS = [
    { label: "newline", detail: "Inserts a new line", documentation: "[newline]" },
    { label: "linebreak", detail: "Inserts a line break, which is just 2 newlines", documentation: "[linebreak]" },
    { label: "newpage", detail: "Starts a new page", documentation: "[newpage]" },
    { label: "sleep", detail: "Pauses typewriter", documentation: "[sleep]" },
    { label: "function", detail: "Runs a specified function", documentation: "[function]" },
    { label: "speed1", detail: "Sets speed to speed 1", documentation: "[speed1]" },
    { label: "speed2", detail: "Sets speed to speed 2", documentation: "[speed2]" },
    { label: "speed3", detail: "Sets speed to speed 3", documentation: "[speed3]" },
    { label: "speed4", detail: "Sets speed to speed 4", documentation: "[speed4]" },
    { label: "speed5", detail: "Sets speed to speed 5", documentation: "[speed5]" },
    { label: "speeddefault", detail: "Sets speed to default speed", documentation: "[speeddefault]" },
];

function sendError(uri, message, line, startPos, endPos) {
    const diagnostic = {
        severity: DiagnosticSeverity.Error,
        range: {
            start: { line: line, character: startPos },
            end: { line: line, character: endPos }
        },
        message: message,
        source: 'tw'
    };
    connection.sendDiagnostics({ uri: uri, diagnostics: [diagnostic] });
}

function sendWarning(uri, message, line, startPos, endPos) {
    const diagnostic = {
        severity: DiagnosticSeverity.Warning,
        range: {
            start: { line: line, character: startPos },
            end: { line: line, character: endPos }
        },
        message: message,
        source: 'tw'
    };
    connection.sendDiagnostics({ uri: uri, diagnostics: [diagnostic] });
}

connection.onCompletion((_params) => {
    return TAGS.map(tag => ({
        label: tag.label,
        kind: CompletionItemKind.Keyword,
        detail: tag.detail,
        documentation: { kind: "markdown", value: tag.documentation }
    }));
});

documents.onDidChangeContent(change => {
    const text = change.document.getText();
    const lines = text.split(/\r?\n/g);
    const uri = change.document.uri;

    let diagnostics = [];
    connection.sendDiagnostics({ uri: uri, diagnostics: [] }); // Clear previous diagnostics

    lines.forEach((line, i) => {
        if(line.includes("\\[") || line.includes("\\]")) {
            sendError(uri, "Tags cannot be escaped.", i, line.indexOf("\\"), line.indexOf("\\") + 2);
            return;
        }
        let match;
        const tagPattern = /\[(.*?)\]/g;
        while ((match = tagPattern.exec(line)) !== null) {
            const tag = match[1];
            const startPos = match.index;
            const endPos = match.index + match[0].length;
            if (!TAGS.some(t => t.label === tag)) {
                sendWarning(uri, `Unknown tag: [${tag}]. This will be displayed as text.`, i, startPos, endPos);
            }
        }
    });
});

documents.listen(connection);
connection.listen();
