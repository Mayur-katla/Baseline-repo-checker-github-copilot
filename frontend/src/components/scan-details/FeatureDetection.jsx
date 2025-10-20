import React from 'react';
import { FiCpu, FiDatabase, FiLayout, FiTerminal, FiCheckSquare, FiGitMerge, FiCode } from 'react-icons/fi';

// Add pill and domain group components for categorized display
const Pill = ({ text }) => (
  <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-gray-700/50 text-gray-200 text-xs font-mono border border-gray-600/50">{text}</span>
);

const DomainGroup = ({ icon, title, items }) => {
  const list = Array.isArray(items) ? items : [];
  const cap = 50; // cap visible pills to prevent overflow in huge repos
  const visible = list.slice(0, cap);
  return (
    <div className="bg-gray-700/30 p-4 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center">
          <span className="text-indigo-400 mr-2">{icon}</span>
          <span className="text-sm text-gray-400">{title}</span>
        </div>
        <span className="text-xs text-gray-300">{list.length}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {visible.length ? visible.map((f) => <Pill key={f} text={f} />) : <span className="text-xs text-gray-400">None</span>}
      </div>
      {list.length > cap && (
        <div className="mt-2 text-xs text-gray-500">+{list.length - cap} more</div>
      )}
    </div>
  );
};

// Normalize detected features regardless of backend shape
const normalizeDetected = (data) => {
  const raw = (data && data.detectedFeatures) ?? (data && data.features) ?? null;
  let features = [];
  if (Array.isArray(raw)) {
    features = raw
      .map((f) => (typeof f === 'string' ? f : (f && typeof f.name === 'string' ? f.name : null)))
      .filter((f) => typeof f === 'string');
  } else if (raw && typeof raw === 'object') {
    const vals = Object.values(raw);
    const flat = Array.isArray(vals) ? vals.flat() : [];
    features = flat.filter((f) => typeof f === 'string');
  }
  // Ensure uniqueness and stable ordering
  return Array.from(new Set(features)).sort();
};

// Categorize features into JS APIs, CSS features, HTML attributes using simple heuristics
const categorizeFeatures = (features) => {
  const jsApis = [];
  const cssFeatures = [];
  const htmlAttributes = [];

  const isCss = (k) => /^css[-.]/i.test(k);
  const isHtml = (k) => /^(aria-|html-|data-)/i.test(k);

  const KNOWN_JS = new Set([
    'fetch','XMLHttpRequest','dynamic-import','async-await','top-level-await',
    'optional-chaining','nullish-coalescing','class-fields','private-class-fields',
    'promise-allSettled','string-replaceAll','Intl','IntersectionObserver','ResizeObserver',
    'AbortController','ServiceWorker','Worker','SharedWorker','WebSockets','WebGL',
    'WebRTC','WebAudio','IndexedDB','navigator.clipboard','WebShare','CustomElements',
    'ShadowDOM','PointerEvents','BroadcastChannel','crypto.subtle','clipboard-read','clipboard-write',
  ]);

  for (const f of features) {
    const k = String(f);
    if (isCss(k)) {
      cssFeatures.push(k);
    } else if (isHtml(k)) {
      htmlAttributes.push(k);
    } else if (KNOWN_JS.has(k) || k.startsWith('core-js/')) {
      jsApis.push(k);
    } else {
      // Default bucket for unknowns: treat as JS/Web API to ensure visibility
      jsApis.push(k);
    }
  }

  return { jsApis, cssFeatures, htmlAttributes };
};

const FeatureItem = ({ icon, label, value }) => (
  <div className="bg-gray-700/30 p-4 rounded-lg flex items-center">
    <div className="text-indigo-400 mr-4">{icon}</div>
    <div>
      <p className="text-sm text-gray-400">{label}</p>
      <p className="font-semibold text-white">{value}</p>
    </div>
  </div>
);

const FeatureDetection = ({ data }) => {
  if (!data) return null;

  const {
    authentication = [],
    database = [],
    uiFrameworks = [],
    apiLayer = [],
    testingFrameworks = [],
    cicd = [],
  } = data;

  const authSystem = Array.isArray(authentication) ? (authentication.length ? authentication.join(', ') : 'None') : (authentication || 'None');
  const databaseStr = Array.isArray(database) ? (database.length ? database.join(', ') : 'None') : (database || 'None');
  const apiLayerStr = Array.isArray(apiLayer) ? (apiLayer.length ? apiLayer.join(', ') : 'None') : (apiLayer || 'None');

  // Domain-based categorization
  const detectedList = normalizeDetected(data);
  const { jsApis, cssFeatures, htmlAttributes } = categorizeFeatures(detectedList);

  return (
    <div className="bg-gray-800/50 backdrop-blur-md rounded-2xl p-6 border border-gray-700/50 mt-8">
      <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
        <FiCpu className="mr-3 text-indigo-400" />
        Feature Detection
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <FeatureItem icon={<FiCheckSquare />} label="Authentication" value={authSystem} />
        <FeatureItem icon={<FiDatabase />} label="Database" value={databaseStr} />
        <FeatureItem icon={<FiLayout />} label="UI Frameworks" value={uiFrameworks.join(', ') || 'None'} />
        <FeatureItem icon={<FiTerminal />} label="API Layer" value={apiLayerStr} />
        <FeatureItem icon={<FiCheckSquare />} label="Testing" value={testingFrameworks.join(', ') || 'None'} />
        <FeatureItem icon={<FiGitMerge />} label="CI/CD" value={(Array.isArray(cicd) ? (cicd.length ? cicd.join(', ') : 'None') : (cicd || 'None'))} />
      </div>

      <div className="mt-8">
        <h3 className="text-lg font-semibold text-white mb-4">Detected by Domain</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <DomainGroup icon={<FiTerminal />} title="JS APIs" items={jsApis} />
          <DomainGroup icon={<FiLayout />} title="CSS Features" items={cssFeatures} />
          <DomainGroup icon={<FiCode />} title="HTML Attributes" items={htmlAttributes} />
        </div>
      </div>
    </div>
  );
};

export default FeatureDetection;