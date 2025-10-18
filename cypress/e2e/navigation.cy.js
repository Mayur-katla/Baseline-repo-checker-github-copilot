describe('Navigation', () => {
  it('navigates to Docs and Settings via header', () => {
    cy.visit('/');
    cy.get('[data-testid="main-header"]').should('be.visible');

    cy.contains('Docs').click();
    cy.url().should('include', '/docs');
    cy.contains('Documentation').should('be.visible');

    cy.contains('Settings').click();
    cy.url().should('include', '/settings');
    cy.contains('Settings').should('be.visible');
  });
});