import { yaml } from "@codemirror/lang-yaml";
import { githubLight } from "@uiw/codemirror-theme-github";
import { tokyoNight } from "@uiw/codemirror-theme-tokyo-night";
import CodeMirror, {
  type Extension,
  type ReactCodeMirrorRef,
} from "@uiw/react-codemirror";
import { EditorView, keymap } from "@codemirror/view";
import { useRef, useState } from "react";
import { BsCodeSquare, BsMoonStars, BsSun } from "react-icons/bs";

import { formatYaml } from "../../../utils/yaml";
import { useEditorTheme } from "./useEditorTheme";

export interface YamlEditorProps {
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  height?: string;
  className?: string;
}

export default function YamlEditor({
  value,
  onChange,
  readOnly = false,
  height = "330px",
  className,
}: YamlEditorProps) {
  const editorRef = useRef<ReactCodeMirrorRef>(null);
  const [isFormatting, setIsFormatting] = useState(false);
  const { theme, toggleTheme } = useEditorTheme();

  // Formats the editor content in-place using the given CodeMirror view.
  // Used by both the toolbar button and the Ctrl+Shift+F keymap binding.
  const formatView = async (view: EditorView) => {
    const currentDoc = view.state.doc.toString();
    setIsFormatting(true);
    const formatted = await formatYaml(currentDoc);
    setIsFormatting(false);
    if (formatted !== currentDoc) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: formatted },
      });
    }
  };

  // Button click handler — reads the ref (allowed in event handlers, not render).
  const handleFormatClick = () => {
    const view = editorRef.current?.view;
    if (view) {
      void formatView(view);
    }
  };

  const codeTheme = theme === "dark" ? tokyoNight : githubLight;

  const extensions: Extension[] = [
    yaml(),
    EditorView.theme({
      "&": {
        fontSize: "12.5px",
        fontFamily: "var(--font-sf-mono)",
      },
      ".cm-gutters": {
        fontSize: "12.5px",
        fontFamily: "var(--font-sf-mono)",
      },
    }),
  ];
  if (!readOnly) {
    extensions.push(
      keymap.of([
        {
          key: "Mod-Shift-f",
          preventDefault: true,
          run: (view) => {
            void formatView(view);
            return true;
          },
        },
      ])
    );
  }

  return (
    <div className={className}>
      <div className="overflow-hidden rounded-sm border border-gray-300">
        <CodeMirror
          ref={editorRef}
          value={value}
          height={height}
          readOnly={readOnly}
          editable={!readOnly}
          theme={codeTheme}
          extensions={extensions}
          onChange={onChange}
          basicSetup={{
            lineNumbers: true,
            foldGutter: true,
            highlightActiveLine: !readOnly,
            bracketMatching: true,
            autocompletion: false,
            searchKeymap: true,
          }}
        />
      </div>
      <div className="mt-2 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={toggleTheme}
          title={
            theme === "dark" ? "Switch to light theme" : "Switch to dark theme"
          }
          className="flex cursor-pointer items-center gap-1 rounded-sm border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
        >
          {theme === "dark" ? <BsSun /> : <BsMoonStars />}
          {theme === "dark" ? "Light" : "Dark"}
        </button>
        {!readOnly && (
          <button
            type="button"
            onClick={handleFormatClick}
            disabled={isFormatting}
            title="Format YAML (Ctrl+Shift+F)"
            className="flex cursor-pointer items-center gap-1 rounded-sm border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <BsCodeSquare />
            {isFormatting ? "Formatting..." : "Format"}
          </button>
        )}
      </div>
    </div>
  );
}
