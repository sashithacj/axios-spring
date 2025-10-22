# axios-spring

A smart Axios wrapper with automatic JWT refresh flow built for React Native and React (Next.js-friendly) 🌱

## Features

- **Automatic JWT token refresh** before expiration
- **Request queuing** during token refresh to prevent duplicate requests
- **Configurable token expiry buffer** for proactive refresh timing
- **401 response handling** with automatic retry after token refresh
- **Refresh failure callback** for custom error handling and user redirection
- **Enterprise-grade security** with AES-GCM encryption and HMAC integrity verification
- **Secure key derivation** using PBKDF2 with 100,000 iterations
- **JWT-based token expiry** management
- **Cross-platform storage** (localStorage for React, AsyncStorage for React Native)
- **Customizable token handling** (attachment, extraction, and refresh logic)
- **TypeScript support** with comprehensive type definitions
- **Universal compatibility** with automatic polyfill support for all environments

## How this works

This package wraps an Axios instance with automatic JWT authentication and token refreshing logic. When you make a request, it checks if the access token is valid (with a configurable buffer window). If the token is expired, it will automatically attempt to refresh it using the provided refresh token and endpoint. You can also plug in custom logic to attach tokens to requests, extract new tokens from responses, and define exactly how requests should behave during refresh cycles. All tokens are securely stored and reused across requests without you needing to manage them manually.

The package is designed to work seamlessly in both web and React Native environments. It detects the runtime and automatically selects the appropriate storage backend: for web apps, it uses localStorage; for React Native, it uses @react-native-async-storage/async-storage. This makes the package ideal for cross-platform projects, giving you the same developer experience with secure token handling and refresh logic regardless of the platform.

## Secure Storage Configuration (secureStorage)

`axios-spring` implements **always-on enterprise-grade security** to protect your JWT tokens. All tokens are automatically encrypted using AES-GCM encryption with HMAC integrity verification - **secure storage is configured automatically**

### Security Features

- **Always-On AES-GCM Encryption**: Industry-standard encryption for all token storage
- **HMAC Integrity Verification**: Detects tampering attempts automatically
- **PBKDF2 Key Derivation**: Secure key generation with 100,000 iterations
- **Platform-Optimized Storage**: React uses localStorage, React Native uses AsyncStorage
- **Memory + Persistent Storage**: Dual-layer storage for security and persistence
- **JWT-Based Expiry**: Tokens respect their actual JWT expiration times
- **Cross-Platform Support**: Works securely on all browsers, React Native versions, and Node.js
- **Zero Configuration**: Secure storage is configured automatically with secure defaults
- **Random Key Generation**: Cryptographically secure random keys generated automatically

### Automatic Secure Storage (No Configuration Required)

```typescript
import { initializeApiInstance } from 'axios-spring';

const API = initializeApiInstance({
  baseUrl: 'https://your-api.com/v1/',
  refreshEndpoint: 'auth/refresh',
});

export default API;
```

### Advanced Security Configuration

```typescript
import { initializeApiInstance } from 'axios-spring';

const API = initializeApiInstance({
  baseUrl: 'https://your-api.com/v1/',
  refreshEndpoint: 'auth/refresh',
  secureStorage: {
    encryptionKey: 'your-secret-encryption-key', // Custom encryption key
    keyDerivationSalt: 'your-unique-salt', // Custom salt for key derivation
  },
  onRefreshFailure: (error) => {
    // Handle refresh failures securely
    console.error('Token refresh failed:', error);
    // Clear sensitive data and redirect
  },
});

export default API;
```

### Security Best Practices

1. **Automatic Encryption**: All tokens are encrypted by default - no configuration needed
2. **JWT-Based Expiration**: Tokens respect their actual expiration times, not arbitrary storage limits
3. **Platform-Optimized Persistence**: React uses localStorage, React Native uses AsyncStorage
4. **Use Strong Encryption Keys**: Generate cryptographically secure keys for custom configurations
5. **Unique Salt Values**: Use unique salt values for each application
6. **Regular Key Rotation**: Consider rotating encryption keys periodically
7. **Monitor for Tampering**: The library automatically detects tampering attempts
8. **Secure Key Storage**: Store encryption keys securely (environment variables, secure vaults)
9. **Universal Compatibility**: The package works on all platforms with automatic polyfill support

### Browser Compatibility

| Browser           | Web Crypto API | Encryption Support | Status          |
| ----------------- | -------------- | ------------------ | --------------- |
| Chrome            | ✅             | ✅                 | Fully Supported |
| Firefox           | ✅             | ✅                 | Fully Supported |
| Safari            | ✅             | ✅                 | Fully Supported |
| Edge              | ✅             | ✅                 | Fully Supported |
| Internet Explorer | ✅ (Polyfill)  | ✅                 | Fully Supported |
| Opera             | ✅             | ✅                 | Fully Supported |

_All browsers: Uses automatic polyfill for Web Crypto API support when needed_

### Server-Side Rendering (SSR) Support

`axios-spring` is designed to work seamlessly in both client and server environments:

- **Next.js App Router**: Fully supported with automatic environment detection
- **Next.js Pages Router**: Supported with automatic polyfills
- **Node.js**: Supported with automatic polyfill detection
- **Vite/Webpack**: Automatic polyfill detection and fallbacks

### React Native Compatibility

| React Native | Web Crypto API | Encryption Support | AsyncStorage | Status          |
| ------------ | -------------- | ------------------ | ------------ | --------------- |
| All Versions | ✅             | ✅                 | ✅           | Fully Supported |

_All React Native versions: Uses automatic polyfill for Web Crypto API support when needed_

## Installation

```bash
npm install axios-spring
# or
yarn add axios-spring
```

## Basic Setup

```typescript
// utils/api.ts
import { initializeApiInstance } from 'axios-spring';

// Create the instance
const API = initializeApiInstance({
  baseUrl: 'https://your-api.com/v1/',
  refreshEndpoint: 'auth/refresh',
  tokenExpiryBufferSeconds: 30, // optional, default is 30
  reactOn401Responses: true, // optional, default is true
  onRefreshFailure: (error) => {
    // Handle refresh failure (e.g., redirect to login)
    console.error('Token refresh failed:', error);
    window.location.href = '/login';
  },
});

export default API;
```

## Making Requests

```typescript
// Import the instance from where you have created
import API from '@/utils/api';

// Login and store tokens
const login = async (email: string, password: string) => {
  const response = await API.post('/auth/login', { email, password });
  const { accessToken, refreshToken } = response.data;
  await API.setAuthTokens(accessToken, refreshToken);
  console.log('Login successful, tokens stored.');
};

// Checks whether user has a valid access token
const checkAuthentication = async () => {
  const jwtPayload = await API.isAuthenticated();
  if (jwtPayload) {
    console.log('User is authenticated:', jwtPayload); // Log the JWT payload
  } else {
    console.log('User is not authenticated');
  }
};

// Make an authenticated request
const getProfile = async () => {
  const response = await API.get('/users/me');
  console.log(response.data);
};

// Logout and remove stored tokens
const logout = async () => {
  await API.deleteAuthTokens();
  console.log('Logged out and tokens removed');
};
```

## Configuration Options

| Parameter                     | Type                                                                       | Required | Default                                                        | Description                                                                                                                                                    |
| ----------------------------- | -------------------------------------------------------------------------- | -------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `baseUrl`                     | string                                                                     | Yes      | -                                                              | The base URL of the API that the Axios instance will communicate with.                                                                                         |
| `refreshEndpoint`             | string                                                                     | Yes      | -                                                              | The endpoint path used to refresh the access token.                                                                                                            |
| `tokenExpiryBufferSeconds`    | number                                                                     | No       | 30                                                             | A buffer period in seconds before the access token expires to trigger automatic refresh.                                                                       |
| `reactOn401Responses`         | boolean                                                                    | No       | true                                                           | Whether to automatically react to HTTP 401 responses by attempting to refresh the token and retrying the request.                                              |
| `storageAccessTokenKey`       | string                                                                     | No       | @axios-spring-access-token                                     | Storage key using to save the access token. This would be useful if you are managing multiple sessions.                                                        |
| `storageRefreshTokenKey`      | string                                                                     | No       | @axios-spring-refresh-token                                    | Storage key using to save the refresh token. This would be useful if you are managing multiple sessions.                                                       |
| `onRefreshFailure`            | (error: unknown) => void                                                   | No       | -                                                              | Callback function called when token refresh fails. Useful for redirecting users to login page or handling authentication errors.                               |
| `secureStorage`               | SecureStorageConfig                                                        | No       | -                                                              | Configuration for secure token storage with encryption, integrity verification, and automatic cleanup.                                                         |
| `attachAccessTokenToRequest`  | (config: AxiosRequestConfig, token: string) => AxiosRequestConfig          | No       | Adds `Authorization: Bearer <token>` header by default         | Custom function to attach the access token to the AxiosSpring requests. Useful if you need to attach it differently (e.g., in custom headers or query params). |
| `attachRefreshTokenToRequest` | (config: AxiosRequestConfig, token: string) => AxiosRequestConfig          | No       | Sets `{ data: { refreshToken } }`                              | Custom function to attach the refresh token to the token refresh request. Useful if your backend expects the refresh token in a different format or location.  |
| `extractTokensFromResponse`   | (response: AxiosResponse) => { accessToken: string, refreshToken: string } | No       | Extracts `accessToken` and `refreshToken` from `response.data` | Function to extract tokens from the refresh endpoint response. Customize if your backend returns token data in a different structure.                          |

## Custom Access Token Attachment (attachAccessTokenToRequest)

By default, `axios-spring` adds the access token to the `Authorization` header using the `Bearer` scheme. However, if your backend expects the token in a different location (e.g., custom headers, query parameters), you can provide your own function.

```typescript
import { initializeApiInstance, AxiosRequestConfig } from 'axios-spring';

const API = initializeApiInstance({
  baseUrl: 'https://your-api.com/v1/',
  refreshEndpoint: 'auth/refresh',
  attachAccessTokenToRequest: (config: AxiosRequestConfig, token: string): AxiosRequestConfig => {
    config.headers = {
      ...config.headers,
      'x-auth-token': token, // Attach token to a custom header
    };
    return config;
  },
});

export default API;
```

## Custom Refresh Token Attachment (attachRefreshTokenToRequest)

By default, `axios-spring` sends the refresh token to the token refresh endpoint in the `POST` request body as:

```json
{
  "refreshToken": "stored-refresh-token"
}
```

If your backend refresh endpoint expects the refresh token differently (e.g., as a query parameter or custom header), you can customize it using `attachRefreshTokenToRequest`.

```typescript
import { initializeApiInstance, AxiosRequestConfig } from 'axios-spring';

const API = initializeApiInstance({
  baseUrl: 'https://your-api.com/v1/',
  refreshEndpoint: 'auth/refresh-token',
  attachRefreshTokenToRequest: (config: AxiosRequestConfig, token: string): AxiosRequestConfig => {
    return {
      ...config,
      method: 'GET', // you can change request method, POST by default
      params: { token }, // you can send token as a query parameter
      headers: {
        ...config.headers,
        'x-refresh-token': token, // Also you can send as a custom header
      },
    };
  },
});

export default API;
```

## Custom Tokens Extraction (extractTokensFromResponse)

By default, `axios-spring` expects the token refresh endpoint to return a response body like:

```json
{
  "accessToken": "new-access-token",
  "refreshToken": "new-refresh-token"
}
```

You can override this behavior if your backend wraps the token data in a different structure. You can even extract them from response headers and return.

```typescript
import { initializeApiInstance, AxiosResponse } from 'axios-spring';

const API = initializeApiInstance({
  baseUrl: 'https://your-api.com/v1/',
  refreshEndpoint: 'auth/token/refresh',
  extractTokensFromResponse: (response: AxiosResponse) => {
    return {
      accessToken: response.data?.tokens?.access,
      refreshToken: response.data?.tokens?.refresh,
    };
  },
});

export default API;
```

## Refresh Failure Handling (onRefreshFailure)

When token refresh fails (due to expired refresh token, network errors, or server issues), you can provide a callback function to handle the failure gracefully. This is particularly useful for redirecting users to the login page or clearing stored data.

```typescript
import { initializeApiInstance } from 'axios-spring';

const API = initializeApiInstance({
  baseUrl: 'https://your-api.com/v1/',
  refreshEndpoint: 'auth/refresh',
  onRefreshFailure: (error) => {
    // Clear any stored user data
    // In React: localStorage.removeItem('userData');
    // In React Native: AsyncStorage.removeItem('userData');

    // Redirect to login page
    // In React: window.location.href = '/login';
    // In React Native: NavigationService.navigate('Login');

    // Or show a notification
    console.error('Session expired. Please log in again.');
  },
});

export default API;
```

The callback receives the error object that caused the refresh to fail, allowing you to implement custom error handling based on the specific failure reason.

### React Example

```typescript
import { initializeApiInstance } from 'axios-spring';

const API = initializeApiInstance({
  baseUrl: 'https://your-api.com/v1/',
  refreshEndpoint: 'auth/refresh',
  onRefreshFailure: (error) => {
    // Clear stored data
    localStorage.removeItem('userData');
    localStorage.removeItem('preferences');

    // Redirect to login
    window.location.href = '/login';

    // Show notification
    alert('Session expired. Please log in again.');
  },
});

export default API;
```

### React Native Example

```typescript
import { initializeApiInstance } from 'axios-spring';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationService } from './NavigationService'; // Your navigation service

const API = initializeApiInstance({
  baseUrl: 'https://your-api.com/v1/',
  refreshEndpoint: 'auth/refresh',
  onRefreshFailure: async (error) => {
    // Clear stored data
    await AsyncStorage.multiRemove(['userData', 'preferences']);

    // Navigate to login screen
    NavigationService.navigate('Login');

    // Show notification
    Alert.alert('Session Expired', 'Please log in again.');
  },
});

export default API;
```

## Notes

1. **JWT Authentication**: Designed to work seamlessly with JWT authentication
2. **Token Format**: The package assumes your tokens are JWT format for expiration checking
3. **Request Queuing**: The token refresh queue ensures no duplicate refresh requests are made
4. **Token Management**: You must manage token storage in your application code using the provided methods
5. **Cross-Platform**: Works on all browsers, React Native versions, and Node.js environments
6. **Automatic Detection**: Runtime detection ensures seamless cross-platform compatibility
7. **Security First**: Always-on encryption with enterprise-grade security features
8. **Zero Configuration**: No additional setup required - works out of the box

## Compatibility & Polyfills

The package automatically includes polyfills for environments that don't support modern APIs:

- **Web Crypto API**: For cryptographic operations (Internet Explorer, older browsers)
- **TextEncoder/TextDecoder**: For string encoding/decoding (Internet Explorer, older browsers)
- **Buffer**: For Node.js Buffer compatibility in browsers

Polyfills are loaded automatically only when needed, with no additional configuration required.

## Acknowledgements

Special thanks to:

- The [Axios team](https://github.com/axios/axios) for the excellent HTTP client
- The team behind [`@react-native-async-storage/async-storage`](https://github.com/react-native-async-storage/async-storage) for providing secure, persistent storage in React Native
- The [JSON Web Token (jsonwebtoken)](https://github.com/auth0/node-jsonwebtoken) project for enabling secure and compact token-based authentication
- The [`@peculiar/webcrypto`](https://github.com/PeculiarVentures/webcrypto) team for providing comprehensive Web Crypto API polyfills
- The [`fast-text-encoding`](https://github.com/samthor/fast-text-encoding) project for efficient TextEncoder/TextDecoder polyfills
- The [`buffer`](https://github.com/feross/buffer) project for Node.js Buffer compatibility in browsers
- All contributors and users for their continuous support and feedback
