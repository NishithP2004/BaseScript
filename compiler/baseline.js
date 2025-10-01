import { walk, generate, parse } from 'css-tree';
import { features } from 'web-features';
import { sleep } from './utils.js';

/**
 * Extracts the baseline year from feature status data
 * @param {Object} status - The status object from web-features
 * @returns {string|null} - The baseline year or null if not available
 */
function getBaselineYear(status) {
    if (!status) return null;

    // Try high baseline date first, then low baseline date
    const dateStr = status.baseline_high_date || status.baseline_low_date;
    if (dateStr) {
        return new Date(dateStr).getFullYear().toString();
    }

    return null;
}

/**
 * Extracts browser compatibility information from feature data
 * @param {Object} featureData - The feature data from web-features
 * @returns {Object} - Browser compatibility information
 */
function getBrowserCompatInfo(featureData) {
    const browserCompat = {
        chrome: null,
        firefox: null,
        safari: null,
        edge: null
    };

    if (!featureData || !featureData.status || !featureData.status.support) return browserCompat;

    const support = featureData.status.support;

    // Map web-features browser names to our display names
    const browserMap = {
        'chrome': 'chrome',
        'chrome_android': 'chrome',
        'firefox': 'firefox',
        'firefox_android': 'firefox',
        'safari': 'safari',
        'safari_ios': 'safari',
        'edge': 'edge'
    };

    for (const [browserKey, version] of Object.entries(support)) {
        const mappedBrowser = browserMap[browserKey];
        if (mappedBrowser && version && typeof version === 'string') {
            // Take the earliest version if we have multiple entries for the same browser
            if (!browserCompat[mappedBrowser] || parseFloat(version) < parseFloat(browserCompat[mappedBrowser])) {
                browserCompat[mappedBrowser] = version;
            }
        }
    }

    return browserCompat;
}

/**
 * Gets a user-friendly browser compatibility summary
 * @param {Object} browserCompat - Browser compatibility object
 * @returns {string} - Human readable compatibility summary
 */
function getBrowserCompatSummary(browserCompat) {
    if (!browserCompat) return "Unknown browser support";

    const supported = [];

    for (const [browser, version] of Object.entries(browserCompat)) {
        if (version) {
            supported.push(`${browser.charAt(0).toUpperCase() + browser.slice(1)} ${version}+`);
        }
    }

    if (supported.length === 0) {
        return "Limited browser support";
    } else if (supported.length >= 3) {
        return "Good browser support";
    } else {
        return "Partial browser support";
    }
}

/**
 * Creates a detailed lookup map for CSS properties, values, and at-rules.
 * This is crucial for matching the syntax found in the CSS AST to the baseline data.
 * @param {Object} config - Configuration object for filtering features
 */
function createFeatureLookupMap(config) {
    const lookupMap = new Map();
    const specificLookupMap = new Map(); // For more specific lookups

    for (const [featureId, data] of Object.entries(features)) {
        if (!data.compat_features) continue;

        const baselineStatus = data.status?.baseline;
        // Include all baseline statuses for more comprehensive mapping
        let statusLabel;
        if (baselineStatus === false) {
            statusLabel = 'Not Baseline';
        } else if (baselineStatus === 'low') {
            statusLabel = 'Low Baseline';
        } else if (baselineStatus === true || baselineStatus === 'high') {
            statusLabel = 'High Baseline';
        } else {
            continue; // Skip if no clear baseline status
        }

        // Check if this feature should be included based on configuration
        if (!shouldIncludeFeature(data, statusLabel, config)) {
            continue;
        }

        for (const compatKey of data.compat_features) {
            // Store the full key for precision
            const dataBrowserCompat = getBrowserCompatInfo(data || {});
            specificLookupMap.set(compatKey.toLowerCase(), {
                featureId,
                status: statusLabel,
                description: data.description,
                baselineYear: getBaselineYear(data.status),
                browserCompat: dataBrowserCompat,
                browserCompatSummary: getBrowserCompatSummary(dataBrowserCompat),
                compatKey
            });

            let key = null;

            // More precise mapping based on the type of feature
            if (compatKey.startsWith('css.properties.') || compatKey.startsWith('css.at-rules.') || compatKey.startsWith('css.selectors.') || compatKey.startsWith('css.types.')) {
                // Extract property name (e.g., 'css.properties.margin-block' -> 'margin-block')
                key = compatKey.split('.')[2];
            }

            if (key) {
                const normalizedKey = key.toLowerCase();

                // Skip mapping for basic properties that are universally supported
                const basicProperties = [
                    'top', 'right', 'bottom', 'left', 'margin', 'padding', 'width', 'height',
                    'color', 'background', 'border', 'font-family', 'display', 'position',
                    'float', 'text-align', 'overflow', 'cursor', 'content', 'align-items',
                    'justify-content', 'flex-direction', 'align-content', 'transition',
                    'animation', 'outline', 'resize', 'min-width', 'max-width',
                    'min-height', 'max-height', 'align-self', 'clip-path'
                ];

                // Only map if it's not a basic property or if it's specifically a problematic feature
                const isSpecificFeature = featureId.includes('anchor') || featureId.includes('ui') ||
                    featureId.includes('container') || featureId.includes('popover') ||
                    featureId.includes('layer') || featureId.includes('view-timeline');

                if (!basicProperties.includes(normalizedKey) || isSpecificFeature) {
                    // Only override if we don't have a mapping or this is more specific
                    if (!lookupMap.has(normalizedKey) || statusLabel === 'Not Baseline' || statusLabel === 'Low Baseline') {
                        const keyBrowserCompat = getBrowserCompatInfo(data || {});
                        lookupMap.set(normalizedKey, {
                            featureId,
                            status: statusLabel,
                            description: data.description,
                            baselineYear: getBaselineYear(data.status),
                            browserCompat: keyBrowserCompat,
                            browserCompatSummary: getBrowserCompatSummary(keyBrowserCompat),
                            compatKey
                        });
                    }
                }
            }
        }
    }

    // Add specific mappings for common issues
    const specificMappings = {
        'backdrop': 'backdrop', // ::backdrop selector
        'clamp': 'min-max-clamp', // clamp() function
        'oklch': 'oklab', // oklch() color function
        'oklab': 'oklab', // oklab() color function
        'container': 'container-queries', // @container rule for size queries
        'anchor': 'anchor-positioning', // anchor() function
        'popover': 'popover', // popover attribute/functionality
        'layer': 'cascade-layers' // @layer at-rule
    };

    for (const [key, featureId] of Object.entries(specificMappings)) {
        if (features[featureId]) {
            const data = features[featureId];
            const baselineStatus = data.status?.baseline;
            let statusLabel;
            if (baselineStatus === false) {
                statusLabel = 'Not Baseline';
            } else if (baselineStatus === 'low') {
                statusLabel = 'Low Baseline';
            } else if (baselineStatus === true || baselineStatus === 'high') {
                statusLabel = 'High Baseline';
            }

            if (statusLabel) {
                const manualBrowserCompat = getBrowserCompatInfo(data || {});
                lookupMap.set(key.toLowerCase(), {
                    featureId,
                    status: statusLabel,
                    description: data.description,
                    baselineYear: getBaselineYear(data.status),
                    browserCompat: manualBrowserCompat,
                    browserCompatSummary: getBrowserCompatSummary(manualBrowserCompat),
                    compatKey: `manual-${key}`
                });
            }
        }
    }

    return { lookupMap, specificLookupMap };
}

/**
 * Checks if a feature should be included based on baseline configuration
 * @param {Object} featureData - The feature data from web-features
 * @param {string} status - The baseline status ('Not Baseline', 'Low Baseline', 'High Baseline')
 * @param {Object} config - Configuration object
 * @returns {boolean} - Whether to include this feature
 */
function shouldIncludeFeature(featureData, status, config) {

    // Check availability level
    if (status === 'Not Baseline' && !config.includeNotBaseline) {
        return false;
    }

    if (status === 'Low Baseline' && !config.includeAvailability.includes('low')) {
        return false;
    }

    if (status === 'High Baseline' && !config.includeAvailability.includes('high')) {
        return false;
    }

    // Check baseline year if threshold is set
    if (config.baselineYearThreshold && featureData.status?.baseline_high_date) {
        const baselineDate = new Date(featureData.status.baseline_high_date);
        const thresholdDate = new Date(config.baselineYearThreshold, 0, 1);

        // Only include if the feature became baseline after the threshold
        if (baselineDate < thresholdDate) {
            return false;
        }
    }

    return true;
}

/**
 * Simple helper to check if a status should be included based on config
 * @param {string} status - The baseline status
 * @param {Object} config - Configuration object
 * @returns {boolean} - Whether to include this status
 */
function shouldIncludeStatus(status, config) {
    if (status === 'Not Baseline' && !config.includeNotBaseline) {
        return false;
    }
    if (status === 'Low Baseline' && !config.includeAvailability.includes('low')) {
        return false;
    }
    if (status === 'High Baseline' && !config.includeAvailability.includes('high')) {
        return false;
    }
    return true;
}



/**
 * Parses the CSS AST and identifies rules and declarations using non-baseline features.
 * 
 * @param {csstree.CssNode} ast - The root AST node from css-tree.
 * @param {Object} config - Configuration object for filtering features
 * @param {Array<string>} config.includeAvailability - Availability levels to include ('low', 'high', 'false')
 * @param {number|null} config.baselineYearThreshold - Year threshold for baseline features
 * @param {boolean} config.includeNotBaseline - Whether to include not-baseline features
 * @returns {Array<{selector: string, issues: Array<{property: string, status: string, featureId: string}>}>} 
 *          A list of CSS rules and the non-baseline issues they contain.
 */
function processCssAst(ast, config = {
    includeAvailability: ['low', 'false'],
    baselineYearThreshold: null,
    includeNotBaseline: true,
    strictness: 'normal' // 'strict', 'normal', 'relaxed'
}) {
    const { lookupMap: featureLookupMap, specificLookupMap } = createFeatureLookupMap(config);
    const reportMap = new Map();

    walk(ast, function (node) {
        // --- 1. Capture the Selector for the current Rule or At-Rule ---
        let selector = null;
        let declarations = null;

        if (node.type === 'Rule') {
            selector = node.prelude ? generate(node.prelude) : 'unknown';
            declarations = node.block?.children;

            // Check the Selector itself for non-baseline pseudos like :has(), :is(), ::backdrop
            const selectorNode = node.prelude;
            walk(selectorNode, function (selectorChild) {
                if (selectorChild.type === 'PseudoClassSelector' || selectorChild.type === 'PseudoElementSelector') {
                    const name = selectorChild.name.toLowerCase();
                    let featureInfo = featureLookupMap.get(name);

                    // Special handling for specific pseudo selectors
                    if (name === 'backdrop') {
                        const backdropFeature = features['backdrop'];
                        const backdropBrowserCompat = getBrowserCompatInfo(backdropFeature || {});
                        featureInfo = {
                            featureId: 'backdrop',
                            status: 'High Baseline',
                            description: backdropFeature?.description || 'The ::backdrop pseudo-element',
                            baselineYear: getBaselineYear(backdropFeature?.status),
                            browserCompat: backdropBrowserCompat,
                            browserCompatSummary: getBrowserCompatSummary(backdropBrowserCompat)
                        };
                    } else if (name === 'has') {
                        const hasFeature = features['has'];
                        const hasBrowserCompat = getBrowserCompatInfo(hasFeature || {});
                        featureInfo = {
                            featureId: 'has',
                            status: 'Low Baseline',
                            description: hasFeature?.description || 'The :has() pseudo-class',
                            baselineYear: getBaselineYear(hasFeature?.status),
                            browserCompat: hasBrowserCompat,
                            browserCompatSummary: getBrowserCompatSummary(hasBrowserCompat)
                        };
                    } else if (name === 'is' || name === 'where') {
                        const isWhereFeature = features['is-where-selectors'];
                        const isWhereBrowserCompat = getBrowserCompatInfo(isWhereFeature || {});
                        featureInfo = {
                            featureId: 'is-where-selectors',
                            status: 'High Baseline',
                            description: isWhereFeature?.description || 'The :is() and :where() pseudo-classes',
                            baselineYear: getBaselineYear(isWhereFeature?.status),
                            browserCompat: isWhereBrowserCompat,
                            browserCompatSummary: getBrowserCompatSummary(isWhereBrowserCompat)
                        };
                    }

                    // Check if feature should be included based on configuration
                    if (featureInfo && shouldIncludeStatus(featureInfo.status, config)) {
                        const selectorText = selectorNode ? generate(selectorNode) : 'unknown';
                        if (!reportMap.has(selectorText)) {
                            reportMap.set(selectorText, []);
                        }
                        // Avoid duplicates if the pseudo is used multiple times in the same selector
                        if (!reportMap.get(selectorText).some(i => i.property === name)) {
                            reportMap.get(selectorText).push({
                                property: name,
                                status: featureInfo.status,
                                featureId: featureInfo.featureId,
                                baselineYear: featureInfo.baselineYear,
                                description: featureInfo.description,
                                browserCompat: featureInfo.browserCompat,
                                browserCompatSummary: featureInfo.browserCompatSummary
                            });
                        }
                    }
                }
            });

        } else if (node.type === 'Atrule') {
            const atRuleName = node.name.toLowerCase();
            let featureInfo = featureLookupMap.get(atRuleName);

            // Special handling for @container queries to distinguish size vs style queries
            if (atRuleName === 'container') {
                const preludeText = node.prelude ? generate(node.prelude).toLowerCase() : '';
                if (preludeText.includes('style(') || preludeText.includes('--')) {
                    // Style query - targets custom properties
                    const styleQueryFeature = features['container-style-queries'];
                    const styleQueryBrowserCompat = getBrowserCompatInfo(styleQueryFeature || {});
                    featureInfo = featureLookupMap.get('container-style-queries') || {
                        featureId: 'container-style-queries',
                        status: 'Not Baseline',
                        description: styleQueryFeature?.description || 'Container style queries',
                        baselineYear: getBaselineYear(styleQueryFeature?.status),
                        browserCompat: styleQueryBrowserCompat,
                        browserCompatSummary: getBrowserCompatSummary(styleQueryBrowserCompat)
                    };
                } else {
                    // Size query (default)
                    const containerFeature = features['container-queries'];
                    const containerBrowserCompat = getBrowserCompatInfo(containerFeature || {});
                    featureInfo = {
                        featureId: 'container-queries',
                        status: 'Low Baseline',
                        description: containerFeature?.description || 'Container size queries',
                        baselineYear: getBaselineYear(containerFeature?.status),
                        browserCompat: containerBrowserCompat,
                        browserCompatSummary: getBrowserCompatSummary(containerBrowserCompat)
                    };
                }
            }

            // Check At-Rules themselves (e.g., @layer, @font-palette-values)
            if (featureInfo) {
                const atRuleSelector = `@${atRuleName} ${node.prelude ? generate(node.prelude).trim() : ''}`.trim();
                if (!reportMap.has(atRuleSelector)) {
                    reportMap.set(atRuleSelector, []);
                }
                reportMap.get(atRuleSelector).push({
                    property: `@${atRuleName}`,
                    status: featureInfo.status,
                    featureId: featureInfo.featureId,
                    baselineYear: featureInfo.baselineYear,
                    description: featureInfo.description,
                    browserCompat: featureInfo.browserCompat,
                    browserCompatSummary: featureInfo.browserCompatSummary
                });
            }

            // If the at-rule has a block, continue to process its declarations
            if (node.block) {
                declarations = node.block.children;
                // For declarations inside an At-Rule's block, the selector is the At-Rule itself
                selector = `@${atRuleName} ${node.prelude ? generate(node.prelude).trim() : ''}`.trim();
            }

        }

        // --- 2. Check all Declarations (properties and values) ---
        if (declarations && declarations.forEach) {
            declarations.forEach(declaration => {
                if (declaration.type === 'Declaration') {
                    const property = declaration.property.toLowerCase();
                    const valueNode = declaration.value;
                    const currentSelector = selector;

                    // Check if property itself is a non-baseline feature
                    let propertyFeatureInfo = featureLookupMap.get(property);

                    // Define well-supported properties that should never be flagged
                    const wellSupportedProperties = [
                        'display', 'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
                        'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
                        'width', 'height', 'min-width', 'max-width', 'min-height', 'max-height',
                        'color', 'background', 'background-color', 'background-image',
                        'border', 'border-color', 'border-width', 'border-style',
                        'position', 'top', 'right', 'bottom', 'left',
                        'float', 'text-align', 'font-family', 'font-size', 'font-weight',
                        'flex-direction', 'align-items', 'justify-content', 'align-content',
                        'cursor', 'overflow', 'z-index', 'opacity', 'visibility',
                        'transition', 'animation', 'transform', 'box-shadow',
                        'outline', 'resize', 'content'
                    ];

                    // Skip if this is a well-supported property
                    if (wellSupportedProperties.includes(property)) {
                        propertyFeatureInfo = null;
                    }

                    // Special handling for specific properties
                    if (property === 'margin-block' || property === 'margin-inline' ||
                        property === 'padding-block' || property === 'padding-inline' ||
                        property.includes('-block') || property.includes('-inline')) {
                        // Logical properties - check if they're actually high baseline
                        const logicalPropsFeature = features['logical-properties'];
                        const logicalPropsBrowserCompat = getBrowserCompatInfo(logicalPropsFeature || {});
                        propertyFeatureInfo = {
                            featureId: 'logical-properties',
                            status: 'High Baseline',
                            description: logicalPropsFeature?.description || 'CSS logical properties',
                            baselineYear: getBaselineYear(logicalPropsFeature?.status),
                            browserCompat: logicalPropsBrowserCompat,
                            browserCompatSummary: getBrowserCompatSummary(logicalPropsBrowserCompat)
                        };
                    }

                    const shouldCheckProperty = propertyFeatureInfo &&
                        (propertyFeatureInfo.status === 'Not Baseline' || propertyFeatureInfo.status === 'Low Baseline');

                    if (shouldCheckProperty) {
                        if (!reportMap.has(currentSelector)) {
                            reportMap.set(currentSelector, []);
                        }
                        reportMap.get(currentSelector).push({
                            property,
                            status: propertyFeatureInfo.status,
                            featureId: propertyFeatureInfo.featureId,
                            baselineYear: propertyFeatureInfo.baselineYear,
                            description: propertyFeatureInfo.description,
                            browserCompat: propertyFeatureInfo.browserCompat,
                            browserCompatSummary: propertyFeatureInfo.browserCompatSummary
                        });
                    }

                    // Context-aware property checking - only flag problematic combinations
                    const valueText = generate(valueNode).toLowerCase();

                    // Check for specific problematic property-value combinations
                    if (property === 'font-family' && (valueText.includes('ui-serif') || valueText.includes('ui-sans-serif') || valueText.includes('ui-monospace'))) {
                        const fontFamilyFeature = features['font-family-ui'];
                        if (fontFamilyFeature) {
                            const fontBrowserCompat = getBrowserCompatInfo(fontFamilyFeature);
                            if (!reportMap.has(currentSelector)) {
                                reportMap.set(currentSelector, []);
                            }
                            reportMap.get(currentSelector).push({
                                property: `${property} (ui-* values)`,
                                status: 'Not Baseline',
                                featureId: 'font-family-ui',
                                baselineYear: getBaselineYear(fontFamilyFeature.status),
                                description: fontFamilyFeature.description,
                                browserCompat: fontBrowserCompat,
                                browserCompatSummary: getBrowserCompatSummary(fontBrowserCompat)
                            });
                        }
                    }

                    // Walk through the Declaration's VALUE to check for function/value usage
                    walk(valueNode, function (valueChild) {
                        if (valueChild.type === 'Function') {
                            const functionName = valueChild.name.toLowerCase();
                            let valueFeatureInfo = featureLookupMap.get(functionName);

                            // Special mappings for common functions
                            if (functionName === 'clamp' || functionName === 'min' || functionName === 'max') {
                                const clampFeature = features['min-max-clamp'];
                                const clampBrowserCompat = getBrowserCompatInfo(clampFeature || {});
                                valueFeatureInfo = {
                                    featureId: 'min-max-clamp',
                                    status: 'High Baseline',
                                    description: clampFeature?.description || 'CSS min(), max(), and clamp() functions',
                                    baselineYear: getBaselineYear(clampFeature?.status),
                                    browserCompat: clampBrowserCompat,
                                    browserCompatSummary: getBrowserCompatSummary(clampBrowserCompat)
                                };
                            } else if (functionName === 'oklch' || functionName === 'oklab') {
                                const oklabFeature = features['oklab'];
                                const oklabBrowserCompat = getBrowserCompatInfo(oklabFeature || {});
                                valueFeatureInfo = {
                                    featureId: 'oklab',
                                    status: 'Low Baseline',
                                    description: oklabFeature?.description || 'OKLAB and OKLCH color functions',
                                    baselineYear: getBaselineYear(oklabFeature?.status),
                                    browserCompat: oklabBrowserCompat,
                                    browserCompatSummary: getBrowserCompatSummary(oklabBrowserCompat)
                                };
                            } else if (functionName === 'anchor') {
                                const anchorFeature = features['anchor-positioning'];
                                const anchorBrowserCompat = getBrowserCompatInfo(anchorFeature || {});
                                valueFeatureInfo = {
                                    featureId: 'anchor-positioning',
                                    status: 'Not Baseline',
                                    description: anchorFeature?.description || 'CSS anchor positioning',
                                    baselineYear: getBaselineYear(anchorFeature?.status),
                                    browserCompat: anchorBrowserCompat,
                                    browserCompatSummary: getBrowserCompatSummary(anchorBrowserCompat)
                                };
                            }

                            if (valueFeatureInfo && shouldIncludeStatus(valueFeatureInfo.status, config)) {
                                if (!reportMap.has(currentSelector)) {
                                    reportMap.set(currentSelector, []);
                                }

                                const propAndValue = `${property}: ${functionName}()`;

                                // Avoid duplicates
                                if (!reportMap.get(currentSelector).some(i => i.property === propAndValue)) {
                                    reportMap.get(currentSelector).push({
                                        property: propAndValue,
                                        status: valueFeatureInfo.status,
                                        featureId: valueFeatureInfo.featureId,
                                        baselineYear: valueFeatureInfo.baselineYear,
                                        description: valueFeatureInfo.description,
                                        browserCompat: valueFeatureInfo.browserCompat,
                                        browserCompatSummary: valueFeatureInfo.browserCompatSummary
                                    });
                                }
                            }
                        } else if (valueChild.type === 'Identifier') {
                            const identifierName = valueChild.name.toLowerCase();

                            // Expanded list of common high-baseline values to skip
                            const commonValues = [
                                'block', 'inline', 'flex', 'grid', 'none', 'auto', 'inherit', 'initial',
                                'center', 'left', 'right', 'top', 'bottom', 'middle', 'baseline',
                                'start', 'end', 'stretch', 'space-between', 'space-around', 'space-evenly',
                                'row', 'column', 'wrap', 'nowrap', 'reverse', 'hidden', 'visible',
                                'scroll', 'fixed', 'absolute', 'relative', 'static', 'sticky',
                                'solid', 'dashed', 'dotted', 'double', 'groove', 'ridge', 'inset', 'outset',
                                'transparent', 'currentcolor', 'white', 'black', 'red', 'green', 'blue',
                                'bold', 'normal', 'italic', 'underline', 'overline', 'line-through',
                                'pointer', 'default', 'text', 'crosshair', 'move', 'help', 'wait',
                                'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy',
                                'small', 'medium', 'large', 'x-small', 'x-large', 'xx-small', 'xx-large',
                                'border-box', 'content-box', 'padding-box', 'fill', 'contain', 'cover'
                            ];

                            if (commonValues.includes(identifierName)) return;

                            const identifierFeatureInfo = featureLookupMap.get(identifierName);

                            if (identifierFeatureInfo && shouldIncludeStatus(identifierFeatureInfo.status, config)) {
                                if (!reportMap.has(currentSelector)) {
                                    reportMap.set(currentSelector, []);
                                }
                                if (!reportMap.get(currentSelector).some(i => i.property.includes(identifierName))) {
                                    reportMap.get(currentSelector).push({
                                        property: `${property}: ${identifierName}`,
                                        status: identifierFeatureInfo.status,
                                        featureId: identifierFeatureInfo.featureId,
                                        baselineYear: identifierFeatureInfo.baselineYear,
                                        description: identifierFeatureInfo.description,
                                        browserCompat: identifierFeatureInfo.browserCompat,
                                        browserCompatSummary: identifierFeatureInfo.browserCompatSummary
                                    });
                                }
                            }
                        } else if (valueChild.type === 'Dimension') {
                            // Handle dimension units - but don't flag standard units like px, rem, em as functions
                            const unit = valueChild.unit?.toLowerCase();
                            if (unit && ['rem', 'em', 'px', '%', 'vh', 'vw'].includes(unit)) {
                                // Skip standard CSS units
                                return;
                            }
                        }
                    });
                }
            });
        }
    });

    // Format the final report as an array and filter based on configuration
    return Array.from(reportMap.entries()).map(([selector, issues]) => ({
        selector,
        issues: Array.from(new Set(issues.map(i => JSON.stringify(i))))
            .map(s => JSON.parse(s))
            .filter(issue => {
                // Apply configuration-based filtering
                if (issue.status === 'Not Baseline' && !config.includeNotBaseline) {
                    return false;
                }
                if (issue.status === 'Low Baseline' && !config.includeAvailability.includes('low')) {
                    return false;
                }
                if (issue.status === 'High Baseline' && !config.includeAvailability.includes('high')) {
                    return false;
                }
                return true;
            })
    })).filter(entry => entry.issues.length > 0); // Remove entries with no issues
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
                await browserObject[evaluateFunction]((sel, issues) => {
                    const elements = document.querySelectorAll(sel);

                    elements.forEach(el => {
                        el.style.outline = '3px solid red';
                        el.style.cursor = 'help';

                        // Store detailed issue data
                        el.setAttribute('data-baseline-issues', JSON.stringify(issues));

                        // Add hover event listeners with improved timing
                        el.addEventListener('mouseenter', function (e) {
                            const hoverCard = window.baselineHoverCard;
                            const issuesData = JSON.parse(this.getAttribute('data-baseline-issues'));

                            // Store current hovered element for the toggle function
                            window.currentHoveredElement = this;

                            // Generate hover card content with enhanced contrast
                            let cardContent = `<h4><img src="https://web-platform-dx.github.io/web-features/assets/img/baseline-widely-icon.svg" style="width: 20px; height: 20px; margin-right: 8px; vertical-align: middle; filter: brightness(0) invert(1);" alt="Baseline"> Baseline Issues (${issuesData.length})</h4>`;

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
        await sleep("1m")
    } catch (err) {
        console.error(`Error performing baseline_scan: ${err.message}`)
    }
}

export {
    baselineScanPipeline
}