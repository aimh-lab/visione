# UserApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**deleteApiV2UserByUserId**](UserApi.md#deleteapiv2userbyuserid) | **DELETE** /api/v2/user/{userId} | Deletes the specified user. Requires ADMIN privileges |
| [**getApiV2Logout**](UserApi.md#getapiv2logout) | **GET** /api/v2/logout | Clears all user roles of the current session. |
| [**getApiV2User**](UserApi.md#getapiv2user) | **GET** /api/v2/user | Get information about the current user. |
| [**getApiV2UserByUserId**](UserApi.md#getapiv2userbyuserid) | **GET** /api/v2/user/{userId} | Gets details of the user with the given id. |
| [**getApiV2UserSession**](UserApi.md#getapiv2usersession) | **GET** /api/v2/user/session | Get current sessionId |
| [**patchApiV2UserByUserId**](UserApi.md#patchapiv2userbyuserid) | **PATCH** /api/v2/user/{userId} | Updates the specified user, if it exists. Anyone is allowed to update their data, however only ADMINs are allowed to update anyone. |
| [**postApiV2Login**](UserApi.md#postapiv2login) | **POST** /api/v2/login | Sets roles for session based on user account and returns a session cookie. |
| [**postApiV2User**](UserApi.md#postapiv2user) | **POST** /api/v2/user | Creates a new user, if the username is not already taken. Requires ADMIN privileges |



## deleteApiV2UserByUserId

> ApiUser deleteApiV2UserByUserId(userId)

Deletes the specified user. Requires ADMIN privileges

### Example

```ts
import {
  Configuration,
  UserApi,
} from '';
import type { DeleteApiV2UserByUserIdRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new UserApi();

  const body = {
    // string | User ID
    userId: userId_example,
  } satisfies DeleteApiV2UserByUserIdRequest;

  try {
    const data = await api.deleteApiV2UserByUserId(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **userId** | `string` | User ID | [Defaults to `undefined`] |

### Return type

[**ApiUser**](ApiUser.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | OK |  -  |
| **404** | If the user could not be found |  -  |
| **500** | Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getApiV2Logout

> SuccessStatus getApiV2Logout(session)

Clears all user roles of the current session.

### Example

```ts
import {
  Configuration,
  UserApi,
} from '';
import type { GetApiV2LogoutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new UserApi();

  const body = {
    // string | Session Token (optional)
    session: session_example,
  } satisfies GetApiV2LogoutRequest;

  try {
    const data = await api.getApiV2Logout(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **session** | `string` | Session Token | [Optional] [Defaults to `undefined`] |

### Return type

[**SuccessStatus**](SuccessStatus.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | OK |  -  |
| **400** | Bad Request |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getApiV2User

> ApiUser getApiV2User()

Get information about the current user.

### Example

```ts
import {
  Configuration,
  UserApi,
} from '';
import type { GetApiV2UserRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new UserApi();

  try {
    const data = await api.getApiV2User();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

[**ApiUser**](ApiUser.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | OK |  -  |
| **500** | Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getApiV2UserByUserId

> ApiUser getApiV2UserByUserId(userId)

Gets details of the user with the given id.

### Example

```ts
import {
  Configuration,
  UserApi,
} from '';
import type { GetApiV2UserByUserIdRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new UserApi();

  const body = {
    // string | User\'s UID
    userId: userId_example,
  } satisfies GetApiV2UserByUserIdRequest;

  try {
    const data = await api.getApiV2UserByUserId(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **userId** | `string` | User\&#39;s UID | [Defaults to `undefined`] |

### Return type

[**ApiUser**](ApiUser.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | OK |  -  |
| **404** | If the user could not be found. |  -  |
| **500** | Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getApiV2UserSession

> string getApiV2UserSession(session)

Get current sessionId

### Example

```ts
import {
  Configuration,
  UserApi,
} from '';
import type { GetApiV2UserSessionRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new UserApi();

  const body = {
    // string | Session Token (optional)
    session: session_example,
  } satisfies GetApiV2UserSessionRequest;

  try {
    const data = await api.getApiV2UserSession(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **session** | `string` | Session Token | [Optional] [Defaults to `undefined`] |

### Return type

**string**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `text/plain`, `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | OK |  -  |
| **500** | Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## patchApiV2UserByUserId

> ApiUser patchApiV2UserByUserId(userId, apiUserRequest)

Updates the specified user, if it exists. Anyone is allowed to update their data, however only ADMINs are allowed to update anyone.

### Example

```ts
import {
  Configuration,
  UserApi,
} from '';
import type { PatchApiV2UserByUserIdRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new UserApi();

  const body = {
    // string | User ID
    userId: userId_example,
    // ApiUserRequest (optional)
    apiUserRequest: ...,
  } satisfies PatchApiV2UserByUserIdRequest;

  try {
    const data = await api.patchApiV2UserByUserId(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **userId** | `string` | User ID | [Defaults to `undefined`] |
| **apiUserRequest** | [ApiUserRequest](ApiUserRequest.md) |  | [Optional] |

### Return type

[**ApiUser**](ApiUser.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | OK |  -  |
| **400** | Bad Request |  -  |
| **404** | Not Found |  -  |
| **500** | Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## postApiV2Login

> ApiUser postApiV2Login(loginRequest)

Sets roles for session based on user account and returns a session cookie.

### Example

```ts
import {
  Configuration,
  UserApi,
} from '';
import type { PostApiV2LoginRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new UserApi();

  const body = {
    // LoginRequest (optional)
    loginRequest: ...,
  } satisfies PostApiV2LoginRequest;

  try {
    const data = await api.postApiV2Login(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **loginRequest** | [LoginRequest](LoginRequest.md) |  | [Optional] |

### Return type

[**ApiUser**](ApiUser.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | OK |  -  |
| **400** | Bad Request |  -  |
| **401** | Unauthorized |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## postApiV2User

> ApiUser postApiV2User(apiUserRequest)

Creates a new user, if the username is not already taken. Requires ADMIN privileges

### Example

```ts
import {
  Configuration,
  UserApi,
} from '';
import type { PostApiV2UserRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new UserApi();

  const body = {
    // ApiUserRequest (optional)
    apiUserRequest: ...,
  } satisfies PostApiV2UserRequest;

  try {
    const data = await api.postApiV2User(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **apiUserRequest** | [ApiUserRequest](ApiUserRequest.md) |  | [Optional] |

### Return type

[**ApiUser**](ApiUser.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | OK |  -  |
| **400** | If the username is already taken |  -  |
| **500** | Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

