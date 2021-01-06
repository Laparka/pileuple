# Overview
PileUple is a Compile-time IoC library, which generates Service Resolvers and an IoC container for TypeScript code. The library is using the TypeScript parser to build and analyze the AST of your source code.
There are a lot of IoC libraries implemented for TypeScript. Most of these libraries are clones that use reflect-metadata and experimental decorators libraries. But since TypeScript is a transpiler, it's already a "reflector" itself.

>:warning: The library is still in development. This is my first TypeScript learning project
> I have a lot of plans. Mainly, I need this library for my AWS Lambda project,
> where a microservices approach is more relevant, and the size of a package matters.

# Basic Usage
```
npm install pileuple --save-dev
```

>Project Structure Example
>```
>src/
>├── services/
>│   ├── logger.ts
>│   ├── apiService.ts
>│   └── types.ts
>└── registrations.ts
>```
## 1) Implement Registrations
First, you need to write a registration class to provide dependencies.

>Code Content of `/src/registrations.ts`
>```typescript
>import { Logger, ConsoleLoggerImpl } from "./services/logger";
>import { TYPES } from "./services/types";
>import { ApiService, DebugApiServiceImpl } from "./services/apiService";
>import { ContainerBuilder } from 'pileuple/api/containerBuilder';
>import { DependenciesRegistration } from 'pileuple/api/dependenciesRegistration';
>
>export class Registrations implements DependenciesRegistration {
>    register(containerBuilder: ContainerBuilder): void {
>        containerBuilder.addTransient<Logger, ConsoleLoggerImpl>();
>        containerBuilder.addSingleton<ApiService, DebugApiServiceImpl>(TYPES.ApiService);
>    }
>}
>```
## 2) Run the PileUple Code-generator
```
npm run pileuple ./src/registrations.ts --moduleName Registrations --outputDir ./src/services/__generated/
```

When you are done, run the PileUple code-generator and provide the required parameters:
* The first argument (`./src/registrations.ts`) is the path to your registrations file
* The **moduleName** (`Registrations`) required option is the registration-class name
* The **outputDir** (`./src/services/__generated/`) required option is where to put the generated files

## 3) Verify the generated files
The code-generator then creates:
1. One Service Resolver class per service registration
2. One Type-file with service resolving symbol-types
3. And one file with IoC ServiceProvider, which handles Lifetime Scopes and service resolvings

>```
>src/
>├── services/
>│   ├── __generated/
>│   │    ├── consoleLoggerImplOfLoggerTransientServiceResolver.ts
>│   │    ├── debugApiServiceImplOfApiServiceSingletonServiceResolver.ts
>│   │    ├── index.ts
>│   │    └── types.generated.ts
>│   │
>│   ├── logger.ts
>│   ├── apiService.ts
>│   └── types.ts
>└── registrations.ts
>```

>**debugApiServiceImplOfApiServiceSingletonServiceResolver.ts** - Service Resolver for DebugApiServiceImpl-implementation of ApiService-interface
>```typescript
>// Auto-generated file
>import { ApiService as ApiService } from '../apiService';
>import { DebugApiServiceImpl as DebugApiServiceImpl } from '../apiService';
>
>import { TYPES as __SERVICE_TYPE_SYMBOLS } from './types.generated';
>import { TYPES } from '../types';
>import { SingletonServiceResolver, InstanceConstructor, ServiceResolver } from 'pileuple/api/serviceResolver';
>import { ServiceProvider } from 'pileuple/api/serviceProvider';
>
>class Resolver extends SingletonServiceResolver<ApiService> {
>    doResolve(serviceProvider: ServiceProvider): ApiService {
>        const ctor: InstanceConstructor<DebugApiServiceImpl> = DebugApiServiceImpl;
>        const ctorArgs: any[] = [];
>        ctorArgs.push(serviceProvider.resolveOne(__SERVICE_TYPE_SYMBOLS._srcserviceslogger.Logger));
>        return new ctor(...ctorArgs);
>    }
>}
>
>export function register(resolvers: Map<symbol, ServiceResolver[]>) {
>    const symbol = TYPES.ApiService;
>    let symbolResolvers = resolvers.get(symbol);
>    if (!symbolResolvers) {
>        symbolResolvers = [];
>        resolvers.set(symbol, symbolResolvers);
>    }
>
>    symbolResolvers.push(new Resolver());
>}
>```

>**index.ts** - the main file, which contains the IoC Service Provider:
>```typescript
>// Auto-generated file
>import { register as register1 } from './consoleLoggerImplOfLoggerTransientServiceResolver';
>import { register as register2 } from './debugApiServiceImplOfApiServiceSingletonServiceResolver';
>
>import { ServiceProvider, CompiledServiceProvider } from 'pileuple/api/serviceProvider';
>import { ServiceResolver } from 'pileuple/api/serviceResolver';
>
>const symbolResolvers = new Map<symbol, ServiceResolver[]>();
>
>register1(symbolResolvers);
>register2(symbolResolvers);
>export const serviceProvider: ServiceProvider = CompiledServiceProvider.initialize(symbolResolvers);
>```

## 4) Use in your code
Now, you are ready to use the IoC service provider:

```typescript
import { serviceProvider } from './services/__generated';
import { ApiService } from './services/apiService';
import { TYPES } from './services/__generated/types.generated';
const apiService = serviceProvider.resolveOne<ApiService>(TYPES.ApiService);
const response = apiService.post('/api/signIn', {username: "local", password: "h0$t"}, new Map<string, string>([["request-id","12321321"]]))
```