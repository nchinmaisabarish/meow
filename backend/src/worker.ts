// @ts-ignore
export const log = pino({
  name: SERVICE_NAME,
  level: process.env.LOG_LEVEL || 'info',
});

process.on('uncaughtException', log.fatal.bind(log));

const IP_ADDRESS = process.env.IP_ADDRESS || '127.0.0.1';

function isValidPort(port: string | undefined): boolean {
  if (!port) {
    return false;
  }

  const portAsNumber = parseInt(port);

  return !isNaN(portAsNumber) && portAsNumber >= 0 && portAsNumber <= 65535;
}

const PORT = isValidPort(process.env.PORT) ? parseInt(process.env.PORT!) : 9000;

const mandatory = ['MONGODB_URI', 'SESSION_SECRET'];

mandatory.forEach((param) => {
  if (!process.env[param]) {
    log.error(`env variable ${param} is not set, exiting worker ...`);
    process.exit(1);
  }
});

import cors from 'cors';
import compression from 'compression';
import express from 'express';
import http from 'http';
import { CardController } from './controllers/CardController.js';
import { LoginController } from './controllers/LoginController.js';
import { setHeaders } from './middlewares/setHeaders.js';
import { rejectIfContentTypeIsNot } from './middlewares/rejectIfContentTypeIsNot.js';
import { validateAgainst } from './middlewares/validateAgainst.js';
import { RegisterRequestSchema } from './middlewares/schema-validation/RegisterRequestSchema.js';
import { RegisterController } from './controllers/RegisterController.js';
import { LoginRequestSchema } from './middlewares/schema-validation/LoginRequestSchema.js';
import { verifyJwt } from './middlewares/verifyJwt.js';
import { addEntityToHeader } from './middlewares/addEntityToHeader.js';
import { handleError } from './middlewares/handleError.js';
import { ValidateTokenRequestSchema } from './middlewares/schema-validation/ValidateTokenRequestSchema.js';
import { ValidateTokenController } from './controllers/ValidateTokenController.js';
import { AccountController } from './controllers/AccountController.js';
import { TeamRequestSchema } from './middlewares/schema-validation/TeamRequestSchema.js';
import { LaneController } from './controllers/LaneController.js';
import { LaneRequestSchema } from './middlewares/schema-validation/LaneRequestSchema.js';
import { LanesRequestSchema } from './middlewares/schema-validation/LanesRequestSchema.js';
import { isDatabaseConnectionEstablished } from './middlewares/isDatabaseConnectionEstablished.js';
import { UserController } from './controllers/UserController.js';
import { UserRequestSchema } from './middlewares/schema-validation/UserRequestSchema.js';
import { CardRequestSchema } from './middlewares/schema-validation/CardRequestSchema.js';
import { ForecastController } from './controllers/ForecastController.js';
import { DatabaseHelper } from './helpers/DatabaseHelper.js';
import { SchemaController } from './controllers/SchemaController.js';
import { SchemaRequestSchema } from './middlewares/schema-validation/SchemaRequestSchema.js';
import { BoardRequestSchema } from './middlewares/schema-validation/BoardRequestSchema.js';
import { UserUpdateRequestSchema } from './middlewares/schema-validation/UserUpdateRequestSchema.js';
import { PasswordRequestSchema } from './middlewares/schema-validation/PasswordRequestSchema.js';
import { TeamController } from './controllers/TeamController.js';
import { AccountRequestSchema } from './middlewares/schema-validation/AccountRequestSchema.js';
import { EventRequestSchema } from './middlewares/schema-validation/EventRequestSchema.js';
import { LaneStatisticsController } from './controllers/LaneStatisticsController.js';
import { EventHelper } from './helpers/EventHelper.js';
import { NodeEventStrategy } from './events/NodeEventStrategy.js';
import { LaneEventListener } from './events/LaneEventListener.js';
import { CardEventListener } from './events/CardEventListener.js';
import { AccountEventListener } from './events/AccountEventListener.js';
import { SERVICE_NAME } from './Constants.js';
import pino from 'pino';
import { CardReferenceListener } from './events/CardReferenceListener.js';
import { CardEventController } from './controllers/CardEventController.js';
import { AccountEventController } from './controllers/AccountEventController.js';
import { notifyOnMissedFollowUpDatesTimeline } from './jobs/notifyOnMissedFollowUpDatesTimeline.js';
import JobDailyScheduler from './job-daily-scheduler.js';
import { BoardEventListener } from './events/BoardEventListener.js';
import { CardForecastEventListener } from './events/CardForecastEventListener.js';
import { ActivityController } from './controllers/ActivityController.js';
import { IntentRegistry } from './intent/IntentRegistry.js';
import { IIntent } from './intent/IntentResolver.js';

/* spinning up express */
export const app = express();

app.set('port', process.env.PORT || 9000);
app.set('etag', false);

app.use(compression());
app.enable('trust proxy');
app.disable('x-powered-by');

let corsOptions: cors.CorsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'DELETE'],
};

/* enable CORS in production mode */
if (process.env.NODE_ENV === 'production') {
  corsOptions.origin = false;
}

app.use(cors(corsOptions));

export const intentRegistry = new IntentRegistry();

try {
  log.info('initialise database connection');

  await DatabaseHelper.connect(process.env.MONGODB_URI!);

  log.info('database connection established');

  const strategy = new NodeEventStrategy();

  strategy.register('board', BoardEventListener.onBoardEvent);
  strategy.register('lane', LaneEventListener.onLaneUpdate);
  strategy.register('card', CardEventListener.onCardUpdateOrCreate);
  strategy.register('card', CardForecastEventListener.onCardUpdateOrCreate);
  strategy.register('card', CardReferenceListener.onCardUpdateOrCreate);
  strategy.register('account', AccountEventListener.onAccountUpdate);

  EventHelper.set(strategy);

  log.info('initialising intent registry');

  intentRegistry.register({
    name: 'list_cards',
    pattern: /list.*cards?|get.*cards?|show.*cards?|fetch.*cards?/i,
    handler: CardController.list,
    metadata: {
      method: 'GET',
      description: 'List all cards',
      tags: ['card', 'list', 'query'],
      route: '/api/cards'
    }
  });

  intentRegistry.register({
    name: 'get_card',
    pattern: /get.*card|show.*card|fetch.*card|view.*card/i,
    handler: CardController.get,
    metadata: {
      method: 'GET',
      description: 'Get a specific card by ID',
      tags: ['card', 'get', 'query'],
      route: '/api/cards/:id'
    }
  });

  intentRegistry.register({
    name: 'create_card',
    pattern: /create.*card|add.*card|new.*card/i,
    handler: CardController.create,
    metadata: {
      method: 'POST',
      description: 'Create a new card',
      tags: ['card', 'create', 'mutation'],
      route: '/api/cards'
    }
  });

  intentRegistry.register({
    name: 'update_card',
    pattern: /update.*card|modify.*card|edit.*card|change.*card/i,
    handler: CardController.update,
    metadata: {
      method: 'POST',
      description: 'Update an existing card',
      tags: ['card', 'update', 'mutation'],
      route: '/api/cards/:id'
    }
  });

  intentRegistry.register({
    name: 'list_card_events',
    pattern: /list.*card.*events?|get.*card.*events?|show.*card.*events?/i,
    handler: CardEventController.list,
    metadata: {
      method: 'GET',
      description: 'List events for a card',
      tags: ['card', 'event', 'list', 'query'],
      route: '/api/cards/:id/events'
    }
  });

  intentRegistry.register({
    name: 'create_card_event',
    pattern: /create.*card.*event|add.*card.*event|log.*card.*event/i,
    handler: CardEventController.create,
    metadata: {
      method: 'POST',
      description: 'Create an event for a card',
      tags: ['card', 'event', 'create', 'mutation'],
      route: '/api/cards/:id/events'
    }
  });

  intentRegistry.register({
    name: 'list_accounts',
    pattern: /list.*accounts?|get.*accounts?|show.*accounts?|fetch.*accounts?/i,
    handler: AccountController.list,
    metadata: {
      method: 'GET',
      description: 'List all accounts',
      tags: ['account', 'list', 'query'],
      route: '/api/accounts'
    }
  });

  intentRegistry.register({
    name: 'get_account',
    pattern: /get.*account|show.*account|fetch.*account|view.*account/i,
    handler: AccountController.fetch,
    metadata: {
      method: 'GET',
      description: 'Get a specific account by ID',
      tags: ['account', 'get', 'query'],
      route: '/api/accounts/:id'
    }
  });

  intentRegistry.register({
    name: 'create_account',
    pattern: /create.*account|add.*account|new.*account/i,
    handler: AccountController.create,
    metadata: {
      method: 'POST',
      description: 'Create a new account',
      tags: ['account', 'create', 'mutation'],
      route: '/api/accounts'
    }
  });

  intentRegistry.register({
    name: 'update_account',
    pattern: /update.*account|modify.*account|edit.*account|change.*account/i,
    handler: AccountController.update,
    metadata: {
      method: 'POST',
      description: 'Update an existing account',
      tags: ['account', 'update', 'mutation'],
      route: '/api/accounts/:id'
    }
  });

  intentRegistry.register({
    name: 'list_account_events',
    pattern: /list.*account.*events?|get.*account.*events?|show.*account.*events?/i,
    handler: AccountEventController.list,
    metadata: {
      method: 'GET',
      description: 'List events for an account',
      tags: ['account', 'event', 'list', 'query'],
      route: '/api/accounts/:id/events'
    }
  });

  intentRegistry.register({
    name: 'create_account_event',
    pattern: /create.*account.*event|add.*account.*event|log.*account.*event/i,
    handler: AccountEventController.create,
    metadata: {
      method: 'POST',
      description: 'Create an event for an account',
      tags: ['account', 'event', 'create', 'mutation'],
      route: '/api/accounts/:id/events'
    }
  });

  intentRegistry.register({
    name: 'list_lanes',
    pattern: /list.*lanes?|get.*lanes?|show.*lanes?|fetch.*lanes?/i,
    handler: LaneController.list,
    metadata: {
      method: 'GET',
      description: 'List all lanes',
      tags: ['lane', 'list', 'query'],
      route: '/api/lanes'
    }
  });

  intentRegistry.register({
    name: 'get_lane_statistics',
    pattern: /get.*lane.*statistics?|show.*lane.*statistics?|lane.*stats?/i,
    handler: LaneStatisticsController.get,
    metadata: {
      method: 'GET',
      description: 'Get lane statistics',
      tags: ['lane', 'statistics', 'query'],
      route: '/api/lanes/statistic'
    }
  });

  intentRegistry.register({
    name: 'update_all_lanes',
    pattern: /update.*all.*lanes?|modify.*all.*lanes?|bulk.*update.*lanes?/i,
    handler: LaneController.updateAll,
    metadata: {
      method: 'POST',
      description: 'Update all lanes',
      tags: ['lane', 'update', 'bulk', 'mutation'],
      route: '/api/lanes'
    }
  });

  intentRegistry.register({
    name: 'update_lane',
    pattern: /update.*lane|modify.*lane|edit.*lane|change.*lane/i,
    handler: LaneController.update,
    metadata: {
      method: 'POST',
      description: 'Update a specific lane',
      tags: ['lane', 'update', 'mutation'],
      route: '/api/lanes/:id'
    }
  });

  intentRegistry.register({
    name: 'list_users',
    pattern: /list.*users?|get.*users?|show.*users?|fetch.*users?/i,
    handler: UserController.list,
    metadata: {
      method: 'GET',
      description: 'List all users',
      tags: ['user', 'list', 'query'],
      route: '/api/users'
    }
  });

  intentRegistry.register({
    name: 'create_user',
    pattern: /create.*user|add.*user|new.*user/i,
    handler: UserController.create,
    metadata: {
      method: 'POST',
      description: 'Create a new user',
      tags: ['user', 'create', 'mutation'],
      route: '/api/users'
    }
  });

  intentRegistry.register({
    name: 'update_user',
    pattern: /update.*user|modify.*user|edit.*user|change.*user/i,
    handler: UserController.update,
    metadata: {
      method: 'POST',
      description: 'Update a user',
      tags: ['user', 'update', 'mutation'],
      route: '/api/users/:id'
    }
  });

  intentRegistry.register({
    name: 'update_user_board',
    pattern: /update.*user.*board|modify.*user.*board|set.*user.*board/i,
    handler: UserController.board,
    metadata: {
      method: 'POST',
      description: 'Update user board settings',
      tags: ['user', 'board', 'update', 'mutation'],
      route: '/api/users/:id/board'
    }
  });

  intentRegistry.register({
    name: 'get_user_flags',
    pattern: /get.*user.*flags?|show.*user.*flags?|fetch.*user.*flags?/i,
    handler: UserController.flags,
    metadata: {
      method: 'GET',
      description: 'Get user flags',
      tags: ['user', 'flags', 'query'],
      route: '/api/users/:id/flags'
    }
  });

  intentRegistry.register({
    name: 'update_user_password',
    pattern: /update.*user.*password|change.*user.*password|set.*user.*password/i,
    handler: UserController.password,
    metadata: {
      method: 'POST',
      description: 'Update user password',
      tags: ['user', 'password', 'update', 'mutation'],
      route: '/api/users/:id/password'
    }
  });

  intentRegistry.register({
    name: 'get_team',
    pattern: /get.*team|show.*team|fetch.*team|view.*team/i,
    handler: TeamController.get,
    metadata: {
      method: 'GET',
      description: 'Get team information',
      tags: ['team', 'get', 'query'],
      route: '/api/teams/:id'
    }
  });

  intentRegistry.register({
    name: 'update_team',
    pattern: /update.*team|modify.*team|edit.*team|change.*team/i,
    handler: TeamController.update,
    metadata: {
      method: 'POST',
      description: 'Update team information',
      tags: ['team', 'update', 'mutation'],
      route: '/api/teams/:id'
    }
  });

  intentRegistry.register({
    name: 'update_team_integration',
    pattern: /update.*team.*integration|modify.*team.*integration|set.*team.*integration/i,
    handler: TeamController.updateIntegration,
    metadata: {
      method: 'POST',
      description: 'Update team integration settings',
      tags: ['team', 'integration', 'update', 'mutation'],
      route: '/api/teams/:id/integrations'
    }
  });

  intentRegistry.register({
    name: 'allow_team_registration',
    pattern: /allow.*team.*registration|enable.*team.*registration/i,
    handler: TeamController.allowTeamRegistration,
    metadata: {
      method: 'POST',
      description: 'Allow team registration',
      tags: ['team', 'registration', 'mutation'],
      route: '/api/teams/:id/allow-team-registration'
    }
  });

  intentRegistry.register({
    name: 'get_forecast_achieved',
    pattern: /get.*forecast.*achieved|show.*forecast.*achieved|achieved.*forecast/i,
    handler: ForecastController.achieved,
    metadata: {
      method: 'GET',
      description: 'Get achieved forecast data',
      tags: ['forecast', 'achieved', 'query'],
      route: '/api/forecast/achieved'
    }
  });

  intentRegistry.register({
    name: 'get_forecast_predicted',
    pattern: /get.*forecast.*predicted|show.*forecast.*predicted|predicted.*forecast/i,
    handler: ForecastController.predicted,
    metadata: {
      method: 'GET',
      description: 'Get predicted forecast data',
      tags: ['forecast', 'predicted', 'query'],
      route: '/api/forecast/predicted'
    }
  });

  intentRegistry.register({
    name: 'list_forecasts',
    pattern: /list.*forecasts?|get.*forecasts?|show.*forecasts?/i,
    handler: ForecastController.list,
    metadata: {
      method: 'GET',
      description: 'List all forecasts',
      tags: ['forecast', 'list', 'query'],
      route: '/api/forecast/list'
    }
  });

  intentRegistry.register({
    name: 'get_forecast_time_series',
    pattern: /get.*forecast.*time.*series|show.*forecast.*time.*series|forecast.*series/i,
    handler: ForecastController.series,
    metadata: {
      method: 'GET',
      description: 'Get forecast time series data',
      tags: ['forecast', 'time-series', 'query'],
      route: '/api/forecast/time-series'
    }
  });

  intentRegistry.register({
    name: 'get_forecast_generated',
    pattern: /get.*forecast.*generated|show.*forecast.*generated|generated.*forecast/i,
    handler: ForecastController.generated,
    metadata: {
      method: 'GET',
      description: 'Get generated forecast data',
      tags: ['forecast', 'generated', 'query'],
      route: '/api/forecast/generated'
    }
  });

  intentRegistry.register({
    name: 'create_schema',
    pattern: /create.*schema|add.*schema|new.*schema/i,
    handler: SchemaController.create,
    metadata: {
      method: 'POST',
      description: 'Create a new schema',
      tags: ['schema', 'create', 'mutation'],
      route: '/api/schemas'
    }
  });

  intentRegistry.register({
    name: 'list_schemas',
    pattern: /list.*schemas?|get.*schemas?|show.*schemas?/i,
    handler: SchemaController.list,
    metadata: {
      method: 'GET',
      description: 'List all schemas',
      tags: ['schema', 'list', 'query'],
      route: '/api/schemas'
    }
  });

  intentRegistry.register({
    name: 'list_activities',
    pattern: /list.*activities|get.*activities|show.*activities|fetch.*activities/i,
    handler: ActivityController.list,
    metadata: {
      method: 'GET',
      description: 'List all activities',
      tags: ['activity', 'list', 'query'],
      route: '/api/activities'
    }
  });

  intentRegistry.register({
    name: 'user_login',
    pattern: /login|sign.*in|authenticate/i,
    handler: LoginController.handle,
    metadata: {
      method: 'POST',
      description: 'User login',
      tags: ['auth', 'login', 'public'],
      route: '/public/login'
    }
  });

  intentRegistry.register({
    name: 'user_register',
    pattern: /register|sign.*up|create.*account/i,
    handler: RegisterController.register,
    metadata: {
      method: 'POST',
      description: 'User registration',
      tags: ['auth', 'register', 'public'],
      route: '/public/register'
    }
  });

  intentRegistry.register({
    name: 'get_register_invite',
    pattern: /get.*register.*invite|show.*register.*invite|registration.*invite/i,
    handler: RegisterController.invite,
    metadata: {
      method: 'GET',
      description: 'Get registration invite',
      tags: ['auth', 'register', 'invite', 'public'],
      route: '/public/register/invite'
    }
  });

  intentRegistry.register({
    name: 'get_register_status',
    pattern: /get.*register.*status|show.*register.*status|registration.*status/i,
    handler: RegisterController.status,
    metadata: {
      method: 'GET',
      description: 'Get registration status',
      tags: ['auth', 'register', 'status', 'public'],
      route: '/public/register/status'
    }
  });

  intentRegistry.register({
    name: 'validate_token',
    pattern: /validate.*token|verify.*token|check.*token/i,
    handler: ValidateTokenController.validate,
    metadata: {
      method: 'POST',
      description: 'Validate authentication token',
      tags: ['auth', 'token', 'validate', 'public'],
      route: '/public/validate-token'
    }
  });

  log.info(`intent registry initialised with ${intentRegistry.size()} intents`);

  const card = express.Router();

  card.use(express.json({ limit: '5kb' }));
  card.use(verifyJwt, addEntityToHeader, setHeaders, isDatabaseConnectionEstablished);

  card.route('/').get(CardController.list);
  card
    .route('/')
    .post(
      rejectIfContentTypeIsNot('application/json'),
      validateAgainst(CardRequestSchema),
      CardController.create
    );
  card.route('/:id').get(CardController.get);
  card
    .route('/:id?')
    .post(
      rejectIfContentTypeIsNot('application/json'),
      validateAgainst(CardRequestSchema),
      CardController.update
    );
  card.route('/:id/events').get(CardEventController.list);
  card
    .route('/:id/events')
    .post(
      rejectIfContentTypeIsNot('application/json'),
      validateAgainst(EventRequestSchema),
      CardEventController.create
    );

  app.use('/api/cards', card);

  const team = express.Router();

  team.use(express.json({ limit: '5kb' }));

  team.use(verifyJwt, addEntityToHeader, setHeaders, isDatabaseConnectionEstablished);

  team.route('/:id').get(TeamController.get);
  team
    .route('/:id')
    .post(
      rejectIfContentTypeIsNot('application/json'),
      validateAgainst(TeamRequestSchema),
      TeamController.update
    );
  team
    .route('/:id/integrations')
    .post(rejectIfContentTypeIsNot('application/json'), TeamController.updateIntegration);
  team
    .route('/:id/allow-team-registration')
    .post(rejectIfContentTypeIsNot('application/json'), TeamController.allowTeamRegistration);

  app.use('/api/teams', team);

  const account = express.Router();

  account.use(express.json({ limit: '5kb' }));

  account.use(verifyJwt, addEntityToHeader, setHeaders, isDatabaseConnectionEstablished);

  account.route('/').get(AccountController.list);
  account
    .route('/')
    .post(
      rejectIfContentTypeIsNot('application/json'),
      validateAgainst(AccountRequestSchema),
      AccountController.create
    );
  account
    .route('/:id')
    .post(
      rejectIfContentTypeIsNot('application/json'),
      validateAgainst(AccountRequestSchema),
      AccountController.update
    );
  account.route('/:id').get(AccountController.fetch);
  account.route('/:id/events').get(AccountEventController.list);
  account
    .route('/:id/events')
    .post(
      rejectIfContentTypeIsNot('application/json'),
      validateAgainst(EventRequestSchema),
      AccountEventController.create
    );

  app.use('/api/accounts', account);

  const lane = express.Router();

  lane.use(express.json({ limit: '5kb' }));

  lane.use(verifyJwt, addEntityToHeader, setHeaders, isDatabaseConnectionEstablished);

  lane.route('/').get(LaneController.list);
  lane.route('/statistic').get(LaneStatisticsController.get);
  lane
    .route('/')
    .post(
      rejectIfContentTypeIsNot('application/json'),
      validateAgainst(LanesRequestSchema),
      LaneController.updateAll
    );
  lane
    .route('/:id')
    .post(
      rejectIfContentTypeIsNot('application/json'),
      validateAgainst(LaneRequestSchema),
      LaneController.update
    );

  app.use('/api/lanes', lane);

  const user = express.Router();

  user.use(express.json({ limit: '5kb' }));

  user.use(verifyJwt, addEntityToHeader, setHeaders, isDatabaseConnectionEstablished);

  user.route('/').get(UserController.list);
  user
    .route('/')
    .post(
      rejectIfContentTypeIsNot('application/json'),
      validateAgainst(UserRequestSchema),
      UserController.create
    );
  user
    .route('/:id')
    .post(
      rejectIfContentTypeIsNot('application/json'),
      validateAgainst(UserUpdateRequestSchema),
      UserController.update
    );
  user
    .route('/:id/board')
    .post(
      rejectIfContentTypeIsNot('application/json'),
      validateAgainst(BoardRequestSchema),
      UserController.board
    );
  user.route('/:id/flags').get(UserController.flags);
  user
    .route('/:id/password')
    .post(
      rejectIfContentTypeIsNot('application/json'),
      validateAgainst(PasswordRequestSchema),
      UserController.password
    );

  app.use('/api/users', user);

  const forecast = express.Router();

  forecast.use(express.json({ limit: '5kb' }));

  forecast.use(
    verifyJwt,
    addEntityToHeader,
    setHeaders,
    setHeaders,
    isDatabaseConnectionEstablished
  );

  forecast.route('/achieved').get(ForecastController.achieved);
  forecast.route('/predicted').get(ForecastController.predicted);
  forecast.route('/list').get(ForecastController.list);
  forecast.route('/time-series').get(ForecastController.series);
  forecast.route('/generated').get(ForecastController.generated);

  app.use('/api/forecast', forecast);

  const schema = express.Router();

  schema.use(express.json({ limit: '5kb' }));

  schema.use(verifyJwt);
  schema.use(addEntityToHeader);
  schema.use(setHeaders);
  schema.use(isDatabaseConnectionEstablished);

  schema
    .route('/')
    .post(
      rejectIfContentTypeIsNot('application/json'),
      validateAgainst(SchemaRequestSchema),
      SchemaController.create
    );
  schema.route('/').get(SchemaController.list);

  app.use('/api/schemas', schema);

  const activity = express.Router();

  activity.use(express.json({ limit: '5kb' }));

  activity.use(
    verifyJwt,
    addEntityToHeader,
    setHeaders,
    setHeaders,
    isDatabaseConnectionEstablished
  );

  activity.route('/').get(ActivityController.list);

  app.use('/api/activities', activity);

  const unprotected = express.Router();

  unprotected.use(express.json({ limit: '1kb' }));
  unprotected.use(setHeaders);
  unprotected.use(isDatabaseConnectionEstablished);

  unprotected
    .route('/login')
    .post(
      rejectIfContentTypeIsNot('application/json'),
      validateAgainst(LoginRequestSchema),
      LoginController.handle
    );
  unprotected
    .route('/register')
    .post(
      rejectIfContentTypeIsNot('application/json'),
      validateAgainst(RegisterRequestSchema),
      RegisterController.register
    );
  unprotected.route('/register/invite').get(RegisterController.invite);
  unprotected.route('/register/status').get(RegisterController.status);
  unprotected
    .route('/validate-token')
    .post(
      rejectIfContentTypeIsNot('application/json'),
      validateAgainst(ValidateTokenRequestSchema),
      ValidateTokenController.validate
    );

  app.use('/public', unprotected);
} catch (error) {
  log.error(error);
}

/* return 404 for all other /api routes */
app.all('/api/*', (req, res) => {
  res.status(404).end();
});

app.use(handleError);

const server = http.createServer(app);

server.listen(PORT, IP_ADDRESS, () => {
  log.info(`Listening on ${IP_ADDRESS}:${PORT}`);
});

try {
  const timelineNotification = new JobDailyScheduler(
    notifyOnMissedFollowUpDatesTimeline,
    '10:00'
  ).start();
} catch (error) {
  log.error(error);
}
