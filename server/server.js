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
        }
    }
}));

const TAGS = [
    { label: "newline", detail: "Inserts a new line", documentation: "[newline]" },
    { label: "linebreak", detail: "Inserts a line break, which is just 2 newlines. But has the same speed as one newline", documentation: "[linebreak]" },
    { label: "newpage", detail: "Starts a new page", documentation: "[newpage]" },
    { label: "sleep", detail: "Pauses typewriter for amount in ms. Defaults to 1000 if argument is NaN", documentation: "[sleep 20]" },
    { label: "function", detail: "Runs a specified function", documentation: "[function]" },
    { label: "speed", detail: "Overrides the current character speed to a number. Defaults to the character speed if argument is NaN", documentation: "[speed 70]" },
    { label: "speeddefault", detail: "Removes the override of the [speed] tag", documentation: "[speeddefault]" },
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

    const diagnostics = []; // Collect all warnings here

    lines.forEach((line, i) => {
        let match;
        // Match tags like [sleep 700], [speed 150], [linebreak], etc.
        const tagPattern = /\[([a-zA-Z]+)(?:\s+([^\]]+))?\]/g;

        while ((match = tagPattern.exec(line)) !== null) {
            const fullTag = match[0];
            const tagName = match[1];
            const arg = match[2];
            const startPos = match.index;
            const endPos = match.index + fullTag.length;

            const knownTag = TAGS.some(t => t.label === tagName);

            const tagsThatRecommendArgs = ["sleep", "speed"];

            if (!knownTag) {
                diagnostics.push({  
                    severity: 2, // Warning
                    range: {
                        start: { line: i, character: startPos },
                        end: { line: i, character: endPos }
                    },
                    message: `Unknown tag: [${tagName}].`,
                    source: 'typewriter-lsp'
                });
            } else if (arg !== undefined && isNaN(Number(arg))) {
                let defaultAmount = 0;
                if(tagName === "sleep") defaultAmount = 1000;
                if(tagName === "speed") defaultAmount = 50;
                diagnostics.push({
                    severity: 2,
                    range: {
                        start: { line: i, character: startPos },
                        end: { line: i, character: endPos }
                    },
                    message: `Invalid numeric argument in tag [${tagName} ${arg}]. Will default to ${defaultAmount} ms.`,
                    source: 'typewriter-lsp'
                });
            } else if (arg === undefined && tagsThatRecommendArgs.includes(tagName)) {
                diagnostics.push({
                    severity: 3,
                    range: {
                        start: { line: i, character: startPos },
                        end: { line: i, character: endPos }
                    },
                    message: `Tag [${tagName}] usually takes a numeric argument.`,
                    source: 'typewriter-lsp'
                });
            }
        }
    });

    // Send all collected diagnostics at once
    connection.sendDiagnostics({ uri, diagnostics });
});

documents.listen(connection);
connection.listen();
