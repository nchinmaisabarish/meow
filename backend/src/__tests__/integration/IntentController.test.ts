import request from 'supertest';
import { app } from '../../worker.js';
import { DatabaseHelper } from '../../helpers/DatabaseHelper.js';
import jwt from 'jsonwebtoken';

describe('IntentController Integration Tests', () => {
  let authToken: string;

  beforeAll(async () => {
    if (!process.env.MONGODB_URI) {
      process.env.MONGODB_URI = 'mongodb://localhost:27017/meow-test';
    }
    if (!process.env.SESSION_SECRET) {
      process.env.SESSION_SECRET = 'test-secret-key-for-testing';
    }

    try {
      await DatabaseHelper.connect(process.env.MONGODB_URI);
    } catch (error) {
      console.error('Database connection failed:', error);
    }

    authToken = jwt.sign(
      {
        userId: '507f1f77bcf86cd799439011',
        teamId: '507f1f77bcf86cd799439012',
        email: 'test@example.com',
      },
      process.env.SESSION_SECRET,
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    try {
      await DatabaseHelper.disconnect();
    } catch (error) {
      console.error('Database disconnection failed:', error);
    }
  });

  describe('POST /api/intent/resolve', () => {
    it('should resolve a simple list cards intent', async () => {
      const response = await request(app)
        .post('/api/intent/resolve')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send({
          input: 'list all cards',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('matched', true);
      expect(response.body).toHaveProperty('intent', 'list_cards');
      expect(response.body).toHaveProperty('controller', 'CardController');
      expect(response.body).toHaveProperty('method', 'list');
      expect(response.body).toHaveProperty('confidence');
      expect(response.body.confidence).toBeGreaterThan(0);
    });

    it('should resolve create card intent with parameter extraction', async () => {
      const response = await request(app)
        .post('/api/intent/resolve')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send({
          input: 'create a card called "Implement new feature"',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('matched', true);
      expect(response.body).toHaveProperty('intent', 'create_card');
      expect(response.body).toHaveProperty('controller', 'CardController');
      expect(response.body).toHaveProperty('method', 'create');
      expect(response.body).toHaveProperty('parameters');
      expect(response.body.parameters).toHaveProperty('title');
      expect(response.body.parameters.title).toContain('Implement new feature');
    });

    it('should resolve get card intent with ID extraction', async () => {
      const cardId = '507f1f77bcf86cd799439011';
      const response = await request(app)
        .post('/api/intent/resolve')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send({
          input: `show card ${cardId}`,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('matched', true);
      expect(response.body).toHaveProperty('intent', 'get_card');
      expect(response.body).toHaveProperty('controller', 'CardController');
      expect(response.body).toHaveProperty('method', 'get');
      expect(response.body).toHaveProperty('parameters');
      expect(response.body.parameters).toHaveProperty('id', cardId);
    });

    it('should resolve list accounts intent', async () => {
      const response = await request(app)
        .post('/api/intent/resolve')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send({
          input: 'show all accounts',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('matched', true);
      expect(response.body).toHaveProperty('intent', 'list_accounts');
      expect(response.body).toHaveProperty('controller', 'AccountController');
      expect(response.body).toHaveProperty('method', 'list');
    });

    it('should resolve create account intent with name extraction', async () => {
      const response = await request(app)
        .post('/api/intent/resolve')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send({
          input: 'create an account called "Acme Corporation"',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('matched', true);
      expect(response.body).toHaveProperty('intent', 'create_account');
      expect(response.body).toHaveProperty('controller', 'AccountController');
      expect(response.body).toHaveProperty('method', 'create');
      expect(response.body).toHaveProperty('parameters');
      expect(response.body.parameters).toHaveProperty('name');
      expect(response.body.parameters.name).toContain('Acme Corporation');
    });

    it('should resolve list users intent', async () => {
      const response = await request(app)
        .post('/api/intent/resolve')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send({
          input: 'list all users',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('matched', true);
      expect(response.body).toHaveProperty('intent', 'list_users');
      expect(response.body).toHaveProperty('controller', 'UserController');
      expect(response.body).toHaveProperty('method', 'list');
    });

    it('should resolve create user intent with email extraction', async () => {
      const response = await request(app)
        .post('/api/intent/resolve')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send({
          input: 'invite user john.doe@example.com',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('matched', true);
      expect(response.body).toHaveProperty('intent', 'create_user');
      expect(response.body).toHaveProperty('controller', 'UserController');
      expect(response.body).toHaveProperty('method', 'create');
      expect(response.body).toHaveProperty('parameters');
      expect(response.body.parameters).toHaveProperty('email', 'john.doe@example.com');
    });

    it('should resolve forecast achieved intent', async () => {
      const response = await request(app)
        .post('/api/intent/resolve')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send({
          input: 'show achieved forecast',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('matched', true);
      expect(response.body).toHaveProperty('intent', 'get_forecast_achieved');
      expect(response.body).toHaveProperty('controller', 'ForecastController');
      expect(response.body).toHaveProperty('method', 'achieved');
    });

    it('should resolve forecast predicted intent', async () => {
      const response = await request(app)
        .post('/api/intent/resolve')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send({
          input: 'get predicted forecast',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('matched', true);
      expect(response.body).toHaveProperty('intent', 'get_forecast_predicted');
      expect(response.body).toHaveProperty('controller', 'ForecastController');
      expect(response.body).toHaveProperty('method', 'predicted');
    });

    it('should resolve list lanes intent', async () => {
      const response = await request(app)
        .post('/api/intent/resolve')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send({
          input: 'show all lanes',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('matched', true);
      expect(response.body).toHaveProperty('intent', 'list_lanes');
      expect(response.body).toHaveProperty('controller', 'LaneController');
      expect(response.body).toHaveProperty('method', 'list');
    });

    it('should resolve lane statistics intent', async () => {
      const response = await request(app)
        .post('/api/intent/resolve')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send({
          input: 'show lane statistics',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('matched', true);
      expect(response.body).toHaveProperty('intent', 'get_lane_statistics');
      expect(response.body).toHaveProperty('controller', 'LaneStatisticsController');
      expect(response.body).toHaveProperty('method', 'get');
    });

    it('should resolve list activities intent', async () => {
      const response = await request(app)
        .post('/api/intent/resolve')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send({
          input: 'list all activities',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('matched', true);
      expect(response.body).toHaveProperty('intent', 'list_activities');
      expect(response.body).toHaveProperty('controller', 'ActivityController');
      expect(response.body).toHaveProperty('method', 'list');
    });

    it('should return matched false for unrecognized input', async () => {
      const response = await request(app)
        .post('/api/intent/resolve')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send({
          input: 'this is completely random gibberish xyz123',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('matched', false);
      expect(response.body).not.toHaveProperty('intent');
      expect(response.body).not.toHaveProperty('controller');
      expect(response.body).not.toHaveProperty('method');
    });

    it('should return 400 for missing input', async () => {
      const response = await request(app)
        .post('/api/intent/resolve')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 for empty input', async () => {
      const response = await request(app)
        .post('/api/intent/resolve')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send({
          input: '',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 401 for missing authentication', async () => {
      const response = await request(app)
        .post('/api/intent/resolve')
        .set('Content-Type', 'application/json')
        .send({
          input: 'list all cards',
        });

      expect(response.status).toBe(401);
    });

    it('should include alternatives when multiple intents match', async () => {
      const response = await request(app)
        .post('/api/intent/resolve')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send({
          input: 'show tasks',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('matched', true);
      expect(response.body).toHaveProperty('intent');
      expect(response.body).toHaveProperty('confidence');
    });
  });

  describe('GET /api/intent/list', () => {
    it('should list all available intents', async () => {
      const response = await request(app)
        .get('/api/intent/list')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('count');
      expect(response.body).toHaveProperty('intents');
      expect(Array.isArray(response.body.intents)).toBe(true);
      expect(response.body.intents.length).toBeGreaterThan(0);

      const firstIntent = response.body.intents[0];
      expect(firstIntent).toHaveProperty('intent');
      expect(firstIntent).toHaveProperty('controller');
      expect(firstIntent).toHaveProperty('method');
      expect(firstIntent).toHaveProperty('examplePatterns');
      expect(Array.isArray(firstIntent.examplePatterns)).toBe(true);
    });

    it('should return 401 for missing authentication', async () => {
      const response = await request(app).get('/api/intent/list');

      expect(response.status).toBe(401);
    });
  });
});
