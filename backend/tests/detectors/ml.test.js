const fs = require('fs');
const path = require('path');
const { detectEnvironmentAndVersioning } = require('../../src/services/parser');

jest.mock('child_process', () => ({
  exec: (cmd, opts, cb) => cb(null, '{}'),
}));

describe('ML detection via Python imports and artifacts', () => {
  const testDir = path.join(__dirname, '..', 'fixtures', 'ml-repo');

  beforeAll(() => {
    if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });
    const py = [
      'import torch',
      'import tensorflow as tf',
      'from keras import models',
      'from sklearn import datasets'
    ].join('\n');
    fs.writeFileSync(path.join(testDir, 'model.py'), py);
    fs.writeFileSync(path.join(testDir, 'model.pt'), Buffer.alloc(10));
    fs.writeFileSync(path.join(testDir, 'notebook.ipynb'), '{"cells": []}');
  });

  afterAll(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('detects TensorFlow and PyTorch from Python imports', async () => {
    const env = await detectEnvironmentAndVersioning(testDir, null);
    expect(env.primaryFrameworks).toEqual(expect.arrayContaining(['TensorFlow', 'PyTorch']));
  });

  it('detects Jupyter Notebook and ML artifacts presence', async () => {
    const env = await detectEnvironmentAndVersioning(testDir, null);
    expect(env.primaryFrameworks).toEqual(expect.arrayContaining(['Jupyter Notebook', 'ML Artifacts']));
  });
});