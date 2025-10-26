import React from 'react';
import Editor from '@monaco-editor/react';

type CodeViewerProps = {
  code: string;
  language?: string;
  height?: string | number;
  readOnly?: boolean;
};

export default function CodeViewer({ code, language = 'json', height = '40vh', readOnly = true }: CodeViewerProps) {
  const prefersDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = prefersDark ? 'vs-dark' : 'light';

  return (
    <div className="rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden">
      <Editor
        value={code}
        language={language}
        height={typeof height === 'number' ? `${height}px` : height}
        theme={theme}
        options={{
          readOnly,
          fontSize: 13,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          automaticLayout: true,
        }}
      />
    </div>
  );
}
