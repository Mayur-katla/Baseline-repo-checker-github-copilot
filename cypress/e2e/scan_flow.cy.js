describe('Scan Flow', () => {
  it('submits a GitHub scan and navigates to detail page', () => {
    cy.intercept('POST', '**/api/scans', {
      statusCode: 200,
      body: { scanId: 'e2e-123' }
    }).as('createScan');

    cy.intercept('GET', '**/api/scans/e2e-123/status', {
      statusCode: 200,
      body: { status: 'done', progress: 100 }
    }).as('scanStatus');

    // Provide a richer scan result so Analytics has predictable counts
    cy.intercept('GET', '**/api/scans/e2e-123', {
      statusCode: 200,
      body: {
        repoUrl: 'https://github.com/test/repo',
        suggestions: [{ id: 's1' }, { id: 's2' }],
        projectFeatures: { detectedFeatures: ['fetch', 'async-await', 'IndexedDB', 'XMLHttpRequest', 'Notification', 'document.write'] },
        architecture: { configFiles: ['.browserslistrc'] },
        compatibility: {
          browserCompatibility: {
            fetch: { Chrome: 'supported' },
            'async-await': { Chrome: 'supported' },
            IndexedDB: { Chrome: 'supported' },
            XMLHttpRequest: { Chrome: 'partial' },
            Notification: { Chrome: 'partial' },
            'document.write': { Chrome: 'unsupported' }
          }
        },
        securityAndPerformance: { missingPolicies: [{ title: 'CSP', description: 'Missing CSP' }] },
        aiSuggestions: { items: [] }
      }
    }).as('scanResult');

    cy.visit('/scan');
    cy.get('#repoUrl').type('https://github.com/test/repo');
    cy.contains('button', 'Start Scan').click();

    cy.wait('@createScan');
    cy.url().should('include', '/scan/e2e-123');
    cy.contains('Scan Results').should('be.visible');
    cy.contains('Scan ID: e2e-123').should('be.visible');

    // Verify Analytics headings rendered
    cy.contains('Analytics Statistics').should('be.visible');
    cy.contains('Compatibility Breakdown').should('be.visible');
    cy.contains('Compatibility Distribution').should('be.visible');
    cy.contains('Feature Details').should('be.visible');

    // Verify StatCard counts derived from analytics
    cy.contains('p', 'Supported').next().should('have.text', '3');
    cy.contains('p', 'Partial').next().should('have.text', '2');
    cy.contains('p', 'Unsupported').next().should('have.text', '1');

    // Suggestions card shows suggestions length
    cy.contains('p', 'Suggestions').next().should('have.text', '2');
  });
});