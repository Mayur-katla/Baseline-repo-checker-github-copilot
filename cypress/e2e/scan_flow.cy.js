// Scan Flow E2E: submits a GitHub scan and navigates to detail page

describe('Scan Flow', () => {
  it('submits a GitHub scan and navigates to detail page', () => {
    // Increase default timeout to reduce flake
    Cypress.config('defaultCommandTimeout', 20000);
    cy.writeFile('cypress/output/progress.txt', 'Start test\n');

    // Intercepts for creating scan and fetching its status/data
    cy.intercept('POST', '/api/scans', (req) => {
      req.reply({ scanId: 'e2e-123' });
    }).as('createScan');
    cy.writeFile('cypress/output/progress.txt', 'Intercept createScan set\n', { flag: 'a+' });

    cy.intercept('GET', '/api/scans/e2e-123/status', (req) => {
      req.reply({ status: 'completed', progress: 100 });
    }).as('scanStatus');
    cy.writeFile('cypress/output/progress.txt', 'Intercept scanStatus set\n', { flag: 'a+' });

    cy.intercept('GET', '/api/scans/e2e-123', (req) => {
      req.reply({
        id: 'e2e-123',
        repository: { name: 'e2e-test', owner: 'tester', license: 'MIT', sizeMB: 1.2 },
        projectFeatures: {
          supported: ['feature A', 'feature B', 'feature C'],
          partial: ['feature D'],
          unsupported: ['feature E']
        },
        compatibility: {
          browserCompatibility: {
            supported: 3,
            partial: 1,
            unsupported: 1
          },
          recommendations: {
            suggested: 2
          }
        }
      });
    }).as('scanResult');
    cy.writeFile('cypress/output/progress.txt', 'Intercept scanResult set\n', { flag: 'a+' });

    // Visit home page
    cy.visit('/');
    cy.writeFile('cypress/output/progress.txt', 'Visited home\n', { flag: 'a+' });

    // Open Scan page and submit form
    cy.contains('Start New Scan').click();
    cy.url().should('include', '/scan');
    cy.writeFile('cypress/output/progress.txt', 'Navigated to /scan\n', { flag: 'a+' });

    // Fill out GitHub form (only repoUrl is needed on this UI)
    cy.get('#repoUrl').clear().type('https://github.com/tester/e2e-test');
    cy.writeFile('cypress/output/progress.txt', 'Filled form\n', { flag: 'a+' });

    // Submit
    cy.contains('button', 'Start Scan').click();
    cy.writeFile('cypress/output/progress.txt', 'Clicked Start Scan\n', { flag: 'a+' });

    // Wait for API calls and navigation
    cy.wait('@createScan');
    cy.writeFile('cypress/output/progress.txt', 'Waited createScan\n', { flag: 'a+' });
    cy.wait('@scanStatus');
    cy.writeFile('cypress/output/progress.txt', 'Waited scanStatus\n', { flag: 'a+' });
    cy.wait('@scanResult');
    cy.writeFile('cypress/output/progress.txt', 'Waited scanResult\n', { flag: 'a+' });

    // Ensure navigation to detail page
    cy.url().should('include', '/scan/e2e-123');
    cy.writeFile('cypress/output/progress.txt', 'On /scan/e2e-123\n', { flag: 'a+' });

    // Diagnostics: capture DOM state for debugging
    cy.location('pathname').then((path) => {
      cy.writeFile('cypress/output/pathname.txt', path);
    });
    cy.get('main').invoke('text').then((txt) => {
      cy.writeFile('cypress/output/main_text.txt', txt);
    });
    cy.get('main').invoke('html').then((html) => {
      cy.writeFile('cypress/output/main_inner.html', html);
    });
    cy.get('h1').then(($h1s) => {
      const texts = [...$h1s].map((el) => el.textContent.trim());
      cy.writeFile('cypress/output/h1_texts.json', texts);
    });
    cy.writeFile('cypress/output/progress.txt', 'Diagnostics captured\n', { flag: 'a+' });

    // Assertions: check text content without visibility requirement (framer-motion opacity=0)
    cy.get('h1').should(($hs) => {
      const hasScanResults = [...$hs].some((h) => h.textContent.trim().toLowerCase() === 'scan results');
      expect(hasScanResults, 'Scan Results header present').to.be.true;
    });
    cy.writeFile('cypress/output/progress.txt', 'Header assertion passed\n', { flag: 'a+' });

    cy.get('p').should(($ps) => {
      const hasScanId = [...$ps].some((p) => p.textContent.includes('Scan ID: e2e-123'));
      expect(hasScanId, 'Scan ID present').to.be.true;
    });
    cy.writeFile('cypress/output/progress.txt', 'Scan ID assertion passed\n', { flag: 'a+' });

    // Verify analytics headings exist
    cy.get('main').should(($main) => {
      const txt = $main.text();
      expect(txt).to.include('Analytics Statistics');
      expect(txt).to.include('Compatibility Breakdown');
      expect(txt).to.include('Repository Overview');
    });
    cy.writeFile('cypress/output/progress.txt', 'Analytics headings assertion passed\n', { flag: 'a+' });

    // Verify stat labels appear in text
    cy.get('main').invoke('text').should((txt) => {
      expect(txt).to.include('Supported');
      expect(txt).to.include('Partial');
      expect(txt).to.include('Unsupported');
    });
    cy.writeFile('cypress/output/progress.txt', 'Stat labels assertion passed\n', { flag: 'a+' });
  });
});