/// <reference types="cypress" />

describe('Performance Metrics', () => {
  it('captures UI performance timings', () => {
    cy.visit('/');
    cy.window().then((win) => {
      const perf = win.performance;
      const nav = perf.getEntriesByType('navigation')[0];
      const paints = perf.getEntriesByType('paint') || [];
      const fcpEntry = paints.find((e) => e.name === 'first-contentful-paint') || null;

      const metrics = {
        navigationType: nav ? nav.type : 'unknown',
        domContentLoaded: nav
          ? nav.domContentLoadedEventEnd - nav.startTime
          : perf.timing.domContentLoadedEventEnd - perf.timing.navigationStart,
        loadEvent: nav
          ? nav.loadEventEnd - nav.startTime
          : perf.timing.loadEventEnd - perf.timing.navigationStart,
        firstContentfulPaint: fcpEntry ? fcpEntry.startTime : null,
      };

      cy.log(`Performance metrics: ${JSON.stringify(metrics)}`);
      expect(metrics.loadEvent).to.be.greaterThan(0);
      if (metrics.firstContentfulPaint !== null) {
        expect(metrics.firstContentfulPaint).to.be.greaterThan(0);
      }
    });
  });
});