const request = require('supertest');
const { app, server } = require('../../src/index');
const { connectDB } = require('../../src/config/database');
const mongoose = require('mongoose');
const queue = require('../../src/jobs/queue');

jest.mock('../../src/jobs/queue', () => ({
  createJob: jest.fn(async (payload) => ({ id: 'test-id', status: 'queued' })),
  getJob: jest.fn(),
  removeJob: jest.fn(),
  on: jest.fn(),
  init: jest.fn(),
  createApplyJob: jest.fn(),
}));

beforeAll(async () => {
  await connectDB();
});

afterAll(async () => {
  await mongoose.disconnect();
  server.close();
});

describe('POST /api/scans validation', () => {
  test('400 when missing inputType', async () => {
    const res = await request(app)
      .post('/api/scans')
      .send({})
      .expect(400);
    expect(Array.isArray(res.body.errors)).toBe(true);
    expect(res.body.errors.length > 0).toBe(true);
  });

  test('400 when github/url without valid repoUrl', async () => {
    const res = await request(app)
      .post('/api/scans')
      .send({ inputType: 'github', repoUrl: 'invalid' })
      .expect(400);
    expect(Array.isArray(res.body.errors) && res.body.errors.length > 0).toBe(true);
  });

  test('400 when local without localPath', async () => {
    const res = await request(app)
      .post('/api/scans')
      .send({ inputType: 'local', localPath: '' })
      .expect(400);
    expect(Array.isArray(res.body.errors) && res.body.errors.length > 0).toBe(true);
  });

  test('400 when zip with non-base64 zipBuffer', async () => {
    const res = await request(app)
      .post('/api/scans')
      .send({ inputType: 'zip', zipBuffer: 'not_base64!' })
      .expect(400);
    expect(Array.isArray(res.body.errors) && res.body.errors.length > 0).toBe(true);
  });

  test('201 when valid github input', async () => {
    const res = await request(app)
      .post('/api/scans')
      .send({ inputType: 'github', repoUrl: 'https://github.com/user/repo', targetBrowsers: ['chrome'] })
      .expect(201);
    expect(res.body.scanId).toBe('test-id');
    expect(queue.createJob).toHaveBeenCalled();
  });
});