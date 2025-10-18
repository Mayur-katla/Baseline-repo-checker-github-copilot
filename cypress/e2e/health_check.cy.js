describe('Health Check', () => {
  it('should load the homepage and find the main header', () => {
    cy.visit('/');
    cy.get('[data-testid="main-header"]').should('be.visible');
  });
});