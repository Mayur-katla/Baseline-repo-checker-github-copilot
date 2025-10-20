{
  "id": "baseline-autopilot-ui-upgrade",
  "version": "2.1.0",
  "objective": "Enhance the Baseline Autopilot Scan Results dashboard to be more intuitive, dynamic, and visually professional while maintaining real-time functionality.",
  "context": {
    "project": "Baseline Autopilot",
    "current_version": "2.0.0",
    "tech_stack": {
      "frontend": "React + Tailwind + shadcn/ui + Framer Motion + Recharts",
      "backend": "Node.js + Express",
      "database": "MongoDB Atlas"
    }
  },
  "upgrade_targets": {
    "frontend": {
      "layout_and_navigation": [
        {
          "feature": "Enhanced Header Context",
          "task": "Display repository name, branch, and scan timestamp inline under header for context.",
          "ui_hint": "‘baseline-autopilot • main • scanned 2m ago’"
        },
        {
          "feature": "Segmented Progress Pipeline",
          "task": "Replace static progress bar with segmented steps: Clone → Analyze → Modernize → Report.",
          "animation": "Add smooth transitions using Framer Motion."
        }
      ],
      "analytics_section": [
        {
          "feature": "Interactive Tooltips",
          "task": "Add hover tooltips for ‘Supported’, ‘Partial’, ‘Unsupported’ metrics with short MDN-style descriptions."
        },
        {
          "feature": "Dynamic Charts",
          "task": "Use stacked bar charts and pie charts to display cross-browser compatibility with clickable filters.",
          "library": "Recharts or Chart.js"
        },
        {
          "feature": "Feature Interactivity",
          "task": "Enable click on a bar to filter or highlight related features in the list below."
        }
      ],
      "data_cards": [
        {
          "feature": "Repository Overview",
          "additions": [
            "Show total repo size, LOC, language breakdown.",
            "Include GitHub metadata: stars, forks, last commit."
          ]
        },
        {
          "feature": "Environment & Versioning",
          "additions": [
            "Detect Node, npm, Yarn, framework versions.",
            "Show warnings if outdated versions are found."
          ]
        },
        {
          "feature": "Feature Detection Categorization",
          "task": "Group detected features by domain: JS APIs, CSS features, HTML attributes."
        },
        {
          "feature": "Architecture Visualization",
          "task": "Render repo structure mini file tree for visual clarity.",
          "optional_lib": "react-folder-tree or custom file-view component."
        }
      ],
      "security_section": [
        {
          "feature": "Collapsible Security Hygiene Section",
          "task": "Use accordion layout for each file path containing issues.",
          "ui_enhancement": "Add severity color badges (Low/Medium/High) using shadcn/ui tags."
        },
        {
          "feature": "Vulnerability Severity Badges",
          "task": "Add CVSS-style severity indicator (Low=🟢, Medium=🟡, High=🔴)."
        }
      ],
      "suggestions_autopilot": [
        {
          "feature": "Categorized Suggestion Tabs",
          "categories": ["Security", "Modernization", "Performance", "Maintenance"],
          "task": "Filter suggestion cards dynamically."
        },
        {
          "feature": "AI Summary Card",
          "task": "Generate one-paragraph summary of scan results using local LLM or templated summary text.",
          "example": "“4 modernization and 2 security issues detected. Estimated modernization impact: +72% Baseline compliance.”"
        },
        {
          "feature": "Impact Heatmap",
          "task": "Visualize per-file modernization impact via gradient bars (0–100%)."
        }
      ],
      "summary_and_exports": [
        {
          "feature": "Summary Log Visualization",
          "task": "Convert log entries into timeline view with timestamps and icons (✅, ⚠️, ❌)."
        },
        {
          "feature": "Expanded Export Options",
          "task": "Add PDF and CSV export beside ZIP and GitHub PR creation.",
          "note": "Leverage jsPDF or json2csv for generation."
        },
        {
          "feature": "Badge Generator",
          "task": "Add shields.io integration for ‘Scanned by Baseline Autopilot’ badge with repo name and score."
        }
      ]
    },
    "backend": {
      "enhancements": [
        {
          "feature": "Compare Scans",
          "task": "Store previous scans in DB; add API to compare two scan reports.",
          "api": {
            "path": "/api/scans/compare/:id1/:id2",
            "response": {
              "newIssues": [],
              "resolvedIssues": [],
              "impactChange": "+15%"
            }
          }
        },
        {
          "feature": "Impact Score Per File",
          "task": "Add backend logic to calculate modernization impact for each file."
        },
        {
          "feature": "Security Severity Mapping",
          "task": "Integrate npm audit JSON results and assign severity categories."
        }
      ]
    }
  },
  "visual_design_enhancements": {
    "theme": {
      "dark_mode": {
        "card_background": "#1E213F",
        "hover_highlight": "#2A2D55",
        "text_primary": "#E6E8FF",
        "text_secondary": "#A1A4D1",
        "accent_primary": "#6366F1"
      },
      "light_mode": {
        "card_background": "#F8FAFC",
        "text_primary": "#111827",
        "accent_primary": "#3B82F6"
      }
    },
    "typography": {
      "heading_weight": "600",
      "subheading_size": "sm",
      "body_size": "base"
    },
    "animations": {
      "page_transition": "fade-in 0.3s ease",
      "card_hover": "lift 0.2s ease-out",
      "chart_entry": "slide-up 0.5s ease"
    },
    "iconography": {
      "supported": "✅",
      "partial": "⚠️",
      "unsupported": "❌"
    }
  },
  "optional_addons": [
    {
      "name": "Offline Mode",
      "description": "Fallback to local Baseline JSON snapshot for fast scans when offline."
    },
    {
      "name": "Live Repo Badge API",
      "description": "Expose an endpoint to return scan status badge JSON for shields.io.",
      "endpoint": "/api/badge/:repo"
    },
    {
      "name": "Scan History Timeline",
      "description": "Visualize past scans chronologically with color-coded impact indicators."
    },
    {
      "name": "AI-Generated PR Template",
      "description": "Auto-create formatted PR message summarizing suggested fixes."
    }
  ],
  "performance_targets": {
    "goal": "Maintain smooth experience with large repos",
    "recommendations": [
      "Virtualize large lists using react-window",
      "Use React.memo for heavy charts",
      "Debounce expensive re-renders",
      "Lazy-load Monaco and chart components"
    ]
  },
  "accessibility_and_feedback": {
    "aria_support": true,
    "keyboard_navigation": true,
    "live_regions": {
      "scan_status": "Announce progress updates",
      "error_toasts": "Announce failures with ARIA alerts"
    },
    "toast_notifications": {
      "on_success": "Scan completed successfully",
      "on_failure": "Scan failed: see logs"
    }
  },
  "expected_outcome": {
    "impact": "Improves judge perception and developer usability by turning a static report into an interactive, professional-grade dashboard.",
    "metrics": [
      "UI polish + consistency",
      "Reduced visual clutter",
      "Improved readability and performance",
      "Clear, data-driven presentation"
    ]
  }
}
