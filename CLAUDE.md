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

## AI Testing Integration Guide

### Adding AI Testing Tab to Device Control

The device control interface uses a modular tab system that makes adding new features straightforward. To add an AI testing tab:

#### 1. Create Route Path
Add to `/ui/src/constants/route-paths.ts`:
```typescript
export const getControlAITestingRoute = (serial: string) => `/control/${serial}/ai-testing` as const
```

#### 2. Create AI Testing Tab Component
Create `/ui/src/components/views/control-page/tabs/ai-testing-tab/ai-testing-tab.tsx`:
```typescript
import { observer } from 'mobx-react-lite'
import { useDeviceContainer } from '@/hooks/use-device-container'
import { AITestingStore } from '@/stores/ai-testing-store'
import { AIChat } from '@/components/ui/ai-chat'

export const AITestingTab = observer(() => {
  const { serial } = useDeviceSerial()
  const aiTestingStore = useDeviceContainer(serial).resolve(AITestingStore)
  
  return (
    <div className={styles.container}>
      <AIChat store={aiTestingStore} />
    </div>
  )
})
```

#### 3. Add Tab to Device Control Panel
Update `/ui/src/components/ui/device-control-panel/device-control-panel.tsx`:
```typescript
{
  id: getControlAITestingRoute(serial),
  title: t('AI Testing'),
  before: <Icon20RobotOutline height={17} width={17} />,
  ariaControls: 'tab-content-ai-testing',
  content: <AITestingTab />,
}
```

#### 4. Add Route Configuration
Update `/ui/src/components/app-router.tsx`:
```typescript
<Route element={<ControlPage />} path='ai-testing' />
```

### AI Provider Architecture

#### 1. AI Provider Service
Create `/ui/src/services/ai-provider-service/ai-provider-service.ts`:
```typescript
@injectable()
export class AIProviderService {
  constructor(
    @inject(TYPES.ConfigStore) private configStore: ConfigStore
  ) {}
  
  async sendMessage(message: string, screenshot?: Blob): Promise<AIResponse> {
    const provider = this.configStore.aiProvider
    const apiKey = this.configStore.aiApiKey
    
    // Route to appropriate provider
    switch (provider) {
      case 'openai':
        return this.sendToOpenAI(message, screenshot, apiKey)
      case 'anthropic':
        return this.sendToAnthropic(message, screenshot, apiKey)
      // Add more providers
    }
  }
}
```

#### 2. AI Testing Store
Create `/ui/src/stores/ai-testing-store.ts`:
```typescript
@injectable()
export class AITestingStore {
  @observable messages: AIMessage[] = []
  @observable isProcessing = false
  
  constructor(
    @inject(TYPES.DeviceControlStore) private deviceControl: DeviceControlStore,
    @inject(TYPES.AIProviderService) private aiProvider: AIProviderService
  ) {}
  
  @action
  async sendMessage(content: string) {
    // Add user message
    this.messages.push({ role: 'user', content })
    
    // Capture screenshot
    const screenshot = await this.deviceControl.captureScreenshot()
    
    // Send to AI
    this.isProcessing = true
    const response = await this.aiProvider.sendMessage(content, screenshot)
    
    // Process AI response and execute commands
    await this.processAIResponse(response)
    this.isProcessing = false
  }
  
  private async processAIResponse(response: AIResponse) {
    // Parse commands from AI response
    const commands = this.parseCommands(response.content)
    
    // Execute each command
    for (const command of commands) {
      await this.executeCommand(command)
    }
  }
}
```

### Adding AI Provider Settings

#### 1. Update Settings Schema
Add to `/ui/src/types/settings.ts`:
```typescript
interface Settings {
  // ... existing settings
  aiProvider?: 'openai' | 'anthropic' | 'gemini'
  aiApiKey?: string
  aiModel?: string
  aiSystemPrompt?: string
}
```

#### 2. Create AI Settings Component
Create `/ui/src/components/views/settings/ai-settings/ai-settings.tsx`:
```typescript
export const AISettings = observer(() => {
  const settingsStore = useInjection(TYPES.SettingsStore)
  
  return (
    <FormItem top="AI Provider">
      <Select
        value={settingsStore.aiProvider}
        onChange={(e) => settingsStore.setAIProvider(e.target.value)}
      >
        <option value="openai">OpenAI</option>
        <option value="anthropic">Anthropic</option>
        <option value="gemini">Google Gemini</option>
      </Select>
      
      <FormItem top="API Key">
        <Input
          type="password"
          value={settingsStore.aiApiKey}
          onChange={(e) => settingsStore.setAIApiKey(e.target.value)}
        />
      </FormItem>
      
      <FormItem top="System Prompt">
        <Textarea
          value={settingsStore.aiSystemPrompt}
          onChange={(e) => settingsStore.setSystemPrompt(e.target.value)}
          placeholder="You are an AI assistant helping test mobile applications..."
        />
      </FormItem>
    </FormItem>
  )
})
```

#### 3. WebSocket Integration
Add AI message types to `/lib/wire/wire.proto`:
```protobuf
message AITestingRequest {
  required string message = 1;
  optional bytes screenshot = 2;
}

message AITestingResponse {
  required string content = 1;
  repeated DeviceCommand commands = 2;
}
```

### Implementation Considerations

1. **Security**: Store API keys securely, consider backend storage for production
2. **Rate Limiting**: Implement rate limiting for AI API calls
3. **Error Handling**: Graceful degradation when AI services are unavailable
4. **Command Safety**: Validate AI-suggested commands before execution
5. **Context Window**: Manage conversation history to stay within token limits
6. **Streaming**: Implement streaming responses for better UX
7. **Multi-modal**: Support image analysis for visual testing scenarios

### Backend Integration Points

1. **New API Endpoints**: `/api/v1/ai-testing/*`
2. **WebSocket Messages**: Handle `ai.testing.*` message namespace
3. **Storage**: Store AI conversation history and test results
4. **Permissions**: Add AI testing permissions to group management

## Important Links

- GitHub: https://github.com/VKCOM/devicehub
- Original STF: https://github.com/DeviceFarmer/stf
- VK Development Chat: https://vk.me/join/QCCJfaPu544UDzXgQrXe1jNVMyVEdh9bFZg=