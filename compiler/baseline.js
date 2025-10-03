import { walk, generate, parse } from 'css-tree';
import { features } from 'web-features';
import { sleep } from './utils.js';

/**
 * Extracts the baseline year from a feature's status data.
 * @param {Object} status - The status object from a web-features entry.
 * @returns {string|null} The baseline year as a string, or null if unavailable.
 */
function getBaselineYear(status) {
    if (!status) return null;
    const dateStr = status.baseline_high_date || status.baseline_low_date;
    return dateStr ? new Date(dateStr).getFullYear().toString() : null;
}

/**
 * Extracts browser compatibility information from a feature's data.
 * @param {Object} featureData - The feature data object from web-features.
 * @returns {Object} An object with browser names and their first supported version.
 */
function getBrowserCompatInfo(featureData) {
    const browserCompat = { chrome: null, firefox: null, safari: null, edge: null };
    if (!featureData?.status?.support) return browserCompat;

    const browserMap = {
        'chrome': 'chrome', 'chrome_android': 'chrome',
        'firefox': 'firefox', 'firefox_android': 'firefox',
        'safari': 'safari', 'safari_ios': 'safari',
        'edge': 'edge'
    };

    for (const [browserKey, version] of Object.entries(featureData.status.support)) {
        const mappedBrowser = browserMap[browserKey];
        if (mappedBrowser && version && typeof version === 'string') {
            const existingVersion = parseFloat(browserCompat[mappedBrowser]);
            const newVersion = parseFloat(version);
            if (!browserCompat[mappedBrowser] || newVersion < existingVersion) {
                browserCompat[mappedBrowser] = version;
            }
        }
    }
    return browserCompat;
}

/**
 * Generates a user-friendly browser compatibility summary string.
 * @param {Object} browserCompat - The browser compatibility object from getBrowserCompatInfo.
 * @returns {string} A summary like "Good browser support".
 */
function getBrowserCompatSummary(browserCompat) {
    if (!browserCompat) return "Unknown browser support";
    const supportedCount = Object.values(browserCompat).filter(Boolean).length;

    if (supportedCount === 0) return "Limited browser support";
    if (supportedCount >= 3) return "Good browser support";
    return "Partial browser support";
}

/**
 * Creates a detailed lookup map for CSS features.
 * This map is crucial for matching syntax from the CSS AST to the baseline data.
 * @param {Object} config - Configuration object for filtering features.
 * @returns {Map<string, Object>} A map where keys are CSS identifiers (properties, functions, etc.)
 * and values are their corresponding feature data.
 */
function createFeatureLookupMap(config) {
    const lookupMap = new Map();

    const getStatusLabel = (baselineStatus) => {
        if (baselineStatus === false) return 'Not Baseline';
        if (baselineStatus === 'low') return 'Low Baseline';
        if (baselineStatus === true || baselineStatus === 'high') return 'High Baseline';
        return null;
    };

    const shouldInclude = (status, featureData) => {
        if (!status) return false;
        if (status === 'Not Baseline' && !config.includeNotBaseline) return false;
        if (status === 'Low Baseline' && !config.includeAvailability.includes('low')) return false;
        if (status === 'High Baseline' && !config.includeAvailability.includes('high')) return false;

        if (config.baselineYearThreshold && featureData.status?.baseline_high_date) {
            const featureYear = new Date(featureData.status.baseline_high_date).getFullYear();
            if (featureYear < config.baselineYearThreshold) return false;
        }
        return true;
    };

    for (const [featureId, data] of Object.entries(features)) {
        const statusLabel = getStatusLabel(data.status?.baseline);
        if (!shouldInclude(statusLabel, data) || !data.compat_features) continue;

        const featureInfo = {
            featureId,
            status: statusLabel,
            description: data.description,
            baselineYear: getBaselineYear(data.status),
            browserCompat: getBrowserCompatInfo(data),
            browserCompatSummary: getBrowserCompatSummary(getBrowserCompatInfo(data)),
        };

        for (const compatKey of data.compat_features) {
            const keyParts = compatKey.split('.');
            if (keyParts.length > 2 && ['properties', 'at-rules', 'selectors', 'types', 'functions'].includes(keyParts[1])) {
                const key = keyParts.slice(2).join('.').toLowerCase();

                // Prioritize flagging less stable features if a key is duplicated
                const existing = lookupMap.get(key);
                if (!existing || existing.status === 'High Baseline' || (existing.status === 'Low Baseline' && statusLabel === 'Not Baseline')) {
                    lookupMap.set(key, { ...featureInfo, compatKey });
                }
            }
        }
    }

    return lookupMap;
}

/**
 * Checks if a status should be included based on the configuration.
 * @param {string} status - The baseline status ('Not Baseline', 'Low Baseline', 'High Baseline').
 * @param {Object} config - Configuration object.
 * @returns {boolean} True if the status should be included in the report.
 */
function shouldIncludeStatus(status, config) {
    if (status === 'Not Baseline' && !config.includeNotBaseline) return false;
    if (status === 'Low Baseline' && !config.includeAvailability.includes('low')) return false;
    if (status === 'High Baseline' && !config.includeAvailability.includes('high')) return false;
    return true;
}

/**
 * Parses the CSS AST to identify usage of features based on the provided configuration.
 * @param {csstree.CssNode} ast - The root AST node from css-tree.
 * @param {Object} config - Configuration object for filtering features.
 * @returns {Array<Object>} A list of CSS rules and the flagged features they contain.
 */
function processCssAst(ast, config = {
    includeAvailability: ['low', 'false'],
    baselineYearThreshold: null,
    includeNotBaseline: true,
    strictness: 'normal'
}) {
    const featureLookupMap = createFeatureLookupMap(config);
    const reportMap = new Map();

    const addIssue = (selector, issue) => {
        if (!shouldIncludeStatus(issue.status, config)) return;
        if (!reportMap.has(selector)) {
            reportMap.set(selector, []);
        }
        const issues = reportMap.get(selector);
        // Avoid adding duplicate issues for the same selector
        if (!issues.some(i => i.featureId === issue.featureId && i.property === issue.property)) {
            issues.push(issue);
        }
    };

    walk(ast, {
        enter: function (node) {
            // --- 1. Process Rules: Check Selectors and Declarations ---
            if (node.type === 'Rule') {
                const selector = generate(node.prelude);

                // Check selectors for pseudo-classes/elements
                walk(node.prelude, (child) => {
                    if (child.type === 'PseudoClassSelector' || child.type === 'PseudoElementSelector') {
                        const name = child.name.toLowerCase();
                        const featureInfo = featureLookupMap.get(name);
                        if (featureInfo) {
                            addIssue(selector, { ...featureInfo, property: `:${child.name}` });
                        }
                    }
                });

                // Check declarations within the rule
                node.block.children.forEach(declaration => {
                    if (declaration.type !== 'Declaration') return;
                    processDeclaration(declaration, selector);
                });
            }
            // --- 2. Process At-Rules: Check the rule itself and its declarations ---
            else if (node.type === 'Atrule') {
                const atRuleName = node.name.toLowerCase();
                const preludeText = node.prelude ? generate(node.prelude).toLowerCase() : '';
                const selector = `@${atRuleName} ${preludeText}`.trim();

                let lookupKey = atRuleName;
                // Special handling for @container to distinguish size vs. style queries
                if (atRuleName === 'container' && (preludeText.includes('style(') || preludeText.includes('--'))) {
                    lookupKey = 'container-style-queries';
                }

                const featureInfo = featureLookupMap.get(lookupKey);
                if (featureInfo) {
                    addIssue(selector, { ...featureInfo, property: `@${atRuleName}` });
                }

                // Check declarations within the at-rule's block, if it exists
                if (node.block) {
                    node.block.children.forEach(declaration => {
                        if (declaration.type !== 'Declaration') return;
                        processDeclaration(declaration, selector);
                    });
                }
            }
        }
    });

    /** Helper to process a single declaration (property and its value) */
    function processDeclaration(declaration, selector) {
        const property = declaration.property.toLowerCase();
        const valueNode = declaration.value;

        // Check the property itself
        const propFeatureInfo = featureLookupMap.get(property);
        if (propFeatureInfo) {
            addIssue(selector, { ...propFeatureInfo, property });
        }

        // Walk through the value to find functions or identifiers (keywords)
        walk(valueNode, (child) => {
            let valueFeatureInfo = null;
            let identifier = null;

            if (child.type === 'Function') {
                identifier = child.name.toLowerCase();
                valueFeatureInfo = featureLookupMap.get(identifier);
                identifier += '()';
            } else if (child.type === 'Identifier') {
                identifier = child.name.toLowerCase();
                valueFeatureInfo = featureLookupMap.get(identifier);
            }

            if (valueFeatureInfo) {
                addIssue(selector, { ...valueFeatureInfo, property: `${property}: ${identifier}` });
            }
        });
    }

    // Format the final report
    return Array.from(reportMap.entries())
        .map(([selector, issues]) => ({ selector, issues }))
        .filter(entry => entry.issues.length > 0);
}

async function getCssCode(browserObject, framework = 'puppeteer') {
    try {
        let stylesheets;
        
        switch (framework) {
            case 'puppeteer':
            case 'playwright':
                stylesheets = await browserObject.evaluate(() => {
                    const sheets = Array.from(document.styleSheets)
                    const urls = []
                    sheets.forEach(s => urls.push(s.href))
                    return urls.filter(e => e)
                });
                break;
                
            case 'selenium':
                stylesheets = await browserObject.executeScript(() => {
                    const sheets = Array.from(document.styleSheets)
                    const urls = []
                    sheets.forEach(s => urls.push(s.href))
                    return urls.filter(e => e)
                });
                break;
        }

        let css = ""
        for (let stylesheet of stylesheets) {
            const content = await fetch(stylesheet, {
                method: "GET"
            }).then(res => res.text())
            css += content + "\n"
        }

        return css;
    } catch (err) {
        console.error(`Error extracting CSS code from webpage: ${err.message}`)
    }
}

async function highlightElements(browserObject, report, framework = 'puppeteer') {
    try {
        const evaluateFunction = framework === 'selenium' ? 'executeScript' : 'evaluate';
        
        // Inject CSS and create hover card (same for all frameworks)
        await browserObject[evaluateFunction](() => {
            // Create and inject CSS for the hover card
            const style = document.createElement('style');
            style.textContent = `
        .baseline-hover-card {
            position: absolute;
            /* Enhanced glassmorphic background with better contrast */
            background: rgba(15, 15, 25, 0.85);
            backdrop-filter: blur(24px) saturate(180%);
            -webkit-backdrop-filter: blur(24px) saturate(180%);
            border: 1px solid rgba(255, 255, 255, 0.18);
            color: #ffffff;
            border-radius: 20px;
            padding: 24px;
            box-shadow: 
                0 20px 40px rgba(0, 0, 0, 0.4),
                0 8px 16px rgba(0, 0, 0, 0.3),
                0 4px 8px rgba(0, 0, 0, 0.2),
                inset 0 1px 0 rgba(255, 255, 255, 0.15),
                inset 0 0 20px rgba(255, 255, 255, 0.02);
            z-index: 10000;
            max-width: 420px;
            max-height: 80vh;
            overflow-y: auto;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, system-ui, sans-serif;
            font-size: 14px;
            line-height: 1.6;
            pointer-events: auto;
            opacity: 0;
            transform: translateY(16px) scale(0.92);
            transition: all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
            /* Better text rendering */
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            text-rendering: optimizeLegibility;
        }

        .baseline-hover-card.visible {
            opacity: 1;
            transform: translateY(0) scale(1);
        }

        .baseline-hover-card h4 {
            margin: 0 0 20px 0;
            font-size: 20px;
            font-weight: 800;
            color: #ffffff;
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
            border-bottom: 2px solid rgba(255, 255, 255, 0.2);
            padding-bottom: 16px;
            background: linear-gradient(135deg, #ffffff 0%, #e8f4ff 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            position: relative;
        }

        .baseline-hover-card h4::after {
            content: '';
            position: absolute;
            bottom: -2px;
            left: 0;
            width: 40px;
            height: 2px;
            background: linear-gradient(90deg, #66aaff, #88ccff);
            border-radius: 1px;
        }

        .baseline-hover-card .issue-item {
            margin-bottom: 18px;
            padding: 18px 20px;
            background: rgba(255, 255, 255, 0.08);
            backdrop-filter: blur(12px);
            border-radius: 16px;
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-left: 5px solid var(--status-color);
            box-shadow: 
                0 4px 12px rgba(0, 0, 0, 0.15),
                0 2px 4px rgba(0, 0, 0, 0.1),
                inset 0 1px 0 rgba(255, 255, 255, 0.08);
            transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
            position: relative;
            overflow: hidden;
        }

        .baseline-hover-card .issue-item::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 1px;
            background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
        }

        .baseline-hover-card .issue-item:hover {
            background: rgba(255, 255, 255, 0.12);
            transform: translateY(-2px);
            box-shadow: 
                0 8px 20px rgba(0, 0, 0, 0.2),
                0 4px 8px rgba(0, 0, 0, 0.15),
                inset 0 1px 0 rgba(255, 255, 255, 0.12);
            border-color: rgba(255, 255, 255, 0.18);
        }

        .baseline-hover-card .issue-item:last-child {
            margin-bottom: 0;
        }

        .baseline-hover-card .property {
            font-weight: 800;
            font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Consolas', monospace;
            color: #ffffff;
            margin-bottom: 10px;
            font-size: 16px;
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
            background: rgba(255, 255, 255, 0.05);
            padding: 6px 12px;
            border-radius: 8px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            display: inline-block;
        }

        .baseline-hover-card .status {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            margin-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
            backdrop-filter: blur(10px);
        }

        .baseline-hover-card .status.not-baseline {
            background: linear-gradient(135deg, #ff4444 0%, #cc3333 100%);
            color: #ffffff;
            box-shadow: 0 2px 8px rgba(255, 68, 68, 0.3);
            display: inline-flex;
            align-items: center;
        }

        .baseline-hover-card .status.not-baseline::before {
            content: '';
            display: inline-block;
            width: 16px;
            height: 16px;
            margin-right: 8px;
            background-image: url('https://web-platform-dx.github.io/web-features/assets/img/baseline-newly-icon.svg');
            background-size: contain;
            background-repeat: no-repeat;
            background-position: center;
            filter: brightness(0) invert(1);
        }

        .baseline-hover-card .status.low-baseline {
            background: linear-gradient(135deg, #ff8800 0%, #cc6600 100%);
            color: #ffffff;
            box-shadow: 0 2px 8px rgba(255, 136, 0, 0.3);
            display: inline-flex;
            align-items: center;
        }

        .baseline-hover-card .status.low-baseline::before {
            content: '';
            display: inline-block;
            width: 16px;
            height: 16px;
            margin-right: 8px;
            background-image: url('https://web-platform-dx.github.io/web-features/assets/img/baseline-limited-icon.svg');
            background-size: contain;
            background-repeat: no-repeat;
            background-position: center;
            filter: brightness(0) invert(1);
        }

        .baseline-hover-card .status.high-baseline {
            background: linear-gradient(135deg, #44aa44 0%, #338833 100%);
            color: #ffffff;
            box-shadow: 0 2px 8px rgba(68, 170, 68, 0.3);
            display: inline-flex;
            align-items: center;
        }

        .baseline-hover-card .status.high-baseline::before {
            content: '';
            display: inline-block;
            width: 16px;
            height: 16px;
            margin-right: 8px;
            background-image: url('https://web-platform-dx.github.io/web-features/assets/img/baseline-widely-icon.svg');
            background-size: contain;
            background-repeat: no-repeat;
            background-position: center;
            filter: brightness(0) invert(1);
        }

        .baseline-hover-card .description {
            color: rgba(255, 255, 255, 0.95);
            font-size: 14px;
            margin-bottom: 12px;
            line-height: 1.5;
            text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
            font-weight: 400;
        }

        .baseline-hover-card .baseline-year {
            color: rgba(255, 255, 255, 0.8);
            font-size: 13px;
            font-style: italic;
            margin-bottom: 8px;
            font-weight: 500;
            text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
        }

        .baseline-hover-card .feature-id {
            color: #88ccff;
            font-size: 13px;
            font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Consolas', monospace;
            background: rgba(136, 204, 255, 0.15);
            padding: 6px 10px;
            border-radius: 8px;
            display: inline-block;
            border: 1px solid rgba(136, 204, 255, 0.3);
            font-weight: 600;
            text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
        }

        .baseline-hover-card .browser-compat {
            margin-top: 12px;
            padding-top: 12px;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .baseline-hover-card .browser-compat h5 {
            margin: 0 0 8px 0;
            font-size: 14px;
            font-weight: 700;
            color: rgba(255, 255, 255, 0.9);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .baseline-hover-card .browser-compat-summary {
            color: rgba(255, 255, 255, 0.8);
            font-size: 13px;
            margin-bottom: 8px;
            font-style: italic;
        }

        .baseline-hover-card .browser-list {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
        }

        .baseline-hover-card .browser-item {
            display: inline-flex;
            align-items: center;
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 8px;
            padding: 4px 8px;
            font-size: 12px;
            font-weight: 600;
            color: rgba(255, 255, 255, 0.9);
        }

        .baseline-hover-card .browser-item.chrome {
            border-color: rgba(66, 133, 244, 0.4);
            background: rgba(66, 133, 244, 0.1);
        }

        .baseline-hover-card .browser-item.firefox {
            border-color: rgba(255, 149, 0, 0.4);
            background: rgba(255, 149, 0, 0.1);
        }

        .baseline-hover-card .browser-item.safari {
            border-color: rgba(0, 122, 255, 0.4);
            background: rgba(0, 122, 255, 0.1);
        }

        .baseline-hover-card .browser-item.edge {
            border-color: rgba(0, 120, 212, 0.4);
            background: rgba(0, 120, 212, 0.1);
        }

        .baseline-hover-card .browser-item::before {
            margin-right: 4px;
        }

        .baseline-hover-card .browser-item.chrome::before {
            content: '🟡';
        }

        .baseline-hover-card .browser-item.firefox::before {
            content: '🟠';
        }

        .baseline-hover-card .browser-item.safari::before {
            content: '🔵';
        }

        .baseline-hover-card .browser-item.edge::before {
            content: '🟦';
        }

        .baseline-hover-card .links-section {
            margin-top: 14px;
            padding-top: 14px;
            border-top: 2px solid rgba(255, 255, 255, 0.12);
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
        }

        .baseline-hover-card .external-link {
            display: inline-flex;
            align-items: center;
            color: #66ff88;
            font-size: 13px;
            font-weight: 600;
            text-decoration: none;
            padding: 8px 12px;
            border-radius: 10px;
            background: rgba(102, 255, 136, 0.15);
            border: 1px solid rgba(102, 255, 136, 0.3);
            transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
            backdrop-filter: blur(8px);
            text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
            flex: 1;
            min-width: 100px;
            justify-content: center;
        }

        .baseline-hover-card .external-link:hover {
            background: rgba(102, 255, 136, 0.25);
            border-color: rgba(102, 255, 136, 0.5);
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(102, 255, 136, 0.3);
            color: #88ffaa;
        }

        .baseline-hover-card .external-link::after {
            content: '↗';
            margin-left: 4px;
            opacity: 0.7;
        }

        [data-baseline-issues] {
            position: relative;
        }

        /* Glassmorphic scrollbar */
        .baseline-hover-card::-webkit-scrollbar {
            width: 6px;
        }

        .baseline-hover-card::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 3px;
        }

        .baseline-hover-card::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.2);
            border-radius: 3px;
            backdrop-filter: blur(10px);
        }

        .baseline-hover-card::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.3);
        }
    `;
            document.head.appendChild(style);

            // Create the hover card element
            const hoverCard = document.createElement('div');
            hoverCard.className = 'baseline-hover-card';
            document.body.appendChild(hoverCard);

            // Helper function to position the hover card
            function positionCard(element, card) {
                const rect = element.getBoundingClientRect();
                const cardRect = card.getBoundingClientRect();

                let left = rect.left + window.scrollX;
                let top = rect.bottom + window.scrollY + 8;

                // Adjust if card would go off screen
                if (left + cardRect.width > window.innerWidth + window.scrollX) {
                    left = window.innerWidth + window.scrollX - cardRect.width - 16;
                }

                if (top + cardRect.height > window.innerHeight + window.scrollY) {
                    top = rect.top + window.scrollY - cardRect.height - 8;
                }

                card.style.left = `${Math.max(8, left)}px`;
                card.style.top = `${Math.max(8, top)}px`;
            }

            // Enhanced card hide/show management
            let hideTimeout = null;

            window.showBaselineCard = function () {
                if (hideTimeout) {
                    clearTimeout(hideTimeout);
                    hideTimeout = null;
                }
                hoverCard.classList.add('visible');
            };

            window.hideBaselineCard = function (delay = 300) {
                if (hideTimeout) {
                    clearTimeout(hideTimeout);
                }
                hideTimeout = setTimeout(() => {
                    hoverCard.classList.remove('visible');
                    hideTimeout = null;
                }, delay);
            };

            // Card hover events to keep it visible
            hoverCard.addEventListener('mouseenter', function () {
                window.showBaselineCard();
            });

            hoverCard.addEventListener('mouseleave', function () {
                window.hideBaselineCard(200);
            });

            // Store the hover card globally for access in event handlers
            window.baselineHoverCard = hoverCard;
            window.positionBaselineCard = positionCard;
            window.currentHoveredElement = null;
        });

        for (const entry of report) {
            // Only process actual selectors for DOM highlighting (skip @at-rules like @layer)
            if (entry.selector.startsWith('@')) continue;

            // Inject styles to highlight elements matching the selector and add hover functionality
            try {
                // For Playwright, wrap multiple arguments in an object
                if (framework === 'playwright') {
                    await browserObject.evaluate(({ selector, issues }) => {
                        const elements = document.querySelectorAll(selector);

                        elements.forEach(el => {
                            // Determine highlight color based on most severe baseline status
                            const statuses = issues.map(issue => issue.status);
                            let highlightColor = '#44aa44'; // High Baseline - green
                            let severity = 'high';
                            
                            if (statuses.includes('Not Baseline')) {
                                highlightColor = '#ff4444'; // Not Baseline - red
                                severity = 'not';
                            } else if (statuses.includes('Low Baseline')) {
                                highlightColor = '#ff8800'; // Low Baseline - orange
                                severity = 'low';
                            }

                            el.style.outline = `3px solid ${highlightColor}`;
                            el.style.cursor = 'help';
                            
                            // Ensure element positioning allows for badge placement
                            const computedPosition = window.getComputedStyle(el).position;
                            if (computedPosition === 'static') {
                                el.style.position = 'relative';
                            }
                            
                            // Remove any existing badge to avoid duplicates
                            const existingBadge = el.querySelector('.baseline-issue-badge');
                            if (existingBadge) {
                                existingBadge.remove();
                            }
                            
                            // Add issue count badge
                            const badge = document.createElement('div');
                            badge.className = 'baseline-issue-badge';
                            badge.textContent = issues.length;
                            badge.style.cssText = `
                                position: absolute;
                                top: -10px;
                                right: -10px;
                                background: ${highlightColor};
                                color: white;
                                border-radius: 50%;
                                width: 22px;
                                height: 22px;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                font-size: 11px;
                                font-weight: bold;
                                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
                                z-index: 9999;
                                border: 2px solid white;
                                animation: pulse-${severity} 2s infinite;
                                pointer-events: none;
                                user-select: none;
                            `;
                            
                            // Add animations for different severities
                            if (!document.getElementById('baseline-badge-animations')) {
                                const animationStyle = document.createElement('style');
                                animationStyle.id = 'baseline-badge-animations';
                                animationStyle.textContent = `
                                    @keyframes pulse-not {
                                        0%, 100% { transform: scale(1); box-shadow: 0 2px 8px rgba(255, 68, 68, 0.4); }
                                        50% { transform: scale(1.15); box-shadow: 0 4px 16px rgba(255, 68, 68, 0.7); }
                                    }
                                    @keyframes pulse-low {
                                        0%, 100% { transform: scale(1); box-shadow: 0 2px 8px rgba(255, 136, 0, 0.4); }
                                        50% { transform: scale(1.1); box-shadow: 0 4px 12px rgba(255, 136, 0, 0.6); }
                                    }
                                    @keyframes pulse-high {
                                        0%, 100% { transform: scale(1); box-shadow: 0 2px 8px rgba(68, 170, 68, 0.4); }
                                        50% { transform: scale(1.05); box-shadow: 0 3px 10px rgba(68, 170, 68, 0.5); }
                                    }
                                `;
                                document.head.appendChild(animationStyle);
                            }
                            
                            el.appendChild(badge);

                            // Store detailed issue data
                            el.setAttribute('data-baseline-issues', JSON.stringify(issues));

                            // Add hover event listeners with improved timing
                            el.addEventListener('mouseenter', function (e) {
                                const hoverCard = window.baselineHoverCard;
                                const issuesData = JSON.parse(this.getAttribute('data-baseline-issues'));

                                // Store current hovered element for the toggle function
                                window.currentHoveredElement = this;

                                // Determine the most severe status for the icon
                                const statuses = issuesData.map(issue => issue.status);
                                let iconUrl = 'https://web-platform-dx.github.io/web-features/assets/img/baseline-widely-icon.svg';
                                let statusText = 'High Baseline';
                                
                                if (statuses.includes('Not Baseline')) {
                                    iconUrl = 'https://web-platform-dx.github.io/web-features/assets/img/baseline-newly-icon.svg';
                                    statusText = 'Not Baseline';
                                } else if (statuses.includes('Low Baseline')) {
                                    iconUrl = 'https://web-platform-dx.github.io/web-features/assets/img/baseline-limited-icon.svg';
                                    statusText = 'Low Baseline';
                                }

                                // Generate hover card content with enhanced contrast
                                let cardContent = `<h4><img src="${iconUrl}" style="width: 20px; height: 20px; margin-right: 8px; vertical-align: middle; filter: brightness(0) invert(1);" alt="Baseline"> ${statusText} Issues (${issuesData.length})</h4>`;

                                issuesData.forEach((issue, index) => {
                                    const statusClass = issue.status.toLowerCase().replace(' ', '-');
                                    const statusColor = issue.status === 'Not Baseline' ? '#ff4444' :
                                        issue.status === 'Low Baseline' ? '#ff8800' : '#44aa44';

                                    // Show full description without truncation
                                    const description = issue.description || '';

                                    // Generate browser compatibility HTML
                                    let browserCompatHtml = '';
                                    if (issue.browserCompat) {
                                        const browserItems = [];
                                        for (const [browser, version] of Object.entries(issue.browserCompat)) {
                                            if (version) {
                                                browserItems.push(`<div class="browser-item ${browser}">${browser.charAt(0).toUpperCase() + browser.slice(1)} ${version}+</div>`);
                                            }
                                        }

                                        if (browserItems.length > 0) {
                                            browserCompatHtml = `
                                            <div class="browser-compat">
                                                <h5>🌐 Browser Support</h5>
                                                ${issue.browserCompatSummary ? `<div class="browser-compat-summary">${issue.browserCompatSummary}</div>` : ''}
                                                <div class="browser-list">
                                                    ${browserItems.join('')}
                                                </div>
                                            </div>
                                        `;
                                        }
                                    }

                                    // Generate better URLs for external links
                                    const propertyName = issue.property.split(':')[0].replace(/^@/, '');
                                    const mdnUrl = `https://developer.mozilla.org/en-US/docs/Web/CSS/${propertyName}`;
                                    const webFeaturesUrl = `https://web-platform-dx.github.io/web-features/${issue.featureId}`;
                                    const canIUseUrl = `https://caniuse.com/?search=${encodeURIComponent(propertyName)}`;

                                    cardContent += `
                            <div class="issue-item" style="--status-color: ${statusColor}">
                                <div class="property">${issue.property}</div>
                                <div class="status ${statusClass}">${issue.status}</div>
                                ${description ? `<div class="description">${description}</div>` : ''}
                                ${issue.baselineYear ? `<div class="baseline-year">📅 Baseline since: ${issue.baselineYear}</div>` : ''}
                                <div class="feature-id">🏷️ Feature: ${issue.featureId}</div>
                                ${browserCompatHtml}
                                <div class="links-section">
                                    <a href="${mdnUrl}" target="_blank" class="external-link">📚 MDN Docs</a>
                                    <a href="${webFeaturesUrl}" target="_blank" class="external-link">🌐 Web Features</a>
                                    <a href="${canIUseUrl}" target="_blank" class="external-link">📊 Can I Use</a>
                                </div>
                            </div>
                        `;
                                });

                                hoverCard.innerHTML = cardContent;
                                window.positionBaselineCard(this, hoverCard);

                                // Show the card with enhanced animation
                                setTimeout(() => {
                                    window.showBaselineCard();
                                }, 50);
                            });

                            el.addEventListener('mouseleave', function () {
                                // Use the new delayed hide function
                                window.hideBaselineCard(800); // 800ms delay before hiding
                            });
                        });
                    }, { selector: entry.selector, issues: entry.issues });
                } else {
                    // For Puppeteer and Selenium, use the original approach with multiple arguments
                    await browserObject[evaluateFunction]((sel, issues) => {
                        const elements = document.querySelectorAll(sel);

                        elements.forEach(el => {
                            // Determine highlight color based on most severe baseline status
                            const statuses = issues.map(issue => issue.status);
                            let highlightColor = '#44aa44'; // High Baseline - green
                            let severity = 'high';
                            
                            if (statuses.includes('Not Baseline')) {
                                highlightColor = '#ff4444'; // Not Baseline - red
                                severity = 'not';
                            } else if (statuses.includes('Low Baseline')) {
                                highlightColor = '#ff8800'; // Low Baseline - orange
                                severity = 'low';
                            }

                            el.style.outline = `3px solid ${highlightColor}`;
                            el.style.cursor = 'help';
                            
                            // Ensure element positioning allows for badge placement
                            const computedPosition = window.getComputedStyle(el).position;
                            if (computedPosition === 'static') {
                                el.style.position = 'relative';
                            }
                            
                            // Remove any existing badge to avoid duplicates
                            const existingBadge = el.querySelector('.baseline-issue-badge');
                            if (existingBadge) {
                                existingBadge.remove();
                            }
                            
                            // Add issue count badge
                            const badge = document.createElement('div');
                            badge.className = 'baseline-issue-badge';
                            badge.textContent = issues.length;
                            badge.style.cssText = `
                                position: absolute;
                                top: -10px;
                                right: -10px;
                                background: ${highlightColor};
                                color: white;
                                border-radius: 50%;
                                width: 22px;
                                height: 22px;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                font-size: 11px;
                                font-weight: bold;
                                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
                                z-index: 9999;
                                border: 2px solid white;
                                animation: pulse-${severity} 2s infinite;
                                pointer-events: none;
                                user-select: none;
                            `;
                            
                            // Add animations for different severities
                            if (!document.getElementById('baseline-badge-animations')) {
                                const animationStyle = document.createElement('style');
                                animationStyle.id = 'baseline-badge-animations';
                                animationStyle.textContent = `
                                    @keyframes pulse-not {
                                        0%, 100% { transform: scale(1); box-shadow: 0 2px 8px rgba(255, 68, 68, 0.4); }
                                        50% { transform: scale(1.15); box-shadow: 0 4px 16px rgba(255, 68, 68, 0.7); }
                                    }
                                    @keyframes pulse-low {
                                        0%, 100% { transform: scale(1); box-shadow: 0 2px 8px rgba(255, 136, 0, 0.4); }
                                        50% { transform: scale(1.1); box-shadow: 0 4px 12px rgba(255, 136, 0, 0.6); }
                                    }
                                    @keyframes pulse-high {
                                        0%, 100% { transform: scale(1); box-shadow: 0 2px 8px rgba(68, 170, 68, 0.4); }
                                        50% { transform: scale(1.05); box-shadow: 0 3px 10px rgba(68, 170, 68, 0.5); }
                                    }
                                `;
                                document.head.appendChild(animationStyle);
                            }
                            
                            el.appendChild(badge);

                            // Store detailed issue data
                            el.setAttribute('data-baseline-issues', JSON.stringify(issues));

                            // Add hover event listeners with improved timing
                            el.addEventListener('mouseenter', function (e) {
                                const hoverCard = window.baselineHoverCard;
                                const issuesData = JSON.parse(this.getAttribute('data-baseline-issues'));

                                // Store current hovered element for the toggle function
                                window.currentHoveredElement = this;

                                // Determine the most severe status for the icon
                                const statuses = issuesData.map(issue => issue.status);
                                let iconUrl = 'https://web-platform-dx.github.io/web-features/assets/img/baseline-widely-icon.svg';
                                let statusText = 'High Baseline';
                                
                                if (statuses.includes('Not Baseline')) {
                                    iconUrl = 'https://web-platform-dx.github.io/web-features/assets/img/baseline-newly-icon.svg';
                                    statusText = 'Not Baseline';
                                } else if (statuses.includes('Low Baseline')) {
                                    iconUrl = 'https://web-platform-dx.github.io/web-features/assets/img/baseline-limited-icon.svg';
                                    statusText = 'Low Baseline';
                                }

                                // Generate hover card content with enhanced contrast
                                let cardContent = `<h4><img src="${iconUrl}" style="width: 20px; height: 20px; margin-right: 8px; vertical-align: middle; filter: brightness(0) invert(1);" alt="Baseline"> ${statusText} Issues (${issuesData.length})</h4>`;

                                issuesData.forEach((issue, index) => {
                                    const statusClass = issue.status.toLowerCase().replace(' ', '-');
                                    const statusColor = issue.status === 'Not Baseline' ? '#ff4444' :
                                        issue.status === 'Low Baseline' ? '#ff8800' : '#44aa44';

                                    // Show full description without truncation
                                    const description = issue.description || '';

                                    // Generate browser compatibility HTML
                                    let browserCompatHtml = '';
                                    if (issue.browserCompat) {
                                        const browserItems = [];
                                        for (const [browser, version] of Object.entries(issue.browserCompat)) {
                                            if (version) {
                                                browserItems.push(`<div class="browser-item ${browser}">${browser.charAt(0).toUpperCase() + browser.slice(1)} ${version}+</div>`);
                                            }
                                        }

                                        if (browserItems.length > 0) {
                                            browserCompatHtml = `
                                            <div class="browser-compat">
                                                <h5>🌐 Browser Support</h5>
                                                ${issue.browserCompatSummary ? `<div class="browser-compat-summary">${issue.browserCompatSummary}</div>` : ''}
                                                <div class="browser-list">
                                                    ${browserItems.join('')}
                                                </div>
                                            </div>
                                        `;
                                        }
                                    }

                                    // Generate better URLs for external links
                                    const propertyName = issue.property.split(':')[0].replace(/^@/, '');
                                    const mdnUrl = `https://developer.mozilla.org/en-US/docs/Web/CSS/${propertyName}`;
                                    const webFeaturesUrl = `https://web-platform-dx.github.io/web-features/${issue.featureId}`;
                                    const canIUseUrl = `https://caniuse.com/?search=${encodeURIComponent(propertyName)}`;

                                    cardContent += `
                            <div class="issue-item" style="--status-color: ${statusColor}">
                                <div class="property">${issue.property}</div>
                                <div class="status ${statusClass}">${issue.status}</div>
                                ${description ? `<div class="description">${description}</div>` : ''}
                                ${issue.baselineYear ? `<div class="baseline-year">📅 Baseline since: ${issue.baselineYear}</div>` : ''}
                                <div class="feature-id">🏷️ Feature: ${issue.featureId}</div>
                                ${browserCompatHtml}
                                <div class="links-section">
                                    <a href="${mdnUrl}" target="_blank" class="external-link">📚 MDN Docs</a>
                                    <a href="${webFeaturesUrl}" target="_blank" class="external-link">🌐 Web Features</a>
                                    <a href="${canIUseUrl}" target="_blank" class="external-link">📊 Can I Use</a>
                                </div>
                            </div>
                        `;
                                });

                                hoverCard.innerHTML = cardContent;
                                window.positionBaselineCard(this, hoverCard);

                                // Show the card with enhanced animation
                                setTimeout(() => {
                                    window.showBaselineCard();
                                }, 50);
                            });

                            el.addEventListener('mouseleave', function () {
                                // Use the new delayed hide function
                                window.hideBaselineCard(800); // 800ms delay before hiding
                            });
                        });
                    }, entry.selector, entry.issues);
                }
            } catch (err) {
                console.error(`Error querying selector (${entry.selector}): ${err.message}`)
                console.info("continuing...")
                continue;
            }
        }
    } catch (err) {
        console.error(`Error highlighting elements on page: ${err.message}`)
    }
}

/**
 * Prints a beautified baseline analysis report to the console
 * @param {Array} report - The baseline analysis report array
 * @param {Object} config - The configuration object used for analysis
 */
function printBeautifiedReport(report, config) {
    console.log('\n' + '='.repeat(80));
    console.log('🎯 BASELINE ANALYSIS REPORT');
    console.log('='.repeat(80));

    // Print configuration summary
    console.log('\n📋 Configuration:');
    console.log(`   Include Availability: ${config.includeAvailability.join(', ')}`);
    console.log(`   Baseline Year Threshold: ${config.baselineYearThreshold || 'None'}`);
    console.log(`   Include Not Baseline: ${config.includeNotBaseline}`);
    console.log(`   Strictness: ${config.strictness || 'normal'}`);

    // Group issues by status
    const statusGroups = {
        'Not Baseline': [],
        'Low Baseline': [],
        'High Baseline': []
    };

    let totalIssues = 0;
    report.forEach(entry => {
        entry.issues.forEach(issue => {
            statusGroups[issue.status].push({
                selector: entry.selector,
                ...issue
            });
            totalIssues++;
        });
    });

    // Print summary
    console.log('\n📊 Summary:');
    console.log(`   Total Selectors Analyzed: ${report.length}`);
    console.log(`   Total Issues Found: ${totalIssues}`);
    console.log(`   🔴 Not Baseline: ${statusGroups['Not Baseline'].length}`);
    console.log(`   🟡 Low Baseline: ${statusGroups['Low Baseline'].length}`);
    console.log(`   🟢 High Baseline: ${statusGroups['High Baseline'].length}`);

    // Print detailed issues by status
    Object.entries(statusGroups).forEach(([status, issues]) => {
        if (issues.length === 0) return;

        const icon = status === 'Not Baseline' ? '🔴' : status === 'Low Baseline' ? '🟡' : '🟢';
        console.log('\n' + '-'.repeat(60));
        console.log(`${icon} ${status.toUpperCase()} (${issues.length} issues)`);
        console.log('-'.repeat(60));

        // Group by feature for better readability
        const featureGroups = {};
        issues.forEach(issue => {
            if (!featureGroups[issue.featureId]) {
                featureGroups[issue.featureId] = [];
            }
            featureGroups[issue.featureId].push(issue);
        });

        Object.entries(featureGroups).forEach(([featureId, featureIssues], index) => {
            const firstIssue = featureIssues[0];
            console.log(`\n${index + 1}. 🏷️  Feature: ${featureId}`);

            if (firstIssue.description) {
                // Wrap description at 70 characters
                const wrappedDesc = firstIssue.description.match(/.{1,70}(\s|$)/g) || [firstIssue.description];
                console.log(`   📝 ${wrappedDesc[0].trim()}`);
                wrappedDesc.slice(1).forEach(line => {
                    console.log(`      ${line.trim()}`);
                });
            }

            if (firstIssue.baselineYear) {
                console.log(`   📅 Baseline since: ${firstIssue.baselineYear}`);
            }

            if (firstIssue.browserCompatSummary) {
                console.log(`   🌐 Browser support: ${firstIssue.browserCompatSummary}`);
            }

            // Display detailed browser compatibility information
            if (firstIssue.browserCompat) {
                const browserSupport = [];
                Object.entries(firstIssue.browserCompat).forEach(([browser, version]) => {
                    if (version) {
                        const browserIcon = {
                            chrome: '🟡',
                            firefox: '🟠', 
                            safari: '🔵',
                            edge: '🟦'
                        }[browser] || '🌐';
                        browserSupport.push(`${browserIcon} ${browser.charAt(0).toUpperCase() + browser.slice(1)} ${version}+`);
                    }
                });
                if (browserSupport.length > 0) {
                    console.log(`   🌐 Browser versions: ${browserSupport.join(', ')}`);
                }
            }

            // Display reference links
            const propertyName = firstIssue.property.split(':')[0].replace(/^@/, '');
            console.log(`   🔗 References:`);
            console.log(`      📚 MDN: https://developer.mozilla.org/en-US/docs/Web/CSS/${propertyName}`);
            console.log(`      🌐 Web Features: https://web-platform-dx.github.io/web-features/${featureId}`);
            console.log(`      📊 Can I Use: https://caniuse.com/?search=${encodeURIComponent(propertyName)}`);

            console.log(`   📍 Found in ${featureIssues.length} selector(s):`);

            // Group by selector to avoid repetition
            const selectorGroups = {};
            featureIssues.forEach(issue => {
                if (!selectorGroups[issue.selector]) {
                    selectorGroups[issue.selector] = [];
                }
                selectorGroups[issue.selector].push(issue.property);
            });

            Object.entries(selectorGroups).forEach(([selector, properties]) => {
                // Truncate very long selectors
                const displaySelector = selector.length > 50 ?
                    selector.substring(0, 47) + '...' : selector;
                console.log(`      • ${displaySelector}`);
                console.log(`        Properties: ${properties.join(', ')}`);
            });
        });
    });

    // Print recommendations
    console.log('\n' + '='.repeat(80));
    console.log('💡 RECOMMENDATIONS');
    console.log('='.repeat(80));

    if (statusGroups['Not Baseline'].length > 0) {
        console.log('\n🔴 Not Baseline Issues:');
        console.log('   • Consider providing fallbacks for older browsers');
        console.log('   • Test thoroughly on target browser versions');
        console.log('   • Monitor browser support status changes');
    }

    if (statusGroups['Low Baseline'].length > 0) {
        console.log('\n🟡 Low Baseline Issues:');
        console.log('   • These features are recently added to baseline');
        console.log('   • Safe to use but may need fallbacks for older browsers');
        console.log('   • Consider progressive enhancement approach');
    }

    if (statusGroups['High Baseline'].length > 0) {
        console.log('\n🟢 High Baseline Features:');
        console.log('   • These features are widely supported');
        console.log('   • Generally safe to use without fallbacks');
        console.log('   • Good foundation for modern web development');
    }

    console.log('\n📚 Resources:');
    console.log('   • MDN Web Docs: https://developer.mozilla.org/');
    console.log('   • Can I Use: https://caniuse.com/');
    console.log('   • Web Features: https://web-platform-dx.github.io/web-features/');
    console.log('   • Baseline: https://web.dev/baseline/');

    console.log('\n' + '='.repeat(80));
    console.log('✨ Analysis Complete!');
    console.log('='.repeat(80) + '\n');
}

async function baselineScanPipeline(browserObject, config, framework = 'puppeteer') {
    try {
        const css = await getCssCode(browserObject, framework)
        const ast = parse(css)

        const report = processCssAst(ast, config)
        printBeautifiedReport(report, config)
        await highlightElements(browserObject, report, framework)
        await sleep(config.delay || "1m")
    } catch (err) {
        console.error(`Error performing baseline_scan: ${err.message}`)
    }
}

export {
    baselineScanPipeline
}