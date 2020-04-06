import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

const WORD_DIR = "w";

const RE_LINK = /\[([^\]]+)\]\(([^\)]+)\)/g;

class PaliWordDefinitionProvider implements vscode.DefinitionProvider {
  public async provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ) {
    const line_text = document.lineAt(position.line).text;
    const cursor_char = position.character;

    let link_path = "";
    let result;
    while ((result = RE_LINK.exec(line_text)) !== null) {
      let a = result.index;
      let b = a + result[0].length;

      if (a <= cursor_char && cursor_char <= b) {
        link_path = result[2];
      }
    }

    
    if (link_path.length === 0) {
      return;
    }
    link_path = link_path.replace("%20", " ");

    const abs_path = path.join(path.dirname(document.uri.path), link_path);
    let files = [];
    if (fs.existsSync(abs_path)) {
      files.push(vscode.Uri.file(abs_path));
    }
    const p = new vscode.Position(0, 0);
    return files.map((f) => new vscode.Location(f, p));
  }
}

function sanitize_line(text: string) {
  return text
    .replace("ṁ", "ṃ")
    .replace("Ṁ", "Ṃ")
    .replace(/[“ ”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^a-zA-ZāīūṃṅñṭḍṇḷṁĀĪŪṂṄÑṬḌṆḶṀ '-]/g, "")
    .replace(/(\w)'ti\b/g, "$1 'ti")
    .trim();
}

function sanitize_link_word(word: string) {
  return word.toLowerCase().replace(" ", "%20").replace("'", "");
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

      const words = sanitize_line(line_text).split(" ");

      const uri = editor.document.uri;

      const links = words.map((word) => {
        const name = sanitize_link_word(word);
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

  disposable = vscode.commands.registerCommand(
    "extension.toggleLinkFromWordOrSelection",
    () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }

      const folder = path.dirname(editor.document.uri.path);
      const add_word_dir = fs.existsSync(path.join(folder, WORD_DIR));

      let action_taken = false;

      // If the cursor is in a link, replace it with its label.

      const n = editor.selection.active.line;
      const line_text = editor.document.lineAt(n).text;
      const line_range = editor.document.lineAt(n).range;
      const cursor_char = editor.selection.active.character;

      let result;
      while ((result = RE_LINK.exec(line_text)) !== null) {
        let a = result.index;
        let b = a + result[0].length;

        if (a <= cursor_char && cursor_char <= b) {
          action_taken = true;

          const link_range = new vscode.Range(
            line_range.start.translate(0, a),
            line_range.start.translate(0, b)
          );

          const label = result[1];

          editor.edit((edit) => {
            edit.replace(link_range, label);
          });

          break;
        }
      }

      if (action_taken) {
        return;
      }

      let replace_range: vscode.Range;

      if (!editor.selection.isEmpty && editor.selection.isSingleLine) {
        // If there is a selection, use it as the replace range.
        replace_range = new vscode.Range(
          editor.selection.start,
          editor.selection.end
        );
      } else {
        // Otherwise, replace range is the current word.
        const r = editor.document.getWordRangeAtPosition(
          editor.selection.start
        );
        if (typeof r === "undefined") {
          return;
        } else {
          replace_range = r;
        }
      }

      if (replace_range) {
        const w = editor.document.getText(replace_range);
        let link_target = sanitize_link_word(w) + ".md";
        if (add_word_dir) {
          link_target = path.join(WORD_DIR, link_target);
        }
        const link_text = "[" + w + "](" + link_target + ")";

        editor.edit((edit) => {
          edit.replace(replace_range, link_text);
        });
      }
    }
  );

  context.subscriptions.push(disposable);
}

export function deactivate() {}
