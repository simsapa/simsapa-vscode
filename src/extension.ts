import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

const WORD_DIR = "w";

class PaliWordDefinitionProvider implements vscode.DefinitionProvider {
  public async provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ) {
    const line = document.lineAt(position.line).text;
    const m = line.match(/\[[^\]]+\]\(([^\)]+)\)/);
    let link_path = "";
    if (m !== null) {
      link_path = m[1];
    } else {
      return;
    }
    console.log(link_path);

    const abs_path = path.join(path.dirname(document.uri.path), link_path);
    let files = [];
    if (fs.existsSync(abs_path)) {
      files.push(vscode.Uri.file(abs_path));
    }
    const p = new vscode.Position(0, 0);
    return files.map((f) => new vscode.Location(f, p));
  }
}

export function activate(context: vscode.ExtensionContext) {
  const md = { scheme: "file", language: "markdown" };
  context.subscriptions.push(
    vscode.languages.registerDefinitionProvider(
      md,
      new PaliWordDefinitionProvider()
    )
  );

  let disposable = vscode.commands.registerCommand(
    "extension.appendLinkedWordListFromLine",
    () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }

      const n = editor.selection.active.line;
      const line_text = editor.document.lineAt(n).text;
      const line_end = editor.document.lineAt(n).range.end;

      const words = line_text
        .replace("ṁ", "ṃ")
        .replace("Ṁ", "Ṃ")
        .replace(/[“ ”]/g, '"')
        .replace(/[‘’]/g, "'")
        .replace(/[^a-zA-ZāīūṃṅñṭḍṇḷṁĀĪŪṂṄÑṬḌṆḶṀ '-]/g, "")
        .replace(/(\w)'ti\b/g, "$1 'ti")
        .trim()
        .split(" ");

      const uri = editor.document.uri;

      const links = words.map((word) => {
        const name = word.toLowerCase().replace("'", "");
        const link_path = path.join(WORD_DIR, name + ".md");

        const folder = path.dirname(editor.document.uri.path);
        const word_path = path.join(folder, link_path);

        let missing = "";
        if (!fs.existsSync(word_path)) {
          missing = "X ";
        }

        return "- " + missing + "[" + word + "](" + link_path + ")";
      });

      const links_text = links.join("\n");

      editor.edit((edit) => {
        edit.insert(line_end, "\n\n" + links_text + "\n");
      });
    }
  );

  context.subscriptions.push(disposable);
}

export function deactivate() {}
