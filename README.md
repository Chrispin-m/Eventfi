# CrossFi Event Ticketing Platform

A decentralized event ticketing platform built on CrossFi Chain supporting XFI, XUSD, and MPX token payments. This platform enables event organizers to create secure, blockchain-verified events while providing buyers with fraud-proof NFT tickets.

## 🌟 Features

### For Event Organizers
- **Event Creation**: Create events with customizable ticket tiers
- **Multi-Token Support**: Accept payments in XFI, XUSD, or MPX
- **NFT Tickets**: Automatic minting of ERC-721 ticket NFTs
- **QR Code Verification**: Built-in ticket scanner for event entry
- **Dashboard**: Comprehensive organizer dashboard

### For Ticket Buyers
- **Secure Payments**: Web3 wallet integration for secure transactions
- **NFT Ownership**: Receive verifiable NFT tickets
- **QR Codes**: Digital tickets with scannable QR codes
- **Fraud Protection**: Blockchain-verified ticket authenticity

### Technical Features
- **Smart Contracts**: Production-ready Solidity contracts
- **RESTful API**: Node.js backend with Express
- **Modern Frontend**: React with TypeScript and Tailwind CSS
- **Web3 Integration**: Ethers.js for blockchain interactions
- **Responsive Design**: Mobile-first design approach

## 🏗️ Architecture

```
├── contracts/           # Solidity smart contracts
├── scripts/            # Deployment scripts
├── test/               # Smart contract tests
├── server/             # Node.js backend API
│   ├── routes/         # API routes
│   ├── middleware/     # Express middleware
│   └── config/         # Configuration files
├── src/                # React frontend
│   ├── components/     # Reusable components
│   ├── pages/          # Page components
│   ├── context/        # React context providers
│   └── hooks/          # Custom React hooks
└── docs/               # Documentation
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- MetaMask or compatible Web3 wallet
- CrossFi Chain network added to your wallet

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd crossfi-event-ticketing-platform
   ```

2. **Install dependencies**
   ```bash
   npm install
   cd server && npm install && cd ..
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Compile Smart Contracts**
   ```bash
   npm run compile
   ```

5. **Run Tests**
   ```bash
   npm test
   ```

6. **Deploy Contracts (Testnet)**
   ```bash
   npm run deploy:testnet
   ```

7. **Start Development Servers**
   ```bash
   # Terminal 1: Frontend
   npm run dev
   
   # Terminal 2: Backend API
   npm run server:dev
   ```

## 📱 Usage

### For Event Organizers

1. **Connect Wallet**: Connect your MetaMask wallet to the CrossFi network
2. **Create Event**: Navigate to the Organizer Dashboard and click "Create New Event"
3. **Fill Details**: Enter event information, dates, and location
4. **Configure Tiers**: Set up ticket tiers with pricing in XFI, XUSD, or MPX
5. **Pay Listing Fee**: Pay the 0.1 token listing fee to deploy your event
6. **Manage Event**: View and manage your events from the dashboard

### For Ticket Buyers

1. **Browse Events**: Visit the homepage to see available events
2. **Select Event**: Click on an event to view details and ticket tiers
3. **Choose Tier**: Select your preferred ticket tier and payment token
4. **Connect Wallet**: Connect your Web3 wallet if not already connected
5. **Purchase**: Confirm the transaction to buy your NFT ticket
6. **Download QR**: Save your ticket QR code for event entry

### For Event Entry

1. **Scanner Access**: Event organizers can access the ticket scanner
2. **Verify Tickets**: Upload QR code images or enter ticket data manually
3. **Blockchain Verification**: System verifies tickets against the smart contract
4. **Mark as Used**: Valid tickets can be marked as used for entry

## 🔧 Configuration

### CrossFi Network Setup

Add CrossFi Testnet to MetaMask:
- **Network Name**: CrossFi Testnet
- **RPC URL**: https://rpc.testnet.ms
- **Chain ID**: 4157
- **Currency Symbol**: XFI
- **Block Explorer**: https://scan.testnet.ms

### Environment Variables

Key environment variables to configure:

```bash
# Network
CROSSFI_TESTNET_RPC=https://rpc.testnet.ms
CROSSFI_MAINNET_RPC=https://rpc.mainnet.ms

# Deployment
PRIVATE_KEY=your_private_key_here

# Contracts (after deployment)
EVENT_MANAGER_CONTRACT=deployed_contract_address

# Token Addresses
XUSD_TOKEN_ADDRESS=xusd_token_address
MPX_TOKEN_ADDRESS=mpx_token_address

# Backend
PORT=3000
FRONTEND_URL=http://localhost:5173
```

## 📄 Smart Contracts

### EventManager.sol
Main contract handling event creation, ticket sales, and verification.

**Key Functions**:
- `createEvent()`: Create a new event with listing fee
- `addTicketTier()`: Add ticket tiers to events
- `buyTicket()`: Purchase tickets and mint NFTs
- `verifyTicket()`: Verify ticket validity
- `verifyAndUseTicket()`: Mark tickets as used

### Security Features
- **ReentrancyGuard**: Protection against reentrancy attacks
- **Access Control**: Organizer-only functions
- **Input Validation**: Comprehensive parameter validation
- **Safe Math**: Built-in overflow protection

## 🧪 Testing

Run the test suite:

```bash
# Smart contract tests
npm test

# Backend API tests (when implemented)
cd server && npm test

# Frontend tests (when implemented)
npm run test:frontend
```

## 🚀 Deployment

### Testnet Deployment
```bash
npm run deploy:testnet
```

### Mainnet Deployment
```bash
npm run deploy:mainnet
```

### Backend Deployment
The backend can be deployed to any Node.js hosting service:

```bash
# Build for production
cd server
npm run build

# Start production server
npm start
```

### Frontend Deployment
```bash
# Build frontend
npm run build

# The dist/ folder contains the production build
```

## 🔗 API Documentation

### Events API

**GET /api/events**
- Get all events (paginated)
- Query params: `page`, `limit`, `organizer`

**GET /api/events/:id**
- Get event details by ID
- Returns event info and ticket tiers

**POST /api/events/:id/purchase**
- Prepare ticket purchase
- Requires buyer signature

### Organizer API

**POST /api/organizer/events**
- Create new event
- Requires organizer signature

**GET /api/organizer/events**
- Get events for specific organizer

### Tickets API

**GET /api/tickets/:id**
- Get ticket details and QR code

**POST /api/tickets/verify**
- Verify ticket using QR data

## 🛡️ Security Considerations

- **Private Key Management**: Never commit private keys to version control
- **Input Validation**: All user inputs are validated and sanitized
- **Rate Limiting**: API endpoints are rate-limited to prevent abuse
- **CORS Configuration**: Proper CORS setup for frontend-backend communication
- **Smart Contract Security**: Reentrancy guards and access controls implemented

## 🔧 Development

### Adding New Features

1. **Smart Contract Changes**: Update contracts in `contracts/`
2. **Backend API**: Add routes in `server/routes/`
3. **Frontend Components**: Create components in `src/components/`
4. **Testing**: Add tests for new functionality

### Code Style

- **Solidity**: Follow Solidity style guide
- **TypeScript**: ESLint configuration provided
- **Formatting**: Prettier for consistent formatting

## 📞 Support

For support and questions:
- **GitHub Issues**: Report bugs and feature requests
- **Documentation**: Check the docs/ folder for detailed guides
- **Community**: Join our Discord/Telegram community

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- **CrossFi Chain**: For providing the blockchain infrastructure
- **OpenZeppelin**: For secure smart contract libraries
- **React Community**: For the excellent frontend framework
- **Ethers.js**: For Web3 integration

---

Built with ❤️ for the CrossFi ecosystem