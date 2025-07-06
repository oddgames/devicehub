# DeviceHub - Project Overview and Architecture

## Project Summary

VK DeviceHub is a fork of DeviceFarmer/STF (Smartphone Test Farm) developed by VK Company. It's a comprehensive platform for managing, controlling, and testing mobile devices (Android and iOS) remotely through a web interface.

## Tech Stack

### Backend
- **Runtime**: Node.js (ESM modules)
- **Framework**: Express.js for REST API
- **Database**: MongoDB 6.x (migrated from RethinkDB)
- **Real-time Communication**: 
  - Socket.io for client-server communication
  - ZeroMQ for internal service communication
- **Authentication**: JWT-based with multiple providers (LDAP, OAuth2, SAML2)
- **Message Format**: Protocol Buffers
- **Device Communication**: 
  - Android: ADB (Android Debug Bridge)
  - iOS: WebDriverAgent, node-simctl

### Frontend
- **Framework**: React 18 with TypeScript
- **UI Library**: VKontakte VKUI
- **State Management**: MobX with persistence
- **Data Fetching**: TanStack Query (React Query)
- **Routing**: React Router
- **Build Tool**: Vite
- **Styling**: CSS Modules with PostCSS

## Architecture Overview

### Microservices Architecture
The system is composed of multiple independent services:

1. **API Service** (`/api/v1`): RESTful API gateway
2. **WebSocket Service**: Real-time client communication
3. **Auth Service**: Multiple authentication providers
4. **Provider Service**: Device provider management
5. **Processor Service**: Background job processing
6. **Reaper Service**: Cleanup of stale resources
7. **Storage Services**: File storage (S3-compatible, temporary)
8. **Device Services**: iOS and Android device management

### Database Schema
Main MongoDB collections:
- `users`: User accounts and profiles
- `devices`: Device inventory and status
- `groups`: Group management and permissions
- `accessTokens`: Authentication tokens
- `vncauth`: VNC authentication
- `logs`: System logs
- `stats`: Usage statistics

### API Structure
- Base path: `/api/v1`
- OpenAPI 3.0 specification
- Main resources:
  - `/devices` - Device management
  - `/groups` - Group operations
  - `/users` - User management
  - `/user` - Current user operations
  - `/autotests` - Automated testing
  - `/stats` - Statistics

### Communication Patterns
1. **Client-Server**: Socket.io for real-time updates
2. **Service-to-Service**: ZeroMQ with push/pull and pub/sub patterns
3. **Message Protocol**: Protocol Buffers with 120+ message types

## Key Features

### Device Support
- **Android**: Versions 2.3.3 (API 10) to 14 (API 34)
- **iOS**: All devices supported by WebDriverAgent
- **Special Support**: Android Wear, Fire OS, CyanogenMod
- **No Root Required**: Full functionality without device rooting

### Remote Control
- Real-time screen mirroring (30-40 FPS)
- Touch input with multitouch support
- Keyboard input with meta keys
- Device rotation (auto/manual)
- Drag & drop APK installation
- Clipboard operations
- Reverse port forwarding

### Management Features
- Device inventory with search
- User and group management
- Device booking/reservation system
- Device partitioning for projects
- Battery monitoring
- Usage statistics and tracking

### Development Features
- REST API for automation
- WebSocket API for real-time updates
- Multiple authentication methods
- Docker-based deployment
- Kubernetes/Helm support

## Project Structure

```
devicehub/
├── bin/              # CLI executables
├── lib/              # Core application code
│   ├── units/        # Microservices
│   │   ├── api/      # REST API service
│   │   ├── auth/     # Authentication services
│   │   ├── device/   # Device management
│   │   ├── websocket/# WebSocket service
│   │   └── ...       # Other services
│   ├── db/           # Database layer
│   ├── wire/         # Protocol Buffer definitions
│   └── util/         # Utilities
├── ui/               # React frontend
│   ├── src/          # Source code
│   ├── public/       # Static assets
│   └── ...           # Frontend configs
├── test/             # Test suites
├── doc/              # Documentation
├── helm/             # Kubernetes manifests
└── scripts/          # Deployment scripts
```

## Running the Project

### Development Mode
```bash
# Start MongoDB
docker run --rm -d -p 27017:27017 -h 127.0.0.1 --name mongo mongo:6.0.10 --replSet=test
docker exec mongo mongosh --eval "rs.initiate();"

# Install dependencies
npm install

# Start all services
stf local
```

### Production Deployment
```bash
# Using Docker Compose
docker compose -f docker-compose-prod.yaml --env-file scripts/variables.env up

# For macOS
docker compose -f docker-compose-macos.yaml --env-file scripts/variables.env up
```

## Environment Variables

Key environment variables:
- `STF_ROOT_GROUP_NAME`: Root group name (default: "Common")
- `STF_ADMIN_NAME`: Admin username (default: "administrator")
- `STF_ADMIN_EMAIL`: Admin email (default: "administrator@fakedomain.com")

## Development Notes

### Code Style
- ESM modules throughout
- TypeScript for type safety
- Express middleware pattern
- React functional components
- MobX for state management

### Testing
- Unit tests with Vitest
- E2E tests with Playwright
- API tests with Poetry

### Common Commands
```bash
# Build Swagger/OpenAPI
npm run build:swagger

# Run UI in development
cd ui && npm run dev

# Run tests
npm test

# Generate documentation
npm run doc
```

## Areas for Enhancement

Based on analysis, potential areas for new features:
1. Advanced analytics and reporting
2. AI-powered anomaly detection
3. Enhanced collaboration tools
4. CI/CD pipeline integration
5. Performance benchmarking
6. Cost tracking and billing
7. Multi-device test orchestration
8. Improved iOS support features

## Important Links

- GitHub: https://github.com/VKCOM/devicehub
- Original STF: https://github.com/DeviceFarmer/stf
- VK Development Chat: https://vk.me/join/QCCJfaPu544UDzXgQrXe1jNVMyVEdh9bFZg=