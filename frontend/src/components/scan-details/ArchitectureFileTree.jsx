import React, { useMemo, useState } from 'react';
// import { FiFolder, FiFolderOpen, FiFile, FiChevronRight, FiChevronDown } from 'react-icons/fi';
import { FiFolder, FiFile, FiChevronRight, FiChevronDown } from 'react-icons/fi';

const TreeNode = ({ node, pathAcc, expanded, toggle, configSet, depth = 0, maxChildren = 50 }) => {
  const isDir = node.type === 'dir';
  const pathKey = pathAcc ? `${pathAcc}/${node.name}` : node.name;
  const isExpanded = !!expanded[pathKey];
  const children = Array.isArray(node.children) ? node.children.slice(0, maxChildren) : [];

  return (
    <div className="ml-2">
      <div
        className={`flex items-center cursor-pointer py-1 ${isDir ? 'hover:text-indigo-300' : ''}`}
        onClick={() => isDir && toggle(pathKey)}
      >
        {isDir ? (
          <span className="text-indigo-400 mr-1">{isExpanded ? <FiChevronDown /> : <FiChevronRight />}</span>
        ) : (
          <span className="mr-1" />
        )}
        <span className={`mr-2 ${isDir ? 'text-yellow-300' : configSet.has(node.name) ? 'text-green-300' : 'text-gray-300'}`}>
          {isDir ? <FiFolder /> : <FiFile />}
        </span>
        <span className={`text-sm ${configSet.has(node.name) && !isDir ? 'font-semibold text-green-300' : 'text-white'}`}>{node.name}</span>
      </div>
      {isDir && isExpanded && children.length > 0 && (
        <div className="ml-4 border-l border-gray-700 pl-2">
          {children.map((child, idx) => (
            <TreeNode
              key={`${pathKey}:${idx}:${child.name}`}
              node={child}
              pathAcc={pathKey}
              expanded={expanded}
              toggle={toggle}
              configSet={configSet}
              depth={depth + 1}
              maxChildren={maxChildren}
            />
          ))}
          {Array.isArray(node.children) && node.children.length > maxChildren && (
            <div className="text-xs text-gray-400 ml-6">+{node.children.length - maxChildren} more</div>
          )}
        </div>
      )}
    </div>
  );
};

const ArchitectureFileTree = ({ data }) => {
  const tree = data?.fileTree;
  const configFiles = Array.isArray(data?.configFiles) ? data.configFiles : [];
  const configSet = useMemo(() => new Set(configFiles), [configFiles]);

  const [expanded, setExpanded] = useState(() => ({}));
  const toggle = (key) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  if (!tree || !Array.isArray(tree.children)) {
    return (
      <div className="bg-gray-800/50 backdrop-blur-md rounded-2xl p-6 border border-gray-700/50 mt-6">
        <h2 className="text-xl font-semibold text-white mb-4">Repo File Structure</h2>
        <p className="text-sm text-gray-400">File tree data is not available. Run a scan to populate repository structure.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 backdrop-blur-md rounded-2xl p-6 border border-gray-700/50 mt-6">
      <h2 className="text-xl font-semibold text-white mb-4">Repo File Structure</h2>
      <div className="text-xs text-gray-400 mb-2">Top-level directories with expand/collapse (limited depth)</div>
      <div className="text-sm">
        {tree.children.map((child, idx) => (
          <TreeNode
            key={`root:${idx}:${child.name}`}
            node={child}
            pathAcc={tree.name || ''}
            expanded={expanded}
            toggle={toggle}
            configSet={configSet}
          />
        ))}
      </div>
    </div>
  );
};

export default ArchitectureFileTree;