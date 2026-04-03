const { supabase } = require('../config/database');
const logger = require('../config/logger');

const {
    getJwtSecret,
    getJwtRefreshSecret,
    getAccessTtl,
    getRefreshTtl,
} = require('../config/jwt');

// Repositories
const SupabaseWalletRepository = require('./adapters/outbound/repositories/SupabaseWalletRepository');
const SupabaseTransactionRepository = require('./adapters/outbound/repositories/SupabaseTransactionRepository');
const SupabaseUserRepository = require('./adapters/outbound/repositories/SupabaseUserRepository');
const SupabaseGroupRepository = require('./adapters/outbound/repositories/SupabaseGroupRepository');
const SupabaseEventRepository = require('./adapters/outbound/repositories/SupabaseEventRepository');

// External Services Adapters
const BCryptHashProvider = require('./adapters/outbound/external-services/BCryptHashProvider');
const NodemailerEmailProvider = require('./adapters/outbound/external-services/NodemailerEmailProvider');
const StripePaymentProcessor = require('./adapters/outbound/external-services/StripePaymentProcessor');

// Use Cases
const InitiateTransaction = require('../core/application/use-cases/InitiateTransaction');
const ProcessTransaction = require('../core/application/use-cases/ProcessTransaction');
const TransferCredits = require('../core/application/use-cases/TransferCredits');
const GetWalletBalance = require('../core/application/use-cases/GetWalletBalance');
const GetWallets = require('../core/application/use-cases/GetWallets');
const GetWalletTransactions = require('../core/application/use-cases/GetWalletTransactions');
const RegisterUser = require('../core/application/use-cases/RegisterUser');
const LoginUser = require('../core/application/use-cases/LoginUser');
const VerifyEmail = require('../core/application/use-cases/VerifyEmail');
const RefreshToken = require('../core/application/use-cases/RefreshToken');
const CreateGroup = require('../core/application/use-cases/CreateGroup');
const GetGroups = require('../core/application/use-cases/GetGroups');
const GetGroup = require('../core/application/use-cases/GetGroup');
const GetEvents = require('../core/application/use-cases/GetEvents');
const ParticipateInEvent = require('../core/application/use-cases/ParticipateInEvent');
const GetParticipants = require('../core/application/use-cases/GetParticipants');
const GetPendingParticipations = require('../core/application/use-cases/GetPendingParticipations');
const ValidateParticipation = require('../core/application/use-cases/ValidateParticipation');
const CreateEvent = require('../core/application/use-cases/CreateEvent');
const CreateCheckoutSession = require('../core/application/use-cases/CreateCheckoutSession');
const GetPaymentRequests = require('../core/application/use-cases/GetPaymentRequests');
const RespondToPaymentRequest = require('../core/application/use-cases/RespondToPaymentRequest');

// Controllers
const TransactionController = require('./adapters/inbound/http/controllers/TransactionController');
const WalletController = require('./adapters/inbound/http/controllers/WalletController');
const AuthController = require('./adapters/inbound/http/controllers/AuthController');
const GroupController = require('./adapters/inbound/http/controllers/GroupController');
const EventController = require('./adapters/inbound/http/controllers/EventController');
const PaymentController = require('./adapters/inbound/http/controllers/PaymentController');

// Routes Creators
const createTransactionRoutes = require('./adapters/inbound/http/routes/transaction.routes');
const createWalletRoutes = require('./adapters/inbound/http/routes/wallet.routes');
const createAuthRoutes = require('./adapters/inbound/http/routes/auth.routes');
const createGroupRoutes = require('./adapters/inbound/http/routes/group.routes');
const createEventRoutes = require('./adapters/inbound/http/routes/event.routes');
const createPaymentRoutes = require('./adapters/inbound/http/routes/payment.routes');

/**
 * Bootstrap the application dependencies (Manual Dependency Injection)
 */
function bootstrap() {
    // 1. Instancier les services externes / outils
    const hashProvider = new BCryptHashProvider();
    const emailProvider = new NodemailerEmailProvider();
    const paymentProcessor = new StripePaymentProcessor();

    // 2. Instancier les repositories (Adapteurs de sortie)
    const walletRepo = new SupabaseWalletRepository(supabase);
    const transactionRepo = new SupabaseTransactionRepository(supabase);
    const userRepo = new SupabaseUserRepository(supabase);
    const groupRepo = new SupabaseGroupRepository(supabase);
    const eventRepo = new SupabaseEventRepository(supabase);

    // 3. Instancier les Use Cases (Application)
    const initiateTransactionUC = new InitiateTransaction(walletRepo, transactionRepo, logger);
    const processTransactionUC = new ProcessTransaction(walletRepo, transactionRepo, logger);
    const transferCreditsUC = new TransferCredits(walletRepo, transactionRepo, initiateTransactionUC, processTransactionUC, logger);
    const getWalletBalanceUC = new GetWalletBalance(walletRepo);
    const getWalletsUC = new GetWallets(walletRepo);
    const getWalletTransactionsUC = new GetWalletTransactions(transactionRepo);

    const registerUserUC = new RegisterUser(userRepo, walletRepo, emailProvider, hashProvider, logger);
    const loginUserUC = new LoginUser(userRepo, hashProvider, logger, {
        secret: getJwtSecret(),
        refreshSecret: getJwtRefreshSecret(),
        expiresIn: getAccessTtl(),
        refreshExpiresIn: getRefreshTtl(),
        requireVerification: process.env.REQUIRE_VERIFICATION === 'true'
    });
    const verifyEmailUC = new VerifyEmail(userRepo, logger);
    const refreshTokenUC = new RefreshToken(userRepo, logger, {
        secret: getJwtSecret(),
        refreshSecret: getJwtRefreshSecret(),
        expiresIn: getAccessTtl(),
        refreshExpiresIn: getRefreshTtl()
    });

    const createGroupUC = new CreateGroup(groupRepo, logger);
    const getGroupsUC = new GetGroups(groupRepo);
    const getGroupUC = new GetGroup(groupRepo);

    const getEventsUC = new GetEvents(eventRepo);
    const participateInEventUC = new ParticipateInEvent(eventRepo, walletRepo, logger);
    const getParticipantsUC = new GetParticipants(eventRepo);
    const getPendingParticipationsUC = new GetPendingParticipations(eventRepo);
    const validateParticipationUC = new ValidateParticipation(eventRepo, walletRepo, transactionRepo, logger);
    const createEventUC = new CreateEvent(eventRepo, logger);

    const createCheckoutSessionUC = new CreateCheckoutSession(paymentProcessor, logger);
    const getPaymentRequestsUC = new GetPaymentRequests(transactionRepo);
    const respondToPaymentRequestUC = new RespondToPaymentRequest(transactionRepo, walletRepo, processTransactionUC, logger);

    // 4. Instancier les contrôleurs (Adapteurs d'entrée)
    const transactionController = new TransactionController(initiateTransactionUC, processTransactionUC, transferCreditsUC);
    const walletController = new WalletController(getWalletBalanceUC, getWalletsUC, getWalletTransactionsUC);
    const authController = new AuthController(registerUserUC, loginUserUC, verifyEmailUC, refreshTokenUC);
    const groupController = new GroupController(createGroupUC, getGroupsUC, getGroupUC);
    const eventController = new EventController(getEventsUC, participateInEventUC, getParticipantsUC, getPendingParticipationsUC, validateParticipationUC, createEventUC);
    const paymentController = new PaymentController(createCheckoutSessionUC, getPaymentRequestsUC, respondToPaymentRequestUC);

    // 5. Créer les routes express
    const transactionRoutesHex = createTransactionRoutes(transactionController);
    const walletRoutesHex = createWalletRoutes(walletController);
    const authRoutesHex = createAuthRoutes(authController);
    const groupRoutesHex = createGroupRoutes(groupController);
    const eventRoutesHex = createEventRoutes(eventController);
    const paymentRoutesHex = createPaymentRoutes(paymentController);

    return {
        transactionRoutesHex,
        walletRoutesHex,
        authRoutesHex,
        groupRoutesHex,
        eventRoutesHex,
        paymentRoutesHex
    };
}

module.exports = bootstrap;
