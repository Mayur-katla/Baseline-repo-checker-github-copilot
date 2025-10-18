import React from 'react';
import { FiNavigation, FiList, FiCheckCircle, FiInfo } from 'react-icons/fi';

function Pill({ children }) {
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-700 text-gray-200 border border-gray-600 mr-2 mb-2">
      {children}
    </span>
  );
}

function Section({ title, children, icon }) {
  return (
    <div className="bg-gray-800/60 rounded-xl border border-gray-700/60 p-4">
      <div className="flex items-center mb-3">
        <div className="text-indigo-400 mr-2">{icon || <FiList />}</div>
        <h3 className="text-lg font-semibold">{title}</h3>
      </div>
      {children}
    </div>
  );
}

export default function RouterHintsPanel({ hints }) {
  if (!hints) return null;

  const { rankedFrameworks = [], rankedLanguages = [], rankedMl = [], allowFrameworks, allowLanguages, rationale = [] } = hints || {};

  const allowFw = Array.isArray(allowFrameworks)
    ? new Set(allowFrameworks)
    : (allowFrameworks instanceof Set ? allowFrameworks : new Set());
  const allowLang = Array.isArray(allowLanguages)
    ? new Set(allowLanguages)
    : (allowLanguages instanceof Set ? allowLanguages : new Set());

  return (
    <div className="mt-6">
      <div className="flex items-center mb-4">
        <FiNavigation className="text-2xl text-indigo-400 mr-2" />
        <h2 className="text-2xl font-bold">Detector Router Hints</h2>
      </div>
      <p className="text-sm text-gray-300 mb-4">
        AI-informed ranking to prioritize framework/language detectors and speed up analysis.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Section title="Frameworks" icon={<FiList />}> 
          <div className="flex flex-wrap">
            {rankedFrameworks.length === 0 ? (
              <p className="text-gray-400 text-sm">No frameworks detected.</p>
            ) : (
              rankedFrameworks.map(({ name, score }) => (
                <Pill key={`fw-${name}`}>
                  {name} <span className="ml-2 text-xs text-gray-400">score {score}</span>
                  {allowFw.has(name) && <FiCheckCircle className="inline ml-1 text-green-400" title="Allowed" />}
                </Pill>
              ))
            )}
          </div>
        </Section>
        <Section title="Languages" icon={<FiList />}> 
          <div className="flex flex-wrap">
            {rankedLanguages.length === 0 ? (
              <p className="text-gray-400 text-sm">No languages detected.</p>
            ) : (
              rankedLanguages.map(({ name, score }) => (
                <Pill key={`lang-${name}`}>
                  {name} <span className="ml-2 text-xs text-gray-400">score {score}</span>
                  {allowLang.has(name) && <FiCheckCircle className="inline ml-1 text-green-400" title="Allowed" />}
                </Pill>
              ))
            )}
          </div>
        </Section>
        <Section title="ML Libraries" icon={<FiList />}> 
          <div className="flex flex-wrap">
            {rankedMl.length === 0 ? (
              <p className="text-gray-400 text-sm">No ML libraries detected.</p>
            ) : (
              rankedMl.map(({ name, score }) => (
                <Pill key={`ml-${name}`}>
                  {name} <span className="ml-2 text-xs text-gray-400">score {score}</span>
                </Pill>
              ))
            )}
          </div>
        </Section>
      </div>

      {rationale && rationale.length > 0 && (
        <Section title="Rationale" icon={<FiInfo />}> 
          <ul className="list-disc ml-5 text-sm text-gray-300">
            {rationale.map((r, idx) => (
              <li key={`reason-${idx}`}>
                <span className="text-gray-400 mr-2">[{r.label}]</span>{r.detail}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}