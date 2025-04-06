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
import { initializeApiInstance } from 'axios-spring';

// Create the instance
export const API = initializeApiInstance({
  baseUrl: 'https://your-api.com/v1/',
  refreshEndpoint: 'auth/refresh',
  tokenExpiryBufferSeconds: 30, // optional, default is 30
  reactOn401Responses: true, // optional, default is true
});
```

## Making Requests

```typescript
// Import the instance from where you have created
import { API } from '/app.tsx';

// Example GET request
const response = await API.get('/users');

// Example POST request
const createResponse = await API.post('/users', { name: 'John Doe' });
```

## Configuration Options

| Parameter                  | Type    | Required | Default | Description                                       |
| -------------------------- | ------- | -------- | ------- | ------------------------------------------------- |
| `baseUrl`                  | string  | Yes      | -       | The base URL for your API                         |
| `refreshEndpoint`          | string  | Yes      | -       | The endpoint path for refreshing tokens           |
| `tokenExpiryBufferSeconds` | number  | No       | 30      | Seconds before expiration to refresh token        |
| `reactOn401Responses`      | boolean | No       | true    | Whether to attempt token refresh on 401 responses |

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

1. Designed to work seamlessly with Spring Boot JWT authentication
2. The package assumes your tokens are JWT format for expiration checking
3. The token refresh queue ensures no duplicate refresh requests are made
4. You must manage token storage in your application code
5. Compatible with both browser and React Native environments

## Acknowledgements

Special thanks to:

- The [Axios team](https://github.com/axios/axios) for the excellent HTTP client
- The team behind [`@react-native-async-storage/async-storage`](https://github.com/react-native-async-storage/async-storage) for providing secure, persistent storage in React Native
- All contributors and users
