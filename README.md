# axios-spring

A smart Axios wrapper with automatic JWT refresh flow built for React Native and React (Next.js-friendly) 🌱

## Features

- Automatic JWT token refresh before expiration
- Request queuing during token refresh
- Configurable token expiry buffer
- 401 response handling with automatic retry
- TypeScript support

## How this works

This package automatically selects the right storage based on your environment:

- React (Web): Uses localStorage in the browser.
- React Native: Uses [`@react-native-async-storage/async-storage`](https://www.npmjs.com/package/@react-native-async-storage/async-storage) for secure, persistent storage.

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

| Parameter                  | Type    | Required | Default                     | Description                                                                                                       |
| -------------------------- | ------- | -------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `baseUrl`                  | string  | Yes      | -                           | The base URL of the API that the Axios instance will communicate with.                                            |
| `refreshEndpoint`          | string  | Yes      | -                           | The endpoint path used to refresh the access token.                                                               |
| `tokenExpiryBufferSeconds` | number  | No       | 30                          | A buffer period in seconds before the access token expires to trigger automatic refresh.                          |
| `reactOn401Responses`      | boolean | No       | true                        | Whether to automatically react to HTTP 401 responses by attempting to refresh the token and retrying the request. |
| `storageAccessTokenKey`    | string  | No       | @axios-spring-access-token  | Storage key using to save the access token. This would be useful if you are managing multiple sessions.           |
| `storageRefreshTokenKey`   | string  | No       | @axios-spring-refresh-token | Storage key using to save the refresh token. This would be useful if you are managing multiple sessions.          |

## Refresh Token Endpoint Requirements

Your backend refresh endpoint should:

1. Accept a POST request with body:

```json
{
  "refreshToken": "current-refresh-token"
}
```

2. Return a response with:

```json
{
  "accessToken": "new-access-token",
  "refreshToken": "new-refresh-token"
}
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
