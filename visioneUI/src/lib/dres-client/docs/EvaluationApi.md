# EvaluationApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**getApiV2EvaluationByEvaluationIdInfo**](EvaluationApi.md#getapiv2evaluationbyevaluationidinfo) | **GET** /api/v2/evaluation/{evaluationId}/info | Returns basic information about a specific evaluation. |
| [**getApiV2EvaluationByEvaluationIdState**](EvaluationApi.md#getapiv2evaluationbyevaluationidstate) | **GET** /api/v2/evaluation/{evaluationId}/state | Returns the state of a specific evaluation. |
| [**getApiV2EvaluationInfoList**](EvaluationApi.md#getapiv2evaluationinfolist) | **GET** /api/v2/evaluation/info/list | Lists an overview of all evaluations visible to the current user. |
| [**getApiV2EvaluationStateList**](EvaluationApi.md#getapiv2evaluationstatelist) | **GET** /api/v2/evaluation/state/list | Lists an overview of all evaluation visible to the current user. |



## getApiV2EvaluationByEvaluationIdInfo

> ApiEvaluationInfo getApiV2EvaluationByEvaluationIdInfo(evaluationId)

Returns basic information about a specific evaluation.

### Example

```ts
import {
  Configuration,
  EvaluationApi,
} from '';
import type { GetApiV2EvaluationByEvaluationIdInfoRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new EvaluationApi();

  const body = {
    // string | The evaluation ID.
    evaluationId: evaluationId_example,
  } satisfies GetApiV2EvaluationByEvaluationIdInfoRequest;

  try {
    const data = await api.getApiV2EvaluationByEvaluationIdInfo(body);
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
| **evaluationId** | `string` | The evaluation ID. | [Defaults to `undefined`] |

### Return type

[**ApiEvaluationInfo**](ApiEvaluationInfo.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | OK |  -  |
| **401** | Unauthorized |  -  |
| **403** | Forbidden |  -  |
| **404** | Not Found |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getApiV2EvaluationByEvaluationIdState

> ApiEvaluationState getApiV2EvaluationByEvaluationIdState(evaluationId)

Returns the state of a specific evaluation.

### Example

```ts
import {
  Configuration,
  EvaluationApi,
} from '';
import type { GetApiV2EvaluationByEvaluationIdStateRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new EvaluationApi();

  const body = {
    // string | The evaluation ID.
    evaluationId: evaluationId_example,
  } satisfies GetApiV2EvaluationByEvaluationIdStateRequest;

  try {
    const data = await api.getApiV2EvaluationByEvaluationIdState(body);
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
| **evaluationId** | `string` | The evaluation ID. | [Defaults to `undefined`] |

### Return type

[**ApiEvaluationState**](ApiEvaluationState.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | OK |  -  |
| **401** | Unauthorized |  -  |
| **403** | Forbidden |  -  |
| **404** | Not Found |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getApiV2EvaluationInfoList

> Array&lt;ApiEvaluationInfo&gt; getApiV2EvaluationInfoList()

Lists an overview of all evaluations visible to the current user.

### Example

```ts
import {
  Configuration,
  EvaluationApi,
} from '';
import type { GetApiV2EvaluationInfoListRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new EvaluationApi();

  try {
    const data = await api.getApiV2EvaluationInfoList();
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

[**Array&lt;ApiEvaluationInfo&gt;**](ApiEvaluationInfo.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | OK |  -  |
| **401** | Unauthorized |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getApiV2EvaluationStateList

> Array&lt;ApiEvaluationState&gt; getApiV2EvaluationStateList()

Lists an overview of all evaluation visible to the current user.

### Example

```ts
import {
  Configuration,
  EvaluationApi,
} from '';
import type { GetApiV2EvaluationStateListRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new EvaluationApi();

  try {
    const data = await api.getApiV2EvaluationStateList();
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

[**Array&lt;ApiEvaluationState&gt;**](ApiEvaluationState.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | OK |  -  |
| **401** | Unauthorized |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

