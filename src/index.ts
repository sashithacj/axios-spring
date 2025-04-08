/**
 * Initializes a customized Axios instance with token management (including refresh),
 * automatic authorization handling, and response handling for 401 errors.
 *
 * @param {InitializeOptions} options - Configuration options for the API setup.
 * @param {string} options.baseUrl - The base URL of the API that the Axios instance will communicate with.
 * @param {string} options.refreshEndpoint - The endpoint URL used to refresh the access token.
 * @param {number} [options.tokenExpiryBufferSeconds=30] - A buffer period in seconds before the access token expires to trigger automatic refresh. Defaults to 30 seconds.
 * @param {boolean} [options.reactOn401Responses=true] - Whether to automatically react to HTTP 401 responses by attempting to refresh the token and retrying the request. Defaults to true.
 * @param {string} [options.storageAccessTokenKey='@axios-spring-access-token'] - The storage key to store the access token (defaults to '@axios-spring-access-token').
 * @param {string} [options.storageRefreshTokenKey='@axios-spring-refresh-token'] - The storage key to store the refresh token (defaults to '@axios-spring-refresh-token').
 *
 * @returns {AxiosSpringInstance} - A customized Axios instance that supports token management and automatic 401 error handling. This instance has additional methods:
 *   - `setAuthTokens`: Set access and refresh tokens.
 *   - `deleteAuthTokens`: Remove access and refresh tokens.
 *   - `isAuthenticated`: Check if the user is authenticated by verifying the access token.
 *
 * @example
 * const api = initializeApiInstance({
 *   baseUrl: 'https://api.example.com',
 *   refreshEndpoint: '/auth/refresh-token',
 * });
 *
 * api.get('/secure-data')
 *   .then(response => console.log(response.data))
 *   .catch(error => console.error(error));
 *
 * await api.setAuthTokens('newAccessToken', 'newRefreshToken');
 * const decodedToken = await api.isAuthenticated();
 * await api.deleteAuthTokens();
 */
export { initializeApiInstance } from './api';
