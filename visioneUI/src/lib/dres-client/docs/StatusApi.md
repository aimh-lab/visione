# StatusApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**getApiV2StatusTime**](StatusApi.md#getapiv2statustime) | **GET** /api/v2/status/time | Returns the current time on the server. |



## getApiV2StatusTime

> CurrentTime getApiV2StatusTime()

Returns the current time on the server.

### Example

```ts
import {
  Configuration,
  StatusApi,
} from '';
import type { GetApiV2StatusTimeRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new StatusApi();

  try {
    const data = await api.getApiV2StatusTime();
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

[**CurrentTime**](CurrentTime.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | OK |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

