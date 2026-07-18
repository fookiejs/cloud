import { useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { StreamLanguage } from '@codemirror/language';
import { shell } from '@codemirror/legacy-modes/mode/shell';
import { tokyoNightInit } from '@uiw/codemirror-theme-tokyo-night';
import { cn } from '@/lib/utils';

const shellLanguage = StreamLanguage.define(shell);

const editorTheme = tokyoNightInit({
  settings: {
    background: 'transparent',
    gutterBackground: 'transparent',
    lineHighlight: 'rgba(255,255,255,0.04)',
  },
});

interface Props {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function CommandShellEditor(props: Props): React.JSX.Element {
  const extensions = useMemo(() => [shellLanguage], []);

  return (
    <CodeMirror
      value={props.value}
      height="100%"
      theme={editorTheme}
      extensions={extensions}
      onChange={props.onChange}
      className={cn('command-shell-editor h-full text-[13px]', props.className)}
      basicSetup={{
        lineNumbers: true,
        foldGutter: true,
        highlightActiveLine: true,
        bracketMatching: true,
        autocompletion: false,
        tabSize: 2,
      }}
    />
  );
}
