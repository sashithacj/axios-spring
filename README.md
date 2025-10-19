# axios-spring

A smart Axios wrapper with automatic JWT refresh flow built for React Native and React (Next.js-friendly) 🌱

## Features

- Automatic JWT token refresh before expiration
- Request queuing during token refresh
- Configurable token expiry buffer
- 401 response handling with automatic retry
- Refresh failure callback for custom error handling
- **Always-on enterprise-grade AES-GCM encryption**
- **HMAC integrity verification for tamper detection**
- **Secure key derivation using PBKDF2**
- **Automatic memory cleanup and token expiry**
- **Cross-platform secure storage (React/React Native)**
- Customizable access token attachment
- Customizable refresh token attachment
- Customizable tokens extraction
- TypeScript support

## How this works

This package wraps an Axios instance with automatic JWT authentication and token refreshing logic. When you make a request, it checks if the access token is valid (with a configurable buffer window). If the token is expired, it will automatically attempt to refresh it using the provided refresh token and endpoint. You can also plug in custom logic to attach tokens to requests, extract new tokens from responses, and define exactly how requests should behave during refresh cycles. All tokens are securely stored and reused across requests without you needing to manage them manually.

The package is designed to work seamlessly in both web and React Native environments. It detects the runtime and automatically selects the appropriate storage backend: for web apps, it uses localStorage; for React Native, it uses @react-native-async-storage/async-storage. This makes the package ideal for cross-platform projects, giving you the same developer experience with secure token handling and refresh logic regardless of the platform.

## Secure Storage Configuration (secureStorage)

`axios-spring` implements **always-on enterprise-grade security** to protect your JWT tokens. All tokens are automatically encrypted using AES-GCM encryption with HMAC integrity verification - **secure storage is configured automatically with secure defaults even if you don't provide any configuration!**

### Security Features

- **Always-On AES-GCM Encryption**: Industry-standard encryption for all token storage
- **HMAC Integrity Verification**: Detects tampering attempts automatically
- **PBKDF2 Key Derivation**: Secure key generation with 100,000 iterations
- **Memory-First Storage**: Tokens stored in memory with encrypted persistent backup
- **Automatic Cleanup**: Expired tokens are automatically removed
- **Cross-Platform Support**: Works securely on both React and React Native
- **Zero Configuration**: Secure storage is configured automatically with secure defaults
- **Random Key Generation**: Cryptographically secure random keys generated automatically

### Automatic Secure Storage (No Configuration Required)

```typescript
import { initializeApiInstance } from 'axios-spring';

// Secure storage is automatically configured with secure defaults!
const API = initializeApiInstance({
  baseUrl: 'https://your-api.com/v1/',
  refreshEndpoint: 'auth/refresh',
  // No secureStorage config needed - defaults are applied automatically
});

export default API;
```

### Custom Secure Storage Configuration (Optional)

```typescript
import { initializeApiInstance } from 'axios-spring';

const API = initializeApiInstance({
  baseUrl: 'https://your-api.com/v1/',
  refreshEndpoint: 'auth/refresh',
  secureStorage: {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours (default: 24 hours)
    autoCleanup: true, // Auto-cleanup expired tokens (default: true)
    encryptionKey: 'your-secret-encryption-key', // Custom key (optional)
    keyDerivationSalt: 'your-unique-salt', // Custom salt (optional)
  },
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
    maxAge: 12 * 60 * 60 * 1000, // 12 hours
    autoCleanup: true,
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
2. **Use Strong Encryption Keys**: Generate cryptographically secure keys for custom configurations
3. **Unique Salt Values**: Use unique salt values for each application
4. **Regular Key Rotation**: Consider rotating encryption keys periodically
5. **Monitor for Tampering**: The library automatically detects tampering attempts
6. **Secure Key Storage**: Store encryption keys securely (environment variables, secure vaults)
7. **Web Crypto API Required**: Ensure your environment supports Web Crypto API for encryption

### Browser Compatibility

| Browser | Version | Web Crypto API | Encryption Support | Status |
|---------|---------|----------------|-------------------|---------|
| Chrome | 37+ | ✅ | ✅ | Fully Supported |
| Firefox | 34+ | ✅ | ✅ | Fully Supported |
| Safari | 7+ | ✅ | ✅ | Fully Supported |
| Edge | 12+ | ✅ | ✅ | Fully Supported |
| Internet Explorer | 11 | ❌ | ❌ | Not Supported |
| Opera | 24+ | ✅ | ✅ | Fully Supported |

### React Native Compatibility

| React Native Version | Web Crypto API | Encryption Support | AsyncStorage | Status |
|---------------------|----------------|-------------------|--------------|---------|
| 0.60+ | ✅ | ✅ | ✅ | Fully Supported |
| 0.59 | ✅ | ✅ | ✅ | Fully Supported |
| 0.58 | ✅ | ✅ | ✅ | Fully Supported |
| 0.57 | ✅ | ✅ | ✅ | Fully Supported |
| < 0.57 | ❌ | ❌ | ✅ | Limited Support* |

*Limited Support: Encryption will not work, but basic token storage will function with AsyncStorage.

### Node.js Compatibility

| Node.js Version | Web Crypto API | Encryption Support | Status |
|----------------|----------------|-------------------|---------|
| 16+ | ✅ | ✅ | Fully Supported |
| 15+ | ✅ | ✅ | Fully Supported |
| 14+ | ✅ | ✅ | Fully Supported |
| 13+ | ✅ | ✅ | Fully Supported |
| 12+ | ✅ | ✅ | Fully Supported |
| < 12 | ❌ | ❌ | Not Supported |

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
| `secureStorage`               | SecureStorageConfig                                                        | No       | -                                                              | Configuration for secure token storage with encryption, integrity verification, and automatic cleanup.                                                          |
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

1. Designed to work seamlessly with JWT authentication
2. The package assumes your tokens are JWT format for expiration checking
3. The token refresh queue ensures no duplicate refresh requests are made
4. You must manage token storage in your application code
5. Compatible with both browser and React Native environments

## Acknowledgements

Special thanks to:

- The [Axios team](https://github.com/axios/axios) for the excellent HTTP client
- The team behind [`@react-native-async-storage/async-storage`](https://github.com/react-native-async-storage/async-storage) for providing secure, persistent storage in React Native
- The [JSON Web Token (jsonwebtoken)](https://github.com/auth0/node-jsonwebtoken) project for enabling secure and compact token-based authentication
- All contributors and users for their continuous support and feedback
