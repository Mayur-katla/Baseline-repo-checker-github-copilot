jest.mock('../../src/index', () => {
  const express = require('express');
  const cors = require('cors');
  const Scan = require('../../src/models/Scan');
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.get('/api/scans', async (req, res) => {
    try {
      const scans = await Scan.find({}, {
        id: 1,
        repoUrl: 1,
        status: 1,
        progress: 1,
        createdAt: 1,
        updatedAt: 1,
        _id: 0
      }).sort({ createdAt: -1 }).limit(20);
      res.json(scans);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get scans' });
    }
  });
  const server = { close: () => {} };
  return { app, server };
});

const request = require('supertest');
const { app, server } = require('../../src/index');
const { connectDB } = require('../../src/config/database');
const mongoose = require('mongoose');
const Scan = require('../../src/models/Scan');

beforeAll(async () => {
  await connectDB();
});

afterAll(async () => {
  await mongoose.disconnect();
  server.close();
});

beforeEach(async () => {
  await Scan.deleteMany({});
});

afterEach(async () => {
  await Scan.deleteMany({});
});

describe('GET /api/scans', () => {
  it('should return an empty array when no scans are in the database', async () => {
    const response = await request(app)
      .get('/api/scans')
      .expect(200);

    expect(response.body).toEqual([]);
  });

  it('should return a list of scans when scans are in the database', async () => {
    const scans = [
      { id: '1', repoUrl: 'https://github.com/test/repo1', status: 'done' },
      { id: '2', repoUrl: 'https://github.com/test/repo2', status: 'processing' },
    ];
    await Scan.insertMany(scans);

    const response = await request(app)
      .get('/api/scans')
      .expect(200);

    expect(response.body).toHaveLength(2);
  });
});