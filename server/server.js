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
        colorProvider: true,
    }
}));

const TAGS = [
    { label: "newline", detail: "Inserts a new line.", documentation: "[newline]" },
    { label: "linebreak", detail: "Inserts a line break, which is just 2 newlines. However, it has the same speed as one newline.", documentation: "[linebreak]" },
    { label: "speed", detail: "Overrides the current character speed to a number.", documentation: "[speed 70]" },
    { label: "sleep", detail: "Pauses typewriter for amount in ms.", documentation: "[sleep 20]" },
    { label: "speeddefault", detail: "Removes the override of the [speed] tag.", documentation: "[speeddefault]" },
    { label: "newpage", detail: "Starts a new page.", documentation: "[newpage]" },
    { label: "function", detail: "Runs the function defined by onFunctionTag() in the Typewriter3 definition.", documentation: "[function]" },
    { label: "color", detail: "Changes the text color. Accepts hex (#RRGGBB) or RGB (R G B) format. Displays error if format is incorrect.", documentation: "[color #ff0000]\n[color 255 0 0]" },
    { label: "background", detail: "Changes the background color. Accepts hex (#RRGGBB) or RGB (R G B) format. Displays error if format is incorrect.", documentation: "[background #00ff00]\n[background 0 255 0]" },
    { label: "resetcolor", detail: "Resets the text color to default.", documentation: "[resetcolor]" },
    { label: "resetbg", detail: "Resets the background color to default.", documentation: "[resetbg]" },
    { label: "tab", detail: "Inserts 4 spaces. Optional number parameter to input a different number of spaces.", documentation: "[tab]\n[tab 10]" },
];

connection.onCompletion((params) => {
    const document = documents.get(params.textDocument.uri);
    const text = document.getText();
    const offset = document.offsetAt(params.position);
    const charBefore = text[offset - 1];

    // Only trigger completions if the user is immediately after `[`
    if (charBefore !== "[") return [];

    return TAGS.map(tag => ({
        label: tag.label,
        kind: CompletionItemKind.Keyword,
        detail: tag.label,
        documentation: {
            kind: "markdown",
            value: [
                `${tag.detail}`,
                ``,
                '-----',
                ``,
                '```typewriter',
                tag.documentation,
                '```',
            ].join("\n")
        },
        insertTextFormat: InsertTextFormat.PlainText
    }));
});

documents.onDidChangeContent(change => {
    const text = change.document.getText();
    const lines = text.split(/\r?\n/g);
    const uri = change.document.uri;

    const diagnostics = [];

    lines.forEach((line, i) => {
        let match;
        // Matches tags like [sleep 700], [speed 150], [color #aa0000], [color 255 0 255], etc.
        const tagPattern = /\[([a-zA-Z]+)(?:\s+([^\]]+))?\]/g;

        while ((match = tagPattern.exec(line)) !== null) {
            const fullTag = match[0];
            const tagName = match[1];
            const args = match[2] ? match[2].trim().split(/\s+/) : [];
            const startPos = match.index;
            const endPos = match.index + fullTag.length;

            const knownTag = TAGS.some(t => t.label === tagName);

            if (!knownTag) {
                diagnostics.push({
                    severity: 2,
                    range: {
                        start: { line: i, character: startPos },
                        end: { line: i, character: endPos }
                    },
                    message: `Unknown tag: [${tagName}].`,
                    source: 'typewriter-lsp'
                });
                continue;
            }

            // --- argument validation ---
            if(tagName === "tab") {
                if(args[0] !== undefined && (isNaN(Number(args[0])) || Number(args[0]) < 1)) {
                    diagnostics.push({
                        severity: 2,
                        range: {
                            start: { line: i, character: startPos },
                            end: { line: i, character: endPos }
                        },
                        message: `Invalid numeric argument in [${tagName} ${args.join(" ")}].`,
                        source: 'typewriter-lsp'
                    });
                }
                continue;
            }
            if (tagName === "sleep" || tagName === "speed") {
                if(args[0] === undefined) {
                    diagnostics.push({
                        severity: 2,
                        range: {
                            start: { line: i, character: startPos },
                            end: { line: i, character: endPos }
                        },
                        message: `Missing argument in [${tagName}].`,
                        source: 'typewriter-lsp'
                    });
                    continue;
                }

                if (args.length > 1 || (args[0] && isNaN(Number(args[0])))) {
                    let defaultAmount = tagName === "sleep" ? 1000 : 50;
                    diagnostics.push({
                        severity: 2,
                        range: {
                            start: { line: i, character: startPos },
                            end: { line: i, character: endPos }
                        },
                        message: `Invalid numeric argument in [${tagName} ${args.join(" ")}].`,
                        source: 'typewriter-lsp'
                    });
                }
            }

            if (tagName === "color" || tagName === "background") {
                const argStr = args.join(" ");
                const isHex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(argStr);
                const isRGB =
                    args.length === 3 &&
                    args.every(a => /^\d+$/.test(a) && Number(a) >= 0 && Number(a) <= 255);

                if (!isHex && !isRGB) {
                    diagnostics.push({
                        severity: 1,
                        range: {
                            start: { line: i, character: startPos },
                            end: { line: i, character: endPos }
                        },
                        message: `Invalid color format in [${tagName} ${argStr}]. Expected “[${tagName} #RRGGBB]” or “[${tagName} R G B]”.`,
                        source: 'typewriter-lsp'
                    });
                }
            }
        }
    });

    connection.sendDiagnostics({ uri, diagnostics });
});

connection.onDocumentColor(({ textDocument }) => {
    const uri = textDocument.uri;
    const text = documents.get(uri).getText();

    const colorTagRegex = /(?<!\\)\[(color|background)\s+(#(?:[A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})|(\d{1,3}\s+\d{1,3}\s+\d{1,3}))(?<!\\)\]/g;
    const colors = [];
    let match;

    while ((match = colorTagRegex.exec(text)) !== null) {
        const tag = match[0];
        const colorArg = match[2] || match[3];
        if(!colorArg) continue;
        const start = match.index;
        const end = start + tag.length;

        let r, g, b, a = 1;

        if (colorArg.startsWith("#")) {
            // HEX format
            let hex = colorArg.slice(1);
            if (hex.length === 3) hex = hex.split("").map(c => c + c).join("");
            r = parseInt(hex.slice(0, 2), 16);
            g = parseInt(hex.slice(2, 4), 16);
            b = parseInt(hex.slice(4, 6), 16);
        } else {
            // RGB format
            [r, g, b] = colorArg.split(/\s+/).map(Number);
        }

        colors.push({
            range: {
                start: positionAt(text, start),
                end: positionAt(text, end)
            },
            color: {
                red: r / 255,
                green: g / 255,
                blue: b / 255,
                alpha: a
            }
        });
    }

    return colors;
});

// Helper function to convert index → LSP position
function positionAt(text, index) {
    const lines = text.slice(0, index).split(/\r?\n/);
    return { line: lines.length - 1, character: lines.at(-1).length };
}

connection.onColorPresentation((params) => {
    const { color } = params;
    const r = Math.round(color.red * 255);
    const g = Math.round(color.green * 255);
    const b = Math.round(color.blue * 255);

    return [
        { label: `[color ${r} ${g} ${b}]` },
        { label: `[color #${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}]` }
    ];
});

documents.listen(connection);
connection.listen();
